---
title: dbt (data build tool) Fundamentals
sidebar_label: Fundamentals
sidebar_position: 1
---

---

## 1. Overview

Your data is already loaded into Snowflake by Fivetran, Snowpipe or ADF (Azure Data Factory). Now you need to clean it, join it and model it into tables the business can trust.

**Without dbt,** that logic lives in hundreds of stored procedures and scheduled scripts:

- no version control
- no tests
- unclear dependencies
- "who changed the claims numbers?"

**dbt applies software engineering to SQL transformations:**

- Each transformation is a **`SELECT` statement in a file**.
- dbt works out the dependencies, generates the `CREATE TABLE`, `MERGE` and `VIEW` statements, runs them in the right order, tests the results, and generates documentation and lineage.
- All of it lives in Git and goes through code review and CI/CD, like application code.

**The key mental model:** dbt is a **compiler and orchestrator for SQL**. It moves no data itself; **all the work happens in the warehouse.**

## 2. Definition and key terms

dbt is an open-source command-line framework (**dbt Core**, Apache 2.0 license), plus a commercial SaaS product (dbt Cloud, the "dbt platform"). It handles the **T in ELT**: transforming data already in a warehouse, using modular SQL (or Python) templated with **Jinja**.

**What dbt is not:**

- not an extraction or loading tool, apart from small CSV "seeds"
- not a database
- not a general-purpose scheduler, though dbt Cloud includes one

| Term                        | Meaning                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**                 | A folder with `dbt_project.yml` plus models, tests, macros and so on                                                                                                              |
| **Model**                   | A `.sql` file holding one `SELECT` (or a `.py` Python model run via Snowpark on Snowflake). It becomes one table or view.                                                         |
| **`ref('model')`**          | References another model. It creates a **dependency edge** and resolves to the right database and schema for the current environment.                                             |
| **`source('src','table')`** | References raw data loaded by other tools, declared in YAML. Tracks lineage and can check freshness.                                                                              |
| **Materialization**         | How a model is built: `view` (default), `table`, `incremental`, `ephemeral` (inlined as a CTE, a common table expression), `materialized_view`; on Snowflake also `dynamic_table` |
| **Data test**               | An assertion on the data that **fails if it returns rows**. Generic tests (`unique`, `not_null`, `accepted_values`, `relationships`) or singular tests (custom SQL).              |
| **Unit test** (1.8+)        | Tests a model's **logic** against mocked input rows and expected output, without real data                                                                                        |
| **Model contract**          | Enforces a model's column names and types (and constraints where the platform supports them) at build time                                                                        |
| **Snapshot**                | Records changes to mutable source rows over time as SCD Type 2 (slowly changing dimension type 2) history                                                                         |
| **Seed**                    | A small CSV in the repo loaded as a table (mapping codes, reference lists)                                                                                                        |
| **Macro**                   | A reusable Jinja function that generates SQL                                                                                                                                      |
| **Package**                 | A reusable dbt project installed with `dbt deps` (e.g. `dbt_utils`, `dbt_expectations`)                                                                                           |
| **Adapter**                 | A warehouse-specific plugin (`dbt-snowflake`) that implements connections and materialization SQL                                                                                 |
| **Profile / target**        | Connection settings (`profiles.yml`) and the named environment (`dev`, `prod`)                                                                                                    |
| **Manifest**                | `target/manifest.json`: the parsed project and its full dependency graph                                                                                                          |

**How dbt differs from similar tools:**

- **vs stored procedures:** procedures are imperative and their dependencies are implicit. dbt is declarative, with the dependency graph derived from `ref()`.
- **vs ETL tools** (Informatica, SSIS): those move and transform data on their own engine. dbt pushes all the work down to the warehouse.

## 3. How it works

### Project layout

```
claims_dbt/
├─ dbt_project.yml          # project config, folder-level defaults
├─ packages.yml             # dbt_utils, etc.
├─ models/
│  ├─ staging/              # 1:1 with sources: rename, cast, light cleanup (views)
│  │  ├─ _sources.yml
│  │  ├─ stg_guidewire__claims.sql
│  │  └─ _stg_models.yml    # tests + docs
│  ├─ intermediate/         # business logic joins (ephemeral/views)
│  └─ marts/                # facts & dimensions for consumers (tables/incremental)
│     ├─ fct_claim_payments.sql
│     └─ dim_policy.sql
├─ snapshots/               # SCD2 history
├─ seeds/                   # small CSVs
├─ macros/                  # reusable Jinja
├─ tests/                   # singular data tests
└─ target/                  # compiled SQL + artifacts (generated, not committed)
```

