---
title: Snowflake Cost
sidebar_label: Snowflake Cost
sidebar_position: 3
---

---

## 1. Plain-language overview

Snowflake bills like a taxi meter, not like a lease. You pay for:

- **compute while it runs,** measured per second
- **data you keep,** per TB per month
- **background services** that run on your behalf
- **data moved** out of a region or cloud

**Why that matters:** a single warehouse accidentally left running all day, a dashboard that queries every minute, or background clustering on a busy table can each cost more than the real analytics work. The flexibility that makes Snowflake fast also makes waste easy, so cost has to be designed in, not reviewed once a quarter.

**A typical split:** in most accounts, **compute is roughly 70–90% of the bill** and storage is a smaller share. This is a common industry observation, not a published Snowflake figure, so check it against your own account. It means the biggest savings are almost always in compute.

## 2. The five sources of cost

| Source                    | What's billed                                                                                                                                                               | Unit                                                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Warehouse compute**  | Virtual warehouses while running (including idle time before they suspend)                                                                                                  | Credits/hour by size: XS 1, S 2, M 4, L 8, XL 16, 2XL 32, 3XL 64, 4XL 128, 5XL 256, 6XL 512. Billed per second with a **60-second minimum each time it resumes**. Multi-cluster = × number of running clusters. Snowpark-optimized warehouses and newer warehouse generations use higher rates. |
| **2. Serverless compute** | Snowpipe, Snowpipe Streaming, Automatic Clustering, materialized view refresh, Search Optimization, Query Acceleration, serverless tasks, replication, AI services (Cortex) | Credits at feature-specific rates (Service Consumption Table). Some also charge per file or per token.                                                                                                                                                                                          |
| **3. Cloud services**     | Compilation, metadata, authentication, `SHOW`/`DESCRIBE` commands, result-cache hits                                                                                        | Credits, but **charged only for the part above 10% of that day's warehouse compute**                                                                                                                                                                                                            |
| **4. Storage**            | Compressed data: active tables + Time Travel + Fail-safe + internal stages + changed data held by clones + MV/SOS structures                                                | Flat rate per TB per month (average over the month)                                                                                                                                                                                                                                             |
| **5. Data transfer**      | Moving data **out** to another region or cloud (replication, unloading, external functions)                                                                                 | Per TB. Loading data in is free.                                                                                                                                                                                                                                                                |

**What multiplies all of these:**

- **Edition:** Standard, Enterprise, Business Critical or Virtual Private Snowflake. A higher edition means a higher price per credit.
- **Region and cloud.**
- **Contract:** on-demand, or a **capacity** contract where you pre-purchase at a discount.

Edition is set **per account**, so dev and sandbox accounts in the same organization can run on a cheaper edition than production.

## 3. How it works: how money is charged

```
            ┌──────── Your actions ─────────┐
 Query ─────► Cloud Services (compile)      │──► CS credits (only >10% of WH/day billed)
            │      │                        │
            │      ▼ result cache hit? ──► free compute
            │  Warehouse resumes ───────────┼──► 60-s minimum, then per-second
            │  runs queries + idles ────────┼──► credits until AUTO_SUSPEND fires
            └───────────────────────────────┘
 DML changes data ──► new micro-partitions ──► old ones kept for Time Travel + Fail-safe (storage)
                 └──► triggers Auto-Clustering / MV refresh / SOS maintenance (serverless credits)
 Files land ────────► Snowpipe (serverless credits + per-file overhead)
 Replication / unload cross-region ──► data-transfer charges + replication credits
```

**The key point:** you pay for warehouse **uptime, not for query work**. A warehouse that runs 2 seconds of queries every 4 minutes with `AUTO_SUSPEND = 300` never suspends, so it bills 24 hours a day. This is the single most common source of waste.

**Storage lifecycle of one row update on a permanent table:**

1. The new micro-partition is active storage.
2. The old micro-partition is kept for Time Travel (1–90 days).
3. It then sits in Fail-safe for 7 more days.
4. Only then is it deleted.

So high-churn tables with long retention can hold **many times their visible size**.

## 4. Behind the scenes: where each cost source comes from

