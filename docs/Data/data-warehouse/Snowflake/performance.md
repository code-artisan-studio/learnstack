---
title: Snowflake Performance
sidebar_label: Snowflake Performance
sidebar_position: 2
---

---

## 1. Overview

Snowflake has no indexes to add and no buffer pool to tune. Performance comes from four places:

1. **Reading less data:** pruning, clustering, selecting only the columns you need, and caching.
2. **Doing less work:** better SQL, precomputed results, and incremental processing.
3. **Having the right amount of compute:** the warehouse size, plus more clusters when there are many concurrent queries.
4. **Not waiting:** for a slot in the queue, for a lock, or for the warehouse to start.

The most important habit is to **diagnose before you pay**. A bigger warehouse costs twice as much per hour, and it fixes only some of these problems.

## 2. Definition and key terms

Performance in Snowflake means meeting latency, throughput and concurrency targets at an acceptable credit cost.

| Term                                  | Meaning                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pruning**                           | Skipping micro-partitions using per-partition min/max metadata. You see it as _Partitions scanned_ vs _Partitions total_.                                                          |
| **Clustering depth**                  | On average, how many micro-partitions overlap for a given value of a column. Lower is better, and 1 is perfect.                                                                    |
| **Clustering key**                    | Columns or expressions you choose so that **Automatic Clustering** keeps related rows in the same partitions. It runs as a background serverless service and is billed separately. |
| **Spilling**                          | A query runs out of memory and writes intermediate data to local disk (slower) or remote storage (much slower).                                                                    |
| **Queuing**                           | A query waits because the warehouse is busy (`QUEUED_OVERLOAD_TIME`) or still starting up (`QUEUED_PROVISIONING_TIME`).                                                            |
| **Search Optimization Service (SOS)** | A background-maintained access structure for selective point lookups (`=`, `IN`, substring and `LIKE` searches, VARIANT fields, geospatial). Enterprise edition and above.         |
| **Materialized view (MV)**            | A precomputed result on **one table**, kept up to date automatically, and usable by the optimizer to rewrite queries. Enterprise edition and above.                                |
| **Dynamic table**                     | A declarative, incrementally refreshed table (joins allowed) that you define with a `TARGET_LAG`. It's a pipeline tool and also a performance tool.                                |
| **Query Acceleration Service (QAS)**  | Offloads the large-scan parts of eligible queries to serverless compute. Enterprise edition and above.                                                                             |

**How these differ from what you may know:**

- **Clustering key vs a SQL Server clustered index:** a clustering key doesn't give row-level seeks. It only improves how well whole partitions can be skipped.
- **SOS vs an index:** SOS behaves more like an index, but it's maintained automatically in the background and billed separately.

## 3. How it works: where query time goes

```
TOTAL_ELAPSED_TIME
 ├─ COMPILATION_TIME          (Cloud Services: parse, optimize, prune using metadata)
 ├─ QUEUED_PROVISIONING_TIME  (warehouse resuming or resizing)
 ├─ QUEUED_OVERLOAD_TIME      (warehouse full → fix with multi-cluster / separate warehouse)
 ├─ TRANSACTION_BLOCKED_TIME  (waiting on a lock held by another DML statement)
 └─ EXECUTION_TIME            (warehouse work)
       ├─ Remote I/O     → read from object storage   (fix: pruning, fewer columns, cache)
       ├─ Local I/O      → read from SSD cache
       ├─ Processing     → joins, aggregates, sorts    (fix: SQL, precompute)
       ├─ Spilling       → local / remote disk        (fix: bigger size, less data)
       └─ Network        → data moved between nodes (fix: join keys, reduce data skew)
```

**How Snowflake decides what to run (pipeline):**

