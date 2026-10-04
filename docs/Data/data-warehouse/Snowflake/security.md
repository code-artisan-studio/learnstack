---
title: Snowflake Security
sidebar_label: Snowflake Security
sidebar_position: 5
---

---

## 1. Overview

Think of a bank vault building:

- **The street gate:** the network. Only allowed IP addresses or private links get in.
- **The ID badge:** authentication. SSO, MFA or a key pair proves who you are.
- **The keys on your keyring:** RBAC. Which rooms and drawers your role can open.
- **Frosted glass over certain fields:** masking. You can open the drawer but see `XXX-XX-1234`.
- **Folders filtered to your branch:** row access. You only see your own region's customers.
- **CCTV:** auditing. Who looked at what, and when.

Snowflake's security matters because many teams share the same data. Masking and row access let **one governed table serve many audiences** instead of keeping a separate copy per audience, and every extra copy is another place data can leak from.

## 2. The layered model

```
 ┌───────────────────────────────────────────────────────────────┐
 │ 1. NETWORK     Network policies/rules (IP allow/deny),         │
 │                Private Link (Business Critical)                │
 ├───────────────────────────────────────────────────────────────┤
 │ 2. IDENTITY    SSO (SAML 2.0 via Entra ID/Okta), OAuth          │
 │                (Snowflake / External OAuth), key-pair, MFA,     │
 │                SCIM user provisioning, auth/session/password    │
 │                policies, user TYPE = PERSON | SERVICE           │
 ├───────────────────────────────────────────────────────────────┤
 │ 3. AUTHORIZATION  RBAC + ownership (DAC), database roles,      │
 │                   future grants, managed-access schemas         │
 ├───────────────────────────────────────────────────────────────┤
 │ 4. DATA        Row access policies → Masking policies,          │
 │    PROTECTION  tag-based masking, external tokenization,        │
 │                secure views/UDFs, projection & aggregation      │
 │                policies †, encryption (AES-256, TLS 1.2+,       │
 │                Tri-Secret Secure w/ customer-managed key)       │
 ├───────────────────────────────────────────────────────────────┤
 │ 5. MONITOR     LOGIN_HISTORY, QUERY_HISTORY, ACCESS_HISTORY,    │
 │                GRANTS_TO_ROLES/USERS, POLICY_REFERENCES,        │
 │                data classification, Trust Center †              │
 └───────────────────────────────────────────────────────────────┘
```

**Encryption basics:**

- All data is encrypted at rest with AES-256 in a hierarchy of keys that Snowflake rotates automatically. Enterprise edition adds periodic re-encryption ("rekeying").
- **Tri-Secret Secure** (Business Critical) combines Snowflake's key with **your** key held in Azure Key Vault, AWS KMS or Google Cloud KMS. Revoking your key makes the data unreadable.
- All connections use TLS.

**Identity trend:** Snowflake is phasing out password-only sign-ins in favor of MFA, key-pair, OAuth and workload identity †. Use `TYPE = SERVICE` users with key-pair or OAuth for applications.

---

## 3. RBAC (role-based access control)

### Definition

In Snowflake:

- **Privileges** (`SELECT`, `USAGE`, `CREATE TABLE`, `OPERATE` and so on) are granted on **securable objects** to **roles**.
- **Roles are granted to users**, or to other roles.
- Every object also has exactly one **owner role**, which has full control, including granting access to others. This ownership model is called **DAC** (discretionary access control), and it works alongside RBAC.
- **A user never holds privileges directly.** Privileges always come through a role.

### Key terms

| Term                          | Meaning                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **System roles**              | `ORGADMIN` (organization level) • `ACCOUNTADMIN` (top of the account; includes SYSADMIN + SECURITYADMIN) • `SECURITYADMIN` (can manage any grant) • `USERADMIN` (creates users and roles) • `SYSADMIN` (creates warehouses and databases) • `PUBLIC` (every user has it) |
| **Role hierarchy**            | Granting role A to role B means B **inherits** all of A's privileges. Privileges flow _upward_.                                                                                                                                                                          |
| **Primary / secondary roles** | The primary role (`USE ROLE`) owns any object you create. With `USE SECONDARY ROLES ALL`, queries are authorized using the **combined** privileges of all your roles.                                                                                                    |
| **Database roles**            | Roles scoped to one database. They can be shared and are well suited to "access roles".                                                                                                                                                                                  |
| **Future grants**             | `GRANT SELECT ON FUTURE TABLES IN SCHEMA ...` covers tables that don't exist yet.                                                                                                                                                                                        |
| **Managed-access schema**     | Only the schema owner, or a role with `MANAGE GRANTS`, can grant on its objects. Individual table owners can't hand out access themselves.                                                                                                                               |

