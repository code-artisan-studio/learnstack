---
title: Fetch Patterns
sidebar_label: Fetch Patterns
sidebar_position: 2
---

React fetch patterns define **when data is requested, where request state lives, how stale results are prevented, and how the UI stays synchronized after writes**. For small client-only cases, `fetch` in `useEffect` is valid; for most production applications, prefer framework loaders or a server-state library such as TanStack Query, RTK Query, or SWR to gain caching, deduplication, retries, cancellation, and invalidation.[1][2][3]

## Core model

Remote data is **server state**: the backend owns the truth, while the React application fetches, caches, and renders a temporary representation.

```text
React component
       |
       v
Fetch pattern / query client
       |
       +--> loading state
       +--> cached data
       +--> error state
       +--> cancellation / retry / refetch
       |
       v
API / backend
       |
       v
Authoritative data
```

Do not treat data returned from an API as permanent local React state that never changes. Build an explicit freshness and update strategy.

## Fetch patterns map

| Pattern                    | Best for                                                | Main limitation                                                       |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Event-handler fetch        | User explicitly starts an action                        | Not for data required merely to render a route                        |
| `useEffect` fetch          | Small client-only component or a custom data hook       | Manual loading, error, race, caching, and invalidation logic          |
| Route/framework loader     | Page-level data needed before or during route rendering | Depends on routing/framework architecture                             |
| Query library              | Most API-driven client apps                             | Requires deliberate query-key and invalidation design                 |
| Suspense/resource pattern  | Framework-supported async rendering boundaries          | Requires understanding Suspense/error boundaries and platform support |
| WebSocket/SSE subscription | Live updates                                            | Requires reconnection, ordering, and cleanup policy                   |

React describes Effects as the mechanism for synchronizing with external systems and acknowledges that data fetching can be done in an Effect. However, Effects run only on the client, can create request waterfalls, and require cleanup against race conditions.[2][1]

## Event-driven fetching

Fetch in an event handler when the user explicitly requests an operation, such as pressing **Search**, exporting a report, or submitting a form.

```jsx
// Illustrative example — user-triggered search
import { useState } from "react";

export default function CustomerSearch() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  async function handleSearch(event) {
    event.preventDefault();

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(
        `/api/customers?query=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data);
      setStatus("success");
    } catch (error) {
      setError(error);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSearch}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search customers"
      />
      <button disabled={status === "loading"}>
        {status === "loading" ? "Searching…" : "Search"}
      </button>
      {status === "error" && <p role="alert">{error.message}</p>}
      <Results items={results} />
    </form>
  );
}
```

Use this pattern for **commands**: actions that the user intentionally initiates. Avoid using a click handler just to fetch data every time a page is mounted; page-required data belongs in a route-level or render-driven fetch pattern.

## useEffect fetching

Use `useEffect` when a component must synchronize with an external request whenever a reactive input changes.

```text
accountId changes
      |
      v
Effect starts GET /api/accounts/:accountId
      |
      +--> pending: show loading
      +--> success: render account
      +--> failure: show error / retry
      +--> cleanup: abort or ignore stale result
```

```jsx
// Illustrative example — AccountPage.jsx
import { useEffect, useState } from "react";

