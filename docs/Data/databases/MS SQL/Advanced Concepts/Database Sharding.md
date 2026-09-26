**Database sharding** is a horizontal scaling technique that splits a large database into smaller, independent pieces called **shards**, each running on its own server (or node), so the system can handle more data and more requests by adding machines. [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)

---

## Core idea

- You have one logical table (e.g., `Users`, `Transactions`) that becomes too large or too hot for a single database server.
- You split that table **by rows** into multiple subsets.
- Each subset (shard) lives on a different server.
- Together, all shards hold the full dataset. [yugabyte](https://www.yugabyte.com/key-concepts/database-sharding/)

Sharding is often called **horizontal partitioning**, but with an important distinction from in‑database partitioning:

- **Partitioning**: splits within one database instance (or tightly coupled cluster).
- **Sharding**: splits **across multiple independent database instances/servers**, often in a distributed system. [medium](https://medium.com/@abdulfaisalup/sharding-vs-partition-1cb55ce4c0d6)

---

## Why shard?

Sharding addresses three main problems:

1. **Too much data for one machine**
   - Single-node storage limits (disk, RAM) get hit.
   - Indexes and tables become too large to manage efficiently. [bytebytego](https://bytebytego.com/guides/a-crash-course-in-database-sharding/)

2. **Too many requests for one machine**
   - CPU, I/O, and connection limits on a single DB server become a bottleneck.
   - Sharding spreads the load across many machines. [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)

3. **High latency under load**
   - As one box gets saturated, response times increase.
   - More shards → more parallelism → lower latency per shard. [yugabyte](https://www.yugabyte.com/key-concepts/database-sharding/)

By adding more shards (nodes), you scale **horizontally** instead of just upgrading to a bigger single server (vertical scaling).

---

## Sharding key and sharding algorithm

A **sharding key** is a column (or set of columns) that determines which shard a row belongs to. [mongodb](https://www.mongodb.com/resources/products/capabilities/database-sharding-explained)

Common choices:

- `UserId` – each user’s data lives in one shard
- `TenantId` – in multi-tenant SaaS, each tenant in a shard
- `AccountId`, `Region`, etc.

A **sharding algorithm** uses that key to decide the shard:

### 1. Range-based sharding

Rows are assigned to shards based on ranges of the sharding key. [mongodb](https://www.mongodb.com/resources/products/capabilities/database-sharding-explained)

Example:

- Shard 1: `UserId` 1–1,000,000
- Shard 2: `UserId` 1,000,001–2,000,000
- Shard 3: `UserId` 2,000,001–3,000,000

Pros:

- Simple to understand and route queries.
- Good for range queries on the sharding key.

Cons:

- Risk of **hot spots** if data isn’t evenly distributed (e.g., some ranges are much more active). [bytebytego](https://bytebytego.com/guides/a-crash-course-in-database-sharding/)

---

### 2. Hash-based sharding

A hash function on the sharding key determines the shard. [yugabyte](https://www.yugabyte.com/key-concepts/database-sharding/)

Example:

```text
shard_id = hash(UserId) % N
```

where `N` is the number of shards.

Pros:

- Very even distribution of data and load.
- Reduces hot spots.

Cons:

- Range queries on the sharding key are harder (data is scattered).
- Adding/removing shards requires re-mapping unless you use techniques like consistent hashing. [bytebytego](https://bytebytego.com/guides/a-crash-course-in-database-sharding/)

---

### 3. Directory-based (lookup) sharding

A **lookup table** (directory) maps each sharding key value to a specific shard. [mongodb](https://www.mongodb.com/resources/products/capabilities/database-sharding-explained)

Example directory:

| UserId    | Shard  |
| --------- | ------ |
| 1–100k    | ShardA |
| 100k–200k | ShardB |
| …         | …      |

Or more granular:

| UserId | Shard  |
| ------ | ------ |
| 123    | ShardA |
| 456    | ShardC |

Pros:

- Flexible; you can move users between shards without changing the algorithm.
- Can handle irregular distributions and migrations.

Cons:

- Extra lookup overhead (need to consult the directory).
- The directory itself becomes a critical component that must be highly available. [mongodb](https://www.mongodb.com/resources/products/capabilities/database-sharding-explained)

---

### 4. Geo-partitioning (region-based sharding)

Data is first partitioned by geography (region, country), then sharded within each region using hash or range. [yugabyte](https://www.yugabyte.com/key-concepts/database-sharding/)

Example:

- US users → US shards
- EU users → EU shards

Benefits:

- Lower latency for regional users.
- Helps with data residency and compliance (e.g., GDPR).

---

## Sharding architectures

### 1. Application-level sharding

The **application** contains the logic to:

- Compute the shard for a given key
- Open connections to the right database
- Route queries accordingly. [bytebytego](https://bytebytego.com/guides/a-crash-course-in-database-sharding/)

Pros:

- Full control; works with any database.
- No special DB features required.

Cons:

- More complexity in app code.
- Harder to change sharding strategy later.

---

### 2. Middleware / proxy sharding

A **middleware layer** (proxy, router, or orchestration service) sits between the app and the databases and handles routing. [pingcap](https://www.pingcap.com/blog/database-sharding-defined/)

Pros:

- App code stays simpler (talks to a single logical endpoint).
- Easier to evolve the sharding logic centrally.

Cons:

- Additional infrastructure and operational complexity.
- Proxy can become a bottleneck or SPOF if not designed carefully.

---

### 3. Database-native sharding

Some databases provide built-in sharding (e.g., MongoDB, Cassandra, some distributed SQL systems like CockroachDB, YugabyteDB, TiDB). [pingcap](https://www.pingcap.com/blog/database-sharding-defined/)

Pros:

- Sharding logic is part of the DB; less custom code.
- Often includes automatic rebalancing, failover, and resharding.

Cons:

- Tied to a specific database technology.
- May have constraints on operations (cross-shard queries, transactions).

---

## Benefits

- **Scalability**: Add more nodes to handle more data and traffic. [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)
- **Performance**: Each shard is smaller and handles fewer requests → faster queries and index builds. [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)
- **Availability**: If one shard/node fails, others can remain available (depending on design). [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)
- **Cost**: Often cheaper to scale out with many commodity servers than to keep buying bigger single-box hardware. [yugabyte](https://www.yugabyte.com/key-concepts/database-sharding/)

---

## Tradeoffs and challenges

Sharding is powerful but complex:

1. **Increased operational complexity**
   - More machines, more configs, more monitoring.
   - Backups, restores, migrations become more involved. [pingcap](https://www.pingcap.com/blog/database-sharding-defined/)

2. **Cross-shard operations**
   - Joins across shards are expensive or unsupported.
   - Global aggregations (e.g., “total users”) require querying all shards and combining results.
   - Distributed transactions are harder (two-phase commit, saga patterns, etc.). [pingcap](https://www.pingcap.com/blog/database-sharding-defined/)

3. **Choosing the sharding key**
   - Bad key → uneven data distribution, hot shards, poor query patterns.
   - Hard to change once data is already sharded. [mongodb](https://www.mongodb.com/resources/products/capabilities/database-sharding-explained)

4. **Resharding**
   - Moving data when you add/remove shards or change the key is expensive and risky.
   - Often requires careful planning, dual writes, backfills, and cutovers. [bytebytego](https://bytebytego.com/guides/a-crash-course-in-database-sharding/)

Because of this, many teams:

- Start with a well-indexed, partitioned single database.
- Only shard when they truly hit scale limits and have clear access patterns. [pingcap](https://www.pingcap.com/blog/database-sharding-defined/)

---

## When to shard vs when not to

Good candidates:

- Very large, high-traffic systems (social networks, global SaaS, gaming, ad tech).
- Clear sharding key (user, tenant, region) with mostly local queries.
- Workloads that are read/write heavy and saturated on a single node. [aws.amazon](https://aws.amazon.com/what-is/database-sharding/)

Often not needed yet:

- Small/medium apps where a single well-tuned DB (with proper indexing, partitioning, caching) is enough.
- Systems with heavy cross-entity joins and complex global queries. [baeldung](https://www.baeldung.com/cs/database-sharding-vs-partitioning)

---

## Example for a finance app

If your finance tracker grows to millions of users and heavy transaction volume:

- Sharding key: `UserId`
- Strategy: hash-based or range-based on `UserId`
- Each shard holds all `Users`, `Accounts`, `Transactions`, `Categories` for a subset of users.
- Cross-user aggregations (e.g., “total platform volume”) are done via a separate analytics system or a warehouse.

This keeps each shard focused and scalable, while analytical workloads are offloaded to a separate layer.
