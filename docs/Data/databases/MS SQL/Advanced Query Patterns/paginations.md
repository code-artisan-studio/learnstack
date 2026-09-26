---
title: Pagination
sidebar_label: Pagination
sidebar_position: 3
---

Pagination returns a bounded subset of a larger ordered result set—typically a “page” of rows for a UI, API, report, or batch process. In SQL Server, the two common offset-based techniques are `ORDER BY … OFFSET … FETCH` and `ROW_NUMBER() OVER (ORDER BY …)` with a row-number filter. Both require a **stable, deterministic ordering**.[1][2][3]

## The core rule: always use deterministic ordering

Pagination without an `ORDER BY` has no meaningful order. Even with an `ORDER BY`, sort by a unique tie-breaker so rows do not move unpredictably between pages.

```sql
ORDER BY CreatedAt DESC, OrderId DESC
```

If you only sort by a non-unique value:

```sql
ORDER BY CreatedAt DESC
```

two rows with the same timestamp can be returned in either order. Adding `OrderId` makes the order deterministic.

```text
Good:
CreatedAt DESC, OrderId DESC

Risky:
CreatedAt DESC
```

`OFFSET`/`FETCH` requires `ORDER BY`, and `ROW_NUMBER()` also requires an `ORDER BY` in its `OVER` clause.[1][2][3]

## OFFSET / FETCH

`OFFSET` skips a specified number of ordered rows; `FETCH NEXT` returns the next page-size rows. SQL Server introduced this syntax in SQL Server 2012.[1][4][5]

```sql
DECLARE @PageNumber int = 3;
DECLARE @PageSize int = 25;

SELECT
    o.OrderId,
    o.CustomerId,
    o.Status,
    o.CreatedAt,
    o.Total
FROM sales.Orders AS o
WHERE o.Status = 'Pending'
ORDER BY o.CreatedAt DESC, o.OrderId DESC
OFFSET (@PageNumber - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

For page 3 with a page size of 25:
For page 3 with a page size of 25:

```text
Offset = (3 - 1) × 25 = 50
```

SQL Server skips the first 50 rows in the ordered result and returns rows 51–75.

### Syntax

```sql
SELECT ...
FROM ...
WHERE ...
ORDER BY SortColumn, UniqueTieBreaker
OFFSET @RowsToSkip ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

- `OFFSET` is mandatory when using `FETCH`.
- `FETCH` is optional; `OFFSET 0 ROWS` can be used without it.
- `FIRST` and `NEXT` are synonyms.
- `ROW` and `ROWS` are synonyms.[2][5]

### When to use it

Use `OFFSET`/`FETCH` when:

- Users need page numbers, such as “page 17 of 200.”
- The result set is moderate in size.
- You are implementing a standard grid/list interface.
- You need simple, readable SQL.

It is generally the simplest offset pagination syntax in modern SQL Server.[1][2][4]

## ROW_NUMBER() window function

`ROW_NUMBER()` assigns a sequential number to each row in a result set based on an `ORDER BY`. You then filter that calculated number in an outer query.[3][6][7]

```sql
DECLARE @PageNumber int = 3;
DECLARE @PageSize int = 25;

WITH OrderedOrders AS
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.Status,
        o.CreatedAt,
        o.Total,
        ROW_NUMBER() OVER
        (
            ORDER BY o.CreatedAt DESC, o.OrderId DESC
        ) AS RowNum
    FROM sales.Orders AS o
    WHERE o.Status = 'Pending'
)
SELECT
    OrderId,
    CustomerId,
    Status,
    CreatedAt,
    Total
FROM OrderedOrders
WHERE RowNum BETWEEN
      ((@PageNumber - 1) * @PageSize) + 1
  AND (@PageNumber * @PageSize)
ORDER BY RowNum;
```

For page 3 and size 25, this returns:

```text
51 <= RowNum <= 75
```

### When to use it

Use `ROW_NUMBER()` when:

- You need the row number as part of the result.
- You need custom filtering/ranges based on row position.
- You are supporting SQL Server versions before 2012.
- You are already using window-function logic, partitioning, or ranking.

Example: page within each customer:

```sql
WITH RankedOrders AS
(
    SELECT
        o.OrderId,
        o.CustomerId,
        o.CreatedAt,
        ROW_NUMBER() OVER
        (
            PARTITION BY o.CustomerId
            ORDER BY o.CreatedAt DESC, o.OrderId DESC
        ) AS OrderNumberForCustomer
    FROM sales.Orders AS o
)
SELECT *
FROM RankedOrders
WHERE OrderNumberForCustomer <= 10;
```