- **Warehouse billing:** credits accrue for every running cluster from resume until suspend. Resizing affects new queries, and billing changes once the new nodes are provisioned. Idle time is the gap between warehouse metering and query time.
- **Per-query cost:** `QUERY_ATTRIBUTION_HISTORY` assigns warehouse credits to individual queries, **excluding idle time**. That's why query costs added up don't match the warehouse bill; the gap is idle time.
- **Cloud services adjustment:** `METERING_DAILY_HISTORY` shows `CREDITS_USED_CLOUD_SERVICES` and `CREDITS_ADJUSTMENT_CLOUD_SERVICES`. Only what's left after the 10% adjustment is billed.
- **Storage metrics:** `TABLE_STORAGE_METRICS` splits each table into `ACTIVE_BYTES`, `TIME_TRAVEL_BYTES`, `FAILSAFE_BYTES` and `RETAINED_FOR_CLONE_BYTES`. That's where hidden storage shows up.
- **Serverless features** each have their own history view: `AUTOMATIC_CLUSTERING_HISTORY`, `PIPE_USAGE_HISTORY`, `SEARCH_OPTIMIZATION_HISTORY`, `MATERIALIZED_VIEW_REFRESH_HISTORY`, `QUERY_ACCELERATION_HISTORY`, `SERVERLESS_TASK_HISTORY`, `REPLICATION_USAGE_HISTORY`.
- **Dollar amounts:** `ORGANIZATION_USAGE.USAGE_IN_CURRENCY_DAILY` converts usage to currency at your contracted rates.
- **Controls:**
  - **Resource monitors** watch **warehouse** credits only, and can notify or suspend.
  - **Budgets** cover both warehouses and serverless features and notify you, but don't stop anything.
  - **Statement timeouts** stop individual runaway queries.

## 5. Methods to reduce cost, by source

### A. Warehouse compute (usually the biggest lever)

| Technique                           | How                                                                                                                                 | Watch out for                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Short auto-suspend**              | `AUTO_SUSPEND = 60` for ETL, ad-hoc and data science                                                                                | BI warehouses lose their SSD cache; 300–600 seconds may be better overall. Don't go below 60, because each resume bills a 60-second minimum anyway. |
| **Right-size**                      | Start small. Size up only when the profile shows spill or long large scans. Size down when `WAREHOUSE_LOAD_HISTORY` shows low load. | For parallel-friendly queries, a bigger size can be cost-neutral and faster, so measure **credits per job**, not credits per hour                   |
| **Consolidate**                     | Merge rarely used warehouses that are mostly idle                                                                                   | Keep isolation where an SLA or chargeback needs it                                                                                                  |
| **Multi-cluster caps**              | `MAX_CLUSTER_COUNT` set realistically; `SCALING_POLICY = 'ECONOMY'` for latency-tolerant work                                       | Economy policy lets queries queue a little before adding clusters                                                                                   |
| **Scheduled sizing**                | Size up for the batch window, then back down, from the job itself or a task                                                         | Remember to scale back down                                                                                                                         |
| **Stop runaway queries**            | `STATEMENT_TIMEOUT_IN_SECONDS`, `STATEMENT_QUEUED_TIMEOUT_IN_SECONDS` per warehouse or user                                         | Set them per workload, not one global value                                                                                                         |
| **Do less work**                    | Performance fixes (pruning, projection, no exploding joins) = fewer credits                                                         | See the performance lesson                                                                                                                          |
| **Incremental, not full rebuild**   | Streams + tasks, dynamic tables, or `MERGE` of only the changes instead of nightly `CREATE OR REPLACE` over the full history        | Dynamic tables with a very short `TARGET_LAG` can cost more than a daily batch                                                                      |
| **Reduce query frequency**          | BI refresh schedules, extracts or caching in the BI tool, result-cache-friendly SQL (no `CURRENT_TIMESTAMP()` in dashboard queries) | Agree how fresh data needs to be with the business                                                                                                  |
| **Kill keep-alive traffic**         | Find monitoring tools, health checks or connection pools issuing `SELECT 1` against a warehouse                                     | These are often invisible, so look for tiny repeated queries                                                                                        |
| **Serverless tasks for small jobs** | Small, frequent tasks without a dedicated warehouse                                                                                 | Different rate per credit, so compare first                                                                                                         |

### B. Serverless compute

