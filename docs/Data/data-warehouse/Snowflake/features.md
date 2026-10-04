---
title: Snowflake Features
sidebar_label: Snowflake Features
sidebar_position: 4
---

---

## 1. Snowflake feature map

Newer features are marked †. Their availability varies by cloud, region and edition, so check current documentation.

| Area                        | Features                                                                                                                  | Problem solved                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Architecture**            | Storage and compute separated; multi-cluster warehouses; runs on AWS, Azure and GCP                                       | Elastic scaling and workload isolation                            |
| **Data types**              | `VARIANT`, `OBJECT`, `ARRAY` for JSON, Avro, Parquet, XML                                                                 | Query semi-structured data with SQL, no rigid ETL first           |
| **Data protection**         | **Time Travel**, Fail-safe, `UNDROP`, replication and failover                                                            | Recover from mistakes; disaster recovery                          |
| **Copying data**            | **Zero-copy cloning**                                                                                                     | Instant dev/test copies and snapshots without duplicating storage |
| **Ingestion**               | Bulk `COPY INTO`, **Snowpipe**, Snowpipe Streaming, Kafka connector                                                       | Batch, file-based and streaming loads                             |
| **Pipelines**               | **Streams**, **tasks**, dynamic tables                                                                                    | In-platform CDC, scheduling and incremental transforms            |
| **Collaboration**           | Secure Data Sharing, Marketplace, data clean rooms                                                                        | Share live data with no copies                                    |
| **Security and governance** | RBAC, masking and row-access policies, tags, `ACCESS_HISTORY`, network policies, PrivateLink, Tri-Secret Secure (Horizon) | Least privilege, PII protection, audit trail                      |
| **Developer**               | Snowpark (Python, Java, Scala), UDFs, stored procedures, Snowflake CLI                                                    | Code-based processing next to the data                            |
| **AI and apps †**           | Cortex AI functions, Streamlit in Snowflake, Native Apps, Snowpark Container Services                                     | AI and apps without moving data out                               |
| **Table formats †**         | Iceberg tables, hybrid tables                                                                                             | Open-format interoperability; light OLTP                          |

The four features in this lesson all depend on the same idea: **data is never changed in place; only metadata pointers move.**

```
            micro-partitions are immutable
                       │
      ┌────────────────┼──────────────────┬──────────────────┐
      ▼                ▼                  ▼                  ▼
  Time Travel     Zero-copy clone      Streams         (Snowpipe just adds
  = read old      = new metadata       = remember a     new partitions;
    pointers        pointing at          version and     tasks run SQL on
                    same partitions      diff versions)  a schedule)
```

---

## 2. Time Travel

### What it is

Time Travel lets you **query, clone or restore data as it was at an earlier point**, within a retention period. Use it after an accidental `DELETE`, `UPDATE` or `DROP`, or to reproduce an earlier result.

### Key terms

- **`DATA_RETENTION_TIME_IN_DAYS`:** how long earlier versions are kept.
  - Default is 1 day.
  - Standard edition allows at most 1 day.
  - **Enterprise and above allow up to 90 days** for permanent objects.
  - Transient and temporary objects allow 0 or 1 day.
- **Inheritance:** you can set retention on the account, database, schema or table, and lower levels inherit it.
- **Enforced minimum:** `MIN_DATA_RETENTION_TIME_IN_DAYS` (account level) sets a floor nobody can go below.
- **Fail-safe:** a further **7 days** after Time Travel ends, for **permanent** tables only. **Only Snowflake Support can recover** this data, on a best-effort basis; it's for disasters, not something you query.

### How it works

```
 t0  INSERT → partitions P1,P2              table version v1 → {P1,P2}
 t1  UPDATE row in P2 → writes P2'          table version v2 → {P1,P2'}
                                            P2 retained (Time Travel)
 t1+retention → P2 moves to Fail-safe (7d) → then purged
```

When you query `AT (TIMESTAMP => t0)`, Snowflake looks up the table version that was current at t0 and reads partitions `{P1, P2}`. Nothing is "restored"; it simply reads the older partitions.

### Syntax

```sql
SELECT * FROM claims AT (TIMESTAMP => '2026-09-30 08:00:00'::TIMESTAMP_LTZ);
SELECT * FROM claims AT (OFFSET => -60*30);                     -- 30 min ago
SELECT * FROM claims BEFORE (STATEMENT => '01b2c3d4-...');      -- just before a bad query
CREATE TABLE claims_fixed CLONE claims BEFORE (STATEMENT => '01b2c3d4-...');
UNDROP TABLE claims;          -- also UNDROP SCHEMA / DATABASE
```

