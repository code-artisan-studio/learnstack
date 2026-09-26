---
title: Stored Procedures and Functions
sidebar_label: Procedures and Functions
sidebar_position: 3
---

In SQL Server, a **stored procedure** is an executable database routine used to perform an operation—often reads, writes, transactions, and workflow steps. A **user-defined function (UDF)** is a routine that returns a value or table and can be composed inside SQL queries. Use procedures for **doing work**; use functions for **producing reusable queryable results**.[1][2][3]

## Quick comparison

| Feature                 | Stored procedure                                        | Scalar function                                   | Table-valued function              |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Returns                 | Zero/many result sets, output parameters, return status | One scalar value                                  | A table result                     |
| Invoked with            | `EXEC` / `EXECUTE`                                      | `SELECT`, `WHERE`, `JOIN`, expressions            | `FROM`, `JOIN`, `APPLY`            |
| Can modify data         | Yes                                                     | No side-effecting data changes                    | No side-effecting data changes     |
| Can manage transactions | Yes                                                     | No independent transaction control                | No independent transaction control |
| Can use `TRY...CATCH`   | Yes                                                     | Restricted; not a general error-handling workflow | Restricted                         |
| Best for                | Commands, workflows, operational/reporting APIs         | Small reusable calculations/transforms            | Reusable composable row-set logic  |

Functions have stricter rules because SQL Server needs them to behave as query expressions rather than procedural workflows. Procedures are more flexible.[1][2][4][5]

## Stored procedures

A stored procedure is saved T-SQL that is executed explicitly.

```sql
CREATE OR ALTER PROCEDURE sales.CreateOrder
    @CustomerId int,
    @Total decimal(18,2),
    @OrderId int OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO sales.Orders (CustomerId, Total, Status)
        VALUES (@CustomerId, @Total, 'Pending');

        SET @OrderId = SCOPE_IDENTITY();

        INSERT INTO sales.OrderAudit (OrderId, EventType, CreatedAt)
        VALUES (@OrderId, 'OrderCreated', SYSUTCDATETIME());

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END;
```

Call it with:

```sql
DECLARE @NewOrderId int;

EXEC sales.CreateOrder
    @CustomerId = 42,
    @Total = 99.95,
    @OrderId = @NewOrderId OUTPUT;
```

### Use stored procedures for

- Insert, update, delete, or multi-step workflows.
- Explicit transaction boundaries and error handling.
- Batch jobs, imports, reconciliation, or maintenance work.
- Returning one or more result sets to an application.
- Permission boundaries: grant callers `EXECUTE` without granting direct table permissions.
- Database-side operations that must be close to data.[2][3][4][6]

A procedure can return result sets, output parameters, and an integer return status, although result sets are generally the clearest way to return tabular data.

## Scalar-valued functions

A **scalar UDF** accepts parameters and returns exactly one scalar value, such as `int`, `decimal`, `date`, or `nvarchar`.[4][7][8]

```sql
CREATE OR ALTER FUNCTION sales.CalculateTax
(
    @Amount decimal(18,2),
    @TaxRate decimal(9,6)
)
RETURNS decimal(18,2)
AS
BEGIN
    RETURN ROUND(@Amount * @TaxRate, 2);
END;
```

Use it inside a query:

```sql
SELECT
    OrderId,
    Total,
    sales.CalculateTax(Total, 0.0825) AS Tax
FROM sales.Orders;
```

### Use scalar UDFs for

- Small, deterministic calculations.
- Reusable formatting or normalization logic.
- A computation that naturally belongs in a SQL expression.

### Important performance warning

Historically, scalar UDFs were often executed **once per input row**, hiding cost from the optimizer and causing major slowdowns on large result sets. SQL Server 2019+ can inline eligible scalar UDFs, but many functions are not eligible, so do not assume inlining will occur.[9][10]

Avoid a scalar UDF that queries tables for every row:

```sql
-- Risky on large result sets: may cause per-row hidden work.
SELECT
    o.OrderId,
    dbo.GetCustomerDiscount(o.CustomerId)
FROM sales.Orders AS o;
```

Prefer a set-based `JOIN`, `APPLY`, inline TVF, or a query rewrite. Measure with actual execution plans.