- **Automatic Clustering:** review `AUTOMATIC_CLUSTERING_HISTORY`. On high-churn tables it can cost more than the queries it speeds up. Options: suspend it (`ALTER TABLE ... SUSPEND RECLUSTER`), use a coarser key such as `TO_DATE(ts)`, or load the data already sorted instead.
- **Search Optimization:** enable it **only on specific columns and methods** (`ON EQUALITY(account_id)`), not for a whole table.
- **Materialized views:** drop ones that are rarely queried; check usage with `ACCESS_HISTORY`.
- **Query Acceleration:** cap it with `QUERY_ACCELERATION_MAX_SCALE_FACTOR`.
- **Snowpipe:** batch files to about 100–250 MB compressed. Thousands of tiny files add per-file overhead. For row-level streaming, Snowpipe Streaming is usually cheaper than micro-files.
- **Replication:** replicate only the databases you need, at the refresh frequency your RPO (recovery point objective) actually requires.

### C. Cloud services

- **Avoid millions of tiny queries:** batch single-row `INSERT`s into bulk loads.
- **Reduce metadata polling:** cut automated `SHOW`, `DESCRIBE` and `INFORMATION_SCHEMA` polling by tools.
- **Simplify complex SQL:** huge view stacks and giant `IN` lists are expensive to compile.

### D. Storage

| Technique                                                            | How                                                                                                                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transient and temporary tables** for staging and intermediate data | No Fail-safe, Time Travel of 0–1 day: `CREATE TRANSIENT TABLE ...` or `CREATE TRANSIENT SCHEMA`                                                            |
| **Right-size retention**                                             | `DATA_RETENTION_TIME_IN_DAYS`: long only where recovery or audit needs it, short or 0 for rebuildable layers                                               |
| **Drop unused objects**                                              | Find tables not read in 90+ days using `ACCESS_HISTORY`, then confirm with the owner before dropping                                                       |
| **Clean stages**                                                     | `COPY ... PURGE = TRUE`, `REMOVE @stage`, lifecycle rules on external stages                                                                               |
| **Manage clones**                                                    | Dev clones that diverge from production build up their own storage; give them an expiry date                                                               |
| **Watch churn**                                                      | A full `CREATE OR REPLACE` or delete-and-reinsert each night makes the whole table "changed" every day, which multiplies Time Travel and Fail-safe storage |

### E. Data transfer

- **Same region as consumers:** put accounts in the same region as the people and systems that use them.
- **Share in place:** prefer Secure Data Sharing within a region over copying data.
- **Replicate only what's needed** across regions or clouds.

### F. Commercial and governance (FinOps)

- **Capacity contract** once usage is predictable. Watch out for both expired unused credits and overruns.
- **Edition per account:** don't run sandboxes on Business Critical.
- **Attribution:**
  - one warehouse per team or domain
  - **object tags** (`cost_center`) on warehouses and databases
  - `QUERY_TAG` set by applications and dbt
- **Guardrails:**
  - **resource monitors** that notify at 80% and suspend at 100% for non-critical warehouses
  - **Budgets** for serverless features
  - limit who can create or resize warehouses through RBAC
- **Review cadence:** a weekly cost review of the top warehouses, top query patterns, serverless trends and storage growth, with named owners.

## 6. When to push cost hardest, and when not to

**Push hard:**

- dev, test and sandbox accounts
- ad-hoc analytics
- staging layers that can be rebuilt
- BI refresh schedules nobody looks at
- accounts with fast-growing serverless lines

**Be careful:**

- **Regulatory and audit data:** retention settings may be required. Don't cut Time Travel on records that need recovery without risk and compliance sign-off.
- **SLA-critical pipelines:** risk, regulatory and close jobs. Missing a deadline costs more than credits.
- **Latency-sensitive BI:** an auto-suspend that's too short makes the user experience worse.
- **Engineering time:** don't spend a sprint saving $200 a month.

## 7. Benefits of active cost management

- **Lower spend:** savings come mostly from idle time and repeated work, with little or no loss in performance.
- **Predictable budgets** and fair chargeback, which changes how teams behave.
- **Faster queries:** most compute savings come from performance fixes.
- **Better governance:** cleaner data, fewer unused tables and copies of data, which also reduces exposure to data-privacy risk.

## 8. Trade-offs, risks and misconceptions