### Watch out for

- **Storage cost:** high-churn tables with long retention store many old versions. Check `TIME_TRAVEL_BYTES` and `FAILSAFE_BYTES`.
- **`UNDROP` name conflicts:** it fails if an object with the same name already exists. Rename that object first.
- **Lowering retention takes effect at once:** data older than the new period moves into Fail-safe immediately.
- **Not a backup:** it's in the same account and depends on the same object, so it isn't independent. For real backups, use replication to another account or region, or Snowflake's newer backup and snapshot capabilities † (check availability).

---

## 3. Zero-copy cloning

### What it is

`CREATE <database | schema | table> <name> CLONE <source> [AT | BEFORE (...)]` creates a new, **fully independent and writable** object that initially **shares the source's micro-partitions**. Only metadata is copied.

### How it works

```
 Source table  → {P1, P2, P3}
 CLONE         → Clone → {P1, P2, P3}         (no new storage)
 UPDATE clone  → Clone → {P1, P2*, P3}        (P2* new; billed to clone)
 DELETE source → Source → {P1, P3'}           (P2 kept because clone still references it:
                                              RETAINED_FOR_CLONE_BYTES)
```

- **Speed:** cloning copies only metadata. It's fast, but not instant for very large databases with millions of partitions; that can take minutes.
- **Combined with Time Travel:** you can clone the state at a past point, e.g. `CLONE claims AT (TIMESTAMP => ...)`.

### Watch out for

- **Grants:**
  - Grants on the cloned database or schema itself aren't copied.
  - Grants on child objects inside a cloned database or schema are copied.
  - A cloned table gets grants only with `COPY GRANTS`.

  Check grants after cloning.

- **Tasks:** tasks in a cloned schema start **suspended**.
- **Streams:** in a cloned database or schema, unconsumed rows in cloned streams **can't be read**, so the clone's pipelines start fresh.
- **Time Travel on the clone:** the clone has no history from before it was created.
- **Object types:** some have cloning caveats (internal stages, pipes, external tables, and so on). Check the docs for each type.
- **PII:** a clone of production contains production PII. Masking policies attached to columns carry over, but access depends on roles in the clone. Prefer masked or subset clones for non-production.
- **Cost creep:** storage grows as the clone and the source diverge. Long-lived clones of busy tables can become expensive.

---

## 4. Streams (change data capture)

### What it is

A **stream** records a version (offset) of a source object. When you query it, it returns the **rows that changed since that offset**, with extra metadata columns:

| Column              | Meaning                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `METADATA$ACTION`   | `INSERT` or `DELETE`                                                         |
| `METADATA$ISUPDATE` | `TRUE` if the row is one half of an update (shown as a DELETE + INSERT pair) |
| `METADATA$ROW_ID`   | A stable, unique ID for each row, used to track changes                      |

**Types**

| Type                 | Returns                                                                                      | Use for                                         |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Standard (delta)** | The **net** inserts, updates and deletes                                                     | Keeping a target in sync with `MERGE`           |
| **Append-only**      | Inserts only. Much cheaper, because it doesn't need to compare versions to work out deletes. | Landing or raw tables that only receive appends |
| **Insert-only**      | Inserts on external and Iceberg-on-external tables                                           | Data-lake files                                 |

Source objects can be tables, views, directory tables, dynamic tables and Iceberg tables.

### How it works

```
 Stream created at v10 (offset=v10)
 Source changes: v11, v12, v13
 SELECT FROM stream      → diff(v10 → v13)  (offset NOT moved)
 INSERT/MERGE … FROM stream, COMMIT → offset := v13
```

- **What a stream is:** a bookmark (offset) plus the source table's change-tracking metadata. It doesn't copy data.
- **What moves the offset:** **only DML that reads from the stream inside a committed transaction**. A plain `SELECT` doesn't. Within one transaction every read sees the same snapshot, so multi-statement consumption is consistent.
- **Net changes:** if a row is inserted and then deleted between consumptions, the stream shows nothing for it.
- **Going stale:** if a stream isn't consumed within the source's Time Travel retention, it becomes **stale** and has to be recreated. To prevent this, Snowflake temporarily extends retention for unconsumed streams, up to `MAX_DATA_EXTENSION_TIME_IN_DAYS` (default 14). Check the `STALE_AFTER` value in `SHOW STREAMS`.
- **Cheap emptiness check:** `SYSTEM$STREAM_HAS_DATA('s')` runs in Cloud Services, so a task using it can skip a run without starting a warehouse.

