---
title: BFF Pattern
sidebar_label: BFF Pattern
sidebar_position: 3
---

The **Backend for Frontend (BFF)** pattern adds a server-side layer designed specifically for one frontend experience—such as a React web app—rather than exposing a single general-purpose API directly to every client. The BFF aggregates, reshapes, secures, and optimizes backend data for the UI’s needs.[1][2]

## Core idea

Without a BFF, a React page may call many backend services itself:

```text
React dashboard
  ├── Account service
  ├── Transaction service
  ├── Alerts service
  ├── Profile service
  └── Entitlements service
```

With a BFF, React makes one UI-oriented request, while the BFF coordinates backend calls:

```text
React dashboard
       |
       v
Web BFF
  ├── Account service
  ├── Transaction service
  ├── Alerts service
  ├── Profile service
  └── Entitlements service
```

The BFF exists to satisfy a frontend’s particular data shape, performance, security, and interaction requirements. Azure describes it as a separate backend layer for each frontend interface, located between the client and backend services.[2]

## Typical React architecture

```text
React app
  |
  | GET /bff/dashboard
  | cookie/session attached
  v
Web BFF
  |
  +--> Authenticate session
  +--> Apply UI-specific authorization context
  +--> Call internal services in parallel
  +--> Aggregate and reshape responses
  +--> Normalize safe errors
  +--> Return page-ready JSON
  |
  v
Domain services / databases
```

React then consumes the BFF through `fetch`, TanStack Query, RTK Query, Apollo Client, route loaders, or another server-state mechanism. The BFF does not replace React state management; it gives the frontend a better API to consume.

## What a BFF does

A BFF typically handles the following concerns:

- **Aggregation:** combines data from multiple internal services into one UI-ready response.
- **Transformation:** maps domain-oriented backend DTOs into a frontend-oriented view model.
- **Request orchestration:** runs independent upstream requests in parallel, applies timeouts, fallbacks, and controlled retries.
- **API adaptation:** hides legacy APIs, REST/GraphQL differences, and service topology from the React app.
- **Session handling:** can validate browser sessions and exchange server-held credentials for upstream API calls.
- **Response shaping:** returns only what a given page or client needs, avoiding repeated client-side joins and request waterfalls.
- **Error normalization:** converts varied upstream failures into consistent, safe client-facing errors.
- **Client-specific performance policies:** applies caching, pagination, or data compression appropriate for web versus mobile usage.

AWS describes BFFs as one backend per user experience, enabling UI-ready projections from backend services.[1]

## Example: dashboard endpoint

Imagine a React banking dashboard. Without a BFF, the app may independently fetch profile, account summary, transactions, alerts, and entitlements.

```text
React page mount
  |
  +--> GET /profiles/me
  +--> GET /accounts
  +--> GET /alerts
  +--> GET /permissions
  +--> GET /accounts/:id/transactions
```

This can create duplicated authentication logic, browser-visible service contracts, request waterfalls, and difficult partial-failure behavior.

A BFF can offer one endpoint:

```http
GET /bff/dashboard
```

```json
{
  "customer": {
    "displayName": "Avery"
  },
  "accounts": [
    {
      "id": "ACC-1001",
      "displayName": "Everyday Checking",
      "availableBalance": 1240.5,
      "currency": "USD"
    }
  ],
  "alerts": [
    {
      "id": "ALT-9",
      "severity": "info",
      "message": "Your statement is ready."
    }
  ],
  "permissions": {
    "canInitiateTransfer": true
  },
  "asOf": "2026-10-04T17:20:00Z"
}
```

The React page receives a model shaped for its display rather than reconstructing a dashboard from several domain APIs.

## React integration

From React’s perspective, a BFF is simply an API endpoint. Pair it with a server-state client to manage caching, loading, error handling, cancellation, and invalidation.

```jsx
// Illustrative example — api/dashboard.js
export async function getDashboard({ signal }) {
  const response = await fetch("/bff/dashboard", {
    signal,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to load dashboard");
  }

  return response.json();
}
```

