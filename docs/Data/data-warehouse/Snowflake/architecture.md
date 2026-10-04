---
title: Snowflake Architecture
sidebar_label: Snowflake Architecture
sidebar_position: 1
---

---

## 1. Overview

Older data warehouses such as Teradata and on-prem Netezza bundled storage and compute together. To get more CPU you also bought more disk, and every team competed for the same cluster. Snowflake splits the system into three parts:

- **Storage:** a single shared copy of the data, kept on cheap, highly durable cloud object storage.
- **Compute:** any number of separate compute clusters, called _virtual warehouses_, that you start, stop and resize in seconds.
- **Services:** an always-on control layer that handles security, query planning, metadata and transactions.

**Why it matters:** the finance team's month-end close doesn't slow down the data science team's model training. Both read the same data on separate compute, and each pays only for the time its compute runs.

## 2. Definition and key terms

Snowflake is a fully managed, cloud-native SaaS data platform built on a **multi-cluster, shared-data** architecture. It runs on AWS, Azure and GCP.

| Term                        | Meaning                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Micro-partition**         | An immutable, compressed storage unit holding roughly 50–500 MB of uncompressed data. Inside it, data is stored column by column. It's the basic unit of storage and of pruning. |
| **Pruning**                 | Skipping micro-partitions that can't match a query's filter. Snowflake decides this from per-partition metadata such as each column's min/max values.                            |
| **Virtual warehouse**       | A named compute cluster that runs queries in parallel across its nodes. Size runs from XS to 6XL, and each size up doubles the nodes and the credits per hour.                   |
| **Multi-cluster warehouse** | One warehouse that adds identical clusters automatically when queries start queuing. Requires Enterprise edition or higher.                                                      |
| **Credit**                  | Snowflake's billing unit for compute.                                                                                                                                            |
| **Cloud Services**          | The control layer: authentication, access control, optimizer, metadata, transactions and infrastructure management.                                                              |
| **Time Travel / Fail-safe** | Time Travel lets you query or restore earlier versions of data. Fail-safe is a further 7-day recovery period that only Snowflake can use.                                        |
| **Zero-copy clone**         | A new table, schema or database that points at existing micro-partitions. Creating it copies only metadata.                                                                      |

**How Snowflake differs from similar systems:**

- **Shared-nothing MPP** (Massively Parallel Processing, e.g. Redshift before RA3 nodes): each node owns its own slice of the data on its own disk.
- **Shared-disk** systems: every node reads the same storage, but there's typically one cluster.
- **Snowflake** combines the two. The data is shared, as in shared-disk. Each warehouse processes it in parallel with local caching, as in shared-nothing. You can run many warehouses at once.

## 3. How it works: the life of a query

```
 Client (Snowsight / JDBC / ODBC / .NET driver / Python connector)
   │  HTTPS + TLS
   ▼
 ┌──────────── CLOUD SERVICES ────────────┐
 │ 1. Authenticate (SSO / OAuth / key-pair)│
 │ 2. Authorize (RBAC: role → grants)      │
 │ 3. Result cache hit? ──yes──► return    │──► (no warehouse needed)
 │ 4. Parse → optimize → prune using       │
 │    partition metadata                   │
 │ 5. Ensure warehouse running (resume)    │
 └───────────────┬─────────────────────────┘
                 ▼ plan + list of micro-partitions to read
 ┌──────────── VIRTUAL WAREHOUSE ─────────┐
 │ 6. Nodes scan assigned partitions       │
 │    - local SSD cache hit? read locally  │
 │    - else fetch from object storage     │
 │ 7. Vectorized columnar execution, joins,│
 │    aggregates; spill to local disk,     │
 │    then remote, if memory runs out      │
 └───────────────┬─────────────────────────┘
                 ▼
 ┌──────────── STORAGE (S3 / Blob / GCS) ─┐
 │ Immutable micro-partitions + metadata   │
 └─────────────────────────────────────────┘
 8. Result → Cloud Services → cached 24h → client
```

**Lifecycle of a warehouse:** it starts suspended, then resumes when a query arrives (auto-resume) or on a manual command. While it runs, you're billed per second, with a 60-second minimum each time it resumes. After the configured idle time it auto-suspends. Suspending a warehouse empties its local SSD cache.

**Lifecycle of data on a write:** Snowflake never updates a micro-partition in place. An `UPDATE` or `DELETE` writes new micro-partitions, and the metadata layer switches the table to point at the new set. The old partitions are kept for the Time Travel period, then move into Fail-safe, then are deleted. This immutability is the mechanism behind Time Travel, cloning and transaction isolation.