### Watch out for

- **One consumer per stream.** If two jobs consume the same stream, each sees only part of the changes. Create one stream per consumer.
- **Retention cost:** streams that sit unconsumed extend the source's retention, which costs storage.
- **Deduplication:** streams give exactly-once tracking _of the table's changes_. If upstream files load twice, the stream faithfully reports both copies. Deduplicate in the `MERGE`.

---

## 5. Tasks (scheduling and orchestration)

### What it is

A **task** runs a SQL statement, a stored procedure call or Snowpark code on a schedule, after another task, or when a stream has data.

```sql
CREATE TASK t_merge_claims
  WAREHOUSE = etl_wh                              -- or omit for serverless:
  -- USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE = 'XSMALL'
  SCHEDULE = 'USING CRON */5 * * * * America/Chicago'
  WHEN SYSTEM$STREAM_HAS_DATA('claims_raw_stream')
AS
  CALL curated.sp_merge_claims();
ALTER TASK t_merge_claims RESUME;                  -- tasks are created SUSPENDED
```

### Key concepts

- **Compute:** a user-managed warehouse that you size and pay for while it runs, or **serverless**, where Snowflake sizes it automatically and bills at serverless rates.
- **Task graph (DAG, directed acyclic graph):**
  - A **root** task has the schedule.
  - Child tasks declare `AFTER parent`.
  - An optional **finalizer** task always runs at the end, for cleanup or notifications.
  - Resume children before the root, or use `SYSTEM$TASK_DEPENDENTS_ENABLE('root')`.
- **Triggered tasks** †: no schedule; they run when the stream has data.
- **Controls:**
  - `ALLOW_OVERLAPPING_EXECUTION` (default FALSE)
  - `SUSPEND_TASK_AFTER_NUM_FAILURES`
  - `TASK_AUTO_RETRY_ATTEMPTS`
  - `USER_TASK_TIMEOUT_MS`
  - error integrations, which send failure notifications to Event Grid, SNS or Pub/Sub
- **Security:** the owning role needs the account-level `EXECUTE TASK` privilege. The task runs with the **owner's** privileges, so use a dedicated service role.
- **Monitoring:** `TABLE(INFORMATION_SCHEMA.TASK_HISTORY())`, `ACCOUNT_USAGE.TASK_HISTORY`, `COMPLETE_TASK_GRAPHS`, and the Snowsight task graph view.
- **Manual run:** `EXECUTE TASK t;`

### Watch out for

- **Created suspended.** "My task never runs" is usually because it was never resumed, or the role lacks `EXECUTE TASK`.
- **Warehouse vs serverless cost:** a warehouse task that runs every minute keeps the warehouse warm, while serverless bills only actual work at its own rate. Compare the two.
- **Limited orchestration:** tasks are fine for in-platform orchestration, but cross-system dependencies (APIs, file systems, other databases) are better handled by Airflow, ADF (Azure Data Factory) or Dagster.

---

## 6. Snowpipe (continuous file ingestion)

### What it is

A **pipe** wraps a `COPY INTO` statement. Snowpipe runs it automatically on **serverless compute** whenever new files arrive in a stage. It loads in micro-batches, with typical latency around a minute (not guaranteed).

### How it works (Azure example)

```
 Producer writes file ─► ADLS/Blob container
                              │ BlobCreated event
                              ▼
                        Event Grid ─► Storage Queue
                              │ (notification integration)
                              ▼
                      Snowflake pipe (AUTO_INGEST=TRUE)
                              │ queue of files
                              ▼
                  Serverless COPY INTO raw table
                              │ load metadata (file name + checksum, 14 days)
                              ▼
                   raw table ─► stream ─► task MERGE ─► curated
```

- **How Snowpipe learns of new files:**
  - **Auto-ingest:** cloud events (S3 → SQS/SNS, Azure Event Grid → Storage Queue, GCS → Pub/Sub). Works with **external stages**.
  - **REST API** (`insertFiles`): your app tells Snowpipe which files to load. Works with internal or external stages.
