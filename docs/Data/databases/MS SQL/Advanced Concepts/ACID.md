**ACID** is the set of four guarantees that define a **reliable database transaction**: **Atomicity**, **Consistency**, **Isolation**, and **Durability**. [databricks](https://www.databricks.com/blog/what-are-acid-transactions)

---

## A – Atomicity

> A transaction is **all-or-nothing**: either every operation succeeds, or none do. [youtube](https://www.youtube.com/watch?v=GAe5oB742dw)

Example: $100 transfer from Alice to Bob

- Debit Alice’s account
- Credit Bob’s account

If the system crashes after the debit but before the credit, **atomicity** ensures the whole transaction is rolled back, so no money is lost or created. DBs use logs (e.g., write‑ahead logging) to undo partial work. [dataversity](https://www.dataversity.net/data-concepts/what-is-acid/)

---

## C – Consistency

> A transaction must take the database from one **valid state** to another, following all rules. [mongodb](https://www.mongodb.com/resources/basics/databases/acid-transactions)

“Valid” means:

- Primary / foreign key constraints hold
- Check constraints and triggers are respected
- Business invariants (e.g., total money in the system doesn’t change on a transfer) remain true [bmc](https://www.bmc.com/blogs/acid-atomic-consistent-isolated-durable/)

The DB engine enforces consistency by rejecting any transaction that would violate defined constraints.

---

## I – Isolation

> Concurrent transactions behave as if they ran **one at a time**. [youtube](https://www.youtube.com/watch?v=GAe5oB742dw)

Even if many users read/write simultaneously, isolation prevents:

- **Dirty reads** – seeing uncommitted changes
- **Non‑repeatable reads** – same row returns different values in one transaction
- **Phantom reads** – new rows appear between repeated queries

Isolation levels (e.g., Read Committed, Repeatable Read, Serializable) trade off strictness vs performance. Stronger isolation = fewer anomalies, more locking/overhead. [youtube](https://www.youtube.com/watch?v=DtlV5JTnlh4)

---

## D – Durability

> Once a transaction is **committed**, its changes are permanent, even if the system crashes right after. [databricks](https://www.databricks.com/blog/what-are-acid-transactions)

Databases achieve this by:

- Writing to durable storage (disk) before confirming commit
- Using logs (WAL) that can be replayed after a crash
- In distributed systems, replicating data so multiple nodes hold the committed changes [youtube](https://www.youtube.com/watch?v=GAe5oB742dw)

After commit, you should never lose that data due to power loss or server failure.

---

## Why ACID matters

ACID is what makes relational databases suitable for:

- Banking and payments (transfers, settlements)
- Inventory and order systems (orders + order lines, stock updates)
- Ledgers and accounting (immutable, correct balances) [bmc](https://www.bmc.com/blogs/acid-atomic-consistent-isolated-durable/)

Without ACID, failures and concurrency could leave your data partially updated, inconsistent, or lost.
