**Consistent hashing** is a distributed hashing technique that maps keys (users, sessions, cache entries) to nodes (servers) in a way that **minimizes reshuffling when nodes are added or removed**. [geeksforgeeks](https://www.geeksforgeeks.org/system-design/consistent-hashing/)

---

## The problem with naive hashing

Naive approach:

```
server = hash(key) mod N
```

where \(N\) is the number of servers. [abstractalgorithms](https://www.abstractalgorithms.dev/consistent-hashing-explained)

Works fine when \(N\) is fixed. But in a distributed system:

- When you add a server (\(N \to N+1\)), **almost every key** gets a new result from the modulo.
- When you remove a server (\(N \to N-1\)), same problem.

In a cache, that means:

- Adding/removing a node invalidates most cached data.
- Your database gets hammered as everything is re-fetched.
- You get a self‑inflicted outage every time you scale. [blog.algomaster](https://blog.algomaster.io/p/consistent-hashing-explained)

You need a scheme where **only a small fraction of keys move** when the cluster changes.

---

## Core idea: the hash ring

Consistent hashing maps both **keys** and **nodes** onto the same circular space (a “ring”), typically using a hash function that outputs values in a fixed range (e.g., 0–2³²−1). [medium](https://medium.com/@tanmaymone/consistent-hashing-explained-simply-the-backbone-of-scalable-distributed-systems-597cce626d32)

Steps:

1. **Hash each node** (by its IP, name, etc.) and place it on the ring.
2. **Hash each key** and place it on the same ring.
3. To find which node owns a key:
   - Move **clockwise** from the key’s position until you hit the first node.
   - That node is responsible for the key. [en.wikipedia](https://en.wikipedia.org/wiki/Consistent_hashing)

Visually: imagine a clock face; each node and key is a point on the circle.

---

## What happens when nodes change?

- **Add a node**:
  - Only keys that fall between the new node and its clockwise predecessor need to move—those now map to the new node.
  - All other keys stay on their existing nodes. [medium](https://medium.com/@tanmaymone/consistent-hashing-explained-simply-the-backbone-of-scalable-distributed-systems-597cce626d32)

- **Remove a node**:
  - Only the keys that were on the removed node move—specifically, they move to the next node clockwise.
  - Everything else is unaffected. [learn.microsoft](https://learn.microsoft.com/en-us/archive/blogs/csliu/consistent-hashing-theory-implementation)

So instead of remapping **almost all** keys, you remap roughly **1/N** of them (proportional to the node that joined/left). [youtube](https://www.youtube.com/watch?v=ZxV2WNllTuI)

---

## Virtual nodes (vnodes)

A basic ring can be uneven:

- Some nodes might end up with more keys than others, especially when \(N\) is small. [en.wikipedia](https://en.wikipedia.org/wiki/Consistent_hashing)

Solution: **virtual nodes**.

- Each physical node is represented by multiple points (vnodes) on the ring.
- Example: Node A appears at hash positions 10, 45, 77; Node B at 20, 55, 90, etc.
- This spreads keys more evenly across physical nodes and reduces hot spots. [learn.microsoft](https://learn.microsoft.com/en-us/archive/blogs/csliu/consistent-hashing-theory-implementation)

Real systems:

- Cassandra uses hundreds of vnodes per physical node to balance load.
- Redis Cluster, Dynamo-style systems, and many CDNs use similar ideas. [baeldung](https://www.baeldung.com/cs/consistent-hashing)

---

## Where consistent hashing is used

- **Distributed caches** (e.g., memcached clusters, custom Redis sharding)
- **NoSQL databases** (Cassandra, DynamoDB-style systems, Riak)
- **CDNs** and edge routing (deciding which edge node serves a given asset)
- **Sharded services** (routing users/tenants to specific shards) [geeksforgeeks](https://www.geeksforgeeks.org/system-design/consistent-hashing/)

---

## Tradeoffs and practical notes

- **Pros:**
  - Minimal key movement on scaling → stable caches, smoother deployments.
  - Naturally supports dynamic membership (nodes joining/leaving).
  - Simple to implement with a sorted list of ring positions and binary search. [arpitbhayani](https://arpitbhayani.me/blogs/consistent-hashing/)

- **Cons:**
  - Slightly more complex than simple modulo.
  - Load balancing still needs care (hence vnodes, monitoring, sometimes re-sharding).
  - Not a magic bullet: you still need to handle replication, failure detection, and rebalancing logic. [blog.levelupcoding](https://blog.levelupcoding.com/p/consistent-hashing-clearly-explained)

---
