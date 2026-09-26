**Pessimistic locking** is a concurrency control technique where you _assume conflicts are likely_ and **lock the data as soon as you read it**, so no other transaction can modify (or sometimes even read) it until you’re done. [medium](https://medium.com/@iamprovidence/pessimistic-locking-in-practice-d159e230ebbf)

---

## Core idea

Instead of letting everyone read and update freely and checking for conflicts at the end (optimistic locking), pessimistic locking:

1. **Acquires a lock** on the row (or table) when you read it.
2. **Blocks other transactions** from modifying (and sometimes reading) that row until you commit or roll back.
3. Guarantees that while you hold the lock, **you are the only one** who can change that data. [medium](https://medium.com/@duhov/optimistic-vs-pessimistic-locking-in-databases-c32a52aeadfe)

It’s called “pessimistic” because it assumes the worst: “Someone else will probably try to change this, so I’ll lock it now.”

---

## How it works in SQL

Typical pattern using `SELECT ... FOR UPDATE`:

```sql
BEGIN TRANSACTION;

-- Lock the row(s) you plan to update
SELECT Balance, Version
FROM Accounts
WHERE AccountId = 123
FOR UPDATE;

-- Do your business logic in the app
-- e.g., newBalance = balance - amount;

-- Update while you still hold the lock
UPDATE Accounts
SET Balance = @NewBalance,
    Version = Version + 1
WHERE AccountId = 123;

COMMIT;
```

Behavior:

- The `SELECT ... FOR UPDATE` acquires an **exclusive lock** on the selected row(s).
- Other transactions that try to:
  - Update the same row → must wait until your transaction commits/rolls back.
  - In many DBs, also `SELECT ... FOR UPDATE` on the same row → must wait. [medium](https://medium.com/@keemsisi/exploring-sql-database-locking-a-comprehensive-guide-to-optimistic-and-pessimistic-approaches-4e0cb7ebdaf2)

Once you commit, the lock is released and the next waiting transaction can proceed.

Some DBs also support:

- `SELECT ... FOR SHARE` / `FOR NO KEY UPDATE` – weaker locks that allow certain reads but still block conflicting writes.
- Different isolation levels (e.g., `SERIALIZABLE`, `REPEATABLE READ`) that affect locking behavior.

---

## Pessimistic vs optimistic locking

**Pessimistic locking:**

- Lock early: when you read the row.
- Others **wait** (block) if they touch the same row.
- Good when:
  - Conflicts are **frequent** (high write contention).
  - You cannot tolerate lost updates or retries.
  - Critical sections are short (lock held for milliseconds, not seconds). [stackoverflow](https://stackoverflow.com/questions/129329/optimistic-vs-pessimistic-locking)

**Optimistic locking:**

- No locks while reading; detect conflicts at update time via version/timestamp.
- Conflicting updates **fail** and must be retried.
- Good when:
  - Reads vastly outnumber writes.
  - Conflicts are rare.
  - You prefer higher throughput and can handle occasional retries. [moderntreasury](https://www.moderntreasury.com/learn/pessimistic-locking-vs-optimistic-locking)

Tradeoff:

- High contention → pessimistic can be safer and simpler (no storm of retries).
- Low contention → optimistic usually gives better performance (no blocking, less lock overhead). [medium](https://medium.com/@duhov/optimistic-vs-pessimistic-locking-in-databases-c32a52aeadfe)

---

## When to use pessimistic locking

Good candidates:

- **High-conflict, write-heavy** scenarios:
  - Inventory deduction for hot items (flash sales).
  - Ledger updates where multiple processes frequently adjust the same account.
  - Seat reservation systems where overbooking is unacceptable. [nicholusmuwonge.medium](https://nicholusmuwonge.medium.com/database-pessimistic-locking-underused-misunderstood-and-critical-c9b241572d7e)

- **Short, critical transactions**:
  - You can keep the lock duration very short (pure DB operations, no user interaction, no long external calls). [medium](https://medium.com/@agrim.kandoria/optimistic-and-pessimistic-locking-in-sql-ensuring-data-consistency-0262bff2f060)

Bad candidates:

- Long-running business transactions that span:
  - User interactions (e.g., user opens a form, thinks for 30 seconds, then submits).
  - External API calls, heavy processing.  
    Holding a DB lock across these will cause severe contention and timeouts. [medium](https://medium.com/@agrim.kandoria/optimistic-and-pessimistic-locking-in-sql-ensuring-data-consistency-0262bff2f060)

---

## Pros and cons

**Pros:**

- Strong guarantee: no lost updates within the locked scope.
- Simpler mental model: “I have the lock, so I’m safe.”
- Avoids retry storms in high-contention scenarios. [medium](https://medium.com/@iamprovidence/pessimistic-locking-in-practice-d159e230ebbf)

**Cons:**

- Reduced concurrency: other transactions must wait.
- Can cause:
  - Higher latency under load
  - Timeouts and deadlocks if not carefully designed.
- Doesn’t scale well if locks are held for long or on hot rows. [nicholusmuwonge.medium](https://nicholusmuwonge.medium.com/database-pessimistic-locking-underused-misunderstood-and-critical-c9b241572d7e)

---

## Example in JPA / .NET

In JPA:

- Use `entityManager.find(..., LockModeType.PESSIMISTIC_WRITE)` or `@Lock(PESSIMISTIC_WRITE)` on repository methods.
- JPA translates this to `SELECT ... FOR UPDATE` under the hood. [baeldung](https://www.baeldung.com/jpa-pessimistic-locking)

In .NET with raw SQL:

- Explicitly use `SELECT ... FOR UPDATE` (or equivalent) inside a transaction.
- In EF Core, you can execute raw SQL for the locking read, then update within the same transaction.

---