```jsx
// Illustrative example — DashboardPage.jsx
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "./api/dashboard";

export default function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => getDashboard({ signal }),
    staleTime: 30_000,
  });

  if (dashboardQuery.isPending) return <DashboardSkeleton />;

  if (dashboardQuery.isError) {
    return <p role="alert">Unable to load your dashboard.</p>;
  }

  const { customer, accounts, alerts } = dashboardQuery.data;

  return (
    <>
      <h1>Welcome, {customer.displayName}</h1>
      <AccountSummary accounts={accounts} />
      <AlertList alerts={alerts} />
    </>
  );
}
```

The BFF handles **backend composition**; TanStack Query handles **browser-side server-state lifecycle**. These are complementary responsibilities. TanStack Query is designed for asynchronous server-state fetching, caching, and updates.[3][4]

## Authentication with BFF

A BFF can implement a safer browser authentication boundary by acting as a confidential OAuth/OIDC client. The browser holds an opaque session cookie, while access and refresh tokens remain on the server; the BFF retrieves the appropriate token and calls upstream services on the user’s behalf.[5][6]

```text
Browser
  |
  | HttpOnly secure session cookie
  v
BFF
  |
  | server-side session maps to tokens
  v
Authorization server / resource APIs
```

This can reduce token exposure to browser JavaScript. `HttpOnly` cookies are not accessible to page JavaScript, though the architecture still needs CSRF protection, secure-cookie settings, session rotation, logout/revocation policies, content-security protections, and server-side authorization checks.[6][5]

## BFF versus API gateway

A BFF and API gateway can coexist, but they solve different problems.

| Concern               | API gateway                                                                    | BFF                                                                        |
| --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Primary scope         | Shared platform entry point for many clients                                   | One specific frontend or user experience                                   |
| Main responsibilities | Routing, TLS termination, rate limits, common authentication, traffic policies | UI-oriented aggregation, response shaping, frontend-specific orchestration |
| API contract          | General-purpose or cross-client                                                | Purpose-built for the web app, mobile app, or a bounded frontend domain    |
| Ownership             | Often platform/infrastructure team                                             | Often team responsible for the frontend experience                         |
| Example               | Route `/web/*`, `/mobile/*`, and partner traffic                               | Serve `/bff/dashboard` for one React web portal                            |

A BFF may sit behind an API gateway: the gateway handles shared traffic policies, while the BFF shapes and coordinates data for one frontend.[7][2]

## BFF versus GraphQL

GraphQL and BFF are not competing concepts.

```text
React -> REST BFF -> internal services
React -> GraphQL BFF -> internal services
React -> BFF -> GraphQL gateway -> services
```

GraphQL can be the BFF’s public API format, particularly when a frontend needs flexible field selection. A REST BFF can be more direct for page-oriented endpoints such as `/bff/dashboard`, `/bff/claims/:id/workspace`, or `/bff/portfolio/:id/overview`.

| Question                | REST-style BFF                                                   | GraphQL-style BFF                                                         |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Client chooses fields?  | Usually no; endpoint response is predefined                      | Yes, within schema and query constraints                                  |
| Good for                | Curated page models, explicit contracts, straightforward caching | Many screen compositions and reusable entity graphs                       |
| Main governance concern | Endpoint growth and contract versioning                          | Query complexity, schema design, and caching/authorization at field level |
| Can be a BFF?           | Yes                                                              | Yes                                                                       |

Microservices.io notes that a BFF gateway can use GraphQL as part of its implementation.[8]

## BFF versus a generic API

A generic API typically exposes domain resources:

```text
GET /accounts/:id
GET /accounts/:id/transactions
GET /customers/:id
GET /notifications
```

A BFF exposes **experience-oriented** endpoints:

```text
GET /bff/dashboard
GET /bff/account-overview/:accountId
GET /bff/claims/:claimId/workspace
POST /bff/transfers/:transferId/confirm
```

The BFF should not become a duplicate domain backend. Keep core business rules, persistence, and authoritative validation in domain services. The BFF should orchestrate and adapt, not take ownership of account balances, underwriting rules, payment authorization, or trade execution logic.

## BFF benefits

- **Fewer client round trips:** aggregates calls and can run upstream requests in parallel.
- **Simpler React code:** React consumes UI-ready view models rather than joining multiple domain responses.
- **Reduced coupling:** internal service APIs and topology remain less exposed to the browser.
- **Client-specific optimization:** web and mobile can receive different payload shapes without compromising one another.
- **Security boundary:** secrets and server-side OAuth credentials can remain outside the browser.
- **Easier frontend evolution:** UI requirements can change without forcing every domain service to offer presentation-specific endpoints.
- **Consistent browser-facing policies:** request tracing, error mapping, safe data shaping, and cache headers can be standardized.

