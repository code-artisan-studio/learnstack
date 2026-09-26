**Optimistic locking** is a concurrency control technique where you _assume conflicts are rare_ and allow multiple transactions to read and modify data without holding locks, then **detect conflicts at commit time** and retry if needed. [en.wikipedia](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)

---

## Core idea

Instead of locking a row when you read it (pessimistic locking), optimistic locking:

1. Lets everyone read freely.
2. Tracks a **version** (or timestamp) on each row.
3. When updating, checks that the version hasn’t changed since you read it.
4. If it has changed, your update fails and you retry with the new data. [medium](https://medium.com/@duhov/optimistic-vs-pessimistic-locking-in-databases-c32a52aeadfe)

Phases (classic OCC model):

- **Begin**: start transaction, note start time / read version.
- **Modify**: read data, make local changes.
- **Validate**: at commit, check if anyone else modified the same row.
- **Commit/Rollback**:
  - If no conflict → commit and bump version.
  - If conflict → rollback and retry. [en.wikipedia](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)

---

## Typical implementation with a version column

Schema example:

```sql
CREATE TABLE Accounts (
    AccountId INT PRIMARY KEY,
    Balance DECIMAL(18,2) NOT NULL,
    Version INT NOT NULL DEFAULT 0
);
```

Workflow:

1. Read:

   ```sql
   SELECT AccountId, Balance, Version
   FROM Accounts
   WHERE AccountId = 123;
   ```

   Suppose you get: `Balance = 1000`, `Version = 5`.

2. In your app, you compute a new balance (e.g., `1100`).

3. Update with a version check:

   ```sql
   UPDATE Accounts
   SET Balance = 1100,
       Version = Version + 1
   WHERE AccountId = 123
     AND Version = 5;
   ```

4. Check affected rows:
   - If **1 row** updated → success; your change was applied.
   - If **0 rows** updated → someone else already changed the row (version is no longer 5); you must:
     - Re-read the row
     - Re-apply your business logic
     - Try again. [blog.bytebytego](https://blog.bytebytego.com/p/optimistic-locking)

This is often implemented in ORMs:

- JPA/Hibernate: `@Version` field → automatic optimistic locking.
- EF Core: concurrency token on a `RowVersion`/`Timestamp` column. [baeldung](https://www.baeldung.com/jpa-optimistic-locking)

---

## Optimistic vs pessimistic locking

**Pessimistic locking:**

- Locks the row when you read it (e.g., `SELECT ... FOR UPDATE`).
- Other transactions must wait until the lock is released.
- Good when:
  - Conflicts are frequent (high write contention).
  - You can’t afford retries or lost updates. [stackoverflow](https://stackoverflow.com/questions/129329/optimistic-vs-pessimistic-locking)

**Optimistic locking:**

- No locks held between read and write.
- Conflicts are detected at update time via version/timestamp.
- Good when:
  - Reads vastly outnumber writes.
  - Conflicts are rare.
  - You prefer higher throughput and can tolerate occasional retries. [medium](https://medium.com/@duhov/optimistic-vs-pessimistic-locking-in-databases-c32a52aeadfe)

Tradeoff:

- Low contention → optimistic locking gives better throughput (no lock overhead, no waiting).
- High contention → many retries → performance degrades; pessimistic may be better. [blog.bytebytego](https://blog.bytebytego.com/p/optimistic-locking)

---

## Where it’s used

- Web apps with many concurrent users editing mostly different data (e.g., user profiles, documents, configs).
- Systems where long-running business transactions span multiple requests (can’t hold DB locks across HTTP calls).
- ORMs and frameworks that need a simple, DB-agnostic concurrency model. [ibm](https://www.ibm.com/docs/en/db2/11.5.x?topic=overview-optimistic-locking)

Example analogy:

- Wikipedia-style editing: multiple people can edit a page; if two submit conflicting changes, one is rejected and the user is asked to resolve and resubmit. [youtube](https://www.youtube.com/watch?v=R-iX1r_7UY0)

---

## Pros and cons

**Pros:**

- Higher concurrency and throughput in low-conflict scenarios.
- No long-held locks → fewer deadlocks, better scalability.
- Works well in multi-tier architectures where DB transactions don’t match business transactions. [ibm](https://www.ibm.com/docs/en/db2/11.5.x?topic=overview-optimistic-locking)

**Cons:**

- Requires retry logic in the application.
- Can cause poor UX under high contention (many users retrying).
- More complex error handling (must detect and resolve conflicts). [en.wikipedia](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)

---