## Table-valued functions

A **table-valued function (TVF)** returns rows and columns, so SQL Server can use it like a table in the `FROM` clause.[6][7][8]

```sql
CREATE OR ALTER FUNCTION sales.OrdersForCustomer
(
    @CustomerId int
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        o.OrderId,
        o.CreatedAt,
        o.Status,
        o.Total
    FROM sales.Orders AS o
    WHERE o.CustomerId = @CustomerId
);
```

Use it like this:

```sql
SELECT *
FROM sales.OrdersForCustomer(42)
WHERE Status = 'Pending';
```

Or compose it with other tables:

```sql
SELECT
    c.CustomerName,
    o.OrderId,
    o.Total
FROM sales.Customers AS c
CROSS APPLY sales.OrdersForCustomer(c.CustomerId) AS o;
```

## Inline TVFs vs multi-statement TVFs

This distinction matters greatly.

### Inline table-valued function (iTVF)

An **inline TVF** has one returned query:

```sql
CREATE OR ALTER FUNCTION sales.ActiveProducts
(
    @CategoryId int
)
RETURNS TABLE
AS
RETURN
(
    SELECT ProductId, Name, Price
    FROM sales.Products
    WHERE CategoryId = @CategoryId
      AND IsActive = 1
);
```

Think of it as a **parameterized view**. SQL Server expands the function’s query into the calling query, so the optimizer can see and optimize the whole statement. Inline TVFs are generally the preferred TVF form.[9]

### Multi-statement table-valued function (mTVF)

A **multi-statement TVF** builds and returns a table variable:

```sql
CREATE OR ALTER FUNCTION sales.CustomerOrderSummary
(
    @CustomerId int
)
RETURNS @Result TABLE
(
    OrderId int,
    Total decimal(18,2),
    ItemCount int
)
AS
BEGIN
    INSERT INTO @Result (OrderId, Total, ItemCount)
    SELECT
        o.OrderId,
        o.Total,
        COUNT(oi.OrderItemId)
    FROM sales.Orders AS o
    LEFT JOIN sales.OrderItems AS oi
        ON oi.OrderId = o.OrderId
    WHERE o.CustomerId = @CustomerId
    GROUP BY o.OrderId, o.Total;

    RETURN;
END;
```

mTVFs are useful only when you truly need multiple procedural steps to construct the table result. They can be harder for the optimizer to estimate accurately and may perform poorly at scale because they can behave like an opaque table-variable-producing black box.[9]

**Rule of thumb:** prefer an inline TVF; avoid mTVFs on performance-critical paths unless you have measured them and cannot express the logic set-wise.

## Function restrictions

A SQL Server UDF is meant to return a value/table without side effects. It cannot generally:

- Perform side-effecting `INSERT`, `UPDATE`, or `DELETE` against permanent tables.
- Create, alter, or drop database objects.
- Start/commit/roll back transactions.
- Call stored procedures.
- Return multiple independent result sets.[2][4][5]

A UDF can read data, use local/table variables, and call other eligible functions, subject to SQL Server’s UDF rules. The important design principle is: do not use a function as a hidden write workflow.

## Decision guide

| Need                                                                 | Choose                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Create an order, update inventory, write audit entries atomically    | Stored procedure                                     |
| Execute a batch operation or maintenance task                        | Stored procedure                                     |
| Return a result set to an application using complex procedural logic | Stored procedure                                     |
| Reuse a simple scalar calculation inside `SELECT`/`WHERE`            | Scalar UDF, if performance is measured/acceptable    |
| Reuse parameterized set logic inside `FROM`/`JOIN`                   | Inline TVF                                           |
| Need to compose a reusable result set with other queries             | Inline TVF                                           |
| Need multi-step table construction                                   | mTVF only if an inline/set-based query is not viable |

## Example: same business area, different tool

**Procedure:** command that changes state.

```sql
EXEC sales.CancelOrder @OrderId = 1001, @Reason = 'Customer request';
```

**Scalar function:** calculate a value in a query.

```sql
SELECT OrderId, sales.CalculateTax(Total, 0.0825)
FROM sales.Orders;
```