### How it works: checking a privilege

```
User ──(SSO login)──► session { primary role: CLAIMS_ANALYST, secondary: ALL }
SELECT * FROM claims.core.claim
   │
   ▼ Cloud Services authorization
   For the effective role set (primary + secondary + all inherited roles):
     USAGE on DATABASE claims?  USAGE on SCHEMA core?  SELECT on TABLE claim?
     USAGE on the WAREHOUSE in use?
   all yes → plan the query → apply row access policy → apply masking → execute
   any no  → "Object does not exist or not authorized"
```

The error message is deliberately the same whether an object is missing or you lack access, so attackers can't use it to discover which objects exist.

### Recommended pattern: access roles vs functional roles

```
 Users (from Entra ID via SCIM)
   │ granted
   ▼
 Functional roles (job-based):  CLAIMS_ANALYST   FRAUD_DS   BI_READER   CLAIMS_ENG
   │ granted                      │                │           │           │
   ▼                              ▼                ▼           ▼           ▼
 Access roles (object-based, often DATABASE ROLES):
   CLAIMS.CORE_RO    CLAIMS.CORE_RW    CLAIMS.MART_RO    WH_BI_USAGE   WH_ETL_USAGE
   │
   ▼ privileges (incl. FUTURE grants) on schemas / tables / warehouses
 All custom role trees roll up to SYSADMIN (so admins can manage objects)
```

**Rules of thumb:**

- Very few people hold `ACCOUNTADMIN`, all with MFA, and it's never anyone's default role.
- Separate the ability to _manage security_ (USERADMIN / SECURITYADMIN or a custom governance role) from the ability to _own data_.
- Manage users and group membership in Entra ID and sync them with **SCIM**. Don't create users by hand in Snowflake.
- Use managed-access schemas plus future grants so new tables are governed automatically.
- Use service users (`TYPE = SERVICE`, key-pair or OAuth) with narrow roles for applications, dbt and ETL.

---

## 4. Dynamic data masking (column-level security)

### Definition

A **masking policy** is a schema-level object holding a SQL expression that Snowflake applies **at query time** to a column. Depending on the caller's context (role, account and so on), it returns either the real value or a masked one. The **stored data never changes**; only what the query returns differs.

```sql
CREATE MASKING POLICY gov.policies.mask_ssn AS (val STRING) RETURNS STRING ->
  CASE
    WHEN IS_ROLE_IN_SESSION('PII_FULL')    THEN val
    WHEN IS_ROLE_IN_SESSION('PII_PARTIAL') THEN 'XXX-XX-' || RIGHT(val, 4)
    ELSE '***MASKED***'
  END;

ALTER TABLE claims.core.claimant MODIFY COLUMN ssn SET MASKING POLICY gov.policies.mask_ssn;
```

### Variants

- **Conditional masking:** the policy also takes other columns as inputs, e.g. `AS (email STRING, consent BOOLEAN)` with `USING (email, marketing_consent)`.
- **Tag-based masking:** attach the policy to a **tag** (`ALTER TAG pii_type SET MASKING POLICY ...`), and every column with that tag is masked automatically, **one policy per data type per tag**. This scales governance to thousands of columns, especially combined with automatic **data classification**, which finds and tags PII.
- **External tokenization:** the policy calls an external function (e.g. a tokenization vendor) to detokenize data for authorized roles. Useful when stored data must already be tokenized, e.g. PAN (card numbers) for PCI.
- **Pseudonymization for joins:** return `SHA2(val)` instead of a constant, so unauthorized users can still join and count distinct values without seeing them.

### How it works internally

