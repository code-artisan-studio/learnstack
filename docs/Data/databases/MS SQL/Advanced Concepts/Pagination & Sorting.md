**Pagination** and **sorting** are the standard techniques for turning huge result sets into small, ordered “pages” that APIs and UIs can actually display. [iifx](https://iifx.dev/en/articles/325260)

---

## Sorting: `ORDER BY`

Sorting defines the **order** of rows in the result. Without it, “page 1” and “page 2” are meaningless because the order can change between calls. [codedamn](https://codedamn.com/news/sql/pagination-in-sql)

Basic SQL:

```sql
-- Ascending (default)
SELECT Id, Name, Salary
FROM Employees
ORDER BY Salary;

-- Descending
SELECT Id, Name, Salary
FROM Employees
ORDER BY Salary DESC;

-- Multi-column
SELECT Id, Department, Salary
FROM Employees
ORDER BY Department ASC, Salary DESC;
```

Key points:

- Always pair pagination with a **stable, deterministic** `ORDER BY` (e.g., include the primary key as a tie-breaker).
- For performance, sort on **indexed columns** whenever possible. [linkedin](https://www.linkedin.com/posts/jigyasa-batra_mastering-sql-sorting-and-pagination-order-activity-7304156592529121280-cIV4)

In SQL Server, instead of `LIMIT`, you use `TOP` or `OFFSET FETCH`:

```sql
-- Top N
SELECT TOP 10 *
FROM Products
ORDER BY Rating DESC;

-- Offset / Fetch (SQL Server 2012+)
SELECT Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC
OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;
```

---

## Pagination: limit + offset

**Pagination** splits a large result into pages: page 1 = rows 1–10, page 2 = rows 11–20, etc.

### 1. Offset-based pagination (classic)

You specify:

- `LIMIT` (or `TOP` / `FETCH`) – how many rows per page
- `OFFSET` – how many rows to skip.

Examples (MySQL/Postgres style):

```sql
-- Page 1 (first 10 rows)
SELECT Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC
LIMIT 10 OFFSET 0;

-- Page 2 (next 10 rows)
SELECT Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC
LIMIT 10 OFFSET 10;

-- Page 3
SELECT Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC
LIMIT 10 OFFSET 20;
```

General formula (1-based page numbers):

- `OFFSET = (PageNumber - 1) * PageSize`
- `LIMIT = PageSize` [geeksforgeeks](https://www.geeksforgeeks.org/sql/pagination-in-sql/)

SQL Server version:

```sql
SELECT Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC
OFFSET ((@PageNumber - 1) * @PageSize) ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

**Pros:**

- Simple to implement.
- Works well for small to medium datasets and early pages.

**Cons:**

- Performance degrades on **deep pages** (large offsets).
  - `OFFSET 100000 LIMIT 10` still scans/sorts 100,010 rows, then discards 100,000. [typedb](https://typedb.com/docs/academy/8-composing-clauses/8.3-sorting-and-pagination/)

---

## 2. Keyset / seek pagination (optimized for large datasets)

Instead of “skip N rows”, you **“seek” from the last item you saw** using a `WHERE` clause on the sort key(s). [medium](https://medium.com/@fathullahmunadi1406/optimizing-sql-pagination-for-large-datasets-boost-performance-with-the-keyset-pagination-method-93678c528220)

Assume you’re paginating by `CreatedAt DESC, Id DESC`:

**First page:**

```sql
SELECT TOP 10 Id, Name, CreatedAt
FROM Users
ORDER BY CreatedAt DESC, Id DESC;
```

You return these 10 rows and remember the last one’s values, e.g.:

- `LastCreatedAt = '2026-07-20T14:32:00'`
- `LastId = 12345`

**Next page (keyset pagination):**

```sql
SELECT TOP 10 Id, Name, CreatedAt
FROM Users
WHERE (CreatedAt < @LastCreatedAt)
   OR (CreatedAt = @LastCreatedAt AND Id < @LastId)
ORDER BY CreatedAt DESC, Id DESC;
```

This directly starts from where the previous page ended; the DB can use an index on `(CreatedAt, Id)` to efficiently seek to the right position.

**Pros:**

- Consistent performance even for deep pages.
- No large offsets; the DB doesn’t scan and discard rows. [medium](https://medium.com/@visutthi/sql-web-sorting-pagination-with-millions-of-rows-2a264f606a87)

**Cons:**

- Cannot jump to an arbitrary page number (e.g., “go to page 500”).
- Client must track the last key(s) (“cursor” or “after” token).
- Slightly more complex API design (cursor-based pagination).

Many modern APIs (Twitter, GitHub, etc.) use this pattern for exactly this reason.

---

## Combining sorting and pagination

Always:

1. Define a **stable sort order** (e.g., `ORDER BY CreatedAt DESC, Id DESC`).
2. Use that same order for both:
   - The first page query
   - The subsequent keyset queries (with `WHERE` on those columns).
3. Ensure the sort columns are **indexed** to avoid expensive sorts.

Example for a finance app (transactions list):

```sql
-- Index:
CREATE INDEX IX_Transactions_UserId_CreatedAt_Id
ON Transactions (UserId, CreatedAt DESC, Id DESC);

-- First page for a user:
SELECT TOP 20 Id, Amount, CategoryId, CreatedAt
FROM Transactions
WHERE UserId = @UserId
ORDER BY CreatedAt DESC, Id DESC;

-- Next page (keyset):
SELECT TOP 20 Id, Amount, CategoryId, CreatedAt
FROM Transactions
WHERE UserId = @UserId
  AND (
      (CreatedAt < @LastCreatedAt)
      OR (CreatedAt = @LastCreatedAt AND Id < @LastId)
  )
ORDER BY CreatedAt DESC, Id DESC;
```

---

## Practical guidance

- Use **offset-based pagination** when:
  - Dataset is moderate.
  - You need random page access (page 1, 2, 3, …).

- Use **keyset/seek pagination** when:
  - You have large tables or deep pagination.
  - “Next/previous” or “load more” is acceptable instead of “go to page N”. [typedb](https://typedb.com/docs/academy/8-composing-clauses/8.3-sorting-and-pagination/)

- Always:
  - Pair pagination with explicit `ORDER BY`.
  - Index the sort columns.
  - Avoid unsorted paginated queries; they can return inconsistent results between calls. [datavidhya](https://datavidhya.com/learn/sql/sql-basics/sorting-and-limiting/)
