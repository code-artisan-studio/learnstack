**Database indexing** is the technique of building auxiliary data structures that let the database find rows quickly without scanning the entire table. [medium](https://medium.com/databases-in-simple-words/how-database-indexes-work-in-simple-words-f22558869c03)

---

## Core idea

Without an index, a query like:

```sql
SELECT * FROM Users WHERE Email = 'alice@example.com';
```

may require a **full table scan**: check every row until you find the match.

With an index on `Email`:

- The database maintains a **sorted structure** (usually a B‑tree) of `Email` values plus pointers to the actual rows.
- It can **jump directly** to the matching entry (or a small range) instead of scanning everything.

Analogy: an index is like the **index at the back of a book** or a **table of contents**—it tells you exactly where to look instead of flipping through every page. [codecademy](https://www.codecademy.com/article/sql-indexes)

---

## How indexes work internally

Most relational databases use **B‑tree** (or B+‑tree) indexes:

- Data is organized in a **balanced tree**:
  - Root node → internal nodes → leaf nodes
- Each node holds sorted keys and pointers to child nodes.
- Searching follows a path from root to leaf, discarding large portions of the data at each step.
- Complexity is **O(log n)**: finding a row in a million-row table takes ~20 comparisons instead of up to 1,000,000. [dev](https://dev.to/tyson_cung/database-indexing-explained-whats-actually-happening-under-the-hood-2do4)

The index stores:

- The indexed column values (e.g., `Email`)
- **Pointers** (row IDs, page+slot, etc.) to the full row in the table

When you query on an indexed column, the engine:

1. Searches the B‑tree to find the matching key(s).
2. Uses the pointers to fetch the full row(s). [atlassian](https://www.atlassian.com/data/databases/how-does-indexing-work)

---

## Common index types

### B-tree / B+‑tree index

- Default and most common.
- Supports:
  - Equality (`=`)
  - Range (`<`, `>`, `BETWEEN`)
  - Sorting (`ORDER BY`) and grouping (`GROUP BY`) efficiently. [tencentcloud](https://www.tencentcloud.com/techpedia/137568)

### Clustered vs non-clustered

- **Clustered index**:
  - Determines the **physical order** of data on disk.
  - The table _is_ the index.
  - Only one per table (e.g., InnoDB in MySQL uses the primary key as clustered). [last9](https://last9.io/blog/database-indexing/)

- **Non-clustered index**:
  - Separate structure that stores indexed columns + pointers to the actual rows.
  - You can have many per table.
  - Query uses the index to find the pointer, then fetches the row. [dev](https://dev.to/tyson_cung/database-indexing-explained-whats-actually-happening-under-the-hood-2do4)

### Hash index

- Uses a hash function to map keys directly to buckets.
- Extremely fast for **exact-match** lookups (`=`).
- Does **not** support ranges or sorting. [linkedin](https://www.linkedin.com/posts/nikkisiapno_6-types-of-database-indexes-clearly-explained-activity-7439574116418097152-yuEv)

### Composite (multi-column) index

- Index on multiple columns, e.g.:

  ```sql
  CREATE INDEX IX_Users_LastName_FirstName
  ON Users (LastName, FirstName);
  ```

- Follows the **leftmost prefix rule**: useful for queries filtering on:
  - `LastName`
  - `LastName, FirstName`  
    but not just `FirstName`. [arunangshudas](https://arunangshudas.com/blog/7-types-of-database-indexes-explained/)

### Partial / filtered index

- Index only rows that satisfy a condition, e.g.:

  ```sql
  CREATE INDEX IX_Orders_Active
  ON Orders (OrderDate)
  WHERE Status = 'Active';
  ```

- Smaller, faster, and more efficient for queries that always filter on that condition. [arunangshudas](https://arunangshudas.com/blog/7-types-of-database-indexes-explained/)

### Other specialized indexes

- **Full-text indexes** – for searching text (tokenized, with relevance ranking).
- **Spatial indexes** – for geographic data (points, polygons).
- **Bitmap indexes** – good for low-cardinality columns (e.g., `Status`, `Gender`) and complex boolean filters. [tencentcloud](https://www.tencentcloud.com/techpedia/137568)

---

## When to use indexes

Good candidates:

- Columns frequently used in:
  - `WHERE` clauses
  - `JOIN` conditions
  - `ORDER BY` / `GROUP BY`
- High-cardinality columns (many distinct values: emails, IDs, usernames). [last9](https://last9.io/blog/database-indexing/)

Bad candidates:

- Very small tables (full scan is already fast).
- Low-cardinality columns (boolean flags, 2–3-value statuses) unless part of a composite or filtered index.
- Columns you rarely query on. [dev](https://dev.to/tyson_cung/database-indexing-explained-whats-actually-happening-under-the-hood-2do4)

---

## Tradeoffs

Indexes speed up reads but cost writes:

- Every `INSERT`, `UPDATE`, or `DELETE` on an indexed column must also update the index structures.
- More indexes → slower writes, more storage, more maintenance (rebuilds, statistics updates). [last9](https://last9.io/blog/database-indexing/)

Rule of thumb:

- Index based on **actual query patterns**, not guesses.
- Use `EXPLAIN` / execution plans to confirm the index is being used and actually helping. [dev](https://dev.to/tyson_cung/database-indexing-explained-whats-actually-happening-under-the-hood-2do4)

---

## Example in SQL Server / .NET context

For a finance app:

```sql
-- Speed up lookups by user and date range
CREATE INDEX IX_Transactions_UserId_Date
ON Transactions (UserId, Date DESC)
INCLUDE (Amount, CategoryId);
```

- `(UserId, Date)` is the key for filtering/sorting.
- `INCLUDE` adds `Amount`, `CategoryId` so common dashboard queries can be served mostly from the index (covering index).

In EF Core, you’d configure this via Fluent API or migrations, then confirm with `SET STATISTICS IO ON` or SSMS execution plans that queries use the index.
