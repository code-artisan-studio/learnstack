**Indexes** are auxiliary data structures that let the database find rows quickly without scanning the whole table. Good indexing strategy is often the single biggest performance win for read-heavy queries. [codelit](https://codelit.io/blog/database-indexing-strategies)

---

## Core idea: how an index helps

Without an index, to satisfy:

```sql
SELECT * FROM Orders
WHERE CustomerId = 123
  AND OrderDate >= '2026-01-01';
```

the engine may need to scan **all rows** in `Orders`.

With a suitable index, it can:

- Jump directly to `CustomerId = 123`
- Then efficiently find rows with `OrderDate >= '2026-01-01'`
- Read far fewer pages → much faster query.

Internally, most indexes are implemented as **B-trees** or other specialized structures.

---

## Index types

### 1. B-tree (balanced tree)

**What it is:** A self-balancing tree that keeps keys in sorted order. [sesamedisk](https://sesamedisk.com/database-indexing-b-tree-hash-composite-strategies/)

**Characteristics:**

- Sorted structure → supports:
  - Equality: `=`, `IN`
  - Range: `<`, `>`, `BETWEEN`
  - Prefix `LIKE 'abc%'`
  - `ORDER BY` and `GROUP BY` on indexed columns [aidev](https://aidev.fit/en/tech/database-indexing-guide.html)
- Default index type in most RDBMS (SQL Server, PostgreSQL, MySQL InnoDB, Oracle).

**Example (SQL Server / PostgreSQL):**

```sql
CREATE INDEX IX_Orders_CustomerId_OrderDate
ON Orders (CustomerId, OrderDate);
```

**When to use:**

- General-purpose indexing for most queries (filters, ranges, sorting). [systemcraft](https://systemcraft.in/concepts/database-indexing/)

**Limitations:**

- Not ideal for:
  - `LIKE '%suffix'` (no leading constant)
  - Very high-cardinality full-text search (use specialized indexes instead).

---

### 2. Hash index

**What it is:** An index based on a **hash table**; each key is hashed to a bucket pointing to rows. [letsbuildsolutions](https://letsbuildsolutions.com/blog/system-design/database-indexing-strategies-b-trees-hash-indexes-and-composite-keys/)

**Characteristics:**

- Excellent for **equality-only** lookups (`=`).
- Typically O(1) average lookup time.
- Does **not** support:
  - Range queries (`<`, `>`, `BETWEEN`)
  - `ORDER BY`
  - Partial key matches in composite indexes [aidev](https://aidev.fit/en/tech/database-indexing-guide.html)

**Example (PostgreSQL):**

```sql
CREATE INDEX IX_Users_Email_Hash
ON Users USING HASH (Email);
```

**When to use:**

- Very high-frequency exact-match lookups (e.g., session tokens, unique keys used only with `=`). [sesamedisk](https://sesamedisk.com/database-indexing-b-tree-hash-composite-strategies/)

**Limitations:**

- Useless for ranges, sorting, or range-based analytics.
- Not supported or not default in all databases (e.g., not in SQL Server as a user-created index type).

---

### 3. Composite (multi-column) index

**What it is:** An index on **multiple columns** in a specific order. [ndlab](https://ndlab.blog/posts/database-indexes-btree-hash-2026)

**Key rule (leftmost prefix):**

For an index on `(A, B, C)`:

- Efficient for queries filtering on:
  - `A`
  - `A, B`
  - `A, B, C`
- Not efficient for queries that skip the leftmost column(s), e.g.:
  - Only `B`
  - Only `C`
  - `B, C` without `A`

**Example:**

```sql
CREATE INDEX IX_Orders_CustomerId_Status_Date
ON Orders (CustomerId, Status, OrderDate);
```

Great for:

```sql
SELECT *
FROM Orders
WHERE CustomerId = 123
  AND Status = 'Shipped'
  AND OrderDate >= '2026-01-01';
```

**When to use:**

- Queries that filter/sort on multiple columns together. [biotama](https://biotama.cv/blog/database-indexing-strategy-composite-covering-partial/)
- Design order based on:
  - Most selective / most frequently filtered columns first
  - Then columns used in `ORDER BY` or additional filters.

---

### 4. Covering index

**What it is:** An index that contains **all columns needed by a query**, so the engine never has to look up the base table (heap/clustered index). [techinterview](https://www.techinterview.org/post/3233474176/system-design-database-indexing-strategies-btree-hash-gin-partial-composite-covering-index-when-to-index-query-performance/)

In SQL Server, you often use `INCLUDE` columns to make an index covering without affecting the key order:

```sql
CREATE INDEX IX_Orders_CustomerId_Covering
ON Orders (CustomerId, OrderDate)
INCLUDE (Status, TotalAmount);
```

Query:

```sql
SELECT CustomerId, OrderDate, Status, TotalAmount
FROM Orders
WHERE CustomerId = 123
  AND OrderDate >= '2026-01-01';
```

- The index key: `(CustomerId, OrderDate)` is used for filtering/sorting.
- `Status`, `TotalAmount` are **included** so the query can be satisfied entirely from the index → **index-only scan**.

**When to use:**

- Hot, frequently executed queries where avoiding table lookups matters. [sql-practice](https://www.sql-practice.online/learn/sql-indexes)
- Especially useful in read-heavy workloads (dashboards, reporting).

**Tradeoff:**

- Larger index size, more write overhead, but can dramatically reduce read cost.

---

### 5. Partial (filtered) index

**What it is:** An index that only covers rows matching a **predicate** (`WHERE` condition). [codelit](https://codelit.io/blog/database-indexing-strategies)

**Example (PostgreSQL):**

```sql
CREATE INDEX IX_Orders_Active_Recent
ON Orders (OrderDate)
WHERE Status = 'Active';
```

- Only rows where `Status = 'Active'` are indexed.
- Much smaller than a full index on `OrderDate`.

**Example (SQL Server – filtered index):**

```sql
CREATE INDEX IX_Orders_Active_Recent
ON Orders (OrderDate)
WHERE Status = 'Active';
```

**When to use:**

- Queries that almost always filter on a specific condition (e.g., `IsActive = 1`, `DeletedAt IS NULL`, `Status = 'Open'`). [ndlab](https://ndlab.blog/posts/database-indexes-btree-hash-2026)
- When a small subset of rows is queried heavily.

**Benefits:**

- Smaller index → faster scans, less storage, less write overhead.
- Often leads to better plans for queries that match the filter.

**Limitations:**

- Only useful for queries that include the same predicate.
- Not all databases support partial/filtered indexes in the same way.

---

## Putting it together: indexing strategies

Practical guidelines:

1. **Start with B-tree indexes** on:
   - Primary keys (usually automatic)
   - Foreign keys (speeds up joins)
   - Columns frequently used in `WHERE`, `JOIN`, `ORDER BY`. [systemcraft](https://systemcraft.in/concepts/database-indexing/)

2. Use **composite indexes** when:
   - Queries filter on multiple columns together.
   - Follow the leftmost-prefix rule; order columns by filter selectivity and frequency. [biotama](https://biotama.cv/blog/database-indexing-strategy-composite-covering-partial/)

3. Add **covering indexes** for:
   - Hot queries where you can avoid table lookups.
   - Use `INCLUDE` for non-key columns needed by the query. [sql-practice](https://www.sql-practice.online/learn/sql-indexes)

4. Use **partial/filtered indexes** when:
   - A large table but a small, frequently queried subset (e.g., active orders, non-deleted rows). [codelit](https://codelit.io/blog/database-indexing-strategies)

5. Consider **hash indexes** only when:
   - You have equality-only lookups on specific columns and your DB supports/encourages them. [letsbuildsolutions](https://letsbuildsolutions.com/blog/system-design/database-indexing-strategies-b-trees-hash-indexes-and-composite-keys/)

6. Always validate with **execution plans**:
   - Confirm the index is being used (index seek/scan vs table scan).
   - Watch for missing indexes hints or high-cost operators. [ekolsoft](https://ekolsoft.com/en/b/database-indexing-guide-btree-hash-index-composite-index-query-optimization-explain)

And remember: every index helps reads but **slows writes** (INSERT/UPDATE/DELETE) and adds storage. Index thoughtfully, not indiscriminately. [letsbuildsolutions](https://letsbuildsolutions.com/blog/system-design/database-indexing-strategies-b-trees-hash-indexes-and-composite-keys/)

If you want, I can map these to concrete patterns for your finance tracker (e.g., indexing `Transactions(UserId, Date, CategoryId)` with a covering index for dashboard queries).
