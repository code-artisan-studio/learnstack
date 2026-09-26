**SQL joins** let you combine rows from two or more tables based on a related column (usually a key). Instead of storing everything in one giant table, you normalize data into related tables and use joins to reconstruct the full picture in queries. [atlassian](https://www.atlassian.com/data/sql/sql-join-types-explained-visually)

Below are the main join types, what they return, and when to use them.

---

## Core join types

Assume two tables:

- `Customers(CustomerId, Name)`
- `Orders(OrderId, CustomerId, OrderDate)`

`CustomerId` is the link between them.

### 1. `INNER JOIN`

Returns only rows where there’s a match in **both** tables. [stackoverflow](https://stackoverflow.com/questions/17946221/what-is-a-sql-join-and-what-are-the-different-types)

```sql
SELECT c.Name, o.OrderId, o.OrderDate
FROM Customers AS c
INNER JOIN Orders AS o
    ON c.CustomerId = o.CustomerId;
```

- Customers with no orders → excluded
- Orders with no matching customer → excluded

Use when you only care about related data that exists on both sides (e.g., “show me orders and their customers”).

---

### 2. `LEFT JOIN` (aka `LEFT OUTER JOIN`)

Returns **all rows from the left table**, and matching rows from the right table; unmatched right-side columns become `NULL`. [medium](https://medium.com/@1xcoder/the-4-types-of-sql-joins-explained-with-examples-d0f121132075)

```sql
SELECT c.Name, o.OrderId, o.OrderDate
FROM Customers AS c
LEFT JOIN Orders AS o
    ON c.CustomerId = o.CustomerId;
```

- All customers appear
- Customers without orders → `OrderId`/`OrderDate` are `NULL`

Use when you want “everything from the left, plus related data if it exists” (e.g., “list all customers and any orders they may have”).

---

### 3. `RIGHT JOIN` (aka `RIGHT OUTER JOIN`)

Mirror of `LEFT JOIN`: all rows from the **right table**, matched rows from the left; unmatched left-side columns are `NULL`. [w3schools](https://www.w3schools.com/sql/sql_join.asp)

```sql
SELECT c.Name, o.OrderId, o.OrderDate
FROM Customers AS c
RIGHT JOIN Orders AS o
    ON c.CustomerId = o.CustomerId;
```

- All orders appear
- Orders with no matching customer → `Name` is `NULL`

In practice, people usually rewrite `RIGHT JOIN` as a `LEFT JOIN` by swapping table order, but it’s good to recognize it.

---

### 4. `FULL OUTER JOIN` (aka `FULL JOIN`)

Returns **all rows from both tables**, matching where possible; where there’s no match, the other side is `NULL`. [medium](https://medium.com/@sujathamudadla1213/different-types-of-joins-in-sql-d0dda20f4397)

```sql
SELECT c.Name, o.OrderId, o.OrderDate
FROM Customers AS c
FULL OUTER JOIN Orders AS o
    ON c.CustomerId = o.CustomerId;
```

- Customers without orders → `OrderId`/`OrderDate` are `NULL`
- Orders without customers → `Name` is `NULL`

Use when you need a complete view of both sides (e.g., “show me all customers and all orders, even if some don’t match”).

Note: Not all databases support `FULL OUTER JOIN` (SQL Server and PostgreSQL do; MySQL does not directly).

---

## Other important join patterns

### 5. `CROSS JOIN`

Produces the **Cartesian product**: every row from the first table combined with every row from the second. [medium](https://medium.com/baakademi/sql-join-types-744268a7a611)

```sql
SELECT c.Name, p.ProductName
FROM Customers AS c
CROSS JOIN Products AS p;
```

- If `Customers` has 100 rows and `Products` has 50, result has 5,000 rows.
- No `ON` condition is used.

Use only when you truly need all combinations (e.g., generating all date × product combinations for reporting). Otherwise, it can explode your result set.

---

### 6. `SELF JOIN`

A join where a table is joined to **itself**, using aliases to treat it as two different tables. [medium](https://medium.com/baakademi/sql-join-types-744268a7a611)

Common pattern: hierarchical data (employees and managers in the same table):

```sql
SELECT e.Name AS Employee,
       m.Name AS Manager
FROM Employees AS e
LEFT JOIN Employees AS m
    ON e.ManagerId = m.EmployeeId;
```

- `Employees` appears twice with different aliases (`e`, `m`).
- Used to compare rows within the same table (org charts, category hierarchies, etc.).

---

### 7. `NATURAL JOIN` (conceptual / some DBs)

Joins tables automatically on columns with the **same name**, without an explicit `ON` clause. [medium](https://medium.com/@sujathamudadla1213/different-types-of-joins-in-sql-d0dda20f4397)

```sql
SELECT *
FROM Customers
NATURAL JOIN Orders;
```

- Relies on column names matching exactly.
- Rarely used in production code because it’s fragile: schema changes can silently alter the join behavior. Prefer explicit `ON` conditions.

---

## How to think about which join to use

Ask:

- Do I need **only matching rows**? → `INNER JOIN`
- Do I need **all rows from one side**, plus matches from the other? → `LEFT JOIN` (or `RIGHT JOIN` if you prefer that orientation)
- Do I need **all rows from both sides**, matched or not? → `FULL OUTER JOIN`
- Do I need **every combination** of two sets? → `CROSS JOIN`
- Am I joining a table **to itself**? → `SELF JOIN` with aliases

In most backend/.NET work, you’ll use `INNER JOIN` and `LEFT JOIN` most often; the others are situational but important to recognize in existing queries and during interviews.

If you want, I can map these to EF Core navigation properties and show how `Include`/`ThenInclude` correspond to different join patterns.