**Inline TVF:** return queryable rows.

```sql
SELECT *
FROM sales.OrdersForCustomer(42)
WHERE Total > 100;
```

```text
Procedure = do something
Scalar UDF = compute one value
TVF = return a composable table
```

## Permissions

Procedures are commonly used to expose a narrow permission surface:

```sql
GRANT EXECUTE ON sales.CreateOrder TO AppRole;
```

The application role can execute the approved procedure without necessarily having direct `INSERT` permission on underlying tables. This can support defense in depth, though it does not replace parameterization, input validation, least-privilege design, or auditing.

## EF Core / .NET considerations

- EF Core can execute procedures with `ExecuteSqlInterpolatedAsync`, raw SQL APIs, or provider-specific mappings.
- Treat stored-procedure calls as infrastructure code and keep SQL parameters parameterized; never concatenate user input into dynamic SQL.
- For read-only stored-procedure results, map to keyless entity types or DTO-like result models.
- EF Core LINQ is often preferable for ordinary CRUD because it is composable, testable, and keeps query logic in application code; use procedures/functions when they provide a real database-side advantage, not by default.

## Interview answer

> A stored procedure is an executable database routine used to perform work. It can modify data, manage transactions, handle errors, return result sets, and expose a controlled permission boundary, so I use it for commands and multi-step database workflows. A scalar function returns one value and can be used inside SQL expressions, but I use it cautiously because scalar UDFs can execute per row unless SQL Server can inline them. A table-valued function returns a queryable table and can be used in `FROM`, `JOIN`, or `APPLY`; I prefer inline TVFs because the optimizer can expand and optimize them like parameterized views. I reserve multi-statement TVFs for cases that cannot be expressed inline and validate their plans and performance.[4][6][7][9]

## Sources

[1] Function vs. Stored Procedure in SQL Server https://stackoverflow.com/questions/1179758/function-vs-stored-procedure-in-sql-server
[2] Functions vs stored procedures in SQL Server - SQLShack https://www.sqlshack.com/functions-vs-stored-procedures-sql-server/
[3] Function vs Procedure https://www.geeksforgeeks.org/computer-science-fundamentals/difference-between-function-and-procedure/
[4] Difference Between Stored Procedure And Function In SQL Server https://www.c-sharpcorner.com/UploadFile/996353/difference-between-stored-procedure-and-user-defined-functio/
[5] Difference between Stored Procedure and Function in SQL ... https://www.scholarhat.com/tutorial/sqlserver/difference-between-stored-procedure-and-function-in-sql-server
[6] Functions vs. Stored Procedures to return result sets https://www.sqlservercentral.com/blogs/sql-server-functions-vs-stored-procedures-to-return-result-sets
[7] Difference between scalar, table-valued, and aggregate functions in ... https://stackoverflow.com/questions/34754663/difference-between-scalar-table-valued-and-aggregate-functions-in-sql-server
[8] Please define Table Value Function EXPLAIN LIKE IM 5. - Reddit https://www.reddit.com/r/SQL/comments/157m3fb/please_define_table_value_function_explain_like/
[9] Joins vs Functions and Performance - Microsoft Q&A https://learn.microsoft.com/en-us/answers/questions/2338077/joins-vs-functions-and-performance
[10] sql server - When is it appropriate to use a scalar valued function? https://dba.stackexchange.com/questions/150658/when-is-it-appropriate-to-use-a-scalar-valued-function
[11] Scalar vs Table-Valued Functions in T-SQL - LinkedIn https://www.linkedin.com/advice/0/what-differences-between-scalar-table-valued
[12] Stored Procedures and Functions. : r/SQLServer https://www.reddit.com/r/SQLServer/comments/1j4zixa/stored_procedures_and_functions/
[13] Stored Procedures vs Function - The Real use case | How to decide https://www.youtube.com/watch?v=AaRgQ6zuLHQ
[14] Table Valued functions Vs Scalar Valued Functions https://www.sqlservercentral.com/forums/topic/table-valued-functions-vs-scalar-valued-functions
[15] sql server - When to Use Functions over Stored Procedures https://dba.stackexchange.com/questions/231185/when-to-use-functions-over-stored-procedures