- At compile time, Cloud Services rewrites every reference to a protected column into `policy_expr(column)`. This happens **wherever the column appears**: in the `SELECT` list, `WHERE`, `JOIN`, `GROUP BY` and in views built on the table.
- The **return type must match** the input type. Masking a `NUMBER` column with a string isn't allowed; use `NULL` or a sentinel number instead.
- Policies follow the column everywhere: views, secure views, clones (the policy reference is kept) and shares. Consumers of shared data see whatever the policy decides for their context.
- **No role bypasses it automatically**, including `ACCOUNTADMIN` and the table owner, unless the policy logic allows that role.
- **Centralized governance:** grant `APPLY MASKING POLICY` (account level) to a dedicated governance role, so table owners can't remove policies.
- Context functions:
  - `IS_ROLE_IN_SESSION()` considers the role hierarchy and secondary roles. It's the recommended choice.
  - `CURRENT_ROLE()` returns only the primary role's name, so it's brittle.
  - `INVOKER_ROLE()` returns the role executing in the current context (e.g. a view owner).
  - `IS_DATABASE_ROLE_IN_SESSION()` checks database roles.
- Listing: `POLICY_REFERENCES()` shows where each policy is applied.

### Watch out for

- **Masked join keys:** if you mask `customer_id` and an unauthorized role joins on it, it joins on masked values and returns wrong or empty results. Use deterministic hashes, or don't mask join keys.
- **Performance:** a policy with a subquery against a large mapping table runs for every row. Use simple role checks, memoizable functions or small mapping tables.
- **Inference attacks:** masking doesn't stop someone running `WHERE ssn LIKE '123%'`... except that the predicate also sees the masked value, so it fails safely. Aggregates can still reveal information, though. Consider **aggregation and projection policies** † for that.

---

## 5. Row access policies (row-level security)

### Definition

A **row access policy** (RAP) is a schema-level object with a Boolean expression. Snowflake evaluates it for every row at query time; rows where it returns `FALSE` are invisible to that caller, as if they didn't exist.

```sql
-- Entitlement mapping: which role may see which state
CREATE TABLE gov.security.state_entitlements (role_name STRING, state STRING);

CREATE ROW ACCESS POLICY gov.policies.rap_by_state AS (row_state STRING) RETURNS BOOLEAN ->
     IS_ROLE_IN_SESSION('CLAIMS_ALL_STATES')
  OR EXISTS (SELECT 1 FROM gov.security.state_entitlements e
             WHERE IS_ROLE_IN_SESSION(e.role_name) AND e.state = row_state);

ALTER TABLE claims.core.claim ADD ROW ACCESS POLICY gov.policies.rap_by_state ON (state);
```

### How it works internally

```
SELECT claim_id, ssn, paid_amt FROM claim WHERE loss_date >= '2026-01-01'
   │ compile (Cloud Services)
   ▼
 1. RBAC check (SELECT on claim)
 2. Row access policy  → adds  AND rap_by_state(state)  as a filter
 3. Masking policies   → wraps ssn  as mask_ssn(ssn)
 4. Optimize & execute on warehouse
```

- **Order:** the **row access policy is applied before masking**.
- **One RAP per table or view,** but the policy can take several columns.
- **A column can't be in both a RAP's input list and a masking policy's input list.** Plan your column choices accordingly.
- **Mapping tables:** the lookup runs with the **policy owner's** privileges, so callers don't need access to the entitlement table.
- **Testing:** `EXECUTE USING POLICY_CONTEXT(CURRENT_ROLE => 'CLAIMS_ANALYST_WI') AS SELECT ...` simulates what a role would see without switching to it.
- **Everywhere:** RAPs also apply to views, clones and shares, like masking.

### Watch out for

- **Pruning:** a RAP adds a filter, which can be a join to the mapping table, to every query. Keep the mapping table small, filter on columns that line up with clustering, and consider memoizable functions.
- **Fail closed:** roles not in the mapping see **zero rows** with **no error**. That's safe, but confusing for support teams.
- **Aggregates:** a RAP filters rows _before_ aggregation, so totals differ by role. Make that clear to business users and dashboard owners.

---

## 6. When to use each control