AWS emphasizes BFFs’ role in producing UI-ready projections and high-performing frontend experiences.[9][1]

## Costs and risks

- **More infrastructure:** another deployable, runtime, monitoring target, and incident surface.
- **Potential duplication:** multiple BFFs can repeat transformations, error handling, or workflow logic.
- **Latency accumulation:** poor serial orchestration can make one BFF request slower than several parallel browser requests.
- **God-BFF risk:** a single BFF can become a large, tightly coupled monolith for every screen.
- **Leaked business logic:** UI adaptation is appropriate; domain invariants and enforcement should remain in domain services.
- **Security complexity:** cookie sessions require CSRF defenses and disciplined CORS, cookie, and origin configuration.
- **Cache confusion:** decide clearly which layer owns caching—the CDN, BFF, browser query cache, or service layer.

Azure warns that the BFF pattern introduces an additional service layer and should be used when frontend-specific needs justify the added complexity.[2]

## When to use it

A BFF is a strong fit when:

- You support distinctly different clients—web, mobile, partner portal, or internal operations console.
- A React page combines data from several services or legacy APIs.
- The browser should not access service credentials or vendor API keys.
- Each client needs meaningfully different payloads, workflows, caching, or performance behavior.
- You need a server-side OAuth client and cookie-backed browser session.
- Your frontend team needs to evolve UI-specific APIs independently of domain services.
- You are building micro-frontends with bounded domains that need their own API adaptation layer.

AWS guidance for micro-frontends emphasizes that a BFF, if used, should belong to the same bounded context as the micro-frontend and should not become a shared cross-domain service.[9]

## When not to use it

Avoid or defer a BFF when:

- You have one straightforward React app and a stable backend API that already fits it.
- The BFF would be a trivial pass-through proxy.
- A route loader, query library, or small aggregation endpoint in an existing backend solves the actual problem.
- The organization cannot operate another service reliably.
- The main need is only generic routing, rate limiting, or TLS termination—use an API gateway instead.
- You are adding it solely because “microservices should have BFFs.”

Start with the smallest appropriate server-side adapter. A BFF earns its cost when it removes meaningful client complexity or improves the security/performance boundary.

## Design guidelines

### Keep endpoints experience-oriented

Prefer:

```text
GET /bff/portfolio/:id/overview
```

over forcing the React page to make multiple domain calls and compose the result itself.

Do not create one endpoint for every button or trivial component. Use endpoints that represent meaningful screen, feature, or workflow boundaries.

### Orchestrate in parallel

```js
// Illustrative BFF handler
const [portfolio, holdings, alerts] = await Promise.all([
  portfolioService.getPortfolio(user, portfolioId),
  holdingsService.getHoldings(user, portfolioId),
  alertsService.getPortfolioAlerts(user, portfolioId),
]);
```

Independent upstream calls should be parallelized. Apply per-service timeouts and define whether a partial response is acceptable.

### Return stable contracts

Define versioned, validated response models owned by the frontend experience. Do not leak raw responses from every internal service; that turns upstream breaking changes into frontend outages.

### Propagate identity safely

Pass the authenticated user identity, tenant, scopes, correlation ID, and authorization context to downstream services using approved service-to-service mechanisms. Do not trust client-supplied account IDs, roles, prices, or permission flags.

### Observe every request

Record safe structured telemetry: request IDs, dependency latency, error class, cache status, and response outcome. Redact credentials, access tokens, account numbers, government identifiers, health data, and raw document contents.

## Financial-services example

A portfolio screen may need holdings, prices, allocation, trade permissions, alerts, and performance data.

```text
React portfolio screen
      |
      | GET /bff/portfolios/PF-220/overview
      v
Portfolio BFF
      |
      +--> Portfolio service
      +--> Holdings service
      +--> Pricing service
      +--> Entitlements service
      +--> Alerts service
      |
      v
Portfolio overview view model
```

```json
{
  "portfolio": {
    "id": "PF-220",
    "name": "Retirement Portfolio"
  },
  "summary": {
    "marketValue": 184230.17,
    "currency": "USD",
    "asOf": "2026-10-04T17:20:00Z"
  },
  "allocation": [
    { "assetClass": "Equities", "weight": 0.68 },
    { "assetClass": "Bonds", "weight": 0.24 }
  ],
  "canPlaceOrder": true,
  "alerts": []
}
```