- **Cost vs latency:** short auto-suspend and Economy scaling save credits but add cold starts and queuing.
- **Cost vs recoverability:** transient tables and short retention lose the ability to recover data or go back in time. Decide each layer deliberately.
- **Cost vs freshness:** fewer refreshes means cheaper but staler data.
- **Visibility gaps:** `ACCOUNT_USAGE` runs hours behind real time, and query attribution excludes idle time. Use them for trends, not for real-time control.
- **Misconception:** "Resource monitors protect the whole bill." They cover warehouses only; serverless features and storage need Budgets and reviews.
- **Misconception:** "Smaller warehouse = cheaper." Not if a job runs 4× as long or spills heavily. Judge by credits per job.
- **Misconception:** "Storage is cheap, ignore it." Time Travel and Fail-safe on high-churn tables, and forgotten clones, quietly add up.
- **Misconception:** "Snowflake bills per query." It bills per warehouse uptime. Idle time is real money.

## 9. Real-world examples

**Banking: dev and test sprawl**

- **Problem:** each sprint team cloned the production customer and transaction databases. The clones diverged through test data loads and kept 90-day Time Travel, and storage doubled in a year. The clones also contained real PII (personally identifiable information).
- **How it was addressed:**
  - Clones are created from a masked, smaller subset, as **transient** databases with 1-day retention.
  - A tag `expires_on` plus a weekly task flags expired clones for owner approval and removal.
  - Dev accounts moved to a cheaper edition.
  - Storage fell, and so did the amount of PII outside production.

**Insurance: the always-on BI warehouse**

- **Problem:** an agent-portal dashboard refreshed every 2 minutes, and its query included `CURRENT_TIMESTAMP()`. The result cache never hit, and the Medium warehouse with a 10-minute auto-suspend ran 24×7.
- **Illustrative cost:** 4 credits × 24 h × 30 days = 2,880 credits/month, about $8,600 at $3/credit.
- **How it was addressed:**
  - Remove the non-deterministic function so results can be cached.
  - Refresh every 15 minutes during business hours only.
  - Drop to Small with a 5-minute auto-suspend.
- **Illustrative result:** roughly 2 credits × 11 h × 22 days ≈ 484 credits, about an 80%+ reduction. Validate this on your own metering data.

**Finance: clustering on a tick table**

- **Problem:** a market-data table receiving continuous small inserts was clustered on `(symbol, ts)`. Automatic Clustering credits exceeded all analyst query credits on that table.
- **How it was addressed:**
  - Change the key to `(TO_DATE(ts), symbol)`.
  - Land intraday data in a transient staging table, then insert sorted daily batches into the main table.
  - Clustering credits dropped sharply, and pruning for daily risk queries stayed good.

## 10. Practical example: a cost-governance starter kit

_Illustrative; review against your standards before production use._