| Control                             | Use when                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RBAC (always)**                   | Every account. It's the foundation, and masking and RAPs build on top of it.                                                                               |
| **Masking policies**                | Columns containing PII, PCI, PHI or confidential data (SSN, PAN, DOB, email, salary) that some roles need in full, others partially, and others not at all |
| **Tag-based masking**               | Many tables and columns. Governance teams classify and tag; policies follow the tags.                                                                      |
| **Row access policies**             | Multi-tenant or entitlement-based visibility: by region, branch, line of business, legal entity, client, or data-residency rules                           |
| **Secure views**                    | Hiding view logic, exposing curated subsets in shares, or when you can't use Enterprise edition                                                            |
| **Network policies / Private Link** | Always restrict network access; Private Link for regulated production                                                                                      |

## 7. When not to use them, or when to use something else

- **Masking as a substitute for not storing data:** if a team never needs a field, don't load it. Minimizing data beats masking it.
- **Masking for PCI scope reduction:** usually you need **tokenization** (external or upstream), not just masking, because masked data is still stored in clear text.
- **Very complex entitlement logic** (hundreds of attributes, real-time HR lookups) evaluated in a RAP on huge fact tables: pre-compute entitlements, or publish secure, filtered marts instead.
- **Standard edition:** use secure views plus RBAC; masking and RAPs aren't available.
- **Application-level end users** (thousands of customers through your app): enforce access in the app or API layer and give the app one service role. Snowflake roles don't map 1:1 to app users. Alternatively pass a context value, but check the patterns supported.

## 8. Benefits

- **One copy, many audiences:** no per-team copies of data, so fewer leak paths and less storage.
- **Central and consistent:** policies apply in every tool (BI, notebooks, JDBC/.NET, shares) because they're enforced in the engine.
- **Separation of duties:** governance roles own the policies; data owners can't remove them.
- **Auditable:** `ACCESS_HISTORY` records which columns were read and by whom; `POLICY_REFERENCES` shows where policies apply.
- **Scales with tags and classification:** new PII columns are protected when tagged.

## 9. Trade-offs, risks and misconceptions

- **Complexity:** roles multiply quickly. Without naming standards and automation (Terraform or schemachange), RBAC turns into an unmanageable mess.
- **Performance:** complex policy bodies and mapping-table subqueries add cost to every query and can reduce pruning. Test with Query Profile.
- **Operational opacity:** "I see zero rows" or "I see `***`" issues need policy-aware support runbooks and `POLICY_CONTEXT` testing.
- **Risky shortcuts:** granting `ACCOUNTADMIN` to unblock someone; `PUBLIC` having grants; ownership of production objects held by personal roles; unrestricted network policy.
- **Misconception:** "ACCOUNTADMIN sees everything." Not through masking or row access policies, unless the policy allows it. Admins can still change policies, though, so audit policy changes (DDL in `QUERY_HISTORY` and `ACCESS_HISTORY`).
- **Misconception:** "Masking encrypts data." It doesn't. Data is already encrypted at rest for everyone; masking only changes what a query returns.
- **Misconception:** "`CURRENT_ROLE()` is enough." It ignores role inheritance and secondary roles. Use `IS_ROLE_IN_SESSION()`.
- **Compliance:** these controls _support_ PCI DSS, HIPAA, GLBA, SOX and similar programs, but don't make you compliant by themselves. Check Snowflake's current attestations and your own control mapping.

## 10. Real-world examples

**Banking: branch- and region-based access to customer data**

- **Problem:** relationship managers should see only their region's customers. AML investigators need full SSN and account details. Marketing analysts may see trends, but no direct identifiers.
- **How the controls are applied:**
  - **RBAC:** functional roles `RM_<REGION>`, `AML_INVESTIGATOR` and `MKT_ANALYST`, with users synced from Entra ID groups via SCIM.
  - **RAP** on `customer` and `account` by `region`, using an entitlement table.
  - **Tag-based masking:** columns tagged `pii=ssn` show the full value for `AML_INVESTIGATOR`, last 4 digits for RMs, a hash for marketing (so marketing can still count distinct customers).
  - **Auditing:** `ACCESS_HISTORY` gives evidence for internal audit of who read SSNs.

**Insurance: claims PHI and licensed adjusters by state**

