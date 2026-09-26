---
title: Isolation Levels
sidebar_label: Isolation Levels
sidebar_position: 3
---

SQL Server isolation levels determine how one transaction can see—and be affected by—other concurrent transactions. Higher isolation prevents more anomalies, but can increase locking, blocking, deadlocks, version-store use, or update conflicts. SQL Server’s normal default is **READ COMMITTED**.[1][2][3]

## The anomalies

Before comparing levels, know the three common anomalies:

- **Dirty read:** Transaction A reads data that Transaction B changed but has not committed; B may later roll back.
- **Non-repeatable read:** A reads one row twice; B commits an update between reads, so A sees different values.
- **Phantom read:** A reruns a predicate query; B inserts/deletes rows matching that predicate, so A sees additional or missing rows.

```text
Transaction A: SELECT * FROM Orders WHERE Status = 'Pending'
Transaction B: INSERT a new Pending order; COMMIT
Transaction A: same SELECT again

A sees an extra row on the second query → phantom read
```

## Isolation-level summary

| Isolation level           | Dirty reads |         Non-repeatable reads |                     Phantoms | Main implementation trade-off                     |
| ------------------------- | ----------: | ---------------------------: | ---------------------------: | ------------------------------------------------- |
| `READ UNCOMMITTED`        |    Possible |                     Possible |                     Possible | Minimal blocking; unreliable results              |
| `READ COMMITTED`          |   Prevented |                     Possible |                     Possible | Default balance of correctness and concurrency    |
| `READ COMMITTED SNAPSHOT` |   Prevented |   Possible across statements |   Possible across statements | Row-version reads; less reader/writer blocking    |
| `REPEATABLE READ`         |   Prevented |                    Prevented |                     Possible | Holds read locks longer                           |
| `SNAPSHOT`                |   Prevented | Prevented within transaction | Prevented within transaction | Row-versioning; possible update conflicts         |
| `SERIALIZABLE`            |   Prevented |                    Prevented |                    Prevented | Strongest lock-based isolation; can block heavily |

`SNAPSHOT` provides a transaction-consistent view, but it is not identical to `SERIALIZABLE`: it does not generally enforce full serial execution of all application invariants, and concurrent updates can cause an update conflict.[1][3][4]

## READ UNCOMMITTED

`READ UNCOMMITTED` permits reading changes that another transaction has not committed.

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
BEGIN TRAN;

SELECT Balance
FROM dbo.Accounts
WHERE AccountId = 42;

COMMIT;
```

It can return data that is later rolled back, so it is inappropriate for money, inventory, orders, authorization, or other correctness-sensitive operations. `WITH (NOLOCK)` is a query-level way of requesting similar behavior and has the same correctness risks.[3][5]

Use it only when **approximate, potentially inconsistent data is explicitly acceptable**, such as a non-critical operational estimate—though snapshot-based read approaches are often safer.

## READ COMMITTED

`READ COMMITTED` prevents dirty reads: a statement does not read another transaction’s uncommitted modifications. It is SQL Server’s standard default isolation level.[1][2][3]

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

BEGIN TRAN;

SELECT Status
FROM dbo.Orders
WHERE OrderId = 1001;

-- Another transaction may commit a change here.

SELECT Status
FROM dbo.Orders
WHERE OrderId = 1001;

COMMIT;
```

The second `SELECT` can return a different committed value, so non-repeatable reads and phantoms are possible across statements in the same transaction. In lock-based `READ COMMITTED`, shared locks are normally held only for each statement’s duration, then released.[3]

This is a good default for many ordinary CRUD operations, especially when transactions are short and business logic can tolerate seeing the latest committed result per statement.

## READ COMMITTED SNAPSHOT (RCSI)

**Read Committed Snapshot Isolation** is a database option that changes how `READ COMMITTED` reads work. Rather than taking shared locks for normal reads, SQL Server uses row versions from `tempdb` to provide each statement a consistent view of data committed when that statement began.[3]

```sql
ALTER DATABASE SalesDb
SET READ_COMMITTED_SNAPSHOT ON;
```

Your application still uses:

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

But reads generally no longer block writers, and writers generally no longer block reads in the same way. This can significantly improve concurrency in read-heavy systems.[3]

Important distinction:

- **RCSI:** snapshot is per **statement**.
- **SNAPSHOT isolation:** snapshot is per **transaction**.

Therefore, under RCSI, two `SELECT` statements in one transaction can still see different committed states if another transaction commits between them.[3]

## REPEATABLE READ

`REPEATABLE READ` prevents another transaction from modifying rows you have read until your transaction completes. It prevents dirty and non-repeatable reads.[3][6]

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN TRAN;

SELECT Quantity
FROM dbo.Inventory
WHERE ProductId = 42;

-- Another transaction cannot update this row until this transaction ends.

COMMIT;
```

However, it does not protect the **range** of a predicate. Another transaction can insert a new row that matches a query predicate, so phantom reads remain possible.

### Trade-off

Because shared locks are held until commit, long-running transactions can cause more blocking and deadlocks. Use it only when reading the same existing rows consistently is required and the transaction can stay short.[3][6]

## SNAPSHOT isolation

`SNAPSHOT` isolation uses row versioning. Every statement in the transaction sees the version of data that was committed when the transaction began.[3]

First, enable it at the database level:

```sql
ALTER DATABASE SalesDb
SET ALLOW_SNAPSHOT_ISOLATION ON;
```

Then use it in the session:

```sql
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;

BEGIN TRAN;

SELECT Quantity
FROM dbo.Inventory
WHERE ProductId = 42;

-- Even if another transaction commits an update now,
-- this transaction continues to see its start-time snapshot.

