---
title: Deadlocks
sidebar_label: Deadlocks
sidebar_position: 3
---

A **deadlock** occurs when two or more database transactions form a circular wait: each holds a lock that another transaction needs, so none can continue. SQL Server detects the cycle, selects one transaction as the **deadlock victim**, rolls it back, and returns error 1205 so the other transaction can proceed.[1][2][3]

## Deadlock vs blocking

| Concept      | What happens                                        | Resolution                                       |
| ------------ | --------------------------------------------------- | ------------------------------------------------ |
| Blocking     | One transaction waits for another to release a lock | Usually resolves when blocker commits/rolls back |
| Deadlock     | Transactions wait on each other in a cycle          | SQL Server kills one transaction                 |
| Lock timeout | A session waits longer than configured timeout      | Waiting session receives a timeout error         |

```text
Blocking:
A holds resource 1
B waits for resource 1
A commits → B continues

Deadlock:
A holds resource 1, waits for resource 2
B holds resource 2, waits for resource 1
Neither can continue → SQL Server aborts one
```

## Simple example

Transaction A updates `Orders` and then `Customers`:

```sql
BEGIN TRAN;

UPDATE dbo.Orders
SET Status = 'Processing'
WHERE OrderId = 1001;

-- Waits here if another transaction holds Customer 42.
UPDATE dbo.Customers
SET LastOrderAt = SYSUTCDATETIME()
WHERE CustomerId = 42;

COMMIT;
```

At the same time, Transaction B does the opposite:

```sql
BEGIN TRAN;

UPDATE dbo.Customers
SET LoyaltyPoints = LoyaltyPoints + 10
WHERE CustomerId = 42;

-- Waits here if transaction A holds Order 1001.
UPDATE dbo.Orders
SET UpdatedAt = SYSUTCDATETIME()
WHERE OrderId = 1001;

COMMIT;
```

```text
Transaction A:
holds Orders → waits for Customers

Transaction B:
holds Customers → waits for Orders
```

That is a deadlock. SQL Server breaks the cycle by rolling back one transaction, typically based on deadlock priority and estimated rollback cost.[1][2][4]

## Common causes

### Inconsistent resource order

The most common cause is different code paths locking the same resources in opposite orders:

```text
Path A: Orders → Customers
Path B: Customers → Orders
```

The strongest basic prevention is to make all paths acquire resources in a **consistent order**.[1][5][6]

### Long transactions

Long-running transactions hold locks longer and increase the chance of overlapping with another transaction. Common causes include:

- Waiting for user input
- Calling an external HTTP/payment/email service
- Doing slow file or network I/O
- Processing large loops inside one transaction
- Leaving a transaction open unintentionally[1][5][7]

### Missing or inefficient indexes

A poorly indexed update or delete may scan many rows or indexes, acquire more locks, and hold them longer. This expands the opportunity for lock conflicts and deadlocks.[2][7]

### Large writes and lock escalation

Updating/deleting many rows can increase lock footprint and potentially cause escalation from row/page locks toward table-level locks. That raises contention and can contribute to deadlocks.[1]

### Isolation levels and reader/writer contention

Higher isolation levels such as `REPEATABLE READ` and `SERIALIZABLE` hold locks longer and can increase deadlock probability when used unnecessarily. SQL Server’s guidance also recommends considering row-versioning isolation—such as `READ_COMMITTED_SNAPSHOT` or `SNAPSHOT`—where appropriate.[1][2]

### Secondary effects

Deadlocks can involve more than the tables obvious in application code:

- Foreign-key validation
- Triggers
- Indexed views
- Nonclustered index maintenance
- Parallel query execution
- Schema and metadata locks
- Partition-level locking behavior[1][8]

## Prevention

You cannot guarantee that all deadlocks disappear in a concurrent database, but you can make them rare and cheap.

### 1. Lock resources in one consistent order

Define a global order for resources and follow it everywhere:

```text
Customer → Order → OrderItem
```

If every transaction follows that same order, circular waiting is much less likely.[1][5][6]

### 2. Keep transactions short

Start transactions as late as possible and commit or roll back as soon as possible.

```csharp
// Good: DB work is short and focused.
await using var tx = await db.Database.BeginTransactionAsync(ct);

await UpdateOrderStateAsync(ct);
await SaveOutboxMessageAsync(ct);

await tx.CommitAsync(ct);
```

Do not do this:

```csharp
await using var tx = await db.Database.BeginTransactionAsync(ct);

await UpdateOrderStateAsync(ct);
await paymentGateway.ChargeAsync(..., ct); // Avoid network I/O in DB transaction.
await tx.CommitAsync(ct);
```

Use an outbox, saga, or asynchronous workflow when external calls must participate in a larger business process.

### 3. Add and maintain useful indexes

Index columns used in:

- `WHERE` predicates
- Join conditions
- Foreign keys
- Update/delete selection criteria

The goal is not “more indexes everywhere.” Each extra index adds write-maintenance cost. Add indexes based on the actual deadlock graph and execution plans. Microsoft guidance identifies index tuning, including nonclustered-index changes, as a low-risk way to reduce recurring deadlocks.[2]

### 4. Reduce lock scope

- Update only required rows.
- Avoid broad scans in write transactions.
- Use bounded batches for large updates/deletes.
- Use atomic set-based operations where possible.

For example, reserve inventory in one statement:

```sql
UPDATE dbo.Inventory
SET AvailableQuantity = AvailableQuantity - @quantity
WHERE ProductId = @productId
  AND AvailableQuantity >= @quantity;
```

Check affected row count. This avoids a separate read-then-write sequence and reduces the transaction’s lock window.

### 5. Use appropriate isolation

Use the weakest isolation level that preserves the business rule. Avoid reaching for `SERIALIZABLE` by default. For read-heavy systems, evaluate `READ_COMMITTED_SNAPSHOT` or snapshot isolation to reduce reader/writer lock contention, while accounting for `tempdb` row-version storage and update-conflict semantics.[1][2]

### 6. Design retries

Deadlocks are usually **transient**. A retry often succeeds once the surviving transaction completes. Applications should retry idempotent work with a small randomized backoff.[2]

```csharp
const int maxAttempts = 3;

for (var attempt = 1; attempt <= maxAttempts; attempt++)
{
    try
    {
        await ProcessOrderAsync(ct);
        break;
    }
    catch (SqlException ex) when (ex.Number == 1205 && attempt < maxAttempts)
    {
        var delay = TimeSpan.FromMilliseconds(
            Random.Shared.Next(50, 200) * attempt);

        await Task.Delay(delay, ct);
    }
}
```

Only retry when the operation is idempotent or protected by an idempotency key. Never blindly retry an unknown partially completed external side effect such as a payment request unless that downstream operation is also idempotent.

## Detection and diagnosis

A deadlock error tells you **that** a deadlock happened; a **deadlock graph** tells you why.

Use:

- The default `system_health` Extended Events session
- A dedicated Extended Events session capturing `xml_deadlock_report`
- Azure SQL Query Store / deadlock analysis features where available
- SQL Server Management Studio deadlock graph visualization[2][9]

The deadlock graph shows:

- The victim and surviving processes
- SQL statements and execution plans involved
- Locked resources and lock modes
- Wait relationships
- Application/session metadata

Do not fix deadlocks by merely increasing command timeout. A deadlock is detected and ended by SQL Server; timeout settings address long waits, not a circular dependency.

## Basic handling flow

```text
Deadlock error 1205
      |
      v
Capture deadlock graph
      |
      v
Identify resource order, query plan, indexes, transaction scope
      |
      v
Fix root cause:
consistent access order / shorter transaction / better index /
smaller batch / isolation change
      |
      v
Keep bounded retry with jitter for transient residual deadlocks
```

## Interview answer

> A SQL Server deadlock is a circular wait: transaction A holds a lock needed by B, while B holds a lock needed by A. SQL Server detects the cycle, chooses a victim based on deadlock priority and rollback cost, rolls it back, and returns error 1205. The most common cause is inconsistent resource-access order, such as one path updating Orders then Customers while another updates Customers then Orders. I prevent deadlocks by using a consistent order, keeping transactions short, avoiding network calls inside transactions, indexing access paths, using small batches and the appropriate isolation level, and using atomic conditional updates when possible. I capture the deadlock graph to diagnose the real lock cycle, then retry only idempotent transactions with bounded jittered backoff.[1][2][4]

## Sources

[1] Deadlocks Guide - SQL Server - Microsoft Learn https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide?view=sql-server-ver17
[2] Analyze and Prevent Deadlocks - Azure SQL Database https://docs.azure.cn/en-us/azure-sql/database/analyze-prevent-deadlocks?view=azuresql
[3] SQL Server Deadlocks: Causes, Monitoring & Fixes https://www.devart.com/dbforge/sql/studio/sql-server-deadlock.html
[4] SQL Server Deadlock Monitoring Tool https://www.solarwinds.com/sql-sentry/use-cases/sql-server-deadlock
[5] Preventing deadlocks in SQL Server https://stackoverflow.com/questions/40585374/preventing-deadlocks-in-sql-server
[6] Deadlock SQL Server - Microsoft Q&A https://learn.microsoft.com/en-us/answers/questions/5581008/deadlock-sql-server
[7] How to Avoid SQL Server Deadlocks: 5 Essential Steps for DBAs https://www.idera.com/blogs/how-to-avoid-sql-server-deadlocks/
[8] Identifying causes for deadlock and ways to prevent it https://learn.microsoft.com/en-us/answers/questions/1138857/identifying-causes-for-deadlock-and-ways-to-preven
[9] SQL query to get the deadlocks in SQL SERVER 2008 https://stackoverflow.com/questions/12422986/sql-query-to-get-the-deadlocks-in-sql-server-2008
[10] SQL Server: Deadlock Analysis and Prevention https://www.pluralsight.com/courses/sqlserver-deadlocks
[11] The Cause of Every Deadlock in SQL Server - SolarWinds THWACK https://thwack.solarwinds.com/discussion/147994/the-cause-of-every-deadlock-in-sql-server
[12] Deadlock avoidance techniques in SQLServer https://www.reddit.com/r/SQLServer/comments/1pal5tw/deadlock_avoidance_techniques/
[13] Are deadlocks common? : r/SQLServer - Reddit https://www.reddit.com/r/SQLServer/comments/1b6qynu/are_deadlocks_common/
[14] Deadlocks in database : r/SQLServer - Reddit https://www.reddit.com/r/SQLServer/comments/14asz36/deadlocks_in_database/
[15] What are SQL Server deadlocks and how to monitor them https://www.sqlshack.com/what-are-sql-server-deadlocks-and-how-to-monitor-them/