`PARTITION BY` restarts numbering for each customer, which is not ordinary global paging but is useful for “top N per group” queries.[3]

## OFFSET/FETCH vs ROW_NUMBER

| Concern                       | `OFFSET` / `FETCH`          | `ROW_NUMBER()`                  |
| ----------------------------- | --------------------------- | ------------------------------- |
| Readability for normal paging | Simpler                     | More verbose                    |
| SQL Server availability       | SQL Server 2012+            | Older versions too              |
| Requires deterministic order  | Yes                         | Yes                             |
| Supports page-number UI       | Yes                         | Yes                             |
| Exposes row number            | No, unless added separately | Yes                             |
| Supports partitioned ranking  | No                          | Yes                             |
| Deep-page performance         | Can degrade                 | Can also degrade                |
| Best use                      | Simple modern offset paging | Custom positional/ranking logic |

Both approaches are **offset-based pagination**. They have similar fundamental scaling limitations: to fetch page 10,000, SQL Server may still have to find/order/skip a large number of preceding rows.[4][8][9]

## Deep pagination problem

Suppose page size is 50:

```text
Page 1:     skip 0 rows
Page 100:   skip 4,950 rows
Page 10,000: skip 499,950 rows
```

The final response still has only 50 rows, but the work to reach that page can be large. An index that matches the filter and ordering helps significantly:

```sql
CREATE INDEX IX_Orders_Status_CreatedAt_OrderId
ON sales.Orders (Status, CreatedAt DESC, OrderId DESC)
INCLUDE (CustomerId, Total);
```

The exact index should be based on real predicates, selectivity, execution plans, and write cost—not copied blindly.

## Keyset / seek pagination: better for deep scrolling

For “next page” / infinite-scroll APIs, use **keyset pagination** instead of `OFFSET`. Rather than say “skip 500,000 rows,” the client supplies the last sort key it saw.

```sql
DECLARE @LastCreatedAt datetime2 = '2026-08-10T12:00:00';
DECLARE @LastOrderId bigint = 5000;
DECLARE @PageSize int = 25;

SELECT TOP (@PageSize)
    o.OrderId,
    o.CustomerId,
    o.Status,
    o.CreatedAt,
    o.Total
FROM sales.Orders AS o
WHERE o.Status = 'Pending'
  AND
  (
      o.CreatedAt < @LastCreatedAt
      OR (o.CreatedAt = @LastCreatedAt AND o.OrderId < @LastOrderId)
  )
ORDER BY o.CreatedAt DESC, o.OrderId DESC;
```

```text
Client receives:
cursor = (CreatedAt, OrderId)

Client sends cursor back for next page:
"Return the next 25 rows after this key."
```

Benefits:

- Does not need to skip all earlier rows.
- Often scales better for deep navigation with a matching index.
- More stable when new rows are inserted before the current page.

Trade-offs:

- It naturally supports **next/previous**, not arbitrary “jump to page 237.”
- The API needs a cursor token, usually encoding the final sort values.
- The sort order must remain stable and indexed.

## Consistency while data changes

Offset pagination is vulnerable to inserts/deletes between requests:

```text
Request 1: get page 1
New row inserted at top
Request 2: get page 2

Possible result:
- A row appears twice, or
- A row is skipped
```

A unique tie-breaker improves ordering determinism but does not create a consistent snapshot across separate requests.

Options depend on the business need:

- Accept minor movement for ordinary feeds/grids.
- Use keyset/cursor pagination for sequential navigation.
- Add a fixed “as-of” boundary such as `CreatedAt <= @snapshotTime`.
- Use snapshot isolation for a multi-query transaction, recognizing that holding a transaction across user page requests is generally a bad design.
- Return a cursor plus a fixed query filter/version.

## Total count

Page-number UIs often want a total:

```sql
SELECT COUNT_BIG(*)
FROM sales.Orders
WHERE Status = 'Pending';
```

Be aware that an exact count can be expensive on huge or complex filtered datasets. Do not automatically run it for every infinite-scroll request.

You can return the page and count separately, or add a window count:

```sql
SELECT
    o.OrderId,
    o.CreatedAt,
    o.Total,
    COUNT_BIG(*) OVER () AS TotalCount
FROM sales.Orders AS o
WHERE o.Status = 'Pending'
ORDER BY o.CreatedAt DESC, o.OrderId DESC
OFFSET @Offset ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

Measure this approach—the window count can add work and may affect execution plans.

## Input safety

Validate and cap page parameters:

```sql
SET @PageNumber = CASE WHEN @PageNumber < 1 THEN 1 ELSE @PageNumber END;
SET @PageSize = CASE
    WHEN @PageSize < 1 THEN 25
    WHEN @PageSize > 100 THEN 100
    ELSE @PageSize