```sql
-- 1. Where does compute go? (last 30 days, by warehouse)
SELECT warehouse_name, SUM(credits_used) AS credits
FROM snowflake.account_usage.warehouse_metering_history
WHERE start_time >= DATEADD(day,-30,CURRENT_DATE)
GROUP BY 1 ORDER BY 2 DESC;

-- 2. Idle share per warehouse (metered vs attributed to queries)
WITH m AS (SELECT warehouse_name, SUM(credits_used_compute) c
           FROM snowflake.account_usage.warehouse_metering_history
           WHERE start_time >= DATEADD(day,-30,CURRENT_DATE) GROUP BY 1),
     q AS (SELECT warehouse_name, SUM(credits_attributed_compute) c
           FROM snowflake.account_usage.query_attribution_history
           WHERE start_time >= DATEADD(day,-30,CURRENT_DATE) GROUP BY 1)
SELECT m.warehouse_name, m.c AS metered, q.c AS used_by_queries,
       1 - q.c/NULLIF(m.c,0) AS idle_ratio
FROM m LEFT JOIN q USING (warehouse_name) ORDER BY metered DESC;

-- 3. Most expensive repeated query patterns
SELECT query_parameterized_hash, ANY_VALUE(query_tag) tag,
       COUNT(*) runs, SUM(credits_attributed_compute) credits
FROM snowflake.account_usage.query_attribution_history
WHERE start_time >= DATEADD(day,-30,CURRENT_DATE)
GROUP BY 1 ORDER BY credits DESC LIMIT 20;

-- 4. Hidden storage
SELECT table_catalog, table_schema, table_name,
       active_bytes/1e12 tb_active, time_travel_bytes/1e12 tb_tt,
       failsafe_bytes/1e12 tb_fs, retained_for_clone_bytes/1e12 tb_clone
FROM snowflake.account_usage.table_storage_metrics
WHERE deleted = FALSE
ORDER BY (time_travel_bytes + failsafe_bytes) DESC LIMIT 20;

-- 5. Guardrails
CREATE RESOURCE MONITOR adhoc_rm WITH CREDIT_QUOTA = 300 FREQUENCY = MONTHLY
  START_TIMESTAMP = IMMEDIATELY
  TRIGGERS ON 80 PERCENT DO NOTIFY ON 100 PERCENT DO SUSPEND;
ALTER WAREHOUSE adhoc_wh SET RESOURCE_MONITOR = adhoc_rm,
  AUTO_SUSPEND = 60, STATEMENT_TIMEOUT_IN_SECONDS = 1800;

-- 6. Attribution
CREATE TAG IF NOT EXISTS governance.tags.cost_center;
ALTER WAREHOUSE claims_etl_wh SET TAG governance.tags.cost_center = 'CLAIMS';
ALTER SESSION SET QUERY_TAG = 'app=claims-api;team=claims';   -- set by the app/driver

-- 7. Cheaper staging layer
CREATE TRANSIENT SCHEMA claims.staging DATA_RETENTION_TIME_IN_DAYS = 0;
```

From a .NET service, set `QUERY_TAG` once per connection (e.g. right after opening it), so every query from that service can be attributed in `QUERY_HISTORY`.

## 11. Interview answer: the 2-minute version

> "Snowflake cost has five parts: **warehouse compute**, billed per second while running with a 60-second minimum per resume and doubling with each size step; **serverless compute** for features like Snowpipe, Automatic Clustering, Search Optimization, materialized views and Query Acceleration; **cloud services**, billed only above 10% of daily warehouse use; **storage**, which includes Time Travel, Fail-safe, stages and changed data held by clones; and **data transfer** out of a region. Edition, region and contract set the price per credit.
>
> Compute dominates, and the biggest waste is **idle uptime**, because you pay for the warehouse being up, not for queries. So I start by measuring:
>
> - `WAREHOUSE_METERING_HISTORY` against `QUERY_ATTRIBUTION_HISTORY` to get the idle ratio
> - the most expensive query patterns by parameterized hash
> - the serverless history views
> - `TABLE_STORAGE_METRICS` for hidden Time Travel and Fail-safe bytes
>
> Then I apply targeted fixes:
>
> - **Compute:** right auto-suspend per workload; right-size by credits per job rather than per hour; cap multi-cluster; statement timeouts; incremental processing instead of full rebuilds; BI refresh schedules that let the result cache work.
> - **Serverless:** clustering only where pruning benefits outweigh the cost, and Search Optimization only on specific columns.
> - **Storage:** transient tables and short retention for rebuildable layers, removing unused tables, and clone expiry.
>
> Finally, governance: per-team warehouses, tags and query tags for chargeback, resource monitors and Budgets as guardrails, cheaper editions for non-production, and a weekly FinOps review. I always weigh savings against SLAs, recoverability and compliance retention."

## 12. Hands-on exercise and troubleshooting

**Setup:** a trial account. `ACCOUNT_USAGE` needs `ACCOUNTADMIN`, or a role granted the `SNOWFLAKE` database roles. Data appears with a delay of hours.

1. Create `cost_lab_wh` (XS, `AUTO_SUSPEND = 600`). Run one small query every 2 minutes for 30 minutes, using a simple script or 15 manual runs.
2. Change it to `AUTO_SUSPEND = 60` and repeat.
3. The next day, compare credits for both periods in `WAREHOUSE_METERING_HISTORY` (hourly). Compare with query-attributed credits using query 2 from section 10.
4. Create a permanent table and a transient table from the same sample data. Run a full `DELETE` and reload three times on each. A day later, compare `TIME_TRAVEL_BYTES` and `FAILSAFE_BYTES`.
5. Attach a resource monitor with a 1-credit quota to `cost_lab_wh` and watch it notify or suspend.