1. **Result cache.** If you run identical query text, the underlying data hasn't changed, the role has the required privileges, and there are no non-deterministic functions such as `CURRENT_TIMESTAMP()`, the result comes back with **no warehouse at all**. Results are kept 24 hours, and each reuse extends that, up to 31 days.
2. **Metadata-only answers.** `COUNT(*)`, `MIN` and `MAX` on supported column types can be answered from metadata alone.
3. **Compile and prune.** The optimizer applies filters to partition metadata, and at run time also uses join filters to skip partitions.
4. **Execute on the warehouse.** Each node processes its share of partitions in parallel. Data it has already read comes from its local SSD cache, which is lost when the warehouse suspends.
5. **Memory.** Each node's memory holds hash tables for joins and aggregations. When those overflow, data spills to local SSD and then to remote storage.

**Locking:** concurrent writes (`UPDATE`, `DELETE`, `MERGE`) to the **same table** generally block each other. Reads are never blocked, because they use snapshot isolation.

## 4. Internal architecture: what each technique changes behind the scenes

| Technique                   | What it changes internally                                                                       | What it costs                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Pruning** (filter design) | Fewer micro-partitions sent to the warehouse                                                     | Free                                                                                                 |
| **Clustering key**          | A background service rewrites partitions so similar values sit together, which reduces overlap   | Serverless credits, plus extra storage from rewritten partitions (old versions held for Time Travel) |
| **Search Optimization**     | Builds a separate structure that maps values to the partitions containing them                   | Serverless credits plus storage. High-churn tables cost more.                                        |
| **Materialized view**       | Stores precomputed results, refreshed in the background. The optimizer may use it automatically. | Serverless refresh credits plus storage. Single table, limited SQL.                                  |
| **Dynamic table**           | Refreshes incrementally to meet the target lag, using the warehouse you assign                   | Warehouse credits. A shorter lag means more refreshes.                                               |
| **Query Acceleration**      | Splits eligible scan-and-filter work across extra serverless compute                             | Serverless credits, capped by `QUERY_ACCELERATION_MAX_SCALE_FACTOR`                                  |
| **Bigger warehouse**        | More nodes, so more parallel scanning, more memory (less spilling) and more SSD cache            | Credits per hour double with each size step                                                          |
| **Multi-cluster**           | Adds clusters when queries queue, and removes them later                                         | Credits for each extra cluster while it runs                                                         |

**The scaling rule:** if a query is large enough to use all the parallelism, doubling the warehouse size roughly halves its run time at **about the same total cost**, because it runs at twice the rate for half as long. Small queries don't get that speedup, so making them bigger just costs more. Measure it rather than assuming it.

## 5. The methods: a diagnose-and-fix guide

### A. Measure first

```sql
-- Top 20 most expensive repeated query patterns, last 7 days (illustrative)
SELECT query_parameterized_hash,
       ANY_VALUE(query_text)                         AS sample_sql,
       COUNT(*)                                      AS runs,
       SUM(total_elapsed_time)/1000                  AS total_sec,
       AVG(partitions_scanned/NULLIF(partitions_total,0)) AS scan_ratio,
       SUM(bytes_spilled_to_remote_storage)          AS remote_spill,
       SUM(queued_overload_time)/1000                AS queued_sec
FROM snowflake.account_usage.query_history
WHERE start_time > DATEADD(day,-7,CURRENT_TIMESTAMP())
  AND warehouse_name IS NOT NULL
GROUP BY 1 ORDER BY total_sec DESC LIMIT 20;
```

For a single query, open the **Query Profile** or call `GET_QUERY_OPERATOR_STATS(query_id)`. Look for:

- **Most expensive nodes:** the operators taking the most time.
- **Pruning:** _Partitions scanned_ compared with _Partitions total_.
- **Spill:** _Bytes spilled_ to local or remote storage.
- **Exploding joins:** a join that outputs far more rows than it takes in.

### B. Match the symptom to the fix

