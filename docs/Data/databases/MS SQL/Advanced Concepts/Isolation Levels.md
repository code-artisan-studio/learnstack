**SQL isolation levels** define how much one transaction must be isolated from the effects of other concurrent transactions. They directly control which **concurrency anomalies** can happen. [learn.microsoft](https://learn.microsoft.com/en-us/sql/odbc/reference/develop-app/transaction-isolation-levels?view=sql-server-ver17)

---

## The three classic anomalies

These are the phenomena the SQL standard uses to define isolation levels. [pickuma](https://pickuma.com/for-dev/database-isolation-levels-and-the-anomalies-they-prevent/)

### 1. Dirty read

- A transaction reads data **written by another transaction that has not yet committed**.
- If the writer later rolls back, the reader saw data that “never existed.”

Example:

- T1: `UPDATE Accounts SET Balance = 900 WHERE Id = 1;` (not committed)
- T2: `SELECT Balance FROM Accounts WHERE Id = 1;` → sees 900
- T1: `ROLLBACK;` → balance is actually back to 1000, but T2 already used 900. [medium](https://medium.com/@cihanelibol99/sql-isolation-levels-a-deep-dive-from-basics-to-professional-09056be3269b)

---

### 2. Non‑repeatable read

- A transaction reads the **same row twice** and gets **different values** because another transaction modified (or deleted) it and committed in between.

Example:

- T1: `SELECT Balance FROM Accounts WHERE Id = 1;` → 1000
- T2: `UPDATE Accounts SET Balance = 900 WHERE Id = 1; COMMIT;`
- T1: `SELECT Balance FROM Accounts WHERE Id = 1;` → 900

Same query, same row, different result within one transaction. [learn.microsoft](https://learn.microsoft.com/en-us/sql/odbc/reference/develop-app/transaction-isolation-levels?view=sql-server-ver17)

---

### 3. Phantom read

- A transaction re-runs a query with a **range condition** and sees **new or missing rows** because another transaction inserted/deleted rows that match the condition and committed.

Example:

- T1: `SELECT * FROM Orders WHERE Amount > 100;` → 10 rows
- T2: `INSERT INTO Orders (Amount) VALUES (150); COMMIT;`
- T1: `SELECT * FROM Orders WHERE Amount > 100;` → 11 rows

The “phantom” row appeared during T1’s transaction. [medium](https://medium.com/@cihanelibol99/sql-isolation-levels-a-deep-dive-from-basics-to-professional-09056be3269b)

---

## The four standard isolation levels

The SQL-92 standard defines four levels, each forbidding more anomalies than the previous. [cockroachlabs](https://www.cockroachlabs.com/blog/sql-isolation-levels-explained/)

| Isolation level  | Dirty reads  | Non‑repeatable reads | Phantom reads |
| ---------------- | ------------ | -------------------- | ------------- |
| Read Uncommitted | Possible     | Possible             | Possible      |
| Read Committed   | Not possible | Possible             | Possible      |
| Repeatable Read  | Not possible | Not possible         | Possible      |
| Serializable     | Not possible | Not possible         | Not possible  |

### 1. Read Uncommitted

- Weakest level.
- Transactions can read **uncommitted changes** from others.
- All three anomalies can occur.
- Rarely used in practice except for special read-only, best-effort scenarios. [learn.microsoft](https://learn.microsoft.com/en-us/sql/odbc/reference/develop-app/transaction-isolation-levels?view=sql-server-ver17)

---

### 2. Read Committed

- Default in many RDBMS (e.g., SQL Server, Oracle, Postgres).
- You only see **committed** data → **no dirty reads**.
- But:
  - Repeated reads of the same row can return different values (**non‑repeatable reads**).
  - Range queries can see new/deleted rows (**phantoms**). [cockroachlabs](https://www.cockroachlabs.com/blog/sql-isolation-levels-explained/)

Behavior:

- Each statement sees a fresh snapshot of committed data.
- Locks are held only as long as needed for the statement, not the whole transaction.

---

### 3. Repeatable Read

- Stronger than Read Committed.
- Guarantees:
  - No dirty reads
  - No non‑repeatable reads: once you read a row, it stays the same for the rest of your transaction.
- Still allows **phantom reads** on ranges. [cockroachlabs](https://www.cockroachlabs.com/blog/sql-isolation-levels-explained/)

Implementation varies:

- In some systems (e.g., InnoDB/MySQL), Repeatable Read also prevents most phantoms by using next-key/gap locking, so behavior is closer to Serializable for many workloads. [postgresql](https://www.postgresql.org/docs/current/transaction-iso.html)

---

### 4. Serializable

- Strongest level.
- Prevents **all three anomalies**: dirty reads, non‑repeatable reads, and phantom reads.
- Transactions behave as if executed **one after another** (serialized). [medium](https://medium.com/@cihanelibol99/sql-isolation-levels-a-deep-dive-from-basics-to-professional-09056be3269b)

Cost:

- Often implemented via range locks or strict MVCC rules.
- More blocking/serialization, higher chance of deadlocks and timeouts.
- Use when correctness is critical and contention is manageable.

---

## Snapshot isolation (common extension)

Many DBs also support **Snapshot** / **Read Committed Snapshot**:

- Each transaction sees a **consistent snapshot** of the database as of the start of the transaction (or statement).
- Prevents dirty reads and non‑repeatable reads.
- Phantoms may still be possible depending on implementation and query patterns.
- Conflicts are often detected at commit time (optimistic concurrency) rather than via heavy locking. [learn.microsoft](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/transaction-isolation-levels?view=sql-server-ver17)

Examples:

- SQL Server: `READ COMMITTED SNAPSHOT`, `SNAPSHOT`
- Postgres: `SERIALIZABLE` uses MVCC with serialization checks.

---

## Practical guidance

- **Read Committed** (default) is usually fine for:
  - Web apps where occasional re-read differences are acceptable.
  - Most OLTP workloads with moderate contention.

- **Repeatable Read** when:
  - You need stable reads within a transaction (e.g., calculating totals that must not change mid-transaction).

- **Serializable** when:
  - Strict correctness is mandatory (financial ledgers, inventory with tight constraints) and you can tolerate more contention.

- **Snapshot** when:
  - You want strong consistency without heavy locking, and can handle occasional commit conflicts.

---

## Setting isolation level (examples)

SQL Server:

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- or REPEATABLE READ, SERIALIZABLE, etc.

BEGIN TRANSACTION;
-- your queries
COMMIT;
```

Postgres:

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN;
-- your queries
COMMIT;
```