- **Problem:** claim notes and medical details are PHI (protected health information). Adjusters are licensed by state. Fraud data scientists need claim patterns without identities.
- **How the controls are applied:**
  - **RAP** on `claim` by `state` for adjusters.
  - **Masking:** `diagnosis_code` and `claimant_dob` are masked except for `CLAIMS_MEDICAL_REVIEW`. The fraud team gets `SHA2(claimant_id)` so they can link claims to the same claimant without identity.
  - **Account:** Business Critical edition with Private Link from Azure and Tri-Secret Secure using a key in Azure Key Vault, for HIPAA-regulated data.

**Finance: asset manager with multiple funds or clients**

- **Problem:** one platform holds positions for several funds and institutional clients. Portfolio managers must see only their funds, and client reporting must not cross clients. Information barriers (Chinese walls) apply between research and trading.
- **How the controls are applied:**
  - **RAP** on positions and trades by `fund_id`, using a fund-entitlement table maintained from the entitlement system.
  - **Separate RBAC trees** for research and trading, with no shared functional roles.
  - **Secure Data Sharing** to clients through secure views that apply the RAP using the client's account (`CURRENT_ACCOUNT()`), so each client sees only its own holdings.

## 11. Practical example: an insurer's security baseline

_Illustrative sketch; not production-ready. Adapt the naming, and automate with Terraform or schemachange._

```sql
-- 0. Network & identity guardrails
CREATE NETWORK RULE corp_egress MODE = INGRESS TYPE = IPV4 VALUE_LIST = ('203.0.113.0/24');
CREATE NETWORK POLICY corp_only ALLOWED_NETWORK_RULE_LIST = ('corp_egress');
ALTER ACCOUNT SET NETWORK_POLICY = corp_only;
CREATE USER svc_claims_api TYPE = SERVICE DEFAULT_ROLE = CLAIMS_API
  RSA_PUBLIC_KEY = '<public key>';                    -- no password

-- 1. Access roles (database roles) + future grants
USE ROLE SYSADMIN;
CREATE DATABASE ROLE claims.core_ro;
GRANT USAGE ON SCHEMA claims.core TO DATABASE ROLE claims.core_ro;
GRANT SELECT ON ALL TABLES    IN SCHEMA claims.core TO DATABASE ROLE claims.core_ro;
GRANT SELECT ON FUTURE TABLES IN SCHEMA claims.core TO DATABASE ROLE claims.core_ro;
ALTER SCHEMA claims.core ENABLE MANAGED ACCESS;

-- 2. Functional roles → access roles → SYSADMIN
USE ROLE USERADMIN;
CREATE ROLE claims_adjuster_wi;  CREATE ROLE claims_medical_review;  CREATE ROLE fraud_ds;
USE ROLE SECURITYADMIN;
GRANT DATABASE ROLE claims.core_ro TO ROLE claims_adjuster_wi;
GRANT DATABASE ROLE claims.core_ro TO ROLE claims_medical_review;
GRANT DATABASE ROLE claims.core_ro TO ROLE fraud_ds;
GRANT USAGE ON WAREHOUSE bi_wh TO ROLE claims_adjuster_wi;
GRANT ROLE claims_adjuster_wi TO ROLE SYSADMIN;   -- keep the tree rooted
-- (users/group membership arrive via Entra ID SCIM)

-- 3. Central governance role
CREATE ROLE governance_admin;
GRANT APPLY MASKING POLICY, APPLY ROW ACCESS POLICY, APPLY TAG ON ACCOUNT TO ROLE governance_admin;

-- 4. Tag-based masking
USE ROLE governance_admin;
CREATE TAG gov.tags.pii ALLOWED_VALUES 'ssn','dob','email','medical';
CREATE MASKING POLICY gov.policies.mask_pii_string AS (val STRING) RETURNS STRING ->
  CASE
    WHEN IS_ROLE_IN_SESSION('CLAIMS_MEDICAL_REVIEW') THEN val
    WHEN SYSTEM$GET_TAG_ON_CURRENT_COLUMN('gov.tags.pii') = 'ssn'
         AND IS_ROLE_IN_SESSION('CLAIMS_ADJUSTER_WI') THEN 'XXX-XX-' || RIGHT(val,4)
    WHEN IS_ROLE_IN_SESSION('FRAUD_DS') THEN SHA2(val)      -- joinable pseudonym
    ELSE '***'
  END;
ALTER TAG gov.tags.pii SET MASKING POLICY gov.policies.mask_pii_string;
ALTER TABLE claims.core.claimant MODIFY COLUMN ssn       SET TAG gov.tags.pii = 'ssn';
ALTER TABLE claims.core.claimant MODIFY COLUMN diagnosis SET TAG gov.tags.pii = 'medical';

-- 5. Row access by state (rap_by_state from section 5)
ALTER TABLE claims.core.claim ADD ROW ACCESS POLICY gov.policies.rap_by_state ON (state);
INSERT INTO gov.security.state_entitlements VALUES ('CLAIMS_ADJUSTER_WI','WI');

-- 6. Verify
EXECUTE USING POLICY_CONTEXT(CURRENT_ROLE => 'CLAIMS_ADJUSTER_WI')
  AS SELECT state, COUNT(*) FROM claims.core.claim GROUP BY 1;
SELECT * FROM TABLE(INFORMATION_SCHEMA.POLICY_REFERENCES(
  REF_ENTITY_NAME => 'claims.core.claimant', REF_ENTITY_DOMAIN => 'table'));
```