**Concurrency:** each warehouse runs a limited number of queries at once (`MAX_CONCURRENCY_LEVEL`, default 8, with the real limit also depending on how heavy each query is). Extra queries queue. A multi-cluster warehouse clears the queue by adding clusters (scaling out); a bigger size makes each individual query faster (scaling up).

## 4. Internal architecture: behind the scenes

These points are based on the 2016 SIGMOD paper _"The Snowflake Elastic Data Warehouse"_ and on Snowflake's public documentation. Snowflake doesn't publish every internal detail, so treat implementation specifics as subject to change.

**Storage layer**

- When data is loaded, Snowflake splits it into micro-partitions in its own internal file format. Within each partition the data is stored column by column, and each column is compressed separately.
- For every micro-partition and column, the metadata layer records the min/max values, the number of distinct values and the null count. Pruning relies entirely on this metadata. There are no traditional indexes.
- **Clustering:** data is clustered in the order it was loaded. If you filter on a column that doesn't match the load order (say `customer_id` on a table loaded by date), the min/max ranges overlap and pruning stops working. A **clustering key** plus **Automatic Clustering** (a serverless background service) reorganizes the partitions to fix that.
- Storage is encrypted at rest with AES-256 in a hierarchy of keys that rotate. Business Critical edition adds Tri-Secret Secure, which combines Snowflake's key with a key you manage (customer-managed key).

**Compute layer**

- Each warehouse is a group of cloud VMs, which Snowflake draws from pre-warmed pools so it can resume in seconds.
- The execution engine works on columns rather than rows, processes data in batches (vectorized), and pushes data from one operator to the next (push-based).
- **Local SSD cache:** each node caches the micro-partitions it has already read. Repeated scans by the same warehouse are much faster. Suspending the warehouse loses this cache.
- **Spilling:** if a query runs out of memory, it writes intermediate data to local disk, and then to remote storage. Remote spilling is a major performance problem.
- **Special warehouse types:** _Snowpark-optimized_ warehouses have more memory per node, for Python/Java ML jobs and user-defined functions (UDFs).

**Cloud Services layer**

- It's multi-tenant and spread across availability zones. The paper describes a transactional key-value store (FoundationDB) holding the metadata catalog.
- It handles query compilation and optimization, access-control checks, transactions (ACID with snapshot isolation, made possible by immutable partitions), and the result cache.
- **Billing:** Cloud Services usage is charged only for the part that goes above 10% of that day's warehouse compute. Large numbers of tiny metadata-heavy queries can push you over that line.

**Serverless features:** these run on compute that Snowflake manages, so you don't size a warehouse for them. They include Snowpipe, Automatic Clustering, materialized view refresh, the Search Optimization Service, serverless tasks and replication. Each is billed separately, and it's easy to forget about them.

**Newer additions (check current availability on your cloud and region):**

- _Hybrid tables_ (Unistore): row-based storage for lightweight OLTP-style workloads.
- _Apache Iceberg tables_: data in an open table format, in storage you own.
- A newer generation of standard warehouses with faster hardware.

These extend the core architecture but don't change it.

## 5. When to use it

- An enterprise analytics warehouse where many teams run mixed workloads (BI, ELT, data science) that need to be kept apart.
- Load that swings a lot, such as month-end or quarter-end peaks, where pay-per-second compute that scales out saves money.
- Governed data sharing with partners, subsidiaries or regulators without copying files around.
- Teams that want SQL-first analytics with little infrastructure to run: no index tuning, no vacuuming, no cluster management.
- Regulated environments that need RBAC, masking policies, audit history (`ACCESS_HISTORY`), and private connectivity (PrivateLink).

## 6. When not to use it

- **High-throughput OLTP:** payment authorization or policy administration systems doing thousands of single-row writes per second with millisecond latency. Use Azure SQL, PostgreSQL or Cosmos DB, and send the data to Snowflake through CDC (Change Data Capture). Hybrid tables cover only light OLTP needs.
- **Very low-latency serving:** responses in single-digit milliseconds to an app. Use a cache or an operational store instead.
- **Small data on a tight budget:** a few GB of data can run on PostgreSQL or DuckDB for far less money.
- **Heavy unstructured data or custom ML training:** a Spark or Databricks lakehouse is often a more natural fit. Snowpark and Cortex are closing this gap.
- **Strict open-format or no-lock-in requirements:** Snowflake's native tables use a proprietary format. Iceberg tables help, with some trade-offs.

