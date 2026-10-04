---
title: REST and GraphQL client integration
sidebar_label: API Client Integration
sidebar_position: 1
---

REST and GraphQL client integration in React means connecting UI components to backend APIs while correctly handling loading, errors, caching, updates, cancellation, and stale data. Treat API data as **server state**—the backend remains authoritative—then choose a client pattern that fits the protocol and application complexity.[1][2]

## Plain-language overview

REST and GraphQL solve the same broad problem—moving data between a React client and a backend—but expose data differently:

```text
REST
React -> GET /api/accounts/ACC-1001 -> JSON resource representation
React -> POST /api/transfers       -> JSON result
```

```text
GraphQL
React -> POST /graphql
      -> Query exactly requested fields
      -> JSON response containing matching data
```

React itself can call either API using `fetch`, but manual data fetching leaves the team responsible for caching, request deduplication, stale data, retries, cancellation, mutations, and invalidation. A server-state library such as TanStack Query, RTK Query, or Apollo Client makes these concerns explicit.[2][3][4]

## REST and GraphQL compared

| Concern            | REST                                                       | GraphQL                                                          |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| API shape          | Many resource-oriented endpoints                           | Usually one GraphQL endpoint with a schema                       |
| Request expression | HTTP method + URL + headers + body                         | Query or mutation document + variables                           |
| Response shape     | Endpoint determines response representation                | Client generally chooses fields in the operation                 |
| Caching model      | Usually cache by URL, method, and parameters               | Often normalized cache using object identifiers such as `id`     |
| Typical reads      | `GET /accounts/ACC-1001`                                   | `query Account($id) { account(id: $id) { ... } }`                |
| Typical writes     | `POST`, `PUT`, `PATCH`, or `DELETE`                        | `mutation Transfer(...) { createTransfer(...) { ... } }`         |
| Client library fit | TanStack Query, RTK Query, SWR, native `fetch`             | Apollo Client, urql, Relay; TanStack Query can also call GraphQL |
| Main risk          | Over-fetching or under-fetching across endpoint boundaries | Complex schema, query-cost governance, and cache normalization   |

The protocol decision belongs at the API and organizational boundary. React is largely protocol-neutral: a query library can use any Promise-returning request function, including REST or GraphQL calls.[5][6]

## Architecture

A well-structured integration separates transport, server-state management, and presentation.

```text
React page/component
        |
        v
Custom hook / query hook
        |
        v
Server-state client
  - cache
  - loading/error states
  - retries
  - request de-duplication
  - mutation lifecycle
  - invalidation/refetch
        |
        v
REST API or GraphQL gateway
        |
        v
Backend services and databases
```

Avoid putting raw `fetch()` calls throughout presentational components. Centralizing API functions and hooks makes authentication, observability, error mapping, type validation, and testing more consistent.

## REST with fetch

For a small screen with a one-off request, native `fetch` plus `useEffect` can work. React describes Effects as a way to synchronize with an external system and notes that client-side Effects can perform data fetching. Effects do not run during server rendering.[3]

```jsx
// Illustrative example — AccountPage.jsx
import { useEffect, useState } from "react";

export default function AccountPage({ accountId }) {
  const [state, setState] = useState({
    status: "loading",
    account: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      setState({ status: "loading", account: null, error: null });

      try {
        const response = await fetch(`/api/accounts/${accountId}`, {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const account = await response.json();

        setState({ status: "success", account, error: null });
      } catch (error) {
        if (error.name !== "AbortError") {
          setState({ status: "error", account: null, error });
        }
      }
    }

    loadAccount();

    return () => controller.abort();
  }, [accountId]);

  if (state.status === "loading") return <p>Loading account…</p>;
  if (state.status === "error") return <p>Unable to load account.</p>;

  return <h1>{state.account.displayName}</h1>;
}
```

This example handles cancellation and basic states, but it does not provide shared caching, request deduplication, background revalidation, retry policies, or mutation invalidation. React recommends using framework data-fetching mechanisms when available because they can be more efficient than manual Effects.[3]

