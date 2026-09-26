**Database connection pooling** is the practice of maintaining a reusable cache of open database connections so your application can “borrow” a connection for a query instead of opening and closing a new one every time. [cockroachlabs](https://www.cockroachlabs.com/blog/what-is-connection-pooling/)

---

## Why pooling matters

Opening a single database connection is relatively expensive:

- DNS lookup
- TCP handshake (network socket creation)
- TLS negotiation (if using SSL)
- Authentication
- Session setup on the DB side

Doing this for every request/query adds up quickly under load and increases:

- **Latency** (each request pays this setup cost)
- **CPU and memory usage** on both app and DB servers
- Risk of exhausting DB connection limits. [stackoverflow](https://stackoverflow.com/questions/4041114/what-is-database-pooling)

A **connection pool** amortizes this cost by:

- Creating a fixed number of connections at startup (or on demand up to a max).
- Reusing those connections across many requests.
- Only closing them when they’re truly no longer needed (pool shutdown, timeout, or config change). [navicat](https://www.navicat.com/en/company/aboutus/blog/3556-database-connection-pooling-explained.html)

---

## How connection pooling works

Typical flow:

1. **Initialization**
   - At application startup, the pool creates a set of connections (e.g., 10–50) and holds them idle. [dasunweerakoon.medium](https://dasunweerakoon.medium.com/database-connection-pooling-made-simple-7c78f3b2dabf)

2. **Borrow a connection**
   - When your code needs to run a query, it asks the pool for a connection.
   - If one is available, it’s handed over immediately.
   - If all are in use, the caller may wait (block) or get an error, depending on configuration. [danubedata](https://danubedata.ro/blog/database-connection-pooling-explained)

3. **Use the connection**
   - Your code executes queries/commands using that connection.

4. **Return the connection**
   - When done, you “dispose” or “close” the connection object in code, but the pool **does not actually close the underlying socket**.
   - It marks the connection as idle and returns it to the pool for reuse. [cockroachlabs](https://www.cockroachlabs.com/blog/what-is-connection-pooling/)

From the app’s perspective, you still write code like:

```csharp
using var conn = new SqlConnection(connString);
await conn.OpenAsync();
// execute commands
```

But under the hood, ADO.NET (or your DB provider) is using a pool behind the scenes.

---

## Where pooling happens

### 1. Client-side (application) pooling

Built into most database drivers and ORMs:

- ADO.NET has built-in pooling for SQL Server.
- JDBC drivers (HikariCP, etc.) for Java.
- `pg` with `pg-pool` or similar for Node/Postgres.
- .NET providers for PostgreSQL, MySQL, etc., all have pool settings. [medium](https://medium.com/@gupta-rahul/understanding-database-connection-pooling-a-practical-guide-for-developers-3fde64dd96e8)

This is the most common setup:

- Each service instance has its own pool.
- The pool is tuned via max size, min size, idle timeout, etc.

---

### 2. External / proxy pooling

A separate process sits between your app and the DB and manages connections:

- Examples: **PgBouncer** (Postgres), **ProxySQL** (MySQL), cloud-provided poolers (e.g., Neon, some PaaS offerings). [danubedata](https://danubedata.ro/blog/database-connection-pooling-explained)

Useful when:

- You have many short-lived app instances (serverless, containers).
- You want a central place to limit total DB connections.
- Your DB can’t handle thousands of concurrent client connections directly.

Pattern:

- Many app instances → few pooled connections → DB.
- The proxy multiplexes many logical clients onto fewer physical connections.

---

## Key configuration knobs

Common settings (names vary by provider):

- **Max pool size** – maximum number of connections the pool will hold.
- **Min pool size** – number of connections kept warm even when idle.
- **Connection timeout** – how long to wait for a free connection before failing.
- **Idle timeout** – how long an idle connection can stay in the pool before being closed.
- **Lifetime / max lifetime** – maximum age of a connection before it’s forcibly replaced. [architecture-weekly](https://www.architecture-weekly.com/p/architecture-weekly-189-mastering)

**Sizing guidance (rule of thumb):**

- Too small → requests queue waiting for a connection → higher latency.
- Too large → DB spends excessive resources managing connections → context switching, memory pressure, worse overall throughput.
- A common starting point for a single app instance is:
  - `max connections ≈ (CPU cores on DB server) × 2–4` total across all instances/pools, then divided by number of instances.
  - Then tune based on monitoring (wait times, CPU, active connections, query latency). [architecture-weekly](https://www.architecture-weekly.com/p/architecture-weekly-189-mastering)

---

## Benefits

- **Lower latency**: no per-request connection setup cost.
- **Higher throughput**: more queries handled with the same resources.
- **Better resource usage**: fewer OS processes/threads on the DB side.
- **Predictability**: easier to cap and control how many concurrent DB connections your app uses. [prisma](https://www.prisma.io/dataguide/database-tools/connection-pooling)

---

## Tradeoffs and pitfalls

- **Connection leaks**: if you forget to dispose/close connections in code, they stay checked out and can exhaust the pool.
- **Stale connections**: if the DB restarts or drops idle connections, the pool must detect and recreate them (most mature pools handle this).
- **Over-pooling in microservices/serverless**:
  - Many services × big pools can exceed the DB’s max connections.
  - Serverless functions that spin up/down can create connection storms.
  - Often solved with a proxy pooler or smaller, carefully tuned pools. [danubedata](https://danubedata.ro/blog/database-connection-pooling-explained)

---

## .NET / SQL Server specifics

In ADO.NET with SQL Server:

- Pooling is **enabled by default**.
- The connection string controls behavior, e.g.:

  ```text
  Server=...;Database=...;User Id=...;Password=...;
  Max Pool Size=50;
  Min Pool Size=5;
  Connection Timeout=15;
  ```

- All `SqlConnection` objects with the **same connection string** share the same pool. Slight differences (different user, app name, etc.) create separate pools.

Best practices:

- Use `using` (or `await using`) around connections so they’re always returned to the pool.
- Avoid keeping connections open for long periods; open, use, close quickly.
- Monitor:
  - `Process.WaitCount` / pool wait times
  - DB-side active connections and CPU
  - Query latency under load.

---