## 7. Benefits

- **Workload isolation:** no "noisy neighbor" problem between teams, because each has its own warehouse.
- **Elasticity:** resize a warehouse or add clusters in seconds, and suspend when idle so you aren't paying for idle compute.
- **Almost no administration:** no indexes, partition maintenance, vacuuming or software upgrades to manage.
- **Cloning and Time Travel:** test environments from production in seconds, and a quick fix for "someone ran a DELETE without a WHERE clause."
- **Secure data sharing:** live access to data with no ETL and no copies, and the consumer pays for their own compute.
- **Multi-cloud and cross-region replication:** supports disaster recovery and data-residency strategies.

## 8. Trade-offs, risks and misconceptions

| Concern           | What to know                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cost**          | Costs grow with usage. Common causes of overspend: warehouses that never suspend, oversized warehouses, BI tools sending a query every minute (keeping a warehouse awake), and forgotten serverless features. **Resource monitors** and per-team warehouses for chargeback are essential. |
| **Performance**   | Most performance problems come from poor pruning (bad clustering or functions on filter columns) or from spilling. A bigger warehouse fixes spilling but **not** poor pruning.                                                                                                            |
| **Concurrency**   | Queuing is solved by scaling out (multi-cluster), not by a bigger size. People often mix these up.                                                                                                                                                                                        |
| **Lock-in**       | Native storage is proprietary, and the SQL dialect and Snowpark APIs are Snowflake-specific.                                                                                                                                                                                              |
| **Reliability**   | Data is highly durable on cloud object storage, and services run across multiple availability zones. A full regional outage still requires cross-region replication and failover, which Business Critical edition supports.                                                               |
| **Security**      | Strong building blocks are provided, but you must design the role hierarchy, network policies, masking and row-access policies yourself. A poorly designed role hierarchy is the most common problem.                                                                                     |
| **Observability** | Use `ACCOUNT_USAGE` views (`QUERY_HISTORY`, `WAREHOUSE_METERING_HISTORY`, `ACCESS_HISTORY`), the Query Profile, and alerts. These views can lag behind real time by up to roughly 45 minutes to 3 hours.                                                                                  |
| **Misconception** | "Snowflake has no partitioning." It has automatic micro-partitioning; what it doesn't have is user-managed partitions.                                                                                                                                                                    |
| **Misconception** | "A bigger warehouse is always faster." Small queries stop getting faster beyond a certain size, but the cost per hour keeps doubling.                                                                                                                                                     |
| **Misconception** | "Time Travel is a backup." It's short-term and tied to your account; it isn't a separate, independent backup.                                                                                                                                                                             |

## 9. Real-world examples

**Banking: AML transaction monitoring and regulatory reporting**

- **Problem:** AML (Anti-Money Laundering) analytics need billions of card and ACH transactions, alongside customer and KYC (Know Your Customer) data. Overnight AML scenario runs were competing with the BI team's daytime dashboards.
- **How Snowflake is applied:**
  - Core banking changes stream in through CDC (e.g. Kafka plus Snowpipe Streaming).
  - `AML_WH` (Large) runs the scenario SQL each night; `BI_WH` (multi-cluster) serves branch dashboards.
  - Masking policies hide PAN (card numbers) and SSNs from everyone except the AML investigator role.
  - `ACCESS_HISTORY` gives audit evidence of who read what.

**Insurance: unified claims and policy analytics**

- **Problem:** policy, claims and billing data sit in separate systems, and actuaries need consistent snapshots for reserving.
- **How Snowflake is applied:**
  - ELT pulls everything into a raw → conformed → mart structure.
  - At each quarter-end, actuaries take a **zero-copy clone** of the claims mart, giving a fixed, reproducible dataset for reserving models at no extra storage cost until data changes.
  - Data scientists score fraud models on a separate Snowpark warehouse.

**Finance (asset management): market data and vendor sharing**

- **Problem:** licensed market and reference data arrives as daily file drops that need fragile ETL.
- **How Snowflake is applied:**
  - The vendor shares the data live through **Secure Data Sharing** or the Marketplace.
  - Risk calculations (VaR, exposure) join positions to prices with no ingestion step.
  - The multi-cluster `RISK_WH` absorbs the 4 pm end-of-day spike, then scales back down.

## 10. Practical example: a mid-size insurer's setup

_This is an illustrative sketch, not production-ready. Review naming, grants and sizes against your own standards._

