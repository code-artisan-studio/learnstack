The **CAP theorem** (Brewer’s theorem) states that in a **distributed data system**, you can guarantee at most **two of these three properties** at the same time: **Consistency**, **Availability**, and **Partition tolerance**. [en.wikipedia](https://en.wikipedia.org/wiki/CAP_theorem)

---

## The three guarantees

### C – Consistency

In CAP, **consistency** means:

> Every read receives the **most recent write** or an error. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/the-cap-theorem-in-dbms/)

All clients see the **same data at the same time**, regardless of which node they talk to.

- If a write happens on node A, it must be replicated to all other relevant nodes **before** the write is considered successful.
- If the system can’t guarantee that, it must reject the read/write (e.g., return an error or timeout).

This is different from ACID “consistency”; CAP consistency is about **linearizability** (all nodes agree on the latest value). [en.wikipedia](https://en.wikipedia.org/wiki/CAP_theorem)

---

### A – Availability

**Availability** in CAP means:

> Every request to a **non-failing node** gets a **response**, but not necessarily the latest data. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/the-cap-theorem-in-dbms/)

- The system always answers; it never says “I can’t serve you right now.”
- But during failures or partitions, the answer might be **stale** (not reflecting the most recent write).

This is not the same as “high availability” in general architecture; CAP’s definition is stricter and more specific. [en.wikipedia](https://en.wikipedia.org/wiki/CAP_theorem)

---

### P – Partition tolerance

**Partition tolerance** means:

> The system continues to operate despite **network partitions** (some nodes can’t communicate). [youtube](https://www.youtube.com/watch?v=X-u2hvC91sA)

A **network partition** is when messages between nodes are dropped or delayed, so parts of the cluster are effectively cut off from each other.

Because real networks _will_ fail, **partition tolerance is non-negotiable** for any serious distributed system. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/the-cap-theorem-in-dbms/)

---

## The trade-off: when a partition occurs

When there’s **no partition**, you can (in theory) have both consistency and availability.

When a **partition happens**, you must choose:

- **Choose Consistency over Availability (CP)**
  - Nodes that can’t confirm they have the latest data **refuse to serve** requests (error/timeout).
  - Clients may not get a response, but if they do, the data is guaranteed up-to-date. [en.wikipedia](https://en.wikipedia.org/wiki/CAP_theorem)

- **Choose Availability over Consistency (AP)**
  - Nodes continue to serve requests even if they can’t talk to each other.
  - Clients always get a response, but it might be **stale or conflicting** until the partition heals. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/the-cap-theorem-in-dbms/)

So the real choice in practice is: **during a network partition, do you favor C or A?** [mongodb](https://www.mongodb.com/resources/basics/databases/cap-theorem)

---

## Classic examples

- **CP systems (favor consistency):**
  - Traditional relational databases in a distributed setup, some NoSQL stores configured for strong consistency (e.g., certain configurations of Google Spanner, HBase).
  - On partition: some nodes become unavailable rather than serve potentially stale data.

- **AP systems (favor availability):**
  - Dynamo-style stores (e.g., DynamoDB, Cassandra, Riak in default modes).
  - On partition: all nodes keep responding; you may get stale or conflicting values that are reconciled later (eventual consistency).

Many systems are **tunable**: you can configure them to lean more CP or AP depending on consistency vs latency needs. [scylladb](https://www.scylladb.com/glossary/cap-theorem/)

---

## Practical interpretation

In real architectures:

- You **must** tolerate partitions (P is required).
- So you design for:
  - **CP** when correctness is critical (bank balances, inventory counts where overselling is unacceptable).
  - **AP** when availability and low latency matter more than perfect consistency (activity feeds, shopping cart views, some analytics).

Also, CAP is a **worst-case, binary model**. In practice, systems often provide:

- **Eventual consistency**: AP during partitions, but converge to consistent state afterward.
- ** Partial consistency**: some operations are strongly consistent, others are eventually consistent. [scylladb](https://www.scylladb.com/glossary/cap-theorem/)

---
