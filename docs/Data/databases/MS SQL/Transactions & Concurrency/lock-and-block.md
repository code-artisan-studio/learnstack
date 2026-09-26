---
title: Lock, Block and Deadlock
sidebar_label: Lock & Block
sidebar_position: 3
---

SQL Server uses **locks** to protect data consistency when multiple transactions access the same data. **Blocking** occurs when one session holds a lock that conflicts with a lock another session needs, so the second session waits until the first transaction commits, rolls back, or releases the resource.[1][2][3]

## Locks, blocking, and deadlocks

These terms are related but different:

| Term     | Meaning                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Locking  | SQL Server’s normal mechanism for coordinating concurrent access                                         |
| Blocking | One session waits because another holds an incompatible lock                                             |
| Deadlock | Two or more sessions wait on each other in a cycle; SQL Server chooses one as a victim and rolls it back |

Blocking is **normal** and often short-lived. It becomes a problem when a transaction holds locks for a long time, blocks many sessions, or creates a blocking chain.[2][3][4]

```text
Session 52 holds an X lock on Order 1001
Session 68 requests an S or X lock on Order 1001
Session 68 waits → blocked by session 52
```

## What SQL Server locks

SQL Server can lock resources at different granularities:

- **Row / key:** a specific row or index key
- **Key range:** a range of index keys, typically for serializable operations
- **Page:** an 8 KB data or index page
- **Extent:** eight contiguous pages
- **Table / object**
- **Database**
- **Schema / metadata**[1][5][6]

SQL Server normally tries to choose a fine enough lock to allow concurrency, but it can escalate many row/page locks to a table lock when maintaining many small locks becomes too costly. Good indexes and short transactions help reduce broad locking.

## Main lock modes

### Shared lock (`S`)

A **shared lock** is used when reading data under lock-based isolation.

- Multiple sessions can usually hold shared locks on the same data.
- A shared lock conflicts with an exclusive lock, so a writer cannot modify data while the shared lock is held.[1][2]

```sql
SELECT *
FROM dbo.Orders
WHERE OrderId = 1001;
```

Under normal lock-based `READ COMMITTED`, shared locks are generally held only for the statement. Under `REPEATABLE READ` or `SERIALIZABLE`, they can be held until the transaction ends.[1][7]

### Exclusive lock (`X`)

An **exclusive lock** is used for `INSERT`, `UPDATE`, and `DELETE`.

- Only one session can hold an exclusive lock on a resource.
- It blocks incompatible reads and all competing writes.
- It is normally held until the transaction commits or rolls back.[1][2]

```sql
BEGIN TRAN;

UPDATE dbo.Inventory
SET AvailableQuantity = AvailableQuantity - 1
WHERE ProductId = 42;

-- X lock remains until COMMIT or ROLLBACK
COMMIT;
```

### Update lock (`U`)

An **update lock** is an intermediate lock used when SQL Server reads a row with the intention that it may update it later.

- Multiple shared locks may coexist with an update lock.
- Only one update lock can typically exist on a resource.
- Before modification, SQL Server converts the update lock to an exclusive lock.[1][5]

Its purpose is to reduce a common conversion deadlock:

```text
Session A: reads row with S lock, then wants X
Session B: reads same row with S lock, then wants X
Both wait to convert → deadlock risk

Using U lock:
One session gets U first; the other waits earlier.
```

### Intent locks (`IS`, `IX`, `SIX`)

Intent locks indicate that a transaction holds or plans to acquire locks at a lower granularity, such as rows or pages. They allow SQL Server to efficiently coordinate locks at different levels in the hierarchy.[1][5][8]

| Intent lock | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `IS`        | Intent to take shared locks below this object                      |
| `IX`        | Intent to take exclusive locks below this object                   |
| `SIX`       | Shared lock on object plus intent to take exclusive locks below it |

Example: SQL Server might place an `IX` lock on `Orders` while holding an `X` lock on one `Orders` row. The table-level `IX` does not mean every row is exclusively locked; it signals that lower-level exclusive locks exist or are expected.

### Schema stability (`Sch-S`) and schema modification (`Sch-M`)

**Schema locks** protect metadata and schema consistency.[1][6][8]