```sql
-- 1. Isolated compute per workload
CREATE WAREHOUSE etl_wh  WAREHOUSE_SIZE='MEDIUM' AUTO_SUSPEND=60  AUTO_RESUME=TRUE INITIALLY_SUSPENDED=TRUE;
CREATE WAREHOUSE bi_wh   WAREHOUSE_SIZE='SMALL'  AUTO_SUSPEND=300 AUTO_RESUME=TRUE
       MIN_CLUSTER_COUNT=1 MAX_CLUSTER_COUNT=4 SCALING_POLICY='STANDARD';   -- Enterprise+
CREATE WAREHOUSE ds_wh   WAREHOUSE_SIZE='LARGE'  WAREHOUSE_TYPE='SNOWPARK-OPTIMIZED' AUTO_SUSPEND=60;

-- 2. Cost guardrail
CREATE RESOURCE MONITOR bi_monthly WITH CREDIT_QUOTA=500
  TRIGGERS ON 80 PERCENT DO NOTIFY ON 100 PERCENT DO SUSPEND;
ALTER WAREHOUSE bi_wh SET RESOURCE_MONITOR = bi_monthly;

-- 3. Protect PII with a masking policy
CREATE MASKING POLICY mask_ssn AS (val STRING) RETURNS STRING ->
  CASE WHEN IS_ROLE_IN_SESSION('CLAIMS_INVESTIGATOR') THEN val ELSE 'XXX-XX-' || RIGHT(val,4) END;
ALTER TABLE claims.core.claimant MODIFY COLUMN ssn SET MASKING POLICY mask_ssn;

-- 4. Improve pruning on a large table frequently filtered by loss date
ALTER TABLE claims.core.claim CLUSTER BY (loss_date);

-- 5. Quarter-end frozen snapshot for actuaries (metadata-only)
CREATE DATABASE claims_q3_2026 CLONE claims;

-- 6. Undo an accidental delete with Time Travel
CREATE TABLE claims.core.claim_restored CLONE claims.core.claim
  AT (OFFSET => -60*30);   -- state 30 minutes ago
```