END;
```

Do not allow arbitrary page sizes or unbounded deep offsets in public APIs. They can become an easy database-exhaustion vector.

## EF Core equivalents

### Offset paging

```csharp
var page = await db.Orders
    .AsNoTracking()
    .Where(o => o.Status == OrderStatus.Pending)
    .OrderByDescending(o => o.CreatedAt)
    .ThenByDescending(o => o.Id)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .Select(o => new OrderListItemDto(
        o.Id,
        o.CustomerId,
        o.Status,
        o.CreatedAt,
        o.Total))
    .ToListAsync(ct);
```

EF Core translates `Skip` / `Take` to provider-specific paging SQL, typically `OFFSET`/`FETCH` for SQL Server.

### Cursor paging

```csharp
var page = await db.Orders
    .AsNoTracking()
    .Where(o => o.Status == OrderStatus.Pending)
    .Where(o =>
        o.CreatedAt < cursor.CreatedAt ||
        (o.CreatedAt == cursor.CreatedAt && o.Id < cursor.OrderId))
    .OrderByDescending(o => o.CreatedAt)
    .ThenByDescending(o => o.Id)
    .Take(pageSize)
    .Select(o => new OrderListItemDto(
        o.Id, o.CustomerId, o.Status, o.CreatedAt, o.Total))
    .ToListAsync(ct);
```

## Interview answer

> Pagination limits a large ordered result set to a page. In modern SQL Server, I use `ORDER BY … OFFSET … FETCH NEXT` for straightforward page-number pagination and ensure the sort is deterministic by adding a unique tie-breaker such as `OrderId`. `ROW_NUMBER()` assigns ordered row positions, then an outer query filters a range, which is useful for older SQL Server versions, partitioned ranking, or when I need row numbers. Both are offset-based, so deep pages can become slow because SQL Server still has to skip many earlier rows. For large infinite-scroll APIs, I prefer keyset pagination using the last seen sort key and an index matching the filter and order.[1][2][3][4]

## Sources

[1] What is the best way to paginate results in SQL Server https://stackoverflow.com/questions/109232/what-is-the-best-way-to-paginate-results-in-sql-server
[2] SQL Server OFFSET FETCH https://www.sqlservertutorial.net/sql-server-basics/sql-server-offset-fetch/
[3] SQL Server ROW_NUMBER() Function Explained By ... https://www.sqlservertutorial.net/sql-server-window-functions/sql-server-row_number-function/
[4] Pagination with OFFSET / FETCH : A better way https://sqlperformance.com/2015/01/t-sql-queries/pagination-with-offset-fetch
[5] Pagination in SQL Server 2012 and above - SQLWizard https://sqlwizardblog.wordpress.com/2020/04/07/pagination-in-sql-server-2012-and-above/
[6] Paging and Versioning Using ROW_NUMBER() https://www.sqlservercentral.com/articles/paging-and-versioning-using-row_number
[7] Pagination Options in SQL Server - Chad Callihan https://callihandata.com/2022/09/27/pagination-options-in-sql-server/
[8] Considerations For Paging Queries In SQL Server With Batch Mode ... https://erikdarling.com/considerations-for-paging-queries-in-sql-server-with-batch-mode-dont-use-offset-fetch/
[9] Using OFFSET for Paging - SQLServerCentral https://www.sqlservercentral.com/articles/using-offset-for-paging
[10] how to use rownumber to write a paging query in SQL https://stackoverflow.com/questions/17391971/how-to-use-rownumber-to-write-a-paging-query-in-sql
[11] Offset and limit in SQL server? - Microsoft Q&A https://learn.microsoft.com/en-us/answers/questions/709574/offset-and-limit-in-sql-server
[12] SQL Server Paging - ROW_NUMBER and Row Count https://www.vbforums.com/showthread.php?527008-SQL-Server-Paging-ROW_NUMBER-and-Row-Count
[13] OFFSET-FETCH Clause - SQL - GeeksforGeeks https://www.geeksforgeeks.org/sql/sql-offset-fetch-clause/
[14] Filter Rows by Row Number for Pagination Queries https://alexanderobregon.substack.com/p/filter-rows-by-row-number-for-pagination
[15] How does paging work with ROW_NUMBER in SQL Server? https://dba.stackexchange.com/questions/32884/how-does-paging-work-with-row-number-in-sql-server