- **Deduplication:** Snowpipe keeps load history for **14 days** and skips files it has already loaded. Bulk `COPY` keeps it 64 days.
- **Order:** files aren't guaranteed to load in arrival order. Design for out-of-order data, e.g. using event timestamps and `MERGE` logic.
- **Backfill:** `ALTER PIPE p REFRESH` queues files staged within the last 7 days that weren't loaded.
- **Monitoring:**
  - `SYSTEM$PIPE_STATUS('p')` for pipe state
  - `COPY_HISTORY` for per-file results and errors
  - `PIPE_USAGE_HISTORY` for cost
  - `VALIDATE_PIPE_LOAD`
  - error notification integrations
- **Snowpipe Streaming:** row-level ingestion through an SDK or the Kafka connector, with **no files**, latency of seconds, and often lower cost than many tiny files. Use it for event streams.

### Watch out for

- **File size:** many tiny files add per-file overhead to the cost. Aim for about **100–250 MB compressed** and roughly one file per minute per stream, or use Snowpipe Streaming. The cost model has changed over time, so check the current Service Consumption Table.
- **Recreating a pipe loses its load history,** so a later `REFRESH` can **reload files and create duplicates**. Plan pipe changes carefully, and make downstream `MERGE`s idempotent.
- **Errors:** by default (`ON_ERROR = SKIP_FILE`), bad files are skipped silently. Watch `COPY_HISTORY` and set up error notifications.
- **Schema changes upstream:** consider `MATCH_BY_COLUMN_NAME`, schema evolution †, or landing data into `VARIANT`.

---

## 7. When to use each feature

| Feature             | Use when                                                                                                    | Avoid / prefer something else when                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Time Travel**     | Recovering from human error; "as of" queries; auditing what changed                                         | You need long-term or independent backups (use replication or backups); very high-churn tables where long retention costs too much         |
| **Zero-copy clone** | Dev/test environments, release rehearsal, quarter-end snapshots, quick backups before a risky change        | Non-production must not hold PII (use masked subsets); a permanent second copy that diverges heavily (cost grows)                          |
| **Streams**         | Incremental processing in Snowflake; `MERGE` into curated or SCD2 (slowly changing dimension type 2) tables | Several independent consumers (one stream each); purely declarative transforms (dynamic tables are simpler)                                |
| **Tasks**           | Scheduling SQL or Snowpark inside Snowflake; simple task graphs                                             | Cross-system orchestration, complex SLAs or lineage (Airflow, ADF, Dagster, dbt Cloud)                                                     |
| **Snowpipe**        | Files arriving continuously; near-real-time to about a minute                                               | Large daily batches (bulk `COPY` on a warehouse is simpler and cheaper); sub-second latency or event streams (Snowpipe Streaming or Kafka) |

## 8. Benefits

- **No ETL server to run:** ingestion, CDC and scheduling all happen inside the platform.
- **Fast recovery and safe experiments:** Time Travel plus cloning make "undo" and "test on production-like data" quick and cheap.
- **Pay only for work done:** serverless Snowpipe and serverless tasks scale to zero when idle.
- **Consistency:** streams consumed within transactions give exactly-once incremental processing _within Snowflake_.

## 9. Trade-offs and misconceptions

- **Hidden storage:** Time Travel, Fail-safe, unconsumed streams that extend retention, and diverged clones all add storage.
- **Platform lock-in:** streams, tasks and pipes are Snowflake-specific, so pipeline logic becomes tied to Snowflake.
- **Operations:** tasks fail quietly unless you set up error integrations and alerts on `TASK_HISTORY` and `COPY_HISTORY`.
- **Security:** tasks run with the owner's role, so over-privileged owners are a risk. Clones copy production data into wherever they're created.
- **Misconception:** "Time Travel = backup." It isn't independent of the account or object.
- **Misconception:** "Cloning a database doubles storage." Only data that changes afterwards costs extra.
- **Misconception:** "Selecting from a stream consumes it." Only committed DML does.
- **Misconception:** "Snowpipe guarantees order and exactly-once end to end." It deduplicates by file within 14 days; order isn't guaranteed.

## 10. Real-world examples

**Banking: near-real-time card transaction pipeline**

