**Query optimization** is the process of making your SQL run faster and cheaper by changing how you write queries, how you model data, and how the database executes them. [en.wikipedia](https://en.wikipedia.org/wiki/Query_optimization)

Think of it in three layers:

1. **What the optimizer does automatically** (execution plans, cost-based choices)
2. **What you control in SQL** (query shape, joins, filters)
3. **What you control in schema/infra** (indexes, partitioning, caching, hardware) [dremio](https://www.dremio.com/blog/sql-query-optimization/)

---

## 1. How the optimizer works (briefly)

The database’s **query optimizer**:

- Takes your SQL and builds multiple possible **execution plans** (different join orders, algorithms, index choices).
- Estimates the **cost** of each plan using statistics (row counts, histograms, selectivity).
- Picks the plan with the lowest estimated cost. [ibm](https://www.ibm.com/think/topics/query-optimization)

You can inspect this with:

- `EXPLAIN` / `EXPLAIN ANALYZE` (Postgres, MySQL, etc.)
- “Display Estimated Execution Plan” in SSMS (SQL Server)
- `EXPLAIN PLAN FOR` (Oracle)

This tells you:

- Are indexes being used or is it doing full table scans?
- Which joins are expensive?
- Where are sorts, aggregates, or spills happening? [medium](https://medium.com/@vibhusrivastava94/database-query-performance-optimizations-00c384fc5717)

Optimization starts by reading these plans and comparing **estimated vs actual rows/costs**.

---

## 2. Query-level techniques

### a) Reduce data scanned

- **Filter early**: push `WHERE` conditions as close to the base tables as possible; don’t wrap big CTEs and filter late. [medium](https://medium.com/@ihona.correadecabo/query-optimization-techniques-every-data-engineer-should-know-333f7aa3b5f0)
- **Avoid `SELECT *`**: fetch only the columns you need (less I/O, less network, better chance of covering indexes). [medium](https://medium.com/@vibhusrivastava94/database-query-performance-optimizations-00c384fc5717)
- **Use proper predicates**:
  - Prefer `Column = @value` over functions on the column (e.g., avoid `WHERE YEAR(OrderDate) = 2026` if you can use a range on `OrderDate`).
  - Functions on columns often prevent index use.

### b) Write efficient joins

- Join on **indexed columns** (usually keys).
- Keep join conditions simple and sargable (no functions on join columns).
- Prefer `INNER JOIN` when you don’t need outer rows; outer joins can be more expensive. [datacamp](https://www.datacamp.com/blog/sql-query-optimization)

### c) Simplify subqueries and derived tables

- Often, a well-written `JOIN` or window function is faster than a correlated subquery.
- For “top N per group” patterns, `ROW_NUMBER()` / window functions can outperform complex subqueries. [datacamp](https://www.datacamp.com/blog/sql-query-optimization)

### d) Avoid unnecessary work

- Don’t `ORDER BY` unless you really need sorted output (sorting is expensive).
- Avoid redundant `DISTINCT` if your logic already guarantees uniqueness.
- Use `UNION ALL` instead of `UNION` if you don’t need duplicate elimination. [medium](https://medium.com/@ihona.correadecabo/query-optimization-techniques-every-data-engineer-should-know-333f7aa3b5f0)

---

## 3. Schema and indexing strategies

### a) Indexing

Indexes are usually the biggest win:

- Add indexes on columns used in:
  - `WHERE` filters
  - `JOIN` conditions
  - `ORDER BY` / `GROUP BY` [medium](https://medium.com/@vibhusrivastava94/database-query-performance-optimizations-00c384fc5717)

Use:

- **Composite indexes** with the right column order (most selective / most filtered first).
- **Covering indexes** (with `INCLUDE` in SQL Server) so queries can be satisfied from the index alone.
- Avoid over-indexing write-heavy tables (every index adds write cost). [medium](https://medium.com/@ihona.correadecabo/query-optimization-techniques-every-data-engineer-should-know-333f7aa3b5f0)

Always validate with `EXPLAIN` that your queries actually use the indexes you expect.

---

### b) Partitioning

For very large tables:

- Partition by a natural key (often time: month/quarter/year).
- Queries that filter on the partition key can **prune partitions** and scan far less data. [medium](https://medium.com/@vibhusrivastava94/database-query-performance-optimizations-00c384fc5717)

Example:

- `Transactions` partitioned by month; a query for “last 3 months” scans only those partitions.

---

### c) Precomputation & denormalization

For read-heavy / analytical workloads:

- **Summary tables**: pre-aggregate daily/monthly totals, per-user stats, etc.
- **Materialized views**: store the result of an expensive query and refresh periodically.
- **Denormalization**: duplicate data to avoid expensive joins in hot paths (e.g., store `CustomerName` on `Orders` for reporting). [medium](https://medium.com/@ihona.correadecabo/query-optimization-techniques-every-data-engineer-should-know-333f7aa3b5f0)

Tradeoff: more complex writes, but much faster reads.

---

## 4. System-level factors

These also affect query performance:

- **Statistics**: ensure they’re up to date so the optimizer makes good choices. Stale stats → bad plans.
- **Connection pooling**: avoid per-request connection overhead.
- **Caching**:
  - Application-level cache (Redis, in-memory) for hot queries.
  - Query result cache where supported (but watch staleness). [middleware](https://middleware.io/blog/database-optimization/)

---

## Practical workflow

1. **Identify the slow queries**
   - Use DMVs, `pg_stat_statements`, slow query logs, APM tools.
2. **Look at the execution plan**
   - Check for scans, missing indexes, wrong join order, big sorts.
3. **Try targeted changes**
   - Add/adjust indexes
   - Rewrite query (filters, joins, remove unnecessary operations)
   - Add partitioning or summary tables if data volume is the issue.
4. **Re-measure**
   - Compare runtime, I/O, CPU before/after.
5. **Automate monitoring**
   - Alert on queries that cross latency thresholds; review periodically as data grows. [middleware](https://middleware.io/blog/database-optimization/)

---