**.NET side:** connect with the `Snowflake.Data` driver using key-pair authentication or External OAuth with Entra ID. Store the private key in Azure Key Vault, and set the role explicitly in the connection string.

## 12. Interview answer: the 2-minute version

> "I treat Snowflake security as layers.
>
> **Network:** network policies or rules to restrict IPs, and Private Link on Business Critical for regulated production.
>
> **Identity:** SSO through Entra ID or Okta, users and groups provisioned by SCIM, MFA for people, and key-pair or OAuth for service users, with no passwords.
>
> **Authorization is RBAC:** privileges go to roles, roles go to users, roles inherit upward, and every object has an owner role. I design **access roles**, usually database roles holding object privileges with future grants, under **functional roles** that map to job functions, all rolling up to SYSADMIN. ACCOUNTADMIN is restricted, I use managed-access schemas, and RBAC is managed as code.
>
> For fine-grained control on Enterprise edition, **dynamic data masking** applies a policy expression to a column at query time based on context like `IS_ROLE_IN_SESSION`. Stored data is unchanged, the policy follows the column through views, clones and shares, and even ACCOUNTADMIN is masked unless the policy allows it. I scale it with **tag-based masking** plus classification, and use deterministic hashes where analysts need to join.
>
> **Row access policies** add a Boolean filter per row, usually driven by an entitlement mapping table, for things like region, state, fund or client. They're evaluated **before** masking, there's one per table, and the same column can't be in both a row and a masking policy signature.
>
> Finally, governance roles hold `APPLY` privileges so data owners can't remove policies, and I audit with `ACCESS_HISTORY`, `LOGIN_HISTORY` and `POLICY_REFERENCES`. The main trade-offs are policy performance on large tables, operational clarity when users see '\*\*\*' or zero rows, and remembering that masking isn't tokenization for PCI scope."

## 13. Hands-on exercise and troubleshooting

**Setup:** an Enterprise trial and `ACCOUNTADMIN` for setup only.

1. Create roles `R_FULL`, `R_PARTIAL` and `R_WI`, and grant all three to yourself.
2. Create a table `cust(id, name, ssn, state)` with 6 rows across WI, IL and MN.
3. Create the masking policy `mask_ssn` (full / last 4 / `***`) and apply it to `ssn`.
4. Create an entitlements table and the policy `rap_by_state`, with `R_WI` → WI and `R_FULL` → all states, and attach it to `state`.
5. Test as each role: `USE ROLE R_WI; USE SECONDARY ROLES NONE; SELECT * FROM cust;`. Repeat using `POLICY_CONTEXT`.
6. Clone the table and select from the clone as `R_WI`.
7. Query `SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY` the next day for reads of `ssn`.

**Expected outcomes:**

- `R_WI` sees only WI rows, with the SSN fully masked (unless the policy grants it the last-4 view).
- `R_FULL` sees all rows with full SSNs.
- The clone behaves exactly the same, because the policies carry over.