## REST with TanStack Query

TanStack Query is protocol-agnostic server-state tooling. A query has a unique query key and a Promise-returning query function; the key supports caching, sharing, and refetching across components.[6][5]

```jsx
// Illustrative example — api/accounts.js
export async function getAccount(accountId, { signal }) {
  const response = await fetch(`/api/accounts/${accountId}`, {
    signal,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to load account");
  }

  return response.json();
}
```

```jsx
// Illustrative example — AccountPage.jsx
import { useQuery } from "@tanstack/react-query";
import { getAccount } from "./api/accounts";

export default function AccountPage({ accountId }) {
  const {
    data: account,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["account", accountId],
    queryFn: ({ signal }) => getAccount(accountId, { signal }),
    staleTime: 30_000,
  });

  if (isPending) return <p>Loading account…</p>;
  if (isError) return <p role="alert">{error.message}</p>;

  return <h1>{account.displayName}</h1>;
}
```

When multiple components subscribe to the same query key, the cache coordinates their data rather than requiring each component to independently manage the request lifecycle. TanStack Query documents cache sharing, background refetching, stale data behavior, and request coordination as core behavior.[4][7]

### REST mutation and invalidation

A mutation changes backend data. After a mutation succeeds, invalidate or update affected cached queries so UI data reflects the backend’s latest state.