- **Problem:** fraud and AML teams need card authorizations in Snowflake within minutes, and recovery has to be quick when a bad transform corrupts data.
- **How the features are used:**
  - The processor drops 1-minute batch files to ADLS, and **Snowpipe** auto-ingests them into `raw.card_auth` through Event Grid.
  - An **append-only stream** on the raw table feeds a **task** every 2 minutes. It `MERGE`s into `curated.card_txn`, deduplicating on `auth_id`.
  - A faulty release corrupted amounts. The fix was `CREATE TABLE ... CLONE curated.card_txn BEFORE (STATEMENT => '<bad merge id>')`, then a swap.

**Insurance: rating-engine UAT and quarter-end snapshots**

- **Problem:** testing a new auto-insurance rating model needs production-scale policy data, and actuaries need a fixed snapshot for reserving.
- **How the features are used:**
  - A **zero-copy clone** of the policy database (masked) goes to UAT (user acceptance testing) in minutes. Tests write freely without touching production.
  - Each quarter-end, `CREATE DATABASE claims_2026q3 CLONE claims AT (TIMESTAMP => '2026-09-30 23:59:59')` gives a reproducible dataset that costs storage only for data changed afterwards.

**Finance: custodian position files and audit reproducibility**

- **Problem:** daily and intraday position files from custodians, plus regulators and auditors asking "what did the risk report show on date X?"
- **How the features are used:**
  - **Snowpipe** loads custodian files.
  - A **standard stream** on positions drives a task graph: root task merges positions, child tasks compute exposures, and a finalizer task writes the run status.
  - **Time Travel** answers short-term "as reported" questions.
  - For multi-year regulatory retention, explicit dated snapshot tables are used instead, because Time Travel tops out at 90 days.

## 11. Practical example: an end-to-end pipeline on Azure

_Illustrative; not production-ready. Placeholders are in `<>`. Review security, naming and error handling._

```sql
-- 1. Secure access to ADLS (no keys in SQL)
CREATE STORAGE INTEGRATION adls_int TYPE = EXTERNAL_STAGE STORAGE_PROVIDER = 'AZURE'
  ENABLED = TRUE AZURE_TENANT_ID = '<tenant-id>'
  STORAGE_ALLOWED_LOCATIONS = ('azure://<acct>.blob.core.windows.net/claims/');
-- then: DESC INTEGRATION adls_int → grant the Snowflake app consent + Storage Blob Data Reader

CREATE NOTIFICATION INTEGRATION claims_evt TYPE = QUEUE ENABLED = TRUE
  NOTIFICATION_PROVIDER = AZURE_STORAGE_QUEUE
  AZURE_STORAGE_QUEUE_PRIMARY_URI = 'https://<acct>.queue.core.windows.net/claims-q'
  AZURE_TENANT_ID = '<tenant-id>';

CREATE STAGE raw.claims_stage URL = 'azure://<acct>.blob.core.windows.net/claims/fnol/'
  STORAGE_INTEGRATION = adls_int FILE_FORMAT = (TYPE = JSON);

-- 2. Landing table (append-only) + Snowpipe
CREATE TABLE raw.claims_landing (payload VARIANT, file_name STRING,
                                 loaded_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP());
CREATE PIPE raw.claims_pipe AUTO_INGEST = TRUE INTEGRATION = 'CLAIMS_EVT' AS
  COPY INTO raw.claims_landing (payload, file_name)
  FROM (SELECT $1, METADATA$FILENAME FROM @raw.claims_stage);

-- 3. CDC on landing
CREATE STREAM raw.claims_landing_s ON TABLE raw.claims_landing APPEND_ONLY = TRUE;

-- 4. Idempotent merge task (serverless)
CREATE TASK curated.t_merge_claims
  USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE = 'XSMALL'
  SCHEDULE = '2 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('raw.claims_landing_s')
AS
MERGE INTO curated.claim t
USING (
  SELECT payload:claimId::NUMBER      AS claim_id,
         payload:policyId::NUMBER     AS policy_id,
         payload:lossDate::DATE       AS loss_date,
         payload:status::STRING       AS status,
         payload:eventTs::TIMESTAMP_TZ AS event_ts
  FROM raw.claims_landing_s
  QUALIFY ROW_NUMBER() OVER (PARTITION BY claim_id ORDER BY event_ts DESC) = 1
) s ON t.claim_id = s.claim_id
WHEN MATCHED AND s.event_ts > t.event_ts THEN UPDATE SET
  status = s.status, loss_date = s.loss_date, event_ts = s.event_ts
WHEN NOT MATCHED THEN INSERT (claim_id, policy_id, loss_date, status, event_ts)
  VALUES (s.claim_id, s.policy_id, s.loss_date, s.status, s.event_ts);

ALTER TASK curated.t_merge_claims RESUME;

-- 5. Protection & testing
ALTER TABLE curated.claim SET DATA_RETENTION_TIME_IN_DAYS = 30;     -- Enterprise+
CREATE DATABASE claims_uat CLONE claims;                              -- instant UAT copy
```

