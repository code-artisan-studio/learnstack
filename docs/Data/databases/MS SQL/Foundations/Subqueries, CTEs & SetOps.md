**Subqueries**, **CTEs**, and **set operations** are three ways to structure more complex SQL logic: breaking a problem into steps, naming intermediate results, and combining result sets. [datacamp](https://www.datacamp.com/tutorial/sql-subquery)

---

## 1. Subqueries (nested queries)

A **subquery** is a query inside another query. The inner query runs first, and its result is used by the outer query. [skillsetmaster](https://skillsetmaster.com/topics/sql-subqueries-ctes)

### Where subqueries can appear

1. **In the `WHERE` clause** (most common)  
   Single-value or list results used for filtering.

   ```sql
   -- Customers who have placed orders above the average order amount
   SELECT DISTINCT c.CustomerId, c.Name
   FROM Customers AS c
   JOIN Orders AS o ON c.CustomerId = o.CustomerId
   WHERE o.Amount > (
       SELECT AVG(Amount)
       FROM Orders
   );
   ```

   Inner query: `SELECT AVG(Amount) FROM Orders` → returns one number.  
   Outer query: uses that number in the `WHERE` condition.

2. **In the `FROM` clause** (derived table / inline view)  
   The subquery acts like a temporary table.

   ```sql
   -- City-level stats, then filter cities with high average
   SELECT city, avg_amount, order_count
   FROM (
       SELECT
           c.City AS city,
           AVG(o.Amount) AS avg_amount,
           COUNT(*) AS order_count
       FROM Customers AS c
       JOIN Orders AS o ON c.CustomerId = o.CustomerId
       GROUP BY c.City
   ) AS city_stats
   WHERE avg_amount > 500;
   ```

3. **In the `SELECT` clause** (scalar subquery)  
   Returns a single value per row.

   ```sql
   SELECT
       c.CustomerId,
       c.Name,
       (
           SELECT SUM(Amount)
           FROM Orders AS o
           WHERE o.CustomerId = c.CustomerId
       ) AS TotalSpent
   FROM Customers AS c;
   ```

### Correlated subqueries

A **correlated subquery** references a column from the outer query, so it runs once per outer row. [youtube](https://www.youtube.com/watch?v=tvBp81WVrCA)

```sql
-- Each customer’s maximum order amount
SELECT
    c.CustomerId,
    c.Name,
    (
        SELECT MAX(Amount)
        FROM Orders AS o
        WHERE o.CustomerId = c.CustomerId
    ) AS MaxOrderAmount
FROM Customers AS c;
```

Powerful but can be slow on large tables; often replaced with joins or window functions in performance-critical code.

---

## 2. CTEs (Common Table Expressions)

A **CTE** is a named, temporary result set defined using `WITH`. It’s like a named subquery that appears before the main query. [meritshot](https://www.meritshot.com/tutorials/sql/ctes-and-set-operations)

Basic syntax:

```sql
WITH city_stats AS (
    SELECT
        c.City AS city,
        AVG(o.Amount) AS avg_amount,
        COUNT(*) AS order_count
    FROM Customers AS c
    JOIN Orders AS o ON c.CustomerId = o.CustomerId
    GROUP BY c.City
)
SELECT city, avg_amount, order_count
FROM city_stats
WHERE avg_amount > 500
ORDER BY avg_amount DESC;
```

Same logic as the derived-table example, but:

- The intermediate result is **named** (`city_stats`)
- The main query reads more like a story
- Easier to debug and modify

### Why use CTEs?

- **Readability**: Break complex logic into clear steps. [dev](https://dev.to/k1gen_/subqueries-vs-ctes-in-sql-a-complete-guide-for-beginners-49mf)
- **Reusability**: Reference the same CTE multiple times in one query. [meritshot](https://www.meritshot.com/tutorials/sql/ctes-and-set-operations)
- **Maintainability**: Easier to edit than deeply nested subqueries. [datawithsarah](https://datawithsarah.com/post/sql-subqueries-vs-ctes-explained/)

Performance-wise, a CTE is often similar to an equivalent subquery; the main benefit is clarity, not speed. [learnsql](https://learnsql.com/blog/cte-vs-subquery/)

### Multiple CTEs

You can chain CTEs, where later ones reference earlier ones:

```sql
WITH
monthly_revenue AS (
    SELECT
        DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1) AS month,
        SUM(Amount) AS revenue
    FROM Orders
    GROUP BY DATEFROMPARTS(YEAR(OrderDate), MONTH(OrderDate), 1)
),
revenue_with_growth AS (
    SELECT
        month,
        revenue,
        LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue
    FROM monthly_revenue
)
SELECT
    month,
    revenue,
    prev_month_revenue,
    CASE
        WHEN prev_month_revenue IS NULL THEN NULL
        ELSE ROUND(100.0 * (revenue - prev_month_revenue) / prev_month_revenue, 2)
    END AS growth_pct
FROM revenue_with_growth;
```

### Recursive CTEs

Used for hierarchical data (org charts, category trees, bill of materials). [youtube](https://www.youtube.com/watch?v=LJC8277LONg&vl=en)

```sql
WITH EmployeeHierarchy AS (
    -- Anchor: top-level employees (no manager)
    SELECT EmployeeId, Name, ManagerId, 0 AS Level
    FROM Employees
    WHERE ManagerId IS NULL

    UNION ALL

    -- Recursive part: employees under previous level
    SELECT e.EmployeeId, e.Name, e.ManagerId, eh.Level + 1
    FROM Employees AS e
    JOIN EmployeeHierarchy AS eh
        ON e.ManagerId = eh.EmployeeId
)
SELECT *
FROM EmployeeHierarchy;
```

---

## 3. Set operations (combining result sets)

**Set operations** combine the results of two or more `SELECT` queries into a single result set. The queries must have the same number of columns with compatible types, in the same order. [youtube](https://www.youtube.com/watch?v=D2xUEYR-GIY)

Main operators:

### `UNION` and `UNION ALL`

- `UNION` – combines results and **removes duplicates**.
- `UNION ALL` – combines results and **keeps all rows** (faster, no dedup). [youtube](https://www.youtube.com/watch?v=D2xUEYR-GIY)

```sql
-- All customer IDs from two regions, no duplicates
SELECT CustomerId FROM CustomersNorth
UNION
SELECT CustomerId FROM CustomersSouth;

-- Same, but keep duplicates if any
SELECT CustomerId FROM CustomersNorth
UNION ALL
SELECT CustomerId FROM CustomersSouth;
```

Use `UNION ALL` unless you specifically need duplicate removal.

### `INTERSECT`

Returns rows that appear in **both** result sets. [meritshot](https://www.meritshot.com/tutorials/sql/ctes-and-set-operations)

```sql
-- Customers who have placed orders in both 2025 and 2026
SELECT CustomerId
FROM Orders
WHERE YEAR(OrderDate) = 2025

INTERSECT

SELECT CustomerId
FROM Orders
WHERE YEAR(OrderDate) = 2026;
```

### `EXCEPT` (or `MINUS` in some DBs)

Returns rows from the first query that **do not appear** in the second. [youtube](https://www.youtube.com/watch?v=D2xUEYR-GIY)

```sql
-- Customers who ordered in 2025 but not in 2026
SELECT CustomerId
FROM Orders
WHERE YEAR(OrderDate) = 2025

EXCEPT

SELECT CustomerId
FROM Orders
WHERE YEAR(OrderDate) = 2026;
```

---

## How these fit together in real code

- Use **subqueries** when you need a quick, one-off filter or calculation.
- Use **CTEs** when the logic is complex, multi-step, or reused in the same query (better readability). [dev](https://dev.to/k1gen_/subqueries-vs-ctes-in-sql-a-complete-guide-for-beginners-49mf)
- Use **set operations** when you’re combining or comparing entire result sets (e.g., “customers in A but not B”, “customers in both years”). [meritshot](https://www.meritshot.com/tutorials/sql/ctes-and-set-operations)

In .NET / EF Core, you’ll often see the equivalent of CTEs and subqueries expressed as LINQ queries that get translated into SQL by the provider. If you’d like, I can show how these patterns map to LINQ (`Where`, `Select`, `Concat`, `Except`, `Intersect`, etc.).