**Expected outcomes:**

- **Run 1** bills roughly continuously for 30+ minutes. **Run 2** bills about 15 short bursts, each with the 60-second minimum.
- The idle ratio is high in run 1.
- The permanent table builds up Fail-safe bytes; the transient table doesn't.

**Troubleshooting:**

- **"My usage queries return nothing."** `ACCOUNT_USAGE` runs behind real time (up to about 3 hours for metering, about 45 minutes for query history), and `QUERY_ATTRIBUTION_HISTORY` can take longer. Also check your role. Use `INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY()` for recent data.
- **"The resource monitor suspended the warehouse, but credits kept growing."** Monitors don't cover serverless features (clustering, Snowpipe, Search Optimization) or cloud services. Check the serverless history views and set up a Budget. Also note that `SUSPEND` lets running queries finish; use `SUSPEND_IMMEDIATE` to cancel them.

## 13. Comparison of cost controls

| Control                            | Covers                                                | Action                         | Best for                                  |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| Auto-suspend                       | One warehouse                                         | Stops idle billing             | Every warehouse                           |
| Statement timeouts                 | Queries                                               | Cancels runaway queries        | Ad-hoc, BI, apps                          |
| Resource monitor                   | Warehouses only                                       | Notify / suspend               | Hard caps on non-critical compute         |
| Budgets                            | Warehouses + serverless (account or group of objects) | Notify                         | Total spend tracking, serverless features |
| Tags + query tags                  | Any tagged object or query                            | Attribution                    | Chargeback and showback                   |
| RBAC on warehouse create/modify    | Who can create or resize                              | Prevents unapproved warehouses | Platform governance                       |
| Capacity contract / edition choice | Price per credit                                      | Commercial                     | Predictable, mature workloads             |

**How the pricing model compares to other platforms** (broad characterization; check current pricing):

- **BigQuery:** charges by bytes scanned on demand, or by reserved slots. Scanning less data saves money directly.
- **Databricks:** charges DBUs (Databricks Units) plus the underlying cloud VMs, and you manage more of the cluster lifecycle yourself.
- **Snowflake:** you mostly manage **uptime and warehouse size**.

The same habits save money on all three: scan less, avoid idle compute, and attribute every unit of spend to an owner.

## 14. Summary

- Five sources of cost: **warehouse compute, serverless, cloud services (above 10%), storage, data transfer**. Edition, region and contract set the price.
- You pay for **uptime, not queries**. Idle warehouses and polling tools are the top source of waste.
- Judge sizing by **credits per job**. Performance tuning is cost tuning.
- Storage hides in **Time Travel, Fail-safe, clones and stages**. Transient tables and short retention for rebuildable layers.
- Serverless features are valuable but need regular review.
- Make it last through governance: tags, per-team warehouses, monitors plus Budgets, timeouts, and a weekly owner review.

## 15. Knowledge check

1. **Explain:** a team's queries total 40 credits a month in `QUERY_ATTRIBUTION_HISTORY`, but their warehouse metered 400. Where did the other 360 go, and what do you change?
2. **Apply:** a nightly job runs 4 hours on a Medium warehouse (16 credits) with heavy remote spill. Someone proposes Large to "save time but spend more." Is that necessarily true?
3. **Decide:** to cut storage, a data engineer wants to set `DATA_RETENTION_TIME_IN_DAYS = 0` across the whole claims database. What do you recommend?

**Answers**

1. Idle uptime: the warehouse stayed running between queries, probably because of a long auto-suspend or a polling tool. Look at query timing in `QUERY_HISTORY`, shorten auto-suspend, remove keep-alive traffic, and consider merging the work into a shared warehouse.
2. Not necessarily. If the query uses the extra parallelism and stops spilling, Large (8 credits/hour) might finish in under 2 hours, which is ≤16 credits, so faster at the same or lower cost. Test it and compare credits per job. Also fix any exploding joins first.
3. Not database-wide. Use 0–1 day only on rebuildable staging and intermediate layers, ideally as transient schemas. Keep longer retention on curated and system-of-record claims data, where recovery and audit requirements apply. Confirm with risk and compliance, and remember Fail-safe still applies to permanent tables.
