---
title: SQL Triggers
sidebar_label: Triggers
sidebar_position: 3
---

A SQL Server **trigger** is a special stored procedure that runs automatically when a defined database event occurs. The main types are **DML triggers** for data changes, **DDL triggers** for schema changes, and **logon triggers** for session creation.[1][2][3]

Triggers are powerful, but they create hidden side effects. Use them sparingly for database-wide integrity, auditing, or schema-policy enforcement—not as the default place for ordinary application workflow logic.

## Trigger types

| Type          | Fires on                                                 | Typical use                                          |
| ------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| DML trigger   | `INSERT`, `UPDATE`, `DELETE`, `MERGE` on a table or view | Auditing, cross-table integrity, compatibility views |
| DDL trigger   | `CREATE`, `ALTER`, `DROP`, and related schema events     | Audit or restrict schema changes                     |
| Logon trigger | `LOGON` event during session creation                    | Connection auditing or connection policy             |
| CLR trigger   | Trigger implemented in a .NET assembly                   | Rare specialized use case                            |

[1][2][3][4]

## DML triggers

DML triggers execute when someone attempts to modify data on a table or view:

```sql
INSERT INTO sales.Orders (...);
UPDATE sales.Orders SET Status = 'Paid' WHERE OrderId = 1001;
DELETE FROM sales.Orders WHERE OrderId = 1001;
```

SQL Server DML triggers are **statement-level**, not row-level. One `UPDATE` affecting 10,000 rows fires the trigger **once**, and the trigger must handle all 10,000 affected rows correctly.[1][2]

### `AFTER` triggers

An `AFTER` trigger runs after SQL Server performs the DML action and validates relevant constraints, but still **inside the same transaction**. If the trigger throws an error or rolls back, the original statement is rolled back too. `FOR` is a synonym for `AFTER` in SQL Server.[2][5]

Example: audit order-status changes.

```sql
CREATE OR ALTER TRIGGER sales.trg_Orders_AuditStatus
ON sales.Orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.OrderStatusChanges
    (
        OrderId,
        OldStatus,
        NewStatus,
        ChangedAt,
        ChangedBy
    )
    SELECT
        d.OrderId,
        d.Status,
        i.Status,
        SYSUTCDATETIME(),
        ORIGINAL_LOGIN()
    FROM inserted AS i
    INNER JOIN deleted AS d
        ON d.OrderId = i.OrderId
    WHERE i.Status <> d.Status;
END;
```

```text
UPDATE Orders
   |
   +--> SQL Server updates row(s)
   |
   +--> AFTER trigger runs
   |
   +--> Audit row(s) are inserted
   |
   +--> Transaction commits, or all work rolls back
```

Use `AFTER` triggers for:

- Audit records.
- Cross-table validation that cannot be modeled by a constraint.
- Maintaining tightly coupled database-side derived data.
- Enforcing database rules regardless of which application writes to the table.[2]

### `INSTEAD OF` triggers

An `INSTEAD OF` trigger runs **instead of** the original DML operation. The trigger becomes responsible for performing the required insert, update, or delete itself.[2]

They are especially useful for making a view writable or preserving a legacy interface while directing data to a redesigned schema.

```sql
CREATE OR ALTER TRIGGER sales.trg_OrderSummary_Insert
ON sales.vw_OrderSummary
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO sales.Orders (CustomerId, Total, Status)
    SELECT
        CustomerId,
        Total,
        'Pending'
    FROM inserted;
END;
```

A client can now run:

```sql
INSERT INTO sales.vw_OrderSummary (CustomerId, Total)
VALUES (42, 99.95);
```

The view itself is not directly modified; the trigger decides how to write to underlying tables.

### Important: SQL Server has no `BEFORE` DML trigger

Some databases support `BEFORE INSERT`, `BEFORE UPDATE`, and `BEFORE DELETE` triggers. SQL Server does **not**. For DML, SQL Server uses:

- `AFTER` / `FOR`
- `INSTEAD OF`[2][5]

## `inserted` and `deleted` tables

Inside a DML trigger, SQL Server exposes two logical, temporary tables:

| Operation | `inserted`       | `deleted`        |
| --------- | ---------------- | ---------------- |
| `INSERT`  | New row versions | Empty            |
| `DELETE`  | Empty            | Old row versions |
| `UPDATE`  | New row versions | Old row versions |

Use them as **sets**, not as single variables:

```sql
-- Wrong: assumes exactly one changed row
DECLARE @OrderId int;
SELECT @OrderId = OrderId FROM inserted;
```

```sql
-- Correct: handles any number of changed rows
INSERT INTO audit.OrderAudit (OrderId, EventType, OccurredAt)
SELECT
    i.OrderId,
    'Created',
    SYSUTCDATETIME()
FROM inserted AS i;
```

An `UPDATE` is conceptually a delete of the old version plus insertion of the new version, so both tables contain rows.[2]

## DDL triggers

DDL triggers execute when schema or database-definition events occur, such as `CREATE`, `ALTER`, or `DROP`. They can be scoped to a **database** or SQL Server **instance**.[1][3][4]

Example: audit table drops in a database.

```sql
CREATE OR ALTER TRIGGER audit.trg_AuditTableDrop
ON DATABASE
FOR DROP_TABLE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO audit.SchemaChanges
    (
        EventType,
        EventData,
        OccurredAt,
        LoginName
    )
    VALUES
    (
        EVENTDATA().value('(/EVENT_INSTANCE/EventType)[1]', 'sysname'),
        CONVERT(nvarchar(max), EVENTDATA()),
        SYSUTCDATETIME(),
        ORIGINAL_LOGIN()
    );
END;
```

Common uses:

- Audit schema changes.
- Prevent destructive changes outside an approved process.
- Enforce schema naming or deployment policies.
- Monitor permission, login, or role changes.[3][6]

Be cautious: blocking DDL with triggers can interfere with migrations, emergency changes, or automated deployment pipelines.

## Logon triggers

A **logon trigger** fires after authentication succeeds but while the SQL Server session is being established. It is server-scoped.[1][4][6]

Example: record connections.

```sql
CREATE OR ALTER TRIGGER trg_AuditLogons
ON ALL SERVER
FOR LOGON
AS
BEGIN
    INSERT INTO master.dbo.LoginAudit
    (
        LoginName,
        HostName,
        ApplicationName,
        LoggedAt
    )
    VALUES
    (
        ORIGINAL_LOGIN(),
        HOST_NAME(),
        APP_NAME(),
        SYSUTCDATETIME()
    );
END;
```

Use logon triggers extremely carefully. A buggy, slow, or overly restrictive logon trigger can prevent legitimate users—or even administrators—from connecting to SQL Server.[1][4]

## CLR triggers

SQL Server also supports triggers implemented in a .NET CLR assembly. A CLR trigger may be an `AFTER`, `INSTEAD OF`, or DDL trigger.[1][2]

They are uncommon in modern systems. Prefer ordinary T-SQL unless CLR integration provides a clear, measured benefit and your organization accepts the operational/security complexity of enabling and managing SQL CLR assemblies.

## Benefits

Triggers can be useful because they:

- Enforce a rule regardless of which application, script, ORM, or integration writes to the database.
- Execute in the same transaction as the triggering statement.
- Support centralized auditing.
- Help preserve compatibility for legacy schemas and writable views.
- Can enforce some cross-table rules that normal constraints cannot express.[2][3]

## Risks and trade-offs

Triggers can also cause significant problems:

- **Hidden behavior:** `UPDATE Orders` may unexpectedly write audit tables, update summaries, or reject the operation.
- **Performance cost:** trigger work increases the duration of the original transaction and can increase locking/blocking.
- **Deadlocks:** trigger code may touch additional tables in an inconsistent order.
- **Recursive/cascading behavior:** one trigger can cause another DML event, producing difficult-to-debug chains.
- **Multi-row bugs:** code written for one row fails when a statement modifies many rows.
- **Error coupling:** an audit-table outage or trigger bug can prevent the original business operation from committing.

Because triggers execute in the same transaction, keep them fast, deterministic, set-based, and narrowly scoped.[2][6]

## When to use a trigger

Use a trigger when the rule belongs at the **database boundary** and must apply to every writer:

- Audit critical changes where all data paths must be captured.
- Enforce a cross-table integrity rule that cannot be expressed as a constraint.
- Write-compatible views over legacy/normalized schemas.
- Audit or govern schema changes with DDL triggers.
- A migration/compatibility bridge with a planned retirement path.

Avoid triggers for:

- Sending emails, HTTP requests, or message-bus events.
- Long-running work.
- Most application workflow/business logic.
- Maintaining data that can be calculated on demand.
- Logic that needs visible, easy-to-test orchestration.

For integration events, prefer the **transactional outbox pattern**: write an outbox record in the application transaction, then publish asynchronously from a worker. This avoids holding the SQL transaction open for external I/O.

## Trigger design rules

1. Write set-based SQL; never assume one affected row.
2. Keep trigger work short and local.
3. Use `SET NOCOUNT ON`.
4. Only inspect/update columns that matter.
5. Be explicit about recursion and nested-trigger behavior.
6. Avoid external network calls and slow procedural loops.
7. Add indexes to tables accessed by the trigger.
8. Test multi-row inserts, updates, deletes, rollbacks, concurrency, and deadlock scenarios.
9. Document every trigger because it is implicit behavior.
10. Monitor trigger duration, error rates, blocking, and deadlocks.

## Interview answer

> A SQL Server trigger is a special stored procedure that executes automatically in response to a database event. The major categories are DML triggers for `INSERT`, `UPDATE`, and `DELETE`; DDL triggers for schema events such as `CREATE`, `ALTER`, and `DROP`; and logon triggers for new sessions. DML triggers are either `AFTER`, which run after the statement inside the same transaction, or `INSTEAD OF`, which replace the original operation and are useful for writable views. SQL Server DML triggers are statement-level, so I always use the `inserted` and `deleted` pseudo-tables set-wise. I use triggers sparingly for database-enforced auditing, integrity, or compatibility—not for slow external work or ordinary application workflow—because they add hidden behavior, transaction time, locking, and deadlock risk.[1][2][3]

## Sources

[1] CREATE TRIGGER (Transact-SQL) - SQL Server https://learn.microsoft.com/en-us/sql/t-sql/statements/create-trigger-transact-sql?view=sql-server-ver17
[2] DML Triggers - SQL Server https://learn.microsoft.com/en-us/sql/relational-databases/triggers/dml-triggers?view=sql-server-ver17
[3] DDL Triggers - SQL Server https://learn.microsoft.com/en-us/sql/relational-databases/triggers/ddl-triggers?view=sql-server-ver17
[4] Type of Triggers in SQL Server https://www.mssqltips.com/tutorial/type-of-triggers-in-sql-server/
[5] Difference Between Insert / After Insert, Update / After ... https://www.sqlservercentral.com/forums/topic/difference-between-insert-after-insert-update-after-update-etc-triggers
[6] Understanding SQL Triggers - DevOps.dev https://blog.devops.dev/understanding-sql-triggers-36e62492ce09
[7] Circuit Breaker Pattern in Microservices https://www.geeksforgeeks.org/system-design/what-is-circuit-breaker-pattern-in-microservices/
[8] Need to list all triggers in SQL Server database with table name and ... https://stackoverflow.com/questions/4305691/need-to-list-all-triggers-in-sql-server-database-with-table-name-and-tables-sch
[9] Different Types of Triggers In SQL Server https://www.scholarhat.com/tutorial/sqlserver/different-types-of-sql-server-triggers
[10] Triggers in SQL Server https://www.sqlshack.com/triggers-in-sql-server/
[11] What are the types of Triggers in the SQL server? https://www.mindstick.com/forum/157530/what-are-the-types-of-triggers-in-the-sql-server
[12] What is a trigger in SQL Server and how to use it? https://www.mindstick.com/forum/158353/what-is-a-trigger-in-sql-server-and-how-to-use-it
[13] SQL | Triggers https://www.geeksforgeeks.org/dbms/sql-triggers/
[14] SQL TRIGGERS Explained For Beginners And HOW TO Use ... https://www.youtube.com/watch?v=fp9u1vgrjpk