`profiles.yml`, which holds credentials, normally lives in `~/.dbt/` or comes from environment variables. **It's never committed to Git.**

### What happens when you run `dbt build`

```
 1. LOAD      read dbt_project.yml, profiles.yml, packages
 2. PARSE     read every .sql/.yml, render ref()/source() → build DAG
              → manifest.json (partial parsing reuses previous parse)
 3. SELECT    apply --select / --exclude / state: selectors to the DAG
 4. COMPILE   render Jinja → pure SQL for each node (target/compiled/)
 5. EXECUTE   walk DAG in dependency order, up to N parallel threads:
                seeds → snapshots → models → tests (each model's tests run
                right after it; downstream nodes are SKIPPED if a test errors)
              each model: adapter materialization macro wraps your SELECT
              in DDL/DML and runs it on Snowflake (target/run/)
 6. ARTIFACTS run_results.json, logs/dbt.log, (docs: catalog.json)
```

**Dependency flow example:**

```
source(guidewire.claims) ─► stg_claims ─┐
source(guidewire.payments) ► stg_payments ─► int_claim_payments ─► fct_claim_payments ─► (BI / Semantic Layer)
seed(loss_cause_map) ─────────────────────┘
```

**Concurrency:** `threads: 8` in the profile means up to 8 independent models build at once. Each thread holds its own Snowflake session. The warehouse size and its concurrency limit decide whether that parallelism actually speeds things up.

## 4. Internal architecture: behind the scenes on Snowflake

dbt itself does very little processing. It **generates SQL**, and the adapter's materialization macros decide which statements to run.

| Materialization | What dbt-snowflake roughly issues                                                                                                                                                          | Notes                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `view`          | `CREATE OR REPLACE VIEW ... AS <your select>`                                                                                                                                              | Cheap to build; the cost is paid by every query against it                                                                                             |
| `table`         | `CREATE OR REPLACE TRANSIENT TABLE ... AS <select>`                                                                                                                                        | **Transient by default** on Snowflake: no Fail-safe, which saves storage (see the cost lesson). Set `transient: false` for tables that need Fail-safe. |
| `incremental`   | First run: create the table. Later runs: build a temporary view or table of new rows, then `MERGE` (the default strategy) or `DELETE+INSERT`, `APPEND`, or `microbatch` † into the target. | Your SQL uses `is_incremental()` and `{{ this }}` to select only new or changed rows                                                                   |
| `ephemeral`     | Nothing created; inlined as a CTE into downstream models                                                                                                                                   | Keeps the warehouse tidy, but harder to debug                                                                                                          |
| `dynamic_table` | `CREATE DYNAMIC TABLE ... TARGET_LAG = ...`                                                                                                                                                | Snowflake refreshes it; dbt manages the definition                                                                                                     |
| snapshot        | `MERGE` into a history table with `dbt_valid_from`, `dbt_valid_to`, `dbt_scd_id`                                                                                                           | `timestamp` or `check` strategy                                                                                                                        |

**Useful Snowflake configs in dbt** (each ties back to an earlier lesson):

| Config                   | What it does                                            | Earlier lesson       |
| ------------------------ | ------------------------------------------------------- | -------------------- |
| `snowflake_warehouse`    | Per-model warehouse; heavy models on a larger warehouse | Performance and cost |
| `cluster_by`             | Clustering key on large tables                          | Performance          |
| `query_tag`              | Cost attribution                                        | Cost                 |
| `copy_grants`, `grants:` | Keep or declare grants                                  | Security             |
| `secure: true`           | Secure views                                            | Security             |
| `transient`              | Transient vs permanent tables                           | Cost                 |

**Other internals:**

- **Adapter interface:** dbt Core is warehouse-agnostic. The `dbt-snowflake` adapter (built on `snowflake-connector-python`) implements connections, type mapping and materialization macros. You can override any built-in macro in your project. A common example is `generate_schema_name`, which controls dev vs prod schema naming.
- **Artifacts drive tooling:**
  - `manifest.json` (the graph), `run_results.json` (timings and status) and `catalog.json` (warehouse metadata) power documentation, lineage, Slim CI and observability tools.
  - **State comparison:** `--select state:modified+ --defer --state <prod artifacts>` builds only changed models and the models downstream of them, and **defers** references to unchanged models to production objects. This is the core of fast CI.
  - **`dbt clone`** (1.6+) uses Snowflake **zero-copy clone** to copy production objects into a CI or dev schema instantly.