export default function AccountPage({ accountId }) {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      setState({ status: "loading", data: null, error: null });

      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Account request failed: ${response.status}`);
        }

        const account = await response.json();

        setState({ status: "success", data: account, error: null });
      } catch (error) {
        if (error.name !== "AbortError") {
          setState({ status: "error", data: null, error });
        }
      }
    }

    loadAccount();

    return () => controller.abort();
  }, [accountId]);

  if (state.status === "loading") return <p>Loading account…</p>;
  if (state.status === "error")
    return <p role="alert">Unable to load account.</p>;

  return <h1>{state.data.displayName}</h1>;
}
```

The dependency array makes the effect re-run when `accountId` changes. Include every reactive value read by the Effect, rather than suppressing dependency warnings. React’s hook rules require reactive values used in an Effect to appear in its dependency list.[4]

## Race-condition protection

A **race condition** happens when request A starts, then request B starts, but A finishes last and overwrites B’s newer result.

```text
User selects account A -> request A begins
User selects account B -> request B begins
Request B completes    -> display B
Request A completes    -> incorrectly display A
```

Use cleanup that aborts the old request or ignores its result. React explicitly calls out cleanup as necessary to prevent stale responses winning this race.[5][1]

### Ignore stale responses

```jsx
useEffect(() => {
  let ignore = false;

  async function loadAccount() {
    const response = await fetch(`/api/accounts/${accountId}`);
    const data = await response.json();

    if (!ignore) {
      setAccount(data);
    }
  }

  loadAccount();

  return () => {
    ignore = true;
  };
}, [accountId]);
```

### Abort obsolete requests

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/accounts/${accountId}`, {
    signal: controller.signal,
  })
    .then((response) => response.json())
    .then(setAccount)
    .catch((error) => {
      if (error.name !== "AbortError") {
        setError(error);
      }
    });

  return () => controller.abort();
}, [accountId]);
```

In real applications, combine robust error handling with either approach. Aborting reduces unnecessary network and backend work; ignoring results still protects UI correctness when cancellation is unavailable or incomplete.

## Custom fetch hooks

When multiple components need the same manual pattern, extract it into a custom hook. This centralizes request policy while leaving rendering components focused on UI.

```jsx
// Illustrative example — useAccount.js
import { useEffect, useState } from "react";

export function useAccount(accountId) {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!accountId) {
      setState({ status: "idle", data: null, error: null });
      return;
    }

    const controller = new AbortController();

    async function load() {
      setState({ status: "loading", data: null, error: null });

      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load account");
        }

        const data = await response.json();

        setState({ status: "success", data, error: null });
      } catch (error) {
        if (error.name !== "AbortError") {
          setState({ status: "error", data: null, error });
        }
      }
    }

    load();
    return () => controller.abort();
  }, [accountId]);

  return state;
}
```

A custom hook reduces repetition, but it does not by itself provide application-wide cache sharing, request de-duplication, stale-time policy, prefetching, or mutation invalidation. For those capabilities, use a query library or framework data layer. React recommends custom hooks or community-maintained data libraries when direct Effects become repetitive.[1][2]

## Query-library pattern

A query library turns “fetch this data” into a declarative dependency:

```jsx
useQuery({
  queryKey: ["account", accountId],
  queryFn: () => getAccount(accountId),
});
```

The **query key** identifies the data request and its inputs. A query library uses it for caching, sharing results, refetching, and invalidation. TanStack Query defines a query as a declarative dependency on an asynchronous data source tied to a unique key.[6]

```jsx
// Illustrative example — AccountPage.jsx
import { useQuery } from "@tanstack/react-query";

async function getAccount({ accountId, signal }) {
  const response = await fetch(`/api/accounts/${accountId}`, {
    signal,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to load account");
  }

  return response.json();
}

export default function AccountPage({ accountId }) {
  const accountQuery = useQuery({
    queryKey: ["account", accountId],
    queryFn: ({ signal }) => getAccount({ accountId, signal }),
    staleTime: 30_000,
    enabled: Boolean(accountId),
  });

  if (accountQuery.isPending) return <p>Loading account…</p>;
  if (accountQuery.isError) {
    return <p role="alert">{accountQuery.error.message}</p>;
  }

  return <h1>{accountQuery.data.displayName}</h1>;
}
```

TanStack Query gives a query function an `AbortSignal` that can be consumed by `fetch` to cancel an out-of-date or unused query.[7][8]

### Query key design

A correct query key must include every input that changes the returned data.

```jsx
// Incorrect: query result changes with page but page is absent from key
queryKey: ["transactions", accountId];

// Correct
queryKey: ["transactions", accountId, { page, sort, startDate, endDate }];
```

Otherwise, the cache can return data for the wrong account, page, filter, tenant, or user context.

## Mutations and invalidation

A **query** reads server data. A **mutation** changes server data: create, update, delete, submit, approve, or upload.

```text
Mutation succeeds
      |
      +--> Invalidate/refetch relevant query
      |
      +--> Or update the cached query deliberately
      |
      v
UI reflects authoritative server state
```

```jsx
// Illustrative example — UpdateAccountForm.jsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function updateAccount({ accountId, displayName }) {
  const response = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error("Save failed");
  }

  return response.json();
}

export default function UpdateAccountForm({ accountId }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["account", accountId],
      });
    },
  });

  return (
    <button
      disabled={updateMutation.isPending}
      onClick={() =>
        updateMutation.mutate({
          accountId,
          displayName: "Primary Checking",
        })
      }
    >
      {updateMutation.isPending ? "Saving…" : "Save"}
    </button>
  );
}
```

An invalidation strategy is not optional. If you mutate backend data but leave the cache untouched, the UI can remain stale or contradict a later screen.

## Dependent versus parallel fetching

A **dependent query** needs output from another query:

```text
GET /current-user
       |
       v
user.organizationId
       |
       v
GET /organizations/:organizationId/projects
```

```jsx
const userQuery = useQuery({
  queryKey: ["currentUser"],
  queryFn: getCurrentUser,
});

const projectQuery = useQuery({
  queryKey: ["projects", userQuery.data?.organizationId],
  queryFn: () => getProjects(userQuery.data.organizationId),
  enabled: Boolean(userQuery.data?.organizationId),
});
```

TanStack Query’s `enabled` option allows the dependent query to wait until required input is available.[9][10]

However, dependent queries create a request waterfall: if requests each take similar time, serial loading takes longer than parallel loading. Where the domain permits it, redesign the API or route loader to return related data together or begin independent requests concurrently.[9][1]

```jsx
// Independent requests: start concurrently
const accountsQuery = useQuery({
  queryKey: ["accounts"],
  queryFn: getAccounts,
});

const alertsQuery = useQuery({
  queryKey: ["alerts"],
  queryFn: getAlerts,
});
```

## Pagination and infinite scrolling

### Page-based pagination

Use a query key containing the page and filters:

```jsx
const transactionsQuery = useQuery({
  queryKey: ["transactions", accountId, { page, sort }],
  queryFn: () => getTransactions({ accountId, page, sort }),
});
```

Do not keep a paginated result under a key that ignores page or filter input.

### Infinite scrolling

Use a dedicated infinite-query mechanism when the API provides cursor or page tokens:

```text
Initial request -> items + nextCursor
        |
User scrolls
        |
Next request -> cursor=nextCursor
        |
Append another page safely
```

Cursor-based pagination is often safer than offset pagination for rapidly changing transaction or activity feeds because inserts can shift offsets.

## Search and debounce

For typeahead search, avoid sending a network request on every keystroke. Keep the raw input local, then derive a debounced value before enabling a query.

```text
Raw input:       "t" -> "tr" -> "tra" -> "tran"
Debounced input:                         "tran"
                                            |
                                            v
                                    Search request
```

The important architecture rule is that the query key includes the debounced search term and that old results cannot overwrite newer input. For a command-style search triggered by a button, event-driven fetching is often simpler and more accessible.

## Prefetching

**Prefetching** begins loading likely-next data before the user explicitly navigates there.

```text
User hovers “Account details”
          |
          v
Prefetch GET /api/accounts/ACC-1001
          |
          v
User clicks
          |
          v
Route can often render from cache
```

Prefetch only high-confidence, low-risk, appropriately authorized resources. Avoid speculative requests for sensitive customer records or expensive reports, especially in regulated systems.

## Route-level and framework fetching

For page-critical data, fetch close to the route boundary rather than waiting for individual child components to mount.

```text
Weak pattern: waterfall

Route renders
  -> parent Effect fetches account
     -> child renders
        -> child Effect fetches transactions
           -> grandchild renders
              -> grandchild Effect fetches alerts
```

```text
Better pattern: coordinated route data

Route matches
  -> begin account, transactions, and alerts requests
  -> render pending shell / streamed content
  -> child components receive or read coordinated data
```

React notes that fetching directly inside Effects can create network waterfalls, while frameworks can fetch data more efficiently.[2][1]

If you use React Router Data/Framework mode, route loaders can own page-level requests and redirects. In Next.js, Remix, or another React framework, prefer the framework’s documented server/route data mechanisms when they fit your rendering model.

## Suspense and `use`

React supports reading a Promise with the `use` API in supported environments, and React documentation notes that caching the Promise lets data loading begin before it is needed. This is generally best consumed through a framework or well-designed resource/cache layer rather than ad hoc promise creation inside a rendering component.[11][12]

```jsx
// Conceptual only — framework/resource cache required
const account = use(getAccountResource(accountId));
```

Suspense requires an error boundary strategy and clear ownership of the Promise cache. Do not assume it replaces server-state caching, authorization, or mutation invalidation.

## Error-handling pattern

A robust request UI distinguishes errors users can act on:

| Situation               | Recommended behavior                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Loading first-time data | Show a page-level skeleton or clear loading state                    |
| Refreshing cached data  | Keep safe old data visible; show a subtle refresh indicator          |
| Invalid input           | Show field-level validation feedback                                 |
| 401 unauthenticated     | Start approved session renewal/login flow                            |
| 403 forbidden           | Explain access is denied without exposing sensitive resource details |
| 404 not found           | Show a resource-not-found state                                      |
| Network failure         | Preserve safe user input; offer retry                                |
| 409 conflict            | Explain competing update; reload or reconcile                        |
| 5xx server error        | Give a general recovery path and send sanitized diagnostics          |

Do not expose raw backend stack traces, internal identifiers, tokens, or sensitive data in a user-facing error message or client telemetry.

## Retry and idempotency

Retries are reasonable for idempotent reads and carefully designed safe operations. Retrying a critical write blindly can create duplicate transfers, orders, or claim submissions.

```text
GET /accounts/123
  -> retry may be acceptable, subject to policy

POST /transfers
  -> use server-side idempotency key and explicit operation status
```

For business-critical mutations, the server should enforce idempotency, authorization, concurrency checks, and audit controls. The client should disable duplicate submission or expose a clear in-progress state.

## Caching and freshness

Caching policies should be domain-specific:

| Data                      | Example policy                                                     |
| ------------------------- | ------------------------------------------------------------------ |
| Static reference data     | Longer freshness window; background refresh                        |
| Account summary           | Short freshness period; refetch after relevant mutation            |
| Market quote              | Explicit “as of” time; subscription or frequent controlled refresh |
| Draft form                | Local/reducer state plus intentional persistence if allowed        |
| Transfer status           | Polling or server push until terminal state                        |
| Authorization/entitlement | Short-lived, server-validated, invalidated on session change       |

A cache improves speed and user experience but cannot guarantee correctness alone. For high-stakes decisions, show freshness timestamps and validate server-side at the operation boundary.

## Banking, insurance, and finance examples

| Domain                    | Fetch pattern                                                                                                        | Design concern                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Banking account details   | Route-level or query-library fetch keyed by account ID; invalidate after profile or account changes                  | Backend enforces ownership; avoid speculative prefetch of accounts      |
| Insurance claim workspace | Parallel requests for claim summary, tasks, documents, and timeline; mutation invalidates precise claim-related keys | Handle long-running document processing and role-dependent visibility   |
| Portfolio view            | Query cache for holdings; controlled polling or streaming for prices; explicit as-of timestamp                       | Avoid stale prices being mistaken for executable prices                 |
| Transfer submission       | Event-driven mutation with disabled submit button and idempotency key                                                | Prevent duplicate submission and display authoritative operation status |

## When to use each

| Situation                                    | Recommended pattern                                           |
| -------------------------------------------- | ------------------------------------------------------------- |
| User clicks Search/Export/Submit             | Event handler or mutation hook                                |
| Simple client-only data read                 | `useEffect` with cleanup and explicit state                   |
| Reusable manual fetching behavior            | Custom hook around `useEffect`                                |
| Shared API data, caching, retries, mutations | TanStack Query, RTK Query, or SWR                             |
| Route-critical page data                     | Framework or router loader                                    |
| Dependent request                            | Query `enabled` condition or route orchestration              |
| Multiple independent requests                | Start in parallel                                             |
| Live updates                                 | WebSocket or Server-Sent Events with reconnect/cleanup policy |
| High-stakes write                            | Mutation workflow plus server idempotency and confirmation    |

## Trade-offs

- **Manual Effects** are transparent and dependency-light, but repetitive and easy to get wrong around races, caching, and waterfalls.
- **Custom hooks** centralize manual policy but can grow into a home-built query cache.
- **Query libraries** solve common server-state concerns, but query keys, stale-time defaults, invalidation, and error behavior must be designed deliberately.
- **Route/framework loaders** coordinate page data well and reduce waterfalls, but couple fetching to routing/runtime conventions.
- **Suspense** can simplify loading composition but requires a mature cache and error-boundary strategy.
- **Push/subscription patterns** reduce polling latency but add connection lifecycle, ordering, reconnect, and authorization complexity.

## Interview answer — 2-minute version

React fetch patterns should distinguish server state from local UI state. For a small client-only component, I can fetch in `useEffect`, but I include all dependencies, represent loading/error/success states, and clean up with an `AbortController` or stale-response guard to avoid race conditions. Effects only run on the client and can create network waterfalls, so they are not my default for page-critical production data.[5][1]

For most applications, I use a server-state solution such as TanStack Query, RTK Query, or a framework route loader. Query keys include every data input, mutations explicitly invalidate or update affected cache entries, and independent requests run in parallel. Dependent requests are enabled only when prerequisite values exist, but I try to avoid unnecessary serial waterfalls by improving the backend API shape.[6][2][9]

I use event-driven mutations for user commands and protect critical writes with pending UI, backend idempotency, and server-side authorization. The backend remains authoritative, while React coordinates rendering, caching, and recovery.

## Hands-on exercise

Build an **Account Transactions** screen:

```text
/accounts/:accountId/transactions?page=1&sort=date
```

1. Fetch the account summary and transactions independently and start both requests in parallel.
2. Use query keys such as `["account", accountId]` and `["transactions", accountId, { page, sort }]`.
3. Add loading, error, empty, and success states.
4. Add a search input with a debounced term; include it in the transactions query key.
5. Change accounts quickly and confirm stale results never replace the current account’s results.
6. Add a mutation that labels a transaction, then invalidate the relevant transaction query.
7. Test a page refresh, slow network, failed request, and rapid route changes.

**Expected outcome:** Account and transactions load concurrently, cache results are isolated by account/page/sort/search, obsolete requests do not corrupt the displayed screen, and post-mutation data refreshes.

**Failure symptom:** Switching from Account A to Account B briefly shows A’s transactions under B’s header.  
**Diagnostic hint:** Verify the account ID is part of the query key or Effect dependency list, and abort or ignore obsolete requests.[5][6]

**Failure symptom:** A successful label update does not appear until a full browser refresh.  
**Diagnostic hint:** Invalidate or update the exact transaction query-key family after the mutation succeeds.

## Sources

1. useEffect https://react.dev/reference/react/useEffect
2. Synchronizing with Effects https://react.dev/learn/synchronizing-with-effects
3. Query - TanStack https://tanstack.com/query/latest
4. Removing Effect Dependencies https://react.dev/learn/removing-effect-dependencies
5. You Might Not Need an Effect https://react.dev/learn/you-might-not-need-an-effect
6. TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/queries
7. Query Cancellation | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
8. Query Functions | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/query-functions
9. Dependent Queries | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries
10. Disabling/Pausing Queries | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries
11. use https://react.dev/reference/react/use
12. Reusing Logic with Custom Hooks https://react.dev/learn/reusing-logic-with-custom-hooks
13. Anda Mungkin Tidak Membutuhkan Effect https://id.react.dev/learn/you-might-not-need-an-effect
14. Built-in React Hooks https://hu.react.dev/reference/react
15. How do i cancel all queries which have already being run #5266 https://github.com/TanStack/query/discussions/5266