**Why the `MERGE` is written this way:** `event_ts > t.event_ts` handles files that arrive out of order, and `QUALIFY` removes duplicates within a batch. Together they make the merge safe against duplicate or reordered files, which Snowpipe doesn't prevent.

## 12. Interview answer: the 2-minute version

> "Snowflake's main features come from its separation of storage and compute and its **immutable micro-partitions**. Beyond elastic warehouses and data sharing, four data-management features are built on that design.
>
> **Time Travel** keeps earlier versions of data for a retention period: 1 day by default, up to 90 on Enterprise. You can query with `AT` or `BEFORE` a timestamp, offset or statement ID, `UNDROP` objects, or clone a past state. After that comes 7 days of Fail-safe that only Snowflake Support can recover from. It isn't a backup, so I'd still use replication for disaster recovery.
>
> **Zero-copy cloning** creates a writable copy of a table, schema or database by copying metadata only. Storage is charged only as the copies diverge. It's ideal for UAT environments and quarter-end snapshots, with a few cautions: PII ends up in the clone, grants need checking, and cloned tasks start suspended.
>
> **Streams** are Snowflake's CDC. A stream is an offset on a table that returns net inserts, updates and deletes with metadata columns. It moves forward only when DML consumes it in a committed transaction. Standard streams handle `MERGE`-style sync; append-only streams are cheaper for landing tables. Unconsumed streams go stale, and each consumer needs its own stream.
>
> **Tasks** schedule SQL or procedures on a cron, as a dependency graph, or triggered by stream data, on a warehouse or serverless. A `WHEN SYSTEM$STREAM_HAS_DATA` check avoids paying for empty runs.
>
> **Snowpipe** does serverless, event-driven file ingestion. Cloud storage events trigger a `COPY` that runs within about a minute, with 14-day file deduplication but no ordering guarantee. Snowpipe Streaming covers row-level, seconds-latency ingestion.
>
> Put together: Snowpipe → append-only stream → task with an idempotent `MERGE` → curated table, with Time Travel and clones for recovery and testing. For larger declarative pipelines I'd compare this with dynamic tables or an external orchestrator."

## 13. Hands-on exercise and troubleshooting

**Setup:** a trial account (Enterprise trial). Use any small table.

1. **Time Travel:**
   - Create a table and insert 10 rows. Note the time.
   - Run `DELETE FROM t WHERE id < 5;` and note the query ID.
   - Query `BEFORE (STATEMENT => '<id>')`, then restore by cloning from that point.
   - `DROP TABLE t; UNDROP TABLE t;`
2. **Clone:** clone `t` to `t_dev`, update `t_dev`, and confirm `t` is unchanged.
3. **Stream:**
   - Create a stream `s` on `t`. Insert 2 rows, update 1 and delete 1.
   - `SELECT * FROM s` twice; the results should be the same both times.
   - `INSERT INTO t_audit SELECT * FROM s;`
   - Select from `s` again; it should now be empty.
4. **Task:** create a serverless task with a 1-minute schedule and `WHEN SYSTEM$STREAM_HAS_DATA('s')` that inserts the stream into `t_audit`, then resume it. Insert a row, wait about 1–2 minutes, and check `TASK_HISTORY()`.
5. **Snowpipe (internal-stage variant):**
   - Create a pipe _without_ auto-ingest on an internal stage.
   - `PUT` a CSV file, then `ALTER PIPE p REFRESH;`
   - Check `COPY_HISTORY` and `SYSTEM$PIPE_STATUS`.

**Expected outcomes:**

- The restored table has all 10 rows, and `UNDROP` brings the table back.
- The stream shows the update as a DELETE + INSERT pair with `ISUPDATE = TRUE`. It empties only after the `INSERT ... SELECT`.
- Task runs with no stream data show as SKIPPED.

**Troubleshooting:**