| Symptom (where to see it)                                      | Likely cause                                                     | Fix                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Scanned ≈ total partitions                                     | Filter can't prune                                               | Write filters as ranges on raw columns (`col >= '2026-01-01'`, not `YEAR(col)=2026`); match data types; cluster the table |
| Selective lookup (`WHERE account_id = ?`) still scans a lot    | High-cardinality column that clustering can't help               | Search Optimization on that column                                                                                        |
| Large `Bytes spilled to remote`                                | Not enough memory for the join or aggregate                      | Size up one step; filter and project before joining; break the query into steps                                           |
| Join outputs far more rows than inputs                         | Many-to-many join or missing join condition                      | Fix the join keys; remove duplicates first; use `EXISTS` for semi-joins                                                   |
| High `QUEUED_OVERLOAD_TIME`                                    | Concurrency                                                      | Multi-cluster (scale out) or a separate warehouse, **not** a bigger size                                                  |
| High `QUEUED_PROVISIONING_TIME`                                | Cold start or resize                                             | Adjust auto-suspend for latency-sensitive BI; avoid frequent resizing                                                     |
| High `TRANSACTION_BLOCKED_TIME`                                | DML contention on one table                                      | Batch your MERGEs; write append-only into staging, then merge once                                                        |
| High `COMPILATION_TIME`                                        | Very complex SQL: huge view stacks, giant `IN` lists, many joins | Simplify views; turn long lists into a join against a table; materialize intermediate results                             |
| The same aggregate is recomputed all day                       | Repeated work                                                    | Materialized view (one table) or dynamic table (joins)                                                                    |
| Occasional huge-scan queries hurt an otherwise small warehouse | Unpredictable workload                                           | Query Acceleration Service (check `QUERY_ACCELERATION_ELIGIBLE`)                                                          |
| Dashboard slow after the warehouse resumes                     | Local SSD cache was emptied                                      | Longer auto-suspend for that warehouse, and route it to the same warehouse consistently                                   |

### C. SQL rules that pay off every time

- **Read less:** select only the columns you need (`SELECT *` reads every column from storage).
- **Filter early, before joins.** Use `QUALIFY` for window-function filters, and `UNION ALL` instead of `UNION` when you don't need duplicates removed.
- **Avoid unbounded `ORDER BY`** on large results. Use `ORDER BY ... LIMIT n`, which the engine runs as an efficient top-K.
- **Join on columns of the same type** (`NUMBER` to `NUMBER`, not `NUMBER` to `VARCHAR`).
- **JSON:** extract frequently filtered JSON (VARIANT) fields into typed columns.
- **Avoid row-by-row processing:** no loops issuing single-row INSERTs or UPDATEs. Work in sets.
- **Loading:** use `COPY` with files of about 100–250 MB compressed, which is Snowflake's guidance. Use Snowpipe or Snowpipe Streaming instead of many tiny `INSERT`s.
- **Load in a useful order:** `INSERT ... SELECT ... ORDER BY <common filter column>` gives good clustering for free.

### D. Warehouse strategy

- **Separate warehouses per workload** (ETL, BI, data science, ad-hoc) so each can be sized and isolated.
- **Size for the heaviest query that still needs to be fast.** Use multi-cluster for peak concurrency.
- **Auto-suspend:** 60 seconds for ETL. Longer (5–10 minutes) for BI warehouses that benefit from a warm cache.
- **Guardrails:** `STATEMENT_TIMEOUT_IN_SECONDS` and `STATEMENT_QUEUED_TIMEOUT_IN_SECONDS` to stop runaway queries, and resource monitors to cap credits.
- **Snowpark-optimized warehouses** for memory-heavy Python ML jobs and user-defined functions.
- **Newer warehouse generations or adaptive compute:** check current documentation for availability and pricing before relying on them.

### E. Clustering-key guidance

- **Which tables:** only large tables (generally multi-TB) where queries filter consistently on the same columns and pruning is poor.
- **Check first:** run `SELECT SYSTEM$CLUSTERING_INFORMATION('db.sch.tbl','(loss_date)');` and look at `average_depth`.
- **Number of columns:** at most 3–4 key columns, with the lower-cardinality column first. Reduce very high cardinality with an expression, e.g. `TO_DATE(event_ts)` instead of the raw timestamp.
- **Avoid on high-churn tables:** if the table is updated constantly, Automatic Clustering keeps rewriting partitions and can cost more than it saves.

## 6. When to use which technique

