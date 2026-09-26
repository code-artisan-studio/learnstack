**Caching** is the practice of storing copies of frequently accessed data closer to the requester so you can serve it faster and reduce load on slower, authoritative sources (like your database). [dev](https://dev.to/budiwidhiyanto/caching-strategies-across-application-layers-building-faster-more-scalable-products-h08)

In modern systems, caching is **multi-layered**: different layers trade off speed, capacity, and consistency.

---

## Caching layers (from user to database)

A typical hierarchy looks like this:

### 1. Browser / Client-side cache

- Lives in the user’s browser or mobile app.
- Controlled by HTTP headers (`Cache-Control`, `ETag`, `Last-Modified`) and local storage (localStorage, IndexedDB, service workers). [technori](https://technori.com/2026/03/24675-caching-layers-explained-browser-cdn-and-app-caching/marcus/)
- Best for:
  - Static assets (JS, CSS, images)
  - Semi-static data (user preferences, UI state, configs)

**Pros:** Fastest for repeat visits; requests may never hit your server.  
**Cons:** Hard to invalidate; users can clear it; device-specific.

---

### 2. CDN (Content Delivery Network) cache

- Distributed edge servers around the world that cache content closer to users. [sysdesai](https://www.sysdesai.com/news/U9EngJpkxU8T)
- Best for:
  - Static assets (images, videos, JS/CSS bundles)
  - Public, read-heavy, mostly identical responses (e.g., public API docs, blog posts, marketing pages)

**Pros:** Massive latency reduction; offloads traffic from your origin; handles global scale.  
**Cons:** Invalidation is tricky; not good for personalized or frequently changing per-user data.

---

### 3. Reverse proxy / gateway / load balancer cache

- Sits in front of your application servers (e.g., Nginx, Varnish, API gateway). [linkedin](https://www.linkedin.com/posts/rishabh-pareek_caching-explained-different-levels-and-activity-7425727525022208000-Op2R)
- Caches full HTTP responses (HTML pages, API responses) before they hit your app.
- Common patterns:
  - Cache `GET /api/products` for 1 minute
  - Cache rendered pages for anonymous users

**Pros:** Reduces load on app servers; protects against traffic spikes; simple to configure for whole paths.  
**Cons:** Limited logic; invalidation and cache key design (query params, headers, auth) can be complex.

---

### 4. Application-level cache

- Inside your service layer: in-memory caches or dedicated stores like **Redis**, **Memcached**. [medium](https://medium.com/@yaroslavzhbankov/caching-essentials-types-strategies-and-best-practices-459493cc47d9)
- Stores:
  - Computed results (e.g., “user’s monthly summary”)
  - DB query results
  - Sessions, feature flags, tokens, frequently accessed domain objects

Common patterns:

- **Cache-aside (lazy loading)**
  - On read: check cache → if miss, read from DB → write to cache.
  - Simple, widely used.

- **Write-through**
  - On write: update DB and cache together.
  - Keeps cache consistent but adds write latency.

- **Write-back (write-behind)**
  - On write: update cache, asynchronously flush to DB.
  - Faster writes, risk of data loss if cache fails before flush.

- **TTL-based expiration**
  - Set a time-to-live so stale data automatically expires.

**Pros:** Fine-grained control; huge performance gains for hot data; can be shared across instances (Redis).  
**Cons:** You must manage keys, invalidation, and consistency; adds infra complexity.

---

### 5. Database cache

- Built into the DB engine: buffer pool, query cache, materialized views. [linkedin](https://www.linkedin.com/posts/baljeet-singh-oracle-rightnow_devsecops-securedevops-cybersecurity-activity-7424304379983462400-hwDh)
- Examples:
  - SQL Server buffer pool keeping hot data pages in memory
  - Materialized views precomputing expensive joins/aggregations

**Pros:** Transparent to app; critical for DB performance; reduces I/O.  
**Cons:** Not general-purpose; limited control; can be invalidated on schema/index changes.

---

## Common caching strategies

These are patterns for _how_ you use caches, especially at the application layer:

### 1. Cache-aside (lazy loading)

- On read:
  1. Check cache.
  2. If present → return.
  3. If not → query DB, return result, store in cache with TTL.

**Use when:** Reads dominate; occasional stale data is acceptable; simple to implement.

---

### 2. Write-through

- On write:
  1. Write to DB.
  2. Update cache in the same transactional flow.

**Use when:** Strong consistency is important; write latency is acceptable; you want cache always in sync.

---

### 3. Write-behind (write-back)

- On write:
  1. Update cache.
  2. Asynchronously persist to DB (queue, background job).

**Use when:** Write performance is critical; you can tolerate brief inconsistency and have durable queue/cache.

---

### 4. Refresh-ahead / proactive refresh

- Before a cached item expires, proactively refresh it (e.g., via background job).
- Avoids latency spikes when popular keys expire all at once.

**Use when:** Predictable hot keys (e.g., daily summary per user) and you want to avoid “cache stampede” on expiry.

---

### 5. Read-through

- Cache sits between app and DB; on miss, the cache itself fetches from DB and stores result.
- Similar to cache-aside but the cache library handles the fetch logic.

---

## How to choose layers and strategies

Questions to guide design:

- **How fresh must data be?**
  - Near real-time → fewer layers, shorter TTLs, more write-through.
  - Minutes/hours acceptable → more aggressive CDN/proxy/app caching.

- **Is data personalized or global?**
  - Global/public → great for CDN/proxy.
  - Per-user → mainly app cache, maybe browser for non-sensitive UI state.

- **Read vs write ratio?**
  - Read-heavy → aggressive caching pays off.
  - Write-heavy → be careful; caching can add complexity and inconsistency.

- **Scale and latency requirements?**
  - Global users → CDN + regional app caches.
  - Single region, low latency → app cache + DB tuning may be enough.

---

## Example for a .NET finance API

Typical stack:

- **Browser**: cache static assets (JS/CSS/images) with long `Cache-Control`; use versioned filenames for invalidation.
- **CDN**: cache public docs, maybe some aggregated, non-personalized reports.
- **API gateway / reverse proxy**: optional; cache some read-only, non-authenticated endpoints (e.g., currency rates).
- **Application cache (Redis)**:
  - Cache user’s monthly summary, category breakdowns, recent transactions list.
  - Use cache-aside with short TTLs (e.g., 1–5 minutes) and explicit invalidation on write (when a new transaction is added).
- **DB**:
  - Proper indexing and buffer pool for hot tables.
  - Optionally materialized views or pre-aggregated tables refreshed by batch jobs.
