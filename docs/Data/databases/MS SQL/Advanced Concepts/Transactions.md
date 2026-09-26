A **database transaction** is a sequence of one or more operations (reads, inserts, updates, deletes) that are treated as a **single logical unit of work**: either all of them succeed together, or none of them take effect. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/transaction-in-dbms/)

---

## Why transactions exist

Without transactions, failures and concurrency can leave your data in an inconsistent state.

Example: money transfer from Account A to Account B

1. Read balance of A
2. Deduct amount from A
3. Add amount to B

If the system crashes after step 2 but before step 3, money disappears. A transaction ensures:

- If everything succeeds → **commit**: both debit and credit are saved.
- If anything fails → **rollback**: no change is saved at all. [en.wikipedia](https://en.wikipedia.org/wiki/Database_transaction)

---

## ACID properties

Transactions are defined by the **ACID** guarantees:

- **Atomicity** – all-or-nothing: either all operations in the transaction are applied, or none are.
- **Consistency** – the database moves from one valid state to another, respecting constraints (PK/FK, checks, etc.).
- **Isolation** – concurrent transactions don’t interfere; each behaves as if it ran alone.
- **Durability** – once committed, changes survive crashes (written to disk / log). [medium](https://medium.com/@franciscofrez/database-transactions-overview-from-theory-to-real-world-use-2b5bd73ce314)

---

## Basic transaction lifecycle

Typical flow:

1. **Begin** – start the transaction.
   ```sql
   BEGIN TRANSACTION;
   -- or START TRANSACTION;
   ```
2. **Execute operations** – reads and writes.

   ```sql
   UPDATE Accounts
   SET Balance = Balance - 100
   WHERE AccountId = 1;

   UPDATE Accounts
   SET Balance = Balance + 100
   WHERE AccountId = 2;
   ```

3. **Commit** – make changes permanent.
   ```sql
   COMMIT;
   ```
4. **Rollback** – undo all changes if something fails.
   ```sql
   ROLLBACK;
   ```

States a transaction can be in:

- **Active** – executing operations
- **Partially committed** – all operations done, not yet committed
- **Committed** – changes are permanent
- **Failed / Aborted** – rolled back, no changes persist [docs.oracle](https://docs.oracle.com/en/database/oracle/oracle-database/21/cncpt/transactions.html)

---

## Concurrency and isolation

When multiple transactions run at the same time, the DB must isolate them so they don’t corrupt each other’s work.

Common isolation levels (from weakest to strongest):

- **Read Uncommitted** – can see uncommitted changes (dirty reads).
- **Read Committed** – only see committed data; each statement sees a fresh snapshot.
- **Repeatable Read** – within a transaction, repeated reads see the same data.
- **Serializable** – strongest; transactions behave as if executed one after another.

Higher isolation → stronger guarantees, but more locking / contention and potentially lower concurrency. [planetscale](https://planetscale.com/blog/database-transactions)

---

## Example in .NET (EF Core / ADO.NET)

EF Core example:

```csharp
using var scope = new TransactionScope(
    TransactionScopeOption.Required,
    new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted },
    TransactionScopeAsyncFlowOption.Enabled);

try
{
    await context.Accounts
        .Where(a => a.Id == 1)
        .ExecuteUpdateAsync(a => a.SetProperty(x => x.Balance, x => x.Balance - 100));

    await context.Accounts
        .Where(a => a.Id == 2)
        .ExecuteUpdateAsync(a => a.SetProperty(x => x.Balance, x => x.Balance + 100));

    scope.Complete(); // commits
}
catch
{
    // scope not completed → automatic rollback
}
```

Or with raw ADO.NET:

```csharp
using var conn = new SqlConnection(connString);
await conn.OpenAsync();

using var tx = conn.BeginTransaction();
try
{
    // execute commands with conn and tx
    // ...

    tx.Commit();
}
catch
{
    tx.Rollback();
}
```

---

## When to use transactions

Use transactions whenever:

- Multiple related changes must stay consistent (transfers, order + order items, ledger entries).
- You need to enforce business rules across multiple rows/tables.
- You must protect against partial updates on errors or crashes. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/transaction-in-dbms/)

Avoid wrapping long-running or user-interactive flows in a single DB transaction; keep transactions short to reduce locking and contention.
