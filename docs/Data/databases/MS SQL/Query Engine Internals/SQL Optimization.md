**Execution plans**, the **query optimizer**, and **cost-based optimization** are the core mechanisms a database uses to turn your SQL into an efficient physical execution strategy. [learn.microsoft](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide?view=sql-server-ver17)

---

## 1. Execution Plans

An **execution plan** is the step-by-step recipe the database engine will follow to run a query. [learn.microsoft](<https://learn.microsoft.com/en-us/previous-versions/technet-magazine/cc137757(v=msdn.10)?redirectedfrom=MSDN>)

It specifies:

- Which **indexes** to use (or whether to scan the whole table)
- Which **join algorithms** to use (nested loops, hash join, merge join) and in what order
- When to **filter**, **aggregate**, **sort**, or **spill to disk**
- How data **flows** between operators (e.g., scan → filter → join → aggregate → sort)

You can view:

- **Estimated plan** – what the optimizer thinks it will do, without running the query
- **Actual plan** – what actually happened, with real row counts and runtime metrics

In SQL Server, you can get this via:

```sql
SET SHOWPLAN_TEXT ON;        -- or
SET STATISTICS PROFILE ON;   -- or use SSMS “Display Estimated Execution Plan”
EXPLAIN <your_query>;        -- in other DBs
```

Key things you read in a plan:

- **Operators** (e.g., `Clustered Index Scan`, `Index Seek`, `Hash Join`, `Sort`)
- **Cost %** per operator (relative contribution to total estimated cost) [rafaelrampineli.medium](https://rafaelrampineli.medium.com/optimizing-sql-server-performance-through-query-execution-plans-and-indexing-strategies-6019b069dede)
- **Estimated vs actual rows** – big gaps often indicate bad statistics or cardinality estimates
- **Warnings** (missing statistics, implicit conversions, spills to disk)

---

## 2. Query Optimizer

The **query optimizer** is the component that decides _which_ execution plan to use for a given SQL statement. [docs.oracle](https://docs.oracle.com/en/database/oracle/oracle-database/18/tgsql/query-optimizer-concepts.html)

Inputs:

- Parsed SQL (syntax tree / logical query)
- Schema metadata (tables, columns, indexes, constraints)
- **Statistics** on data distribution (histograms, row counts, distinct values, etc.) [geeksforgeeks](https://www.geeksforgeeks.org/software-engineering/cost-based-optimization/)
- System configuration (memory, CPU, parallelism settings)

Process (simplified):

1. **Parse** the SQL and build a logical representation.
2. **Generate alternatives**: many logically equivalent physical plans (different join orders, join types, access paths). [dl.acm](https://dl.acm.org/doi/pdf/10.1145/335191.335451)
3. **Estimate cost** for each candidate plan.
4. **Choose the plan** with the lowest estimated cost and cache it for reuse. [learn.microsoft](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide?view=sql-server-ver17)

The optimizer’s job is a **combinatorial search**: for a query with multiple joins, there can be thousands of possible plans. [cockroachlabs](https://www.cockroachlabs.com/docs/stable/cost-based-optimizer)

---

## 3. Cost-Based Optimization (CBO)

**Cost-based optimization** means the optimizer assigns a **cost** to each candidate plan and picks the cheapest one. [docs.couchbase](https://docs.couchbase.com/cloud/n1ql/n1ql-language-reference/cost-based-optimizer.html)

### What “cost” means

“Cost” is an abstract number representing expected resource usage, typically correlated with **execution time**. [docs.couchbase](https://docs.couchbase.com/cloud/n1ql/n1ql-language-reference/cost-based-optimizer.html)

It’s estimated from:

- **I/O** – how many pages/blocks must be read/written
- **CPU** – how much processing (filters, joins, aggregates)
- **Memory** – need for sorts, hashes, spills to disk
- **Network** (in distributed systems) – data movement between nodes [link.springer](https://link.springer.com/article/10.1007/s10796-022-10320-2)

Each operator in the plan has a cost model; the total plan cost is the sum (or weighted combination) of operator costs. [dl.acm](https://dl.acm.org/doi/pdf/10.1145/335191.335451)

### How cost is estimated

The optimizer uses:

- **Statistics** on columns and indexes:
  - Row counts
  - Distinct value counts
  - Histograms of value distributions
  - Density / selectivity estimates [learn.microsoft](<https://learn.microsoft.com/en-us/previous-versions/technet-magazine/cc137757(v=msdn.10)?redirectedfrom=MSDN>)
- **Cardinality estimation**: how many rows each step will produce. [geeksforgeeks](https://www.geeksforgeeks.org/software-engineering/cost-based-optimization/)
  - Poor cardinality estimates → bad plan choices (e.g., choosing nested loops for huge joins).

Example flow:

1. For a predicate like `WHERE OrderDate >= '2026-01-01'`, the optimizer uses statistics to estimate how many rows match.
2. It calculates the cost of:
   - Scanning the whole table and filtering
   - Using an index seek + lookups
   - Using a covering index, etc.
3. It picks the access path with the lowest estimated cost. [rafaelrampineli.medium](https://rafaelrampineli.medium.com/optimizing-sql-server-performance-through-query-execution-plans-and-indexing-strategies-6019b069dede)

For joins, it also tries different:

- **Join orders** (which table is outer/inner)
- **Join algorithms**:
  - Nested loops (good for small outer, indexed inner)
  - Hash join (good for large, unsorted inputs)
  - Merge join (good for sorted inputs) [cockroachlabs](https://www.cockroachlabs.com/docs/stable/cost-based-optimizer)

### Why statistics matter

If statistics are **missing or outdated**, the optimizer’s cost estimates can be way off: [learn.microsoft](<https://learn.microsoft.com/en-us/previous-versions/technet-magazine/cc137757(v=msdn.10)?redirectedfrom=MSDN>)

- It may think a filter returns 10 rows when it actually returns 1 million.
- It may choose nested loops for a large join, causing severe slowdown.

Regularly updating statistics (or using auto-stats) is critical for good CBO behavior.

---

## Putting it together

- You write **SQL** (logical intent).
- The **query optimizer** generates multiple **physical execution plans**. [docs.oracle](https://docs.oracle.com/en/database/oracle/oracle-database/18/tgsql/query-optimizer-concepts.html)
- Using **cost-based optimization**, it estimates I/O, CPU, memory, etc., for each plan based on **statistics** and picks the one with the lowest estimated cost. [dl.acm](https://dl.acm.org/doi/pdf/10.1145/335191.335451)
- The chosen **execution plan** is what actually runs; you can inspect it to diagnose and tune performance. [learn.microsoft](https://learn.microsoft.com/en-us/sql/relational-databases/query-processing-architecture-guide?view=sql-server-ver17)

---

## Practical implications for you as a backend engineer

- **Good schema + indexes** give the optimizer good options to choose from.
- **Up-to-date statistics** are essential; bad stats → bad plans. [rafaelrampineli.medium](https://rafaelrampineli.medium.com/optimizing-sql-server-performance-through-query-execution-plans-and-indexing-strategies-6019b069dede)
- Use **execution plans** to:
  - See if your indexes are being used
  - Detect scans where seeks are expected
  - Find expensive sorts/joins and fix them (better indexing, query rewrite)
- In EF Core, pay attention to:
  - Generated SQL (avoid unnecessary joins, subqueries)
  - N+1 patterns that create many small queries instead of one well-optimized join
  - Proper indexing on FK and filter columns to help the optimizer.

If you want, I can walk through a concrete SQL Server execution plan example (e.g., a typical finance query with joins and filters) and show how to interpret costs and operators.