- **`Sch-S`**: acquired when SQL Server compiles or executes a query; it blocks schema modifications but normally does not block ordinary data changes.
- **`Sch-M`**: acquired by schema-changing operations such as `ALTER TABLE`, `CREATE/DROP INDEX`, `TRUNCATE TABLE`, or dropping an object; it is highly restrictive.

This is why a seemingly harmless query can wait behind a long `ALTER TABLE`, and why DDL changes should be planned carefully in busy systems.

### Key-range locks

**Key-range locks** protect a range in an index and prevent phantom rows under `SERIALIZABLE` isolation.[5][8][9]

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRAN;

SELECT *
FROM dbo.Bookings
WHERE RoomId = 7
  AND BookingDate = '2026-08-10';

-- SQL Server can protect the matching key range,
-- preventing an insert of a matching booking.

COMMIT;
```

They are vital for strict range-level correctness but can increase blocking.

### Bulk update (`BU`) locks

A **bulk update lock** is used by certain bulk-loading operations, such as bulk copy with `TABLOCK`. It allows compatible bulk load operations while blocking incompatible access.[1][5][8]

## Lock compatibility

A simplified compatibility view:

| Existing lock |  Request S |  Request U | Request X |
| ------------- | ---------: | ---------: | --------: |
| `S`           | Compatible | Compatible |    Blocks |
| `U`           | Compatible |     Blocks |    Blocks |
| `X`           |     Blocks |     Blocks |    Blocks |

“Compatible” means the requested lock can be granted immediately. “Blocks” means the session must wait if the conflicting lock remains held. SQL Server’s full compatibility matrix also includes intent, schema, bulk-update, and range locks.[1][8]

## Blocking example

### Session A

```sql
BEGIN TRAN;

UPDATE dbo.Orders
SET Status = 'Processing'
WHERE OrderId = 1001;

-- Do not commit yet
```

### Session B

```sql
SELECT *
FROM dbo.Orders
WHERE OrderId = 1001;
```

Under lock-based `READ COMMITTED`, Session B can wait because Session A holds an exclusive lock on that row. Once A runs `COMMIT` or `ROLLBACK`, B can proceed.

```text
Session A: X lock on Order 1001
Session B: requests S lock on Order 1001
           ↓
        waits (blocking)
Session A: COMMIT
Session B: proceeds
```

Blocking is a correctness feature: it prevents B from reading an uncommitted value under normal isolation.[4][10]

## Common causes of harmful blocking

- Long-running transactions.
- Open transactions left idle by application code.
- Updating/deleting many rows in one transaction.
- Missing or inefficient indexes causing scans and many locks.
- Large schema changes during high traffic.
- Large batches that trigger lock escalation.
- Higher isolation levels such as `REPEATABLE READ` or `SERIALIZABLE`.
- Reader/writer contention in lock-based `READ COMMITTED`.[1][10][11]

An external API call inside a transaction is a classic mistake:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

await db.Orders
    .Where(o => o.Id == orderId)
    .ExecuteUpdateAsync(/* ... */, ct);

await paymentGateway.ChargeAsync(..., ct); // Avoid holding DB locks here.

await tx.CommitAsync(ct);
```

The database transaction can hold locks while the network call waits. Prefer reserving/recording state in a short transaction, then calling the external service outside it, using patterns such as an outbox or saga when consistency across systems matters.

## Blocking vs deadlock

A **blocking chain** has a session that can eventually release its lock:

```text
Session 1 blocks Session 2 blocks Session 3
```

A **deadlock** is circular:

```text
Session 1 holds Order row, wants Customer row
Session 2 holds Customer row, wants Order row
```

Neither can proceed. SQL Server detects the cycle and aborts one transaction as the deadlock victim. The application should catch the deadlock error and retry an idempotent transaction with bounded backoff.[3]

## Finding blockers

### Quick diagnostic query

```sql
SELECT
    r.session_id,
    r.blocking_session_id,
    r.status,
    r.wait_type,
    r.wait_time,
    r.wait_resource,
    DB_NAME(r.database_id) AS database_name,
    s.host_name,
    s.program_name,
    t.text AS current_sql
FROM sys.dm_exec_requests AS r
JOIN sys.dm_exec_sessions AS s
    ON s.session_id = r.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) AS t
WHERE r.blocking_session_id <> 0;
```

Look for:

- The **head blocker**: the session at the start of the chain.
- Long transaction duration.
- Wait type and locked resource.
- The SQL statement and application identity holding the lock.

SSMS Activity Monitor can also show blocking processes, and `sp_who2` is a quick legacy troubleshooting view.[12]

Do not immediately run `KILL <session_id>` in production. First identify the transaction and application owner; killing a session causes rollback, which itself can take time and continue holding locks while undo occurs.

## Reducing blocking

1. **Keep transactions short.** Begin as late as possible and commit/rollback as early as possible.
2. **Access objects in a consistent order.** This reduces deadlock risk.
3. **Index predicates and joins.** Efficient seeks reduce scanned rows, lock duration, and lock footprint.
4. **Batch large modifications.** Delete/update in bounded chunks instead of a huge transaction.
5. **Use the weakest isolation level that preserves the business invariant.**
6. **Consider RCSI** for read-heavy workloads to reduce ordinary reader/writer blocking through row versioning; test `tempdb` capacity and workload effects first.[1][7]
7. **Use atomic conditional updates** for targeted invariants rather than broad locks.

Example: reserve inventory atomically:

```sql
UPDATE dbo.Inventory
SET AvailableQuantity = AvailableQuantity - @requested
WHERE ProductId = @productId
  AND AvailableQuantity >= @requested;
```

Check affected-row count. This avoids a separate read followed by a write and often avoids needing a longer serializable transaction.

## Interview answer

> SQL Server locks are in-memory structures that protect rows, keys, pages, tables, and schemas during concurrent access. The main lock modes are shared (`S`) for reads, exclusive (`X`) for writes, update (`U`) to reduce lock-conversion deadlocks, intent locks (`IS`, `IX`, `SIX`) to coordinate hierarchical locks, schema locks (`Sch-S`, `Sch-M`), and key-range locks under serializable isolation. Blocking occurs when a session requests a lock incompatible with one another session holds; it is normal when brief, but harmful when transactions are long, inefficient, or form chains. I troubleshoot by finding the head blocker using request/session DMVs or Activity Monitor, then reduce blocking with short transactions, proper indexes, chunked modifications, appropriate isolation/RCSI, consistent access order, and atomic conditional updates.[1][2][3]

## Sources

[1] Transaction Locking and Row Versioning Guide - SQL Server https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide?view=sql-server-ver17
[2] SQL SERVER - Locking, Blocking, and Deadlocking: Differences ... https://blog.sqlauthority.com/2023/06/22/sql-server-locking-blocking-and-deadlocking-differences-similarities-and-best-practices/
[3] Troubleshoot SQL Server Blocking and Identify Root Causes https://www.solarwinds.com/sql-sentry/use-cases/sql-server-blocking
[4] sql server - What is blocking and how does it happen? https://dba.stackexchange.com/questions/4760/what-is-blocking-and-how-does-it-happen
[5] Types of Locks in SQL Server https://www.baeldung.com/sql/ms-sql-locks
[6] All about locking in SQL Server https://www.sqlshack.com/locking-sql-server/
[7] SET TRANSACTION ISOLATION LEVEL (Transact-SQL) - SQL Server https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver17
[8] A Basic Overview of Locks in SQL Server - Coeo https://www.coeo.com/2025/01/a-basic-overview-of-locks-in-sql-server/
[9] SQL Server locks explained https://stackoverflow.com/questions/100789/sql-server-locks-explained
[10] Blocking in SQL Server - GeeksforGeeks https://www.geeksforgeeks.org/sql/blocking-in-sql-server/
[11] Locking and Blocking in SQL Server - Brent Ozar Unlimited® https://www.brentozar.com/sql/locking-and-blocking-in-sql-server/
[12] How to check blocking queries in SQL Server - Stack Overflow https://stackoverflow.com/questions/41078457/how-to-check-blocking-queries-in-sql-server
[13] SQL Server Blocking Explained: How to Fix Blocking - YouTube https://www.youtube.com/watch?v=bva6RAjpa6U
[14] What are the different locking modes present in SQL | SQL ... https://www.youtube.com/watch?v=9lmPOTv-pDc
[15] SQL- Lock Table https://www.geeksforgeeks.org/sql/sql-lock-table/
[16] Massive Blocking – SQLServerCentral Forums https://www.sqlservercentral.com/forums/topic/massive-blocking