```jsx
// Illustrative example — UpdateAccountNameForm.jsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function updateAccountName({ accountId, displayName }) {
  const response = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error("Unable to update account");
  }

  return response.json();
}

export default function UpdateAccountNameForm({ accountId }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: updateAccountName,
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

The API response is authoritative. Invalidation tells the client cache that it should refetch or otherwise revalidate the affected data.

## REST with RTK Query

If your application already uses Redux Toolkit, **RTK Query** provides API fetching and caching integrated into Redux. It is designed to simplify loading and caching data, and its API slice generates a custom middleware that must be registered in the Redux store.[8][9]

```jsx
// Illustrative example — accountsApi.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const accountsApi = createApi({
  reducerPath: "accountsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",
  }),
  tagTypes: ["Account"],

  endpoints: (builder) => ({
    getAccount: builder.query({
      query: (accountId) => `/accounts/${accountId}`,
      providesTags: (result, error, accountId) => [
        { type: "Account", id: accountId },
      ],
    }),

    updateAccount: builder.mutation({
      query: ({ accountId, ...body }) => ({
        url: `/accounts/${accountId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { accountId }) => [
        { type: "Account", id: accountId },
      ],
    }),
  }),
});

export const { useGetAccountQuery, useUpdateAccountMutation } = accountsApi;
```

Use RTK Query if Redux is already a deliberate architectural choice. Do not add Redux solely to make a single REST request; TanStack Query or a framework loader is usually lighter for that case.

## GraphQL with Apollo Client

Apollo Client is a GraphQL client and state-management library for React. It provides declarative queries, mutations, cache handling, loading/error tracking, and hooks that connect operations to component rendering.[10][11][2]

```jsx
// Illustrative example — apolloClient.js
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: "/graphql",
    credentials: "include",
  }),
  cache: new InMemoryCache(),
});
```

```jsx
// Illustrative example — main.jsx
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apolloClient";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ApolloProvider client={apolloClient}>
    <App />
  </ApolloProvider>,
);
```

The provider makes the configured client available to React hooks below it.

## GraphQL query

A GraphQL query declares the data shape needed by the screen.

```jsx
// Illustrative example — AccountPage.jsx
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const GET_ACCOUNT = gql`
  query GetAccount($accountId: ID!) {
    account(id: $accountId) {
      id
      displayName
      availableBalance
      currency
    }
  }
`;

export default function AccountPage({ accountId }) {
  const { loading, error, data } = useQuery(GET_ACCOUNT, {
    variables: { accountId },
  });

  if (loading) return <p>Loading account…</p>;
  if (error) return <p role="alert">Unable to load account.</p>;

  return (
    <section>
      <h1>{data.account.displayName}</h1>
      <p>
        {data.account.availableBalance} {data.account.currency}
      </p>
    </section>
  );
}
```

Apollo’s `useQuery` hook returns query state such as loading status, errors, and data, and it runs its associated operation when the component renders.[10]

### Query variables

GraphQL variables are typed inputs sent separately from the operation document:

```graphql
query GetAccount($accountId: ID!) {
  account(id: $accountId) {
    id
    displayName
  }
}
```

```jsx
useQuery(GET_ACCOUNT, {
  variables: { accountId: "ACC-1001" },
});
```

Variables should be preferred over string-building GraphQL documents. They improve correctness, type safety, readability, caching consistency, and injection resistance.

## GraphQL mutation

A mutation requests a backend-side data change. Apollo’s `useMutation` hook returns a mutation function that you call when an event occurs.[12][13]

```jsx
// Illustrative example — UpdateAccountNameForm.jsx
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const UPDATE_ACCOUNT_NAME = gql`
  mutation UpdateAccountName($accountId: ID!, $displayName: String!) {
    updateAccountName(accountId: $accountId, displayName: $displayName) {
      id
      displayName
    }
  }
`;

export default function UpdateAccountNameForm({ accountId }) {
  const [updateAccountName, { loading, error }] =
    useMutation(UPDATE_ACCOUNT_NAME);

  async function handleSubmit(event) {
    event.preventDefault();

    await updateAccountName({
      variables: {
        accountId,
        displayName: "Primary Checking",
      },
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <button disabled={loading}>{loading ? "Saving…" : "Save"}</button>
      {error && <p role="alert">Unable to save changes.</p>}
    </form>
  );
}
```

When a mutation response includes an object with the same cache identity—commonly a stable `id` plus type—Apollo can merge returned fields into its existing normalized cache.[11]

## GraphQL cache behavior

Apollo’s normalized cache can allow one mutation result to update multiple screens that reference the same entity:

```text
AccountDetails query -> cache: Account:ACC-1001
AccountList query    -> cache: Account:ACC-1001
       |
Mutation returns:
{ id: "ACC-1001", displayName: "Primary Checking" }
       |
       v
Cache merges updated field
       |
       v
Subscribed components can update
```

This is powerful, but it requires consistent identifiers, sensible cache policies, and mutation responses that include the fields needed to update the UI. If a mutation cannot update the cache automatically, use a deliberate cache update or refetch/invalidate affected queries.

## REST versus GraphQL caching

| Concern                 | REST with TanStack/RTK Query                               | GraphQL with Apollo                                                                              |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Primary cache key       | Explicit query key, such as `["account", accountId]`       | Query shape plus variables; often normalized entities by `typename` + `id`                       |
| Update after mutation   | Invalidate/refetch or manually update query cache          | Automatic normalized merge when mutation returns identifiable entities; otherwise update/refetch |
| Cache granularity       | Usually endpoint/query result level                        | Often entity/field level                                                                         |
| Main discipline         | Design stable keys and invalidate the right query families | Define stable object identity and predictable cache policies                                     |
| Typical debugging issue | Stale query due to missed invalidation                     | Cache does not update because mutation response lacks identity or fields                         |

Neither approach removes the need to define freshness, invalidation, error handling, and concurrency behavior.

## Authentication and request middleware

Both REST and GraphQL need a consistent request layer for authentication, correlation IDs, error translation, timeout/cancellation, and observability.

```text
React hook
    |
    v
HTTP/GraphQL client
    |
    +--> Attach session credential or approved auth token
    +--> Add correlation ID
    +--> Apply timeout/cancellation policy
    +--> Normalize expected error responses
    |
    v
API gateway / backend
    |
    +--> Authenticate
    +--> Authorize action and resource
    +--> Validate input
    +--> Execute domain logic
```

Do not hardcode credentials inside components. Prefer secure session mechanisms or an organization-approved token strategy. Client code must never be the only access-control layer: an account ID, GraphQL variable, or hidden UI button does not establish permission.

## Error handling

Distinguish errors by what the user can do:

| Error class                    | UI approach                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Validation failure             | Show field-specific, actionable messages                                                        |
| Unauthorized / expired session | Redirect or refresh session through an approved auth flow                                       |
| Forbidden                      | Show an access-denied state; do not imply the resource does not exist unless policy requires it |
| Not found                      | Show a resource-not-found state                                                                 |
| Conflict / stale update        | Explain that data changed and offer reload or reconciliation                                    |
| Network outage / timeout       | Preserve safe local input, offer retry, and avoid duplicate submissions                         |
| Backend 5xx                    | Provide generic recovery messaging and record sanitized diagnostics                             |

For GraphQL, distinguish transport errors from operation-level errors. A GraphQL response can contain partial `data` plus `errors`, depending on the server and client error policy; design the UI intentionally for this case rather than assuming every response is all-or-nothing. Apollo notes that data and errors may both be absent or affected by configured error policy.[14]

## Loading and concurrency

For reads, show a loading state only where it improves comprehension; if cached data exists, preserve it while refresh occurs when that is safe.

For writes:

- Disable or make idempotent a button during submission to prevent accidental duplicates.
- Use idempotency keys for business-critical operations such as payments, orders, or claim submissions.
- Abort irrelevant in-flight requests on unmount or input change where the client supports cancellation.
- Handle race conditions: a slower earlier response must not overwrite a newer user intent.
- Do not use optimistic updates for irreversible or regulated operations unless backend semantics, rollback behavior, and user disclosure are carefully designed.

## Banking, insurance, and finance examples

| Domain             | REST use                                                                     | GraphQL use                                                                          | Key safeguard                                                                                 |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Banking            | `GET /accounts/:id/transactions?page=…`; `POST /transfer-drafts`             | A dashboard query combining account summary, cards, and alerts                       | Backend enforces account ownership, limits, MFA, idempotency, and fraud controls              |
| Insurance          | Resource APIs for claim uploads, document downloads, and policy updates      | Claim workspace query selecting summary, timeline, documents, and assigned adjusters | Apply document scanning, role/tenant authorization, and audit controls server-side            |
| Investment finance | REST endpoints for large exports, order workflows, and streaming integration | Portfolio screen query for holdings, allocation, performance, and alerts             | Use freshness indicators, authorization, market-data entitlements, and safe stale-data policy |

GraphQL is particularly attractive for screen-oriented aggregation across multiple backend domains, while REST is often straightforward for resource operations, file transfers, bulk exports, and conventional service boundaries. This is an architectural recommendation, not a universal rule.

## When to use which

### Use REST when

- Your backend already exposes stable resource endpoints
- HTTP caching, CDNs, file uploads/downloads, or conventional integrations matter
- Teams prefer resource-oriented APIs and straightforward operational tooling
- You need predictable endpoints for bulk operations or streaming/file workflows
- The UI’s data requirements fit endpoint boundaries reasonably well

### Use GraphQL when

- Many screens compose related data from several services
- Frontend teams need field-level query flexibility
- Over-fetching or repeated round trips are materially costly
- A governed schema, observability, query-complexity limits, and ownership model exist
- The organization can operate a GraphQL gateway responsibly

### Use either with a server-state client

The protocol does not choose the React integration pattern:

```text
REST + TanStack Query / RTK Query
GraphQL + Apollo / urql / Relay
GraphQL + TanStack Query using a custom POST function
REST + native fetch for intentionally small, simple cases
```

## Practical decision guide

```text
Is data backend-owned and fetched asynchronously?
    -> Use a server-state approach.

Already use GraphQL with a normalized entity graph?
    -> Apollo, Relay, or urql are natural choices.

Already use Redux Toolkit and REST endpoints?
    -> Consider RTK Query.

Need REST or GraphQL with minimal coupling to one transport/client?
    -> TanStack Query plus a thin API client.

Building one small, low-risk component?
    -> fetch + useEffect can be acceptable, but handle cancellation and errors.
```

## Interview answer — 2-minute version

In React, REST and GraphQL integration should treat remote API data as server state. I separate the UI from a thin transport layer and a server-state client that manages caching, loading, errors, mutations, cancellation, retries, invalidation, and stale-data behavior. TanStack Query is protocol-agnostic and works with REST or GraphQL Promise-based functions; RTK Query is a strong fit when Redux Toolkit is already in use.[4][5][6]

For GraphQL, Apollo Client provides React hooks such as `useQuery` and `useMutation`, along with a normalized cache. Query variables describe dynamic input, and mutation responses should return stable object identifiers and changed fields so the cache can update subscribed UI.[13][2][11][10]

For all protocols, the backend remains authoritative: the client must handle loading, errors, and refresh, but APIs must enforce authentication, resource-level authorization, validation, concurrency controls, and audit requirements. For critical financial operations, I avoid casual optimistic updates and use backend idempotency and explicit confirmation workflows.

## Hands-on exercise

Build an **Account Details** screen twice.

### REST implementation

1. Create `getAccount(accountId)` using `fetch`.
2. Wrap it in a TanStack `useQuery` with `queryKey: ["account", accountId]`.
3. Add an account-name `PATCH` mutation.
4. Invalidate `["account", accountId]` after mutation success.
5. Test loading, a simulated 404, a network error, and a successful retry.

### GraphQL implementation

1. Configure an Apollo Client and `ApolloProvider`.
2. Create `GET_ACCOUNT` using a variable `$accountId`.
3. Render it with `useQuery`.
4. Create an `UPDATE_ACCOUNT_NAME` mutation returning `id` and `displayName`.
5. Verify that the account display refreshes from Apollo’s cache after the mutation.

**Expected outcome:** Both implementations correctly render loading, error, and success states; after a successful update, the displayed account name changes without manually duplicating backend data in local React state.

**Failure symptom:** REST data remains stale after saving.  
**Diagnostic hint:** Confirm that the mutation invalidates the exact query-key family used by the read query.

**Failure symptom:** Apollo mutation succeeds but another screen still shows the old name.  
**Diagnostic hint:** Ensure the mutation returns the entity’s stable identifier and updated fields, and verify cache identity policies if the backend does not use conventional `id` fields.

## Sources

1. Overview | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/overview
2. Introduction to Apollo Client - Apollo GraphQL Docs https://www.apollographql.com/docs/react
3. useEffect - React https://react.dev/reference/react/useEffect
4. TanStack Query https://tanstack.com/query/latest
5. TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/queries
6. TanStack/query - GitHub https://github.com/tanstack/query
7. Caching Examples | TanStack Query React Docs https://tanstack.com/query/latest/docs/framework/react/guides/caching
8. Redux Essentials, Part 7: RTK Query Basics https://redux.js.org/tutorials/essentials/part-7-rtk-query-basics
9. RTK Query Quick Start https://redux.js.org/toolkit/tutorials/rtk-query
10. Queries - Apollo GraphQL Docs https://www.apollographql.com/docs/react/data/queries
11. Why Apollo Client? - Apollo GraphQL Docs https://www.apollographql.com/docs/react/why-apollo
12. Mutations in Apollo Client - Apollo GraphQL Docs https://www.apollographql.com/docs/react/data/mutations
13. useMutation - Apollo GraphQL Docs https://www.apollographql.com/docs/react/api/react/useMutation
14. class ApolloClient - Apollo GraphQL Docs https://www.apollographql.com/docs/react/api/core/ApolloClient
15. React Hooks in Apollo Client for GraphQL Queries and Mutations https://learning.atheros.ai/blog/react-hooks-in-apollo-client-for-graphql-queries-and-mutations
16. Using the Effect Hook - React https://legacy.reactjs.org/docs/hooks-effect.html
17. Mutations | Apollo Angular - The Guild: GraphQL https://the-guild.dev/graphql/apollo-angular/docs/data/mutations