- **Pruning and SQL hygiene:** always. They're free.
- **Clustering:** large tables, repeated range filters on the same columns, measurably poor pruning.
- **Search Optimization:** needle-in-a-haystack lookups by ID, email or account number; text searches; filters on JSON fields.
- **Materialized view:** a hot, repeated aggregate or projection of one table, where data changes less often than it's queried.
- **Dynamic table:** precomputed joins and aggregates with an acceptable freshness lag (minutes).
- **Query Acceleration Service:** a mixed workload with occasional large, selective scans.
- **Bigger warehouse:** large queries that spill or scan heavily. **Multi-cluster:** queuing at peak times.

## 7. When not to use them

- **Clustering:** not for small tables (a few GB), tables updated row by row all the time, or columns you rarely filter on.
- **Search Optimization:** not for broad analytical scans, low-cardinality filters, or tables with very heavy changes, where the maintenance cost dominates.
- **Materialized views:** not when the underlying table changes constantly and the view is rarely queried. Also not when you need joins; use a dynamic table instead.
- **Sizing up:** never to fix queuing, poor pruning or lock contention.
- **Snowflake itself:** not as a sub-50 ms per-row serving layer. Put a cache or an operational database in front.

## 8. Benefits

- **Most tuning is free:** filter design, column selection and load order cost nothing.
- **The fix can match the cause:** compute, layout, precomputing and concurrency each have their own lever.
- **Serverless features scale per workload,** not for the whole account.
- **Good diagnostics:** `ACCOUNT_USAGE`, Query Profile and operator statistics give evidence about a query's behavior, not guesswork.

## 9. Trade-offs, risks and misconceptions

- **Cost vs speed:** every accelerator except good SQL costs credits, storage, or both. Track them in `AUTOMATIC_CLUSTERING_HISTORY`, `SEARCH_OPTIMIZATION_HISTORY`, `MATERIALIZED_VIEW_REFRESH_HISTORY` and `QUERY_ACCELERATION_HISTORY`.
- **Clustering side effects:** Automatic Clustering on a high-churn table can quietly become one of your biggest costs.
- **Freshness vs speed:** materialized views and dynamic tables trade freshness for speed. Agree the lag with the business, especially for regulatory reports.
- **Unreliable benchmarks:** the result cache makes repeat runs look instant, so set `USE_CACHED_RESULT = FALSE` when testing. Likewise, a warm SSD cache makes the second run look faster than real-world cold starts.
- **Observability lag:** `ACCOUNT_USAGE` views run behind real time (up to about 45 minutes for `QUERY_HISTORY`). Use `INFORMATION_SCHEMA.QUERY_HISTORY()` for near-real-time checks.
- **Security can cost performance:** masking and row-access policies add work to every query. Keep policy functions simple and avoid subqueries against large mapping tables inside them.
- **Misconception:** "Snowflake is auto-tuned, so there's nothing to do." Layout, SQL and workload design still decide most of the outcome.

## 10. Real-world examples

**Banking: fraud analyst account lookup**

- **Problem:** analysts search 5 years of transactions (tens of billions of rows) by `account_id` or card token. Queries took over 40 seconds because the table is clustered by `txn_date`, so an ID lookup touches nearly every partition.
- **How it was addressed:**
  - `ALTER TABLE txn ADD SEARCH OPTIMIZATION ON EQUALITY(account_id, card_token);`
  - Lookups drop to seconds while the date clustering stays in place for range reports.
  - Cost is tracked monthly against the analyst time saved.

**Insurance: claims operations dashboard**

- **Problem:** a Power BI dashboard joins claims, policies and adjusters. It recomputed the same aggregates every few minutes for 200 users and queued every morning.
- **How it was addressed:**
  - A **dynamic table** with `TARGET_LAG = '15 minutes'` holds the pre-joined claims summary.
  - `BI_WH` becomes multi-cluster (1–3 clusters) with a 10-minute auto-suspend so the cache stays warm.
  - The dashboard queries the dynamic table. Because results repeat, many hits come from the result cache.