The BFF may assemble this response, but the pricing service remains the authoritative source for quotes, the entitlement service remains authoritative for trading permissions, and the trade service must validate every order server-side.

## Practical stack choices

| React environment       | Common BFF form                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Next.js                 | Route handlers, server actions for carefully scoped mutations, or a separate Node/Java/.NET BFF |
| React SPA               | Separate BFF service behind an API gateway or reverse proxy                                     |
| Micro-frontends         | BFF per bounded frontend domain where justified                                                 |
| Serverless architecture | Functions/Lambdas behind an API gateway                                                         |
| GraphQL organization    | GraphQL gateway or GraphQL BFF with client-specific schema and resolvers                        |

AWS identifies serverless functions and container services as viable BFF deployment options.[9]

## Interview answer

The BFF pattern is a client-specific backend layer that sits between a React application and domain services. Rather than making the browser coordinate multiple generic APIs, the BFF aggregates data, adapts it into UI-ready models, handles frontend-specific orchestration, and can provide a safer authentication boundary.[1][2]

I use a BFF when a web client has needs that differ materially from mobile or other clients, when pages must compose several services, or when I want server-held credentials and consistent backend adaptation. React still uses a query client or route loader to manage browser-side loading, caching, error states, and invalidation.[4][3]

A BFF is not an API gateway replacement and should not own core domain rules. The gateway handles shared edge concerns; the BFF owns frontend-specific composition. Domain services remain authoritative for authorization, validation, persistence, and high-stakes business decisions.[7][2]

## Sources

1. Backends for Frontends Pattern | Front-End Web & Mobile - AWS https://aws.amazon.com/blogs/mobile/backends-for-frontends-pattern/
2. Backends for Frontends Pattern - Azure Architecture Center https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends
3. Query - TanStack https://tanstack.com/query/latest
4. TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/queries
5. BFF security architecture: Surviving supply chain attacks - FusionAuth https://fusionauth.io/blog/backend-for-frontend-security-architecture
6. The Backend for Frontend Pattern (BFF) | Auth0 https://auth0.com/blog/the-backend-for-frontend-pattern-bff/
7. Backend for Frontend (BFF) Pattern: Microservices for UX | Teleport https://goteleport.com/learn/backend-for-frontend-bff-pattern/
8. Pattern: API Gateway / Backends for Frontends - Microservices.io https://microservices.io/patterns/apigateway.html
9. API integration ‒ Backend for frontend - AWS Prescriptive Guidance https://docs.aws.amazon.com/prescriptive-guidance/latest/micro-frontends-aws/api-integration-data-fetching.html
10. Stop Leaking API Keys: The Backend for Frontend (BFF) Pattern ... https://blog.gitguardian.com/stop-leaking-api-keys-the-backend-for-frontend-bff-pattern-explained/
11. Backend for Frontend Pattern in Elevating Microservices in ... https://www.architectureandgovernance.com/elevating-ea/backend-for-frontend-pattern-in-elevating-microservices-in-enterprise-architecture/
12. Implementing the Backend-for-Frontend (BFF) / Curated API Pattern ... https://techcommunity.microsoft.com/blog/azuredevcommunityblog/implementing-the-backend-for-frontend-bff--curated-api-pattern-using-azure-api-m/4499880
13. Serverless BFF Pattern with AWS Lambda https://awsforengineers.com/blog/serverless-bff-pattern-with-aws-lambda/
14. BFF Pattern - Azure Ecosystem : r/AZURE - Reddit https://www.reddit.com/r/AZURE/comments/1b81itc/bff_pattern_azure_ecosystem/
15. Java BFF: Optimized Backend for Frontend Architecture Pattern https://www.linkedin.com/posts/johnamduarte_java-bff-why-backend-for-frontend-became-activity-7404822327018045440-0ZXj
16. BFF - Backend for Frontend Design Pattern with Next.js https://dev.to/adelhamad/bff-backend-for-frontend-design-pattern-with-nextjs-3od0
17. Guide to Backend for Frontend (BFF) Pattern: An Approach Using ... https://orkes.io/blog/guide-to-backend-for-frontend