**Troubleshooting:**

- **An authorized user still sees `\***`.** The policy probably uses `CURRENT_ROLE() = 'R_PARTIAL'`, but the user's primary role is a functional role that *inherits* `R_PARTIAL`. Switch to `IS_ROLE_IN_SESSION('R_PARTIAL')`, and check that `USE SECONDARY ROLES` is set as you expect.
- **Everyone, including the owner, sees zero rows.**
  - The RAP returns FALSE for roles not in the mapping. That's working as designed (fail closed).
  - Also check the mapping table's name, data types and case: `'wi'` ≠ `'WI'`, and role names are stored in uppercase.
  - Test with `POLICY_CONTEXT`.
- **A join returns nothing for analysts.** They're joining on a masked column. Expose a hashed key instead, or don't mask join keys.

## 14. Alternatives and comparison

| Need                           | Option A                                         | Option B                                                            | How to choose                                                                                                                               |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Column protection              | Masking policy                                   | Secure view that hides or transforms the column                     | Policies follow the column everywhere and are centrally governed. Views need a separate copy per audience. Standard edition only has views. |
| Massive numbers of PII columns | Tag-based masking + classification               | Per-column policies                                                 | Tag-based scales; per-column suits a few exceptional columns                                                                                |
| PCI or tokenized storage       | External tokenization (detokenize in the policy) | Upstream tokenization; Snowflake stores only tokens                 | Scope reduction usually favors keeping clear-text PAN out of Snowflake entirely                                                             |
| Row visibility                 | Row access policy                                | Secure view with a `WHERE` clause per audience, or separate marts   | RAP keeps one object; marts suit very complex or precomputed entitlements                                                                   |
| Access model                   | RBAC (roles)                                     | ABAC (attribute-based) using tags + policy logic                    | Use both: RBAC for objects, attribute and tag logic inside policies                                                                         |
| Cross-platform governance      | Snowflake Horizon (native)                       | Microsoft Purview, Collibra, Immuta, Unity Catalog (for Databricks) | Native is simplest. External catalogs help when governance spans many platforms; check how they integrate.                                  |

## 15. Summary

- Security is layered: **network → identity → RBAC → data policies → monitoring**, with encryption everywhere.
- **RBAC:** privileges go to roles, roles go to users, roles inherit upward, and there's one owner per object. Use access roles under functional roles, future grants, managed access, SCIM, and minimal ACCOUNTADMIN.
- **Dynamic data masking:** applies at query time and follows the column everywhere. Write policies with `IS_ROLE_IN_SESSION`, scale them with tags, use hashes for joinable pseudonyms, and remember it isn't tokenization.
- **Row access policies:** a Boolean filter per row, evaluated before masking, one per table, usually driven by entitlement mapping tables. They fail closed.
- Govern centrally (`APPLY` privileges), test with `POLICY_CONTEXT`, audit with `ACCESS_HISTORY`, and watch policy performance.

## 16. Knowledge check

1. **Explain:** an ACCOUNTADMIN runs `SELECT ssn FROM claimant` and sees `***`. Is that a bug?
2. **Apply:** you must restrict claims by state _and_ mask the SSN. A developer puts `state` in the RAP and also writes a conditional masking policy that takes `state` as an extra input. What happens, and how do you redesign?
3. **Decide:** a PCI assessor asks whether masking the PAN column in Snowflake takes the platform out of PCI scope. What do you answer?

**Answers**

1. No. Policies apply to every role, including ACCOUNTADMIN, unless the policy logic allows that role. ACCOUNTADMIN _could_ change the policy, which is why policy changes should be restricted to a governance role and audited.
2. A column can't be in both a row access policy signature and a masking policy signature, so the second assignment fails. Redesign: make the masking decision from role or tag context alone (e.g. `IS_ROLE_IN_SESSION`), or base the RAP on a different column such as `jurisdiction_id`, keeping `state` only for the masking policy.
3. Almost certainly not. Masking only changes query output; clear-text PAN is still stored and processed, so the platform stays in scope. To reduce scope, tokenize PAN upstream (or use external tokenization) so Snowflake stores only tokens. Confirm the details with your QSA (Qualified Security Assessor), because this is a compliance judgment.