- **The task never runs.**
  - Check `SHOW TASKS` (state must be `started`).
  - Check that the owner role has `EXECUTE TASK`.
  - Check `TASK_HISTORY()` for `SKIPPED` (no stream data) or `FAILED` (read `ERROR_MESSAGE`).
- **The pipe shows nothing loaded.**
  - `SYSTEM$PIPE_STATUS` shows the pending file count and last error.
  - `COPY_HISTORY(TABLE_NAME => ..., START_TIME => ...)` shows per-file errors such as a format mismatch.
  - With auto-ingest, check the Event Grid subscription, the queue and the consent for the notification integration.
  - A file already loaded within 14 days is skipped silently.
- **The stream is unexpectedly empty.** Another job (another task or a colleague's DML) consumed it. Give each consumer its own stream. If `SHOW STREAMS` shows `stale = true`, recreate the stream and backfill.

## 14. Alternatives and comparison

**Incremental pipelines**

| Option                                | Style                          | Best for                                                                |
| ------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Streams + tasks                       | Imperative CDC + scheduling    | Full control, custom `MERGE` and SCD2 logic, procedural steps           |
| Dynamic tables                        | Declarative SQL + `TARGET_LAG` | Chains of joins and aggregations where you don't want to manage streams |
| dbt incremental models + orchestrator | Code-first, version-controlled | Teams that need lineage, tests and CI/CD across many models             |
| ADF / Airflow / Dagster               | External orchestration         | Cross-system dependencies, enterprise scheduling standards              |

**Ingestion**

| Option                                   | Latency           | Best for                                    |
| ---------------------------------------- | ----------------- | ------------------------------------------- |
| Bulk `COPY` on a warehouse               | Scheduled batches | Large daily or hourly loads                 |
| Snowpipe (auto-ingest / REST)            | About a minute    | Files arriving continuously                 |
| Snowpipe Streaming / Kafka connector     | Seconds           | Event streams, CDC tools, IoT and telemetry |
| Openflow, partner ELT (Fivetran, etc.) † | Varies            | Managed connectors to SaaS and databases    |

**Recovery**

| Option                            | Window                         | Independent of the source account? |
| --------------------------------- | ------------------------------ | ---------------------------------- |
| Time Travel                       | 0–90 days                      | No                                 |
| Fail-safe                         | 7 days, Snowflake Support only | No                                 |
| Clone snapshots                   | As long as kept (storage cost) | No (same account)                  |
| Replication / failover, backups † | Configurable                   | Yes (another account or region)    |

## 15. Summary

- Snowflake's features rest on **immutable micro-partitions plus metadata**.
- **Time Travel** reads earlier versions (up to 90 days on Enterprise), followed by 7 days of Fail-safe. It isn't a backup.
- **Zero-copy clone** copies metadata only and costs storage only as copies diverge. Mind PII, grants, cloned tasks and streams.
- **Streams** are offset-based CDC that advance only when consumed by committed DML. Use one per consumer, and they go stale if ignored.
- **Tasks** schedule SQL in Snowflake as graphs, on a warehouse or serverless. They're created suspended; use `SYSTEM$STREAM_HAS_DATA` to avoid empty runs.
- **Snowpipe** is serverless, event-driven file loading with 14-day file deduplication and no ordering guarantee, so downstream `MERGE`s must be idempotent.

## 16. Knowledge check

1. **Explain:** why can a 10 TB database be cloned in minutes and cost almost nothing at first?
2. **Apply:** a nightly task `MERGE`s from a stream on `orders`. A data scientist creates a second task that also reads that stream for a feature table. Soon both targets are missing rows. Why, and what's the fix?
3. **Decide:** auditors ask you to reproduce a regulatory report as it was 18 months ago. The team says "we have Time Travel." What do you recommend?

**Answers**

1. Micro-partitions are immutable, so a clone just creates new metadata pointing at the same partitions. Storage is billed only for partitions written later, by either side.
2. A stream's offset moves forward when _any_ committed DML consumes it, so each task sees only the changes since the other's last run. Create a separate stream per consumer, or have one task populate both targets in a single transaction.
3. Time Travel can't do it; the maximum is 90 days, and Fail-safe is 7 days of Snowflake-only recovery. You need explicit, retained snapshots: dated snapshot tables, clones made at each reporting date and kept, or bitemporal/SCD2 modeling. Use replication or backups for independence. Agree the retention policy with compliance.