**Finance: end-of-day market-risk batch**

- **Problem:** the VaR (Value at Risk) aggregation across positions × scenarios × prices regularly missed its 6 am deadline. Query Profile showed 300+ GB spilled to remote storage and an exploding join on scenario data.
- **How it was addressed:**
  - Fix the join first: aggregate positions to instrument level before joining to scenarios.
  - Then size up from L to XL only for the batch window, using `ALTER WAREHOUSE` at the start of the job and back down at the end.
  - Run time and cost both fell, because the remote spill was the bottleneck.

## 11. Practical example: tuning a slow claims query

_Illustrative; not production-ready without review._

```sql
-- BEFORE: function on filter column, SELECT *, join type mismatch
SELECT *
FROM claims c
JOIN policy p ON c.policy_id = p.policy_no_str          -- NUMBER vs VARCHAR
WHERE YEAR(c.loss_date) = 2026 AND c.state = 'WI';

-- AFTER: prunable range filter, projected columns, typed join
SELECT c.claim_id, c.loss_date, c.paid_amt, p.product_line
FROM claims c
JOIN policy p ON c.policy_id = p.policy_id               -- both NUMBER
WHERE c.loss_date >= '2026-01-01' AND c.loss_date < '2027-01-01'
  AND c.state = 'WI';

-- Layout: check, then cluster if depth is poor
SELECT SYSTEM$CLUSTERING_INFORMATION('claims', '(loss_date, state)');
ALTER TABLE claims CLUSTER BY (loss_date, state);

-- Workload guardrails for the BI warehouse
ALTER WAREHOUSE bi_wh SET
  MIN_CLUSTER_COUNT = 1, MAX_CLUSTER_COUNT = 3,
  AUTO_SUSPEND = 600,
  STATEMENT_TIMEOUT_IN_SECONDS = 900,
  ENABLE_QUERY_ACCELERATION = TRUE, QUERY_ACCELERATION_MAX_SCALE_FACTOR = 4;
```

**Validate every change by comparing before and after:**

- partitions scanned
- bytes scanned
- spill
- elapsed time
- **credits**, from `WAREHOUSE_METERING_HISTORY` and the serverless history views

## 12. Interview answer: the 2-minute version

> "I approach Snowflake performance as **diagnose first, then apply the cheapest fix that targets the cause**, because every option has a credit cost.
>
> First I split elapsed time using Query Profile and `QUERY_HISTORY` into **compilation, queuing, lock-blocked time and execution**, and grouped by parameterized hash to find the expensive repeated queries.
>
> Then I map symptoms to fixes:
>
> - **Poor pruning**, where partitions scanned is close to the total: fix the filters (no functions on the filter column, matching types), load data in order, and add a **clustering key** for large tables with consistent filters.
> - **Selective lookups** by ID: use the **Search Optimization Service**.
> - **Spilling**: reduce data before joins, then **size up**. For parallelizable queries that's roughly the same cost, just faster.
> - **Queuing**: **scale out** with multi-cluster or a separate warehouse, not a bigger size.
> - **Repeated aggregates**: **materialized views** for one table, **dynamic tables** for joins.
> - **Occasional large scans**: the **Query Acceleration Service**.
> - **Lock contention**: batch the DML.
>
> I also use the three caches: the result cache, the warehouse SSD cache by tuning auto-suspend, and metadata answers. And I add guardrails: statement timeouts, resource monitors, and per-workload warehouses for chargeback.
>
> Finally, I validate each change on both latency and credits, with the result cache turned off during testing."

## 13. Hands-on exercise and troubleshooting

**Setup:** a trial account, an XS warehouse, and `SNOWFLAKE_SAMPLE_DATA.TPCH_SF100`.