A .NET service connects through the `Snowflake.Data` ADO.NET driver, using key-pair authentication or OAuth via Entra ID (Azure's identity service). Keep secrets in Key Vault.

## 11. Interview answer: the 2-minute version

> "Snowflake is a cloud-native data platform built on a **multi-cluster, shared-data** architecture with three independently scalable layers.
>
> **Storage** sits on the cloud provider's object store. Data is automatically organized into immutable, compressed, columnar **micro-partitions**, and per-partition metadata such as column min/max values lets the engine **prune** partitions instead of using indexes. Immutability is what enables **Time Travel, zero-copy cloning and snapshot isolation**.
>
> **Compute** is made up of **virtual warehouses**, independent MPP clusters that all read the same data. That gives workload isolation: ETL, BI and data science each get their own warehouse. You **scale up** a warehouse's size for heavy queries and **scale out** with multi-cluster warehouses for concurrency, and they auto-suspend with per-second billing. Each warehouse caches data on local SSD.
>
> **Cloud Services** is the always-on control layer: authentication, RBAC, query optimization, metadata, transactions and a 24-hour result cache.
>
> The main trade-offs: it's excellent for elastic, governed, mixed analytics and data sharing, but it isn't an OLTP database. Costs need governance through resource monitors and auto-suspend. And performance depends on good pruning, because a bigger warehouse won't fix a full-table scan. In financial services I'd pair it with CDC from the operational systems, masking and row-access policies for PII, and per-domain warehouses for chargeback."

## 12. Hands-on exercise and troubleshooting

**Setup:** a free Snowflake trial account. The `SNOWFLAKE_SAMPLE_DATA` database is included.

1. Create an XS warehouse with `AUTO_SUSPEND=60`.
2. Run the query below twice:
   ```sql
   SELECT o_orderpriority, COUNT(*), SUM(o_totalprice)
   FROM snowflake_sample_data.tpch_sf100.orders
   WHERE o_orderdate BETWEEN '1995-01-01' AND '1995-03-31'
   GROUP BY 1;
   ```
3. Open the **Query Profile** for each run and compare _Partitions scanned_ with _Partitions total_.
4. Run `ALTER SESSION SET USE_CACHED_RESULT=FALSE;`, run the query again, and compare the _Percentage scanned from cache_ value.
5. Clone a small table, delete rows from the clone, and restore them with `AT (OFFSET => -300)`.

**Expected outcomes:**

- The second run in step 2 returns almost instantly from the result cache, with no warehouse time.
- Partitions scanned should be a small fraction of the total, showing that pruning on the date filter works.
- With the result cache off, the run in step 4 shows a high local-disk-cache percentage.

**Troubleshooting:**

- **Symptom: the query is slow and the Query Profile shows "Bytes spilled to remote storage."** Diagnosis: the warehouse doesn't have enough memory for the join or aggregation. Fix: size up one step, or reduce the data earlier (filter before joining, select fewer columns).
- **Symptom: partitions scanned is about equal to the total.** Diagnosis: the filter can't prune. Common causes are a function applied to the filter column (`WHERE YEAR(o_orderdate)=1995`), a type mismatch, or data not clustered on that column. Fix: rewrite the filter as a range on the raw column, or add a clustering key and check `SYSTEM$CLUSTERING_INFORMATION`.
- **Symptom: dashboards are slow at 9 am, but each query is fast when run alone.** Diagnosis: check `QUEUED_OVERLOAD_TIME` in `QUERY_HISTORY`; a high value means queries are queuing. Fix: make it a multi-cluster warehouse (scale out), not a bigger size.

## 13. Alternatives and comparison

Broad characterizations; features change often, so check current documentation.

| Platform                               | Architecture style                                                        | Best fit                                                                                | Watch out for                                         |
| -------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Snowflake**                          | Separate storage and compute, many warehouses on shared data              | SQL-first enterprise analytics, isolating workloads, data sharing, little to administer | Cost discipline, proprietary native format            |
| **Databricks**                         | Lakehouse: Spark plus Delta Lake on your own storage, with SQL warehouses | Heavy data engineering and ML, unstructured data, open formats                          | More platform to operate and tune                     |
| **Google BigQuery**                    | Serverless, shared storage with slot-based compute                        | GCP-native, ad-hoc analytics with no compute to provision                               | Cost model (pay per bytes scanned, or reserved slots) |
| **Amazon Redshift (RA3 / Serverless)** | MPP with managed storage, separate compute                                | AWS-centric shops                                                                       | Concurrency and isolation need deliberate design      |
| **Microsoft Fabric / Synapse**         | OneLake (Delta) with shared capacity units                                | Azure / Power BI-centric organizations                                                  | Platform maturity and the shared-capacity model       |

**How to choose:**

- **Cloud strategy:** single-cloud and deeply native, or multi-cloud.
- **SQL vs code:** SQL-heavy analysts or Python/Spark engineers.
- **Open format:** whether open storage formats are a hard requirement.
- **Platform team:** how much operational work your team can take on.
- **Sharing:** whether you need data sharing across organizations.
- **Cost model:** which pricing model you can forecast and govern.

## 14. Summary

- Three layers, scaled independently: **Cloud Services** (brain), **virtual warehouses** (muscle), **micro-partitioned storage** (memory).
- **Immutable micro-partitions plus metadata** are the foundation. They enable pruning instead of indexes, as well as Time Travel, cloning and snapshot isolation.
- **Scale up for big queries, scale out for concurrency, and use separate warehouses to keep workloads apart.**
- There are **three cache levels:** the result cache (24 hours, in Cloud Services), each warehouse's local SSD cache (lost on suspend), and remote storage.
- It's a strong analytics platform, not an OLTP database. Cost and pruning are the two things you must actively manage.

## 15. Knowledge check

1. **Explain:** why can Snowflake create a clone of a 50 TB database in seconds without doubling the storage bill?
2. **Apply:** your Power BI warehouse (Medium) is slow every morning between 8 and 10 am. Individual queries run in 2 seconds when run alone. What do you check, and what do you change?
3. **Decide:** a claims team wants Snowflake to be the system of record that processes first notice of loss (FNOL), with about 2,000 writes per second and under 50 ms latency. What do you recommend?

**Answers**

1. Micro-partitions are immutable, so a clone is only new metadata pointing at the same partitions. Storage grows only when either copy changes, because changes write new partitions.
2. Check `QUEUED_OVERLOAD_TIME` in `QUERY_HISTORY`. If it's high, the problem is concurrency, not query speed, so make the warehouse multi-cluster (e.g. 1–4 clusters, standard scaling policy). Sizing up would raise the cost but wouldn't fix the queuing.
3. Advise against it. That's an OLTP workload that needs an operational database (Azure SQL, PostgreSQL or Cosmos DB). Send its changes to Snowflake through CDC for analytics. Hybrid tables could serve only light operational lookups, not that write volume.