## 5. When to use it

- SQL-centric transformation work in a cloud warehouse (Snowflake, Databricks, BigQuery, Redshift, Fabric, Postgres and others).
- Teams that want **analytics engineering** practices: Git, code review, tests, CI/CD and documentation for data models.
- Many interdependent models where lineage and impact analysis matter, e.g. regulatory and financial reporting.
- Building a governed **semantic layer** of metrics (dbt Semantic Layer / MetricFlow) that BI tools consume consistently.

## 6. When not to use it

- **Extraction or loading:** use Fivetran, ADF, Airbyte, Snowpipe or Kafka.
- **Sub-minute streaming:** dbt runs in batches. Use Snowpipe Streaming plus dynamic tables or a streaming engine.
- **Row-by-row procedural logic or calls to external APIs:** use stored procedures, Snowpark or application services.
- **A handful of simple transforms owned by one person:** a few views or dynamic tables may be enough.
- **Heavy non-SQL processing** (complex ML, unstructured data): Python models exist, but Spark or Snowpark jobs orchestrated elsewhere may fit better.

## 7. Benefits

- **Modularity and DRY** (don't repeat yourself): `ref()` and macros remove copy-pasted SQL.
- **Automatic dependency ordering:** no hand-maintained job chains.
- **Quality gates:** tests, unit tests, contracts and source freshness catch problems before consumers see them.
- **Lineage and documentation generated from code,** which helps meet data-lineage expectations such as BCBS 239 (the Basel principles for risk data aggregation and reporting).
- **Isolated environments:** each developer builds in their own schema; CI builds only what changed.
- **Portability:** much of the logic moves between warehouses, though not all of it; dialect differences remain.

## 8. Trade-offs, risks and misconceptions

- **Warehouse cost:** dbt makes it easy to rebuild everything. `dbt run` in production with all models as `table` rebuilds whole tables every time. Use incremental models, the right warehouse sizes, `query_tag` and selective runs. CI can also burn credits; use Slim CI and `dbt clone`.
- **Incremental complexity:**
  - Late-arriving data, deletes, schema changes (`on_schema_change`) and duplicates (a missing `unique_key`) are the most common source of wrong numbers.
  - Schedule periodic `--full-refresh` or a lookback window.
- **Jinja overuse:** heavily macro-ed SQL becomes unreadable. Prefer plain SQL, and use macros for real reuse.
- **Too many models:** thousands of tiny models slow down parsing and confuse ownership. Use the layers sensibly and consider **dbt Mesh** (multi-project, with model access levels and versions) for large organizations.
- **Orchestration gaps:** dbt Core has no scheduler. You need dbt Cloud, Airflow, Dagster, ADF or Snowflake tasks to trigger it, plus alerting.
- **Security:**
  - The dbt service account role often has broad create rights, so restrict it to the target databases.
  - Manage secrets through environment variables or a key vault, and use key-pair authentication.
  - Apply grants via config.
  - Masking and row access policies stay in Snowflake. dbt can apply them through post-hooks or packages, but governance should be owned centrally.
- **Observability:** parse `run_results.json`, send failures to alerting, and track model run times and credits over time.
- **Misconception:** "dbt runs the transformations." Snowflake does. dbt only sends SQL.
- **Misconception:** "Tests guarantee correctness." They catch only what you assert. Add reconciliation tests for financial data.
- **Misconception:** "dbt Cloud is required." dbt Core plus your own orchestrator is fully capable. Cloud adds a hosted IDE, scheduler, CI, catalog and Semantic Layer.

## 9. Real-world examples

**Banking: regulatory reporting lineage (e.g. capital and liquidity reports)**

- **Problem:** regulators and internal audit expect traceable, controlled data lineage from source systems to reported figures. Logic was spread across stored procedures and spreadsheets.
- **How dbt is applied:**
  - Sources are declared for core banking, loans and treasury, with **source freshness** checks.
  - Staging → intermediate → reporting marts, with **contracts** on report-facing models.
  - **Reconciliation tests** (singular tests) check that mart totals match general ledger (GL) control totals within a tolerance.
  - dbt docs and lineage serve as evidence of how each figure is produced. Releases go through pull-request approval, which supports change-management controls.

**Insurance: claims history and loss triangles**

- **Problem:** actuaries need claim status and reserve **history** to build loss-development triangles, but the claims system only stores the current state.
- **How dbt is applied:**
  - A **snapshot** on `claims` (timestamp strategy on `last_updated`) builds SCD2 history.
  - An incremental fact `fct_claim_transactions` uses `MERGE` on `transaction_id`.
  - A mart `mart_loss_triangle` pivots incurred and paid amounts by accident period × development period.
  - **Unit tests** check the development-period calculation with mocked edge cases (leap years, reopened claims).

**Finance (asset management): positions and performance marts**

- **Problem:** daily positions from several custodians must be standardized, priced and aggregated to NAV (net asset value). Errors reach client reports.
- **How dbt is applied:**
  - One staging model per custodian, standardizing them to a common schema.
  - `relationships` tests ensure every position maps to a security master record.
  - `accepted_values` tests check currencies and asset classes.
  - A custom test flags day-over-day NAV moves greater than X% for review.
  - The incremental position fact is partitioned by `as_of_date` and uses the `delete+insert` strategy for each date, so restated days replace cleanly.

## 10. Practical example: an insurance claims mini-project on Snowflake

_Illustrative; not production-ready. Exact syntax varies a little across dbt versions._

**`profiles.yml`** (outside the repo):

```yaml
claims_dbt:
  target: dev
  outputs:
    dev:
      type: snowflake
      account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"
      user: "{{ env_var('SNOWFLAKE_USER') }}"
      private_key_path: "{{ env_var('SNOWFLAKE_PRIVATE_KEY_PATH') }}"
      role: TRANSFORMER_DEV
      warehouse: DBT_DEV_WH
      database: ANALYTICS_DEV
      schema: dbt_dkesavan # personal dev schema
      threads: 8
      query_tag: dbt_claims_dev
```

**`dbt_project.yml`** (folder-level defaults):

```yaml
name: claims_dbt
profile: claims_dbt
models:
  claims_dbt:
    staging: { +materialized: view }
    intermediate: { +materialized: ephemeral }
    marts: { +materialized: table, +snowflake_warehouse: DBT_MARTS_WH }
```

**`models/staging/_sources.yml`:**

```yaml
version: 2
sources:
  - name: guidewire
    database: RAW
    schema: GUIDEWIRE
    loaded_at_field: _loaded_at
    freshness:
      warn_after: { count: 6, period: hour }
      error_after: { count: 24, period: hour }
    tables:
      - name: claims
      - name: payments
```

**`models/staging/stg_guidewire__payments.sql`:**

```sql
select
    payment_id::number          as payment_id,
    claim_id::number            as claim_id,
    payment_date::date          as payment_date,
    amount::number(18,2)        as payment_amount,
    upper(payment_type)         as payment_type,
    _loaded_at                  as loaded_at
from {{ source('guidewire', 'payments') }}
```

**`models/marts/fct_claim_payments.sql`** (incremental):

```sql
{{ config(
    materialized='incremental',
    unique_key='payment_id',
    incremental_strategy='merge',
    on_schema_change='append_new_columns',
    cluster_by=['payment_date']
) }}

select p.payment_id, p.claim_id, c.policy_id, c.loss_state,
       p.payment_date, p.payment_type, p.payment_amount, p.loaded_at
from {{ ref('stg_guidewire__payments') }} p
join {{ ref('stg_guidewire__claims') }}   c using (claim_id)
{% if is_incremental() %}
  -- 3-day lookback to catch late-arriving rows
  where p.loaded_at > (select dateadd(day, -3, max(loaded_at)) from {{ this }})
{% endif %}
```

**`models/marts/_marts.yml`** (tests, contract and a unit test):

```yaml
version: 2
models:
  - name: fct_claim_payments
    config:
      contract: { enforced: true }
    columns:
      - name: payment_id
        data_type: number
        data_tests: [unique, not_null]
      - name: claim_id
        data_type: number
        data_tests:
          - relationships: { to: ref('stg_guidewire__claims'), field: claim_id }
      - name: payment_type
        data_type: varchar
        data_tests:
          - accepted_values: { values: ["INDEMNITY", "EXPENSE", "RECOVERY"] }
      # ...remaining columns with data_type
unit_tests:
  - name: test_payment_join_keeps_state
    model: fct_claim_payments
    overrides:
      macros: { is_incremental: false }
    given:
      - input: ref('stg_guidewire__payments')
        rows: [{ payment_id: 1, claim_id: 10, payment_amount: 500 }]
      - input: ref('stg_guidewire__claims')
        rows: [{ claim_id: 10, policy_id: 99, loss_state: "WI" }]
    expect:
      rows: [{ payment_id: 1, policy_id: 99, loss_state: "WI" }]
```

**`snapshots/claims_snapshot.yml`** (YAML snapshot config, dbt 1.9+ †):

```yaml
snapshots:
  - name: claims_snapshot
    relation: source('guidewire', 'claims')
    config:
      unique_key: claim_id
      strategy: timestamp
      updated_at: last_updated
```

**Commands:**

```bash
dbt deps && dbt debug                       # install packages, test connection
dbt build --select +fct_claim_payments      # model + all upstream, with tests
dbt source freshness
dbt docs generate && dbt docs serve         # lineage + docs site

# CI on a pull request (Slim CI): only changed models + downstream, defer to prod
dbt build --select state:modified+ --defer --state ./prod-artifacts --target ci
```

**Deployment flow:**

1. A developer opens a pull request.
2. CI runs Slim CI against a cloned CI schema (`dbt clone`).
3. After review and merge, the production job (dbt Cloud, Airflow or ADF) runs `dbt build` on a schedule.
4. `run_results.json` is parsed, and failures alert the team on Teams or Slack.

## 11. Interview answer: the 2-minute version

> "dbt is the **transformation layer in ELT**. You write each transformation as a `SELECT` statement in SQL (or Python) with Jinja templating, and dbt compiles it into DDL and DML that run **inside the warehouse**. dbt itself moves no data.
>
> The core building blocks:
>
> - **Models:** one `SELECT` per file.
> - **`ref()` and `source()`:** build a dependency graph, so dbt runs everything in the right order and generates lineage and documentation automatically.
> - **Materializations:** view, table, ephemeral, and **incremental**, where dbt `MERGE`s only new or changed rows using `is_incremental()` and a `unique_key`.
> - **Snapshots:** SCD2 history of rows that change in place.
> - **Seeds and macros** for reference data and reuse.
>
> **Quality** comes from data tests (`unique`, `not_null`, `relationships`, `accepted_values`, plus custom SQL), **unit tests** on mocked inputs, **model contracts** for schemas, and **source freshness**.
>
> **Engineering practice:** everything is in Git with per-developer schemas, and CI uses **Slim CI** (`state:modified+` with `--defer`) to build only changed models. On Snowflake, `dbt clone` uses zero-copy cloning.
>
> **Snowflake specifics** I'd use: per-model warehouses, `query_tag` for cost attribution, `cluster_by`, transient tables by default, and grants in config.
>
> **The trade-offs:** dbt Core needs an external orchestrator; incremental models need care with late data and deletes; and it's easy to overspend by fully rebuilding everything. For regulated reporting I add reconciliation tests and contracts, and use the lineage as evidence."

## 12. Hands-on exercise and troubleshooting

**Setup:**

- Python 3.10+ (or the version current dbt supports) and `pip install dbt-snowflake`.
- A Snowflake trial with a `TRANSFORMER` role and an XS warehouse.
- Source data: `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1`.

1. `dbt init tpch_demo`, configure the profile, then `dbt debug`.
2. Declare `orders` and `customer` as sources.
3. Create staging models `stg_orders` and `stg_customers` that rename and cast columns.
4. Create the mart `fct_customer_orders` (one row per order, with customer segment) as an **incremental** model on `o_orderkey` using `o_orderdate`.
5. Add tests: `unique` and `not_null` on `order_key`; `relationships` to customers; `accepted_values` on market segment.
6. Run `dbt build`, then `dbt docs generate && dbt docs serve` and look at the lineage graph.
7. Change `stg_orders` slightly, then run `dbt build --select state:modified+` using the earlier `target/` folder copied to `./prod-artifacts`.

**Expected outcomes:**

- Staging models appear as views and the mart as a transient table in your dev schema.
- The second build of the incremental model runs a `MERGE` (check `target/run/` or Snowflake's query history).
- All tests pass.
- The state-based build selects only the changed model and the models downstream of it.

**Troubleshooting:**

- **`Compilation Error: Model 'X' depends on a node named 'stg_order' which was not found`.** A typo in `ref()`, a disabled model, or a file outside `model-paths`. Check `dbt ls --select stg_order*`.
- **`Database Error: Object 'RAW.GUIDEWIRE.CLAIMS' does not exist or not authorized`.**
  - The source database or schema name or its case is wrong, or the profile's role lacks `USAGE` or `SELECT`.
  - Run `dbt debug`, then try `select` in Snowsight using the same role.
- **The incremental table has duplicates, or the `unique` test fails after a few runs.**
  - `unique_key` is missing (so the strategy appends), or the source has duplicates within a batch.
  - Add `unique_key`, deduplicate with `qualify row_number() ... = 1` in staging, then run `dbt build --full-refresh --select fct_customer_orders`.

## 13. Alternatives and comparison

| Option                                          | Style                                               | Strengths                                                   | Choose when                                                                                    |
| ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **dbt (Core / Cloud)**                          | SQL + Jinja, DAG, tests                             | Large ecosystem, works on many warehouses, testing and docs | Most SQL-centric analytics engineering                                                         |
| **Snowflake stored procedures + streams/tasks** | Imperative, Snowflake-native                        | No extra tooling; fine-grained CDC control                  | Few pipelines, Snowflake-only, CDC-heavy logic                                                 |
| **Snowflake dynamic tables**                    | Declarative, refreshed to a target lag              | Snowflake manages incremental refresh automatically         | Near-real-time derived tables. Can be **combined** with dbt (`dynamic_table` materialization). |
| **SQLMesh**                                     | SQL with virtual environments, column-level lineage | Strong state and environment management                     | Teams that value its environment model; check ecosystem fit                                    |
| **Coalesce, Matillion**                         | Visual / low-code                                   | Faster for less code-oriented teams                         | GUI-first teams                                                                                |
| **Dataform**                                    | SQLX on BigQuery                                    | Native to GCP                                               | BigQuery shops                                                                                 |
| **Spark / Databricks Lakeflow (DLT)**           | Code or declarative pipelines on Spark              | Large-scale, streaming, ML                                  | Lakehouse on Databricks                                                                        |

**How to choose:**

- **SQL vs code:** how SQL-heavy your team is.
- **Warehouse strategy:** single warehouse or several.
- **Testing and CI/CD:** how much you need them.
- **Orchestration:** whether you already have an orchestrator.
- **Latency:** batch vs near-real-time.
- **Licensing and hosting:** Core vs Cloud vs Fusion †.

## 14. Summary

- dbt is the **T in ELT**: SQL plus Jinja compiled to DDL and DML, executed **in the warehouse**.
- `ref()` and `source()` build the **DAG**, which drives run order, lineage and documentation.
- **Materializations:** view, table (transient by default on Snowflake), incremental (`MERGE` and other strategies), ephemeral, dynamic table, and snapshots for SCD2.
- **Quality:** data tests, unit tests, contracts, source freshness. Add reconciliation tests for finance.
- **Engineering:** Git, dev schemas, Slim CI with `state:modified+` and `--defer`, `dbt clone`, an external orchestrator or dbt Cloud.
- Watch incremental correctness, warehouse cost and Jinja complexity.

## 15. Knowledge check

1. **Explain:** what does `ref('stg_claims')` give you that hard-coding `analytics.staging.stg_claims` doesn't?
2. **Apply:** a nightly full rebuild of a 2-billion-row payments fact takes 90 minutes on an L warehouse. Only about 0.5% of rows change each day, including some late-arriving rows up to 2 days old. How do you redesign it?
3. **Decide:** your team wants dbt to also pull data from a REST policy-admin API every 5 minutes. Good idea?

**Answers**

1. `ref()` creates a dependency edge, so dbt builds models in the right order and includes them in lineage, docs, selection (`+model`) and Slim CI. It also resolves to the correct database and schema for each environment (dev, CI, prod) and supports `--defer`. A hard-coded name loses all of that and breaks when you switch environments.
2. Make it `incremental` with `unique_key='payment_id'` and `merge` (or `delete+insert` per date partition), and a **3-day lookback** filter on `loaded_at` to catch late rows. Cluster by date. Run a scheduled `--full-refresh` monthly, or reconciliation tests to detect drift. The daily run then processes about 3 days of changes instead of 2 billion rows, so it's far faster and cheaper.
3. No. dbt doesn't extract data or call APIs, and it runs in batches. Use an ingestion tool (ADF, Fivetran, a custom .NET or Azure Function, then Snowpipe or Snowpipe Streaming) to land the data in raw tables. Then let dbt, possibly combined with dynamic tables for low latency, transform it.
