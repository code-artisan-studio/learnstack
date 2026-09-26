# Node.js — Architect-Level Roadmap

## 1. Language & Runtime Foundations

- JavaScript engine internals (V8: JIT, hidden classes, GC generations)
- Event loop phases (timers, poll, check, close callbacks), microtask vs macrotask
- CommonJS vs ESM, module resolution, dual-package hazard
- `libuv`, thread pool sizing, blocking vs non-blocking I/O

## 2. Asynchronous Patterns

- Callbacks → Promises → async/await, error propagation across async boundaries
- Streams (Readable/Writable/Duplex/Transform), backpressure handling
- Worker threads vs child processes vs cluster module
- `AbortController`, cancellation and timeout patterns

## 3. Application Architecture

- Layered/Clean/Hexagonal architecture in Node services
- Dependency injection patterns (no native container—idiomatic approaches: `awilix`, `tsyringe`)
- Monorepo strategies (Nx, Turborepo), shared package boundaries
- Monolith → service decomposition strategies

## 4. API & Service Design

- Express/Fastify/NestJS trade-offs at scale
- REST, GraphQL, gRPC in Node ecosystems
- Middleware pipelines, request validation (`zod`, `joi`)
- API versioning, contract testing (Pact), OpenAPI-driven design

## 5. Data & Persistence

- ORM/query-builder internals (Prisma, TypeORM, Knex), N+1 pitfalls
- Connection pool tuning under event-loop concurrency
- Caching layers (Redis patterns, cache invalidation strategies)
- Event sourcing/CQRS implementations in Node

## 6. Distributed Systems

- Message queues (Kafka, RabbitMQ, BullMQ) — idempotency, retries, DLQs
- Service discovery, circuit breakers, resilience (`cockatiel`, `opossum`)
- Distributed tracing (OpenTelemetry), correlation IDs
- Saga patterns, eventual consistency handling

## 7. Testing & Quality at Scale

- Test pyramids, contract/property-based testing (`fast-check`)
- Mocking async code and timers, snapshot testing pitfalls
- Load/perf testing (`autocannon`, `k6`), chaos testing approaches

## 8. Packaging, Deployment & Ops

- Package management (`npm`/`pnpm`/`yarn`), lockfile discipline, monorepo workspaces
- Dockerizing Node services (multi-stage builds, distroless/slim images)
- Process management (PM2, cluster mode), graceful shutdown handling
- Observability: structured logging, metrics, SLOs

## 9. Security & Compliance

- Secrets management, dependency vulnerability scanning (`npm audit`, Snyk)
- AuthN/AuthZ patterns (OAuth2/OIDC libs), input validation at boundaries
- Supply-chain security (SBOMs, lockfile integrity, `npm` provenance)

## 10. Architect-Level Judgment

- Node vs polyglot decisions (when NOT to use Node, e.g. CPU-bound workloads)
- Team scaling: TypeScript strictness, linting/formatting standards (`eslint`, `prettier`) as org policy
- Migration strategy (CommonJS→ESM, major runtime upgrades)
- Cost/performance trade-offs (serverless vs containers vs bare metal)