1. `ALTER SESSION SET USE_CACHED_RESULT = FALSE;`
2. **Pruning test.** Run the query with `WHERE YEAR(o_orderdate) = 1995`, then with `WHERE o_orderdate >= '1995-01-01' AND o_orderdate < '1996-01-01'`. Compare _Partitions scanned_ for the two runs.
3. **Spill test.** On XS, join `lineitem` to `orders` on `orderkey`, group by `o_custkey` with `COUNT(DISTINCT l_partkey)`, and note the spill. Resize to M and run again. Compare time **and** run time × credits per hour.
4. **Concurrency check.** `SELECT query_id, queued_overload_time FROM TABLE(information_schema.query_history()) ORDER BY start_time DESC LIMIT 20;`

**Expected outcomes:**

- The range filter scans fewer or equal partitions. The table is loaded roughly in date order, so you should see clear pruning, although the optimizer sometimes handles simple date functions too.
- XS shows local and possibly remote spill. M removes or reduces the spill and should be faster at a similar total cost.

**Troubleshooting:**

- **"Both versions show the same, tiny elapsed time."** The result cache is still being used. Check that the session parameter is set and the query text actually changed. The profile will show _Query Result Reuse_.
- **"M was no faster than XS."** The query is too small, or dominated by one step that can't run in parallel. Check the most expensive node, and look for skew: one join key holding most of the rows. That's the signature of a query where sizing up won't help, so stay on the smaller size.

## 14. Comparison: choosing the lever

| Lever                       | Fixes                                       | Cost type                      | Edition     |
| --------------------------- | ------------------------------------------- | ------------------------------ | ----------- |
| SQL rewrite / filter design | Pruning, exploding joins, compile time      | Free                           | All         |
| Load order / clustering key | Range-filter pruning                        | Serverless + storage           | All         |
| Search Optimization         | Point lookups, text search, VARIANT filters | Serverless + storage           | Enterprise+ |
| Materialized view           | Repeated single-table aggregates            | Serverless + storage           | Enterprise+ |
| Dynamic table               | Repeated joins/aggregates with lag          | Warehouse                      | All         |
| Query Acceleration          | Occasional large scans                      | Serverless (capped)            | Enterprise+ |
| Size up                     | Spill, large scans                          | 2× credits per hour per step   | All         |
| Multi-cluster               | Queuing                                     | Credits for each extra cluster | Enterprise+ |
| Auto-suspend tuning         | Cold-cache latency                          | Idle credits                   | All         |

**Selection rule:** first the free fixes (SQL and layout), then structural ones (clustering, Search Optimization, precomputation), then compute (size up or scale out). Always confirm with before-and-after numbers.

## 15. Summary

- Break elapsed time into compile, queue, blocked and execute. Each has a different fix.
- **Read less** (pruning, projection, clustering, Search Optimization), **compute less** (MVs, dynamic tables, SQL), **right-size compute** (scale up for spill, scale out for queues), **don't wait** (isolation, auto-suspend, batched DML).
- Bigger warehouses only help queries that can use the extra parallelism. For those, the cost stays roughly the same.
- Every accelerator has an ongoing cost. Measure credits as well as latency.

## 16. Knowledge check

1. **Explain:** why doesn't a clustering key on `txn_date` help `WHERE account_id = 12345`, and what does?
2. **Apply:** a query shows 2 TB spilled to remote storage on a Medium warehouse, and the profile shows a join producing 50× its input rows. What do you do first?
3. **Decide:** BI users complain at 9 am. Each query runs in about 3 seconds alone, `QUEUED_OVERLOAD_TIME` is high, and the warehouse is a single-cluster Large. Your manager suggests 2XL. Do you agree?

**Answers**

1. Clustering orders the data by date, so the range of `account_id` values in each partition spans almost everything and nothing can be pruned. Search Optimization with `EQUALITY(account_id)` maps each value to the partitions that hold it.
2. Fix the exploding join first: check the join keys, remove duplicates, or aggregate before joining. The spill is mostly a result of that join, and sizing up would just pay to process rows that shouldn't exist. Resize only if it still spills afterwards.
3. No. The problem is concurrency, not the speed of each query. Use a multi-cluster warehouse (e.g. 1–4 clusters of a smaller or same size), or split heavy users onto their own warehouse. 2XL costs 4× as much per hour as Large and only partly reduces the queue.