COMMIT;
```

### Benefits

- Consistent transaction-wide reads.
- Readers generally do not block writers.
- Writers generally do not block readers.
- Prevents dirty, non-repeatable, and phantom reads **from the transaction’s snapshot perspective**.[3]

### Important caveat: update conflicts

If a row changed after your snapshot began, an attempt to update that row can fail with an update conflict rather than silently overwrite newer data. Your application needs retry or conflict-resolution logic.[4]

Snapshot isolation is excellent for many read-heavy workloads, but it consumes row-version storage in `tempdb` and does not automatically guarantee every multi-row business invariant is serializable. For example, application-level write-skew scenarios may still require explicit constraints, conditional updates, or stronger locking.

## SERIALIZABLE

`SERIALIZABLE` is SQL Server’s strongest standard isolation level. It behaves as though concurrent transactions execute one at a time for the relevant data ranges. In addition to protecting existing rows, SQL Server uses range locks to prevent inserts into ranges read by the transaction.[3][6]

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

BEGIN TRAN;

SELECT *
FROM dbo.Bookings
WHERE RoomId = 7
  AND BookingDate = '2026-08-10';

-- A concurrent transaction cannot insert a matching booking
-- into this protected key range until this transaction commits.

COMMIT;
```

This prevents dirty reads, non-repeatable reads, and phantoms. It is appropriate when correctness requires strict range-level guarantees—for example, certain reservation, uniqueness, or allocation workflows.

### Trade-off

Range locks can increase blocking, lock escalation, deadlocks, and reduced throughput. Keep transactions very short; never hold a serializable transaction open while waiting on a user, calling an external API, or processing slow network I/O.[3][6]

## Configuring isolation

Set it for the current connection/session:

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

Available SQL Server levels are:

```sql
SET TRANSACTION ISOLATION LEVEL
    READ UNCOMMITTED;
-- READ COMMITTED
-- REPEATABLE READ
-- SNAPSHOT
-- SERIALIZABLE
```

RCSI and snapshot isolation need database-level configuration as described above.[3]

In .NET:

```csharp
await using var transaction = await connection.BeginTransactionAsync(
    IsolationLevel.Serializable,
    cancellationToken);
```

Or with EF Core:

```csharp
await using var transaction = await db.Database.BeginTransactionAsync(
    IsolationLevel.Snapshot,
    ct);
```

The actual behavior still depends on SQL Server database settings—for example, `SNAPSHOT` needs `ALLOW_SNAPSHOT_ISOLATION ON`.

## Choosing an isolation level

| Situation                                                       | Typical choice                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Ordinary application reads/writes                               | `READ COMMITTED`                                                  |
| Read-heavy system suffering reader/writer blocking              | Enable RCSI after testing `tempdb` capacity and workload behavior |
| Need stable view across multiple reads in one transaction       | `SNAPSHOT`                                                        |
| Must stop updates to rows already read                          | `REPEATABLE READ`                                                 |
| Must prevent new matching rows / enforce range-level invariants | `SERIALIZABLE`                                                    |
| Approximate, non-critical reporting only                        | Possibly `READ UNCOMMITTED`, but use with great caution           |

Often, the best solution is not a higher transaction isolation level. Prefer a targeted database constraint or atomic conditional update when possible:

```sql
UPDATE dbo.Inventory
SET AvailableQuantity = AvailableQuantity - @requested
WHERE ProductId = @productId
  AND AvailableQuantity >= @requested;
```

Then inspect affected row count. This avoids a read-then-write race without holding a broad lock for the whole workflow.

## Interview answer

> SQL Server isolation levels control what concurrent transactions can observe and how much locking or versioning is used. `READ COMMITTED` is the normal default and prevents dirty reads, but non-repeatable reads and phantoms can still occur. RCSI keeps the `READ COMMITTED` semantics but uses row versions for statement-level snapshots, reducing reader/writer blocking. `REPEATABLE READ` holds read locks until commit, preventing changes to rows already read. `SNAPSHOT` gives a transaction-wide versioned view but can produce update conflicts. `SERIALIZABLE` uses range protection to prevent phantoms and gives the strongest guarantees, but at the highest blocking and deadlock cost. I choose the weakest isolation level that satisfies the invariant, keep transactions short, and prefer constraints or atomic conditional updates for targeted concurrency rules.[1][3][6]

## Sources

[1] Transaction Isolation Levels - SQL Server - Microsoft Learn https://learn.microsoft.com/en-us/sql/t-sql/language-elements/transaction-isolation-levels?view=sql-server-ver17
[2] Which SQL Transaction Isolation Level to be used? - Stack Overflow https://stackoverflow.com/questions/66953361/which-sql-transaction-isolation-level-to-be-used
[3] SET TRANSACTION ISOLATION LEVEL (Transact-SQL) - SQL Server https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver17
[4] Isolation Levels in SQL Server - Brent Ozar Unlimited® https://www.brentozar.com/isolation-levels-sql-server/
[5] Transaction Isolation Levels in DBMS - GeeksforGeeks https://www.geeksforgeeks.org/dbms/transaction-isolation-levels-dbms/
[6] Isolation Levels in SQL Server - SQLServerCentral https://www.sqlservercentral.com/articles/isolation-levels-in-sql-server
[7] Everything you always wanted to know about SQL isolation levels ... https://www.cockroachlabs.com/blog/sql-isolation-levels-explained/
[8] Azure SQL/SQL Server Transaction Isolation Levels summarized! https://www.reddit.com/r/SQLServer/comments/1hkytvc/azure_sqlsql_server_transaction_isolation_levels/
[9] MSSQL - Understanding Isolation Level By Example (Serializable) https://www.youtube.com/watch?v=ZtPj09tJjnQ
