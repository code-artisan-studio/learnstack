**Database partitioning** splits a large table (or database) into smaller, more manageable pieces called **partitions**, so queries can scan less data and maintenance can be done piecewise. [questdb](https://questdb.com/glossary/database-partitioning/)

It’s different from **sharding**:

- **Partitioning**: logical/physical split _within_ a single database instance (or tightly coupled cluster).
- **Sharding**: splits data _across multiple database instances/servers_ for scale and isolation. [medium](https://medium.com/@memorybytes/understanding-data-partitioning-69038d0dc3c2)

---

## Why partition?

Main goals:

- **Performance**: Queries scan only relevant partitions instead of the whole table. [questdb](https://questdb.com/glossary/database-partitioning/)
- **Manageability**: Backups, index rebuilds, archiving, and loads can be done partition-by-partition. [spinnakersupport](https://www.spinnakersupport.com/blog/2025/04/03/database-partitioning/)
- **Scalability**: Easier to grow storage and I/O capacity by adding partitions or moving them to different disks/nodes. [learn.microsoft](https://learn.microsoft.com/en-us/azure/architecture/best-practices/data-partitioning)
- **Availability**: If one partition has issues, others can remain online (depending on DB and setup). [tencentcloud](https://www.tencentcloud.com/techpedia/108164)

Typical use cases:

- Very large tables (millions/billions of rows)
- Time-series data (logs, events, transactions)
- Multi-tenant or multi-region data with natural boundaries. [last9](https://last9.io/blog/database-partitioning/)

---

## Main partitioning strategies

### 1. Horizontal partitioning (by rows)

The table is split **by rows** into multiple partitions; each partition has the same schema but a subset of rows. [questdb](https://questdb.com/glossary/database-partitioning/)

Common horizontal techniques:

#### a) Range partitioning

Rows are assigned to partitions based on a **range** of a key (often time). [last9](https://last9.io/blog/database-partitioning/)

Example (transactions by month):

- `Transactions_2026_01` – rows where `TransactionDate` is in Jan 2026
- `Transactions_2026_02` – Feb 2026
- etc.

Great for:

- Time-series workloads
- Archiving old partitions to cheaper storage
- Fast range queries like “last 3 months”.

#### b) List partitioning

Rows are assigned based on a **discrete list** of values. [medium](https://medium.com/@memorybytes/understanding-data-partitioning-69038d0dc3c2)

Example:

- Partition by region: `NA`, `EU`, `APAC`
- Partition by country or tenant ID from a known set.

Useful when you have a small, stable set of categories.

#### c) Hash partitioning

A **hash function** on one or more columns determines the partition. [questdb](https://questdb.com/glossary/database-partitioning/)

Example:

```text
partition = hash(UserId) % N
```

Benefits:

- Even distribution of rows across partitions
- Good for load balancing when there’s no natural range.

Tradeoff:

- Harder to target a specific partition for a given key unless you know the hash logic.

#### d) Composite partitioning

Combines strategies, e.g.:

- First by **range** (month), then by **hash** on `UserId` within each month.
- Or by **list** (region), then by **range** (date). [medium](https://medium.com/@memorybytes/understanding-data-partitioning-69038d0dc3c2)

Used in large warehouses and time-series systems to balance manageability and distribution.

---

### 2. Vertical partitioning (by columns)

The table is split **by columns** into multiple tables, each holding a subset of columns but the same rows (same primary key). [questdb](https://questdb.com/glossary/database-partitioning/)

Example:

- `UsersCore(UserId, Name, Email, CreatedAt, …)` – frequently accessed columns
- `UsersProfile(UserId, Address, Bio, Preferences, …)` – less frequently accessed, larger columns

Use when:

- Some columns are rarely needed in normal queries
- You want to keep hot data smaller and more cache-friendly
- You have very wide tables.

shows this concept: a single wide table split into smaller vertical slices (profile, connections, content) to reduce I/O for common queries.
Tradeoff:

- Joins are needed to reconstruct the full row, so it helps only if most queries need just one slice.

---

## How partitioning improves queries

Suppose you have a 500M-row `Transactions` table, partitioned by month on `TransactionDate`.

Query:

```sql
SELECT *
FROM Transactions
WHERE UserId = 123
  AND TransactionDate >= '2026-05-01'
  AND TransactionDate < '2026-06-01';
```

Without partitioning:

- The engine may scan the whole table (or large indexes).

With partitioning:

- The optimizer can **prune** partitions: only scan `Transactions_2026_05`.
- I/O drops dramatically; query runs faster even with the same indexes. [questdb](https://questdb.com/glossary/database-partitioning/)

This is called **partition pruning** and is a key performance win.

---

## Partitioning vs indexing

They complement each other:

- **Indexes** speed up lookup _within_ a table or partition.
- **Partitioning** reduces the amount of data the query needs to consider in the first place.

You’ll often see:

- A large table partitioned by date
- Each partition having its own local indexes (or global indexes, depending on DB). [last9](https://last9.io/blog/database-partitioning/)

---

## Tradeoffs and cautions

Benefits:

- Faster queries on large, filterable datasets
- Easier archiving (e.g., drop old monthly partitions)
- More granular maintenance (rebuild index on one partition, not all). [questdb](https://questdb.com/glossary/database-partitioning/)

Costs/risks:

- More complex schema and operations (creating, splitting, merging partitions).
- Poor partition key choice can make things worse (e.g., uneven data distribution, hot partitions).
- Some operations (cross-partition queries, certain joins) can be more expensive if not designed well. [cockroachlabs](https://www.cockroachlabs.com/blog/what-is-data-partitioning-and-how-to-do-it-right/)

Good partition keys:

- Align with common query filters (e.g., date, tenant, region).
- Produce reasonably balanced partitions.
- Are relatively stable (don’t change often). [last9](https://last9.io/blog/database-partitioning/)

---

## Example for a finance app

For a transaction-heavy system:

- Table: `Transactions`
- Partition by `TransactionDate` (range, monthly or quarterly).
- Keep recent partitions on fast storage; archive older ones to cheaper storage.
- Add indexes on `(UserId, TransactionDate)` within each partition for user views.

This gives you:

- Fast “last N months” queries
- Simple archival (detach/move old partitions)
- Manageable index sizes per partition.
