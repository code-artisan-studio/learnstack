**Statistics**, **cardinality estimation**, and **plan caching** are three tightly linked mechanisms that determine how well your queries perform in practice. [sqlpassion](https://www.sqlpassion.at/archive/2017/05/01/cardinality-estimation-limitations/)

---

## 1. Statistics

**Statistics** are metadata the database maintains about the **distribution of data** in columns and indexes. [learn.microsoft](https://learn.microsoft.com/en-us/sql/relational-databases/performance/cardinality-estimation-sql-server?view=sql-server-ver17)

In SQL Server (similar ideas in other RDBMS), statistics typically include:

- **Row count** for the table/index
- **Histogram** – buckets showing how values are distributed in a column (e.g., how many rows fall into value ranges)
- **Density / distinct values** – how many unique values exist, how selective a column is
- **Null counts**, average length, etc.

Example (SQL Server):

```sql
CREATE STATISTICS ST_Transactions_UserId
ON Transactions (UserId);

-- Or automatically created on indexed columns
CREATE INDEX IX_Transactions_UserId ON Transactions(UserId);
```

The optimizer uses these to answer questions like:

- How many rows match `WHERE UserId = 123`?
- How selective is `OrderDate >= '2026-01-01'`?
- How many rows will a join produce?

**Why they matter:**

- Good statistics → accurate estimates → better execution plans.
- Stale or missing statistics → bad estimates → poor plans (e.g., nested loops on huge sets, wrong join order). [red-gate](https://www.red-gate.com/simple-talk/databases/sql-server/performance-sql-server/queries-damned-queries-and-statistics/)

Most databases auto-create and auto-update statistics, but in high‑change systems you may need to:

- Manually update stats on critical tables
- Use filtered statistics for skewed data distributions. [sqlpassion](https://www.sqlpassion.at/archive/2017/05/01/cardinality-estimation-limitations/)

---

## 2. Cardinality Estimation

**Cardinality estimation** is the process of estimating **how many rows** will flow through each step of a query plan. [vldb](https://www.vldb.org/pvldb/vol15/p752-zhu.pdf)

- **Cardinality** = number of rows
- **Cardinality estimate** = optimizer’s guess of row counts at each operator (scan, filter, join, aggregate, etc.)

The optimizer uses:

- Table and index statistics (histograms, densities)
- Predicates in `WHERE`, `JOIN`, `GROUP BY`, etc.
- Correlation assumptions between columns (often imperfect) [vldb](https://www.vldb.org/pvldb/vol15/p752-zhu.pdf)

**Example:**

```sql
SELECT *
FROM Transactions
WHERE UserId = 123
  AND Amount > 1000;
```

The optimizer must estimate:

- How many rows have `UserId = 123`?
- Of those, how many also have `Amount > 1000`?

It combines:

- Histogram info for `UserId` and `Amount`
- Assumptions about independence (or correlation, if known)

These row estimates then feed into the **cost model** to choose between:

- Index seek + lookup vs table scan
- Nested loops vs hash join vs merge join
- Different join orders [learn.microsoft](https://learn.microsoft.com/en-us/sql/relational-databases/performance/cardinality-estimation-sql-server?view=sql-server-ver17)

**When cardinality estimates go wrong:**

- Outdated or missing statistics
- Highly skewed data (e.g., 99% of rows are `Status = 'Active'`)
- Correlated columns (e.g., `Country` and `Region`)
- Complex predicates, functions on columns, dynamic SQL

Symptoms:

- Big gap between **estimated rows** and **actual rows** in the execution plan
- Unexpectedly slow queries despite “good” indexes

Fixes:

- Update statistics (or use filtered statistics)
- Redesign schema/indexes to make predicates more sargable
- Use query hints or plan guides sparingly (e.g., `OPTION (RECOMPILE)`, `USE HINT` in SQL Server) [stackoverflow](https://stackoverflow.com/questions/76639326/sql-server-cardinality-estimation-for-table-variable)

---

## 3. Plan Caching

**Plan caching** is the mechanism where the database stores compiled execution plans in memory and reuses them for subsequent executions of similar queries. [verhoef-training.co](https://verhoef-training.co.uk/official-microsoft-sql-server/10987-performance-tuning-and-optimizing-sql-databases)

Why it exists:

- Parsing, optimizing, and compiling a query is expensive.
- Reusing a plan avoids that cost for repeated queries.

### How it works (conceptually)

1. A query is submitted.
2. The engine checks the **plan cache** for a matching plan (based on query text, parameters, settings, etc.).
3. If a match is found:
   - Reuse the cached plan (fast path).
4. If not:
   - Compile a new plan (using statistics + cardinality estimation)
   - Store it in the cache for future use. [verhoef-training.co](https://verhoef-training.co.uk/official-microsoft-sql-server/10987-performance-tuning-and-optimizing-sql-databases)

In SQL Server, this applies to:

- Parameterized queries
- Stored procedures
- Prepared statements from .NET (`SqlCommand` with parameters, EF Core queries)

### Benefits

- **Faster execution** for repeated queries (no re-optimization).
- Lower CPU usage on the database server.

### Common issues

1. **Plan cache bloat**
   - Many slightly different query texts (e.g., inline literals instead of parameters) → many similar but distinct plans.
   - Symptoms: high memory usage, frequent compilations.

2. **Bad plan reuse**
   - A plan compiled for one set of parameters is reused for very different parameters.
   - Example: a query that’s usually selective (`@UserId = 123`) but sometimes returns most of the table (`@UserId = NULL` or “all”).
   - The cached plan may be optimal for one case but terrible for another. [stackoverflow](https://stackoverflow.com/questions/76639326/sql-server-cardinality-estimation-for-table-variable)

3. **Stale plans after data changes**
   - Data distribution changes significantly, but the cached plan was compiled with old statistics.
   - Can lead to gradually degrading performance until the plan is recompiled. [red-gate](https://www.red-gate.com/simple-talk/databases/sql-server/performance-sql-server/queries-damned-queries-and-statistics/)

### Mitigations

- Always use **parameterized queries** (EF Core, Dapper, ADO.NET with parameters).
- Use **stored procedures** or prepared statements instead of ad‑hoc SQL with literals.
- For queries with highly variable parameter selectivity:
  - Use `OPTION (RECOMPILE)` in SQL Server to force a fresh plan per execution (costly but sometimes necessary). [stackoverflow](https://stackoverflow.com/questions/76639326/sql-server-cardinality-estimation-for-table-variable)
  - Or use **query store** / plan forcing to stabilize plans.
- Monitor plan cache:
  - `sys.dm_exec_cached_plans`, `sys.dm_exec_query_stats` (SQL Server)
  - Look for high compile counts, large plan cache, frequent evictions.

---

## How they fit together

- **Statistics** → feed into → **Cardinality estimation** → drives → **Cost-based optimization** → produces → **Execution plan** → stored in → **Plan cache** → reused for future similar queries. [sqlpassion](https://www.sqlpassion.at/archive/2017/05/01/cardinality-estimation-limitations/)

In practice:

- Keep **statistics healthy** (auto-update on, or manual updates on critical tables).
- Watch for **cardinality estimation issues** via execution plans (estimated vs actual rows).
- Use **parameterized queries** and monitor **plan cache** to avoidcache-related performance problems.

If you want, I can map this to a concrete .NET + SQL Server scenario (e.g., a finance dashboard query) and show how to inspect stats, cardinality, and cached plans in SSMS or via DMVs.
