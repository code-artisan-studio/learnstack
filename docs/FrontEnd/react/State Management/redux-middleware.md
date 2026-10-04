---
title: Redux Middleware
sidebar_label: Redux Middleware
sidebar_position: 4
---

Redux middleware is code that runs **between `dispatch(action)` and the reducer**. It extends Redux’s otherwise synchronous flow so the app can perform side effects—such as API calls, logging, analytics, retries, debouncing, persistence, or multi-step workflows—then dispatch ordinary actions that reducers use to update state.[1][2]

## Plain-language overview

A Redux reducer must be a pure, synchronous function: given the current state and an action, it returns the next state. It should not fetch data, call browser APIs, generate unpredictable values, or perform network requests.

Middleware is the controlled place for those non-reducer concerns.

```text
Without middleware

UI -> dispatch(action) -> reducer -> store state -> React UI
```

```text
With middleware

UI -> dispatch(action)
          |
          v
     middleware pipeline
       |          |
       |          +--> logging / analytics / API call / delay
       v
     reducer -> store state -> React UI
```

Redux documents middleware as a third-party extension point between dispatching an action and the moment it reaches reducers.[1]

## Why Redux needs it

The Redux store itself is synchronous: it dispatches actions, invokes reducers, stores the resulting state, and notifies subscribers. Any asynchronous operation—such as a request to an API—must happen outside reducers, with results later dispatched as plain actions.[3]

```text
User clicks "Load accounts"
        |
        v
dispatch(accountsRequested())
        |
        v
Middleware starts GET /api/accounts
        |
        +--> success: dispatch(accountsLoaded(data))
        |
        +--> failure: dispatch(accountsFailed(error))
        |
        v
Reducers update status/data/error state
        |
        v
React renders loading, success, or error UI
```

This separation makes state changes predictable and keeps reducers testable.

## Middleware signature

Conceptually, Redux middleware follows this curried function shape:

```js
const middleware = (storeApi) => (next) => (action) => {
  // Run logic before the next middleware/reducer.
  const result = next(action);
  // Run logic after reducers receive the action.
  return result;
};
```

The middleware receives:

| Argument            | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `storeApi.dispatch` | Dispatch more actions, including follow-up actions                   |
| `storeApi.getState` | Read current state for decisions                                     |
| `next`              | Pass the action to the next middleware, eventually reaching reducers |
| `action`            | The dispatched action being processed                                |

Middleware is composed into a pipeline that wraps the store’s `dispatch` method, and it can access `dispatch` and `getState`.[4]

## Execution flow

Assume the store has three middleware in this order:

```text
listenerMiddleware -> auditMiddleware -> thunkMiddleware -> reducers
```

Then:

```text
dispatch(action)
    |
    v
listenerMiddleware sees action
    |
    v
auditMiddleware sees action
    |
    v
thunkMiddleware sees action
    |
    v
reducer receives action
    |
    v
store updates state
    |
    v
React-Redux subscribers update
```

The order matters:

- **Before `next(action)`**: inspect, transform, block, delay, or start a side effect before reducers receive the action.
- **After `next(action)`**: inspect the updated state, trigger follow-up work, or record the completed transition.
- **Never calling `next(action)`**: prevents the original action from reaching later middleware and reducers; reserve this for intentional cancellation or interception.

## Redux Toolkit default middleware

Modern Redux applications should generally use **Redux Toolkit (RTK)** and `configureStore`. RTK’s `configureStore` automatically adds thunk middleware, enables Redux DevTools, and in development adds checks for accidental state mutation and non-serializable values.[5][3]

```jsx
// Illustrative example — store.js
import { configureStore } from "@reduxjs/toolkit";
import accountReducer from "./features/accounts/accountSlice";

export const store = configureStore({
  reducer: {
    accounts: accountReducer,
  },
});
```

You do not need to manually install or configure `redux-thunk` for this standard setup; it is included by default.[6][3]

## Thunk middleware

A **thunk** is a function dispatched to the Redux store instead of a plain action object. Thunk middleware recognizes that function, calls it with `dispatch` and `getState`, and lets it perform synchronous or asynchronous work before dispatching normal actions.[7][6]

```jsx
// Illustrative example — accountThunks.js
import {
  accountsLoading,
  accountsLoaded,
  accountsFailed,
} from "./accountSlice";

export function fetchAccounts() {
  return async function fetchAccountsThunk(dispatch, getState) {
    dispatch(accountsLoading());

    try {
      const response = await fetch("/api/accounts");

      if (!response.ok) {
        throw new Error("Unable to load accounts");
      }

      const accounts = await response.json();
      dispatch(accountsLoaded(accounts));
    } catch (error) {
      dispatch(accountsFailed(error.message));
    }
  };
}
```

```jsx
// Illustrative example — AccountsPage.jsx
import { useDispatch } from "react-redux";
import { fetchAccounts } from "./accountThunks";

export default function AccountsPage() {
  const dispatch = useDispatch();

  return (
    <button onClick={() => dispatch(fetchAccounts())}>Load accounts</button>
  );
}
```

`getState()` is useful when the side effect depends on current state—for example, to avoid fetching data already in a valid cache, check a selected organization, or enforce client-side workflow rules. Keep business authorization on the server regardless of client checks.

### createAsyncThunk

Redux Toolkit’s `createAsyncThunk` standardizes the common pending/fulfilled/rejected lifecycle, reducing boilerplate for one-off async operations. RTK documentation describes it as an API that dispatches pending, fulfilled, and rejected actions around an asynchronous function.[8]

```jsx
// Illustrative example — accountSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const fetchAccount = createAsyncThunk(
  "accounts/fetchAccount",
  async (accountId) => {
    const response = await fetch(`/api/accounts/${accountId}`);

    if (!response.ok) {
      throw new Error("Account request failed");
    }

    return response.json();
  },
);

const accountSlice = createSlice({
  name: "accounts",
  initialState: {
    byId: {},
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccount.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAccount.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.byId[action.payload.id] = action.payload;
      })
      .addCase(fetchAccount.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Unknown error";
      });
  },
});

export default accountSlice.reducer;
```

Use thunks or `createAsyncThunk` for application orchestration and nontrivial async work. For routine API caching and request lifecycle management, prefer RTK Query rather than repeatedly hand-writing loading/error/cache reducers.[9][3]

## RTK Query middleware

**RTK Query** is Redux Toolkit’s API data-fetching and caching solution. An RTK Query API slice supplies both a reducer and custom middleware; the middleware manages subscriptions, cache lifetimes, expiration, request behavior, invalidation, and refetching.[10][11]

```jsx
// Illustrative example — accountsApi.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const accountsApi = createApi({
  reducerPath: "accountsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    getAccount: builder.query({
      query: (accountId) => `/accounts/${accountId}`,
    }),
  }),
});
```

```jsx
// Illustrative example — store.js
import { configureStore } from "@reduxjs/toolkit";
import { accountsApi } from "./accountsApi";

export const store = configureStore({
  reducer: {
    [accountsApi.reducerPath]: accountsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(accountsApi.middleware),
});
```

```jsx
// Illustrative example — AccountPage.jsx
import { useGetAccountQuery } from "./accountsApi";

export default function AccountPage({ accountId }) {
  const { data, isLoading, error } = useGetAccountQuery(accountId);

  if (isLoading) return <p>Loading account…</p>;
  if (error) return <p>Could not load the account.</p>;

  return <h1>{data.name}</h1>;
}
```

The API slice middleware is required; without it, RTK Query cannot manage its intended cache and subscription behavior correctly.[9][10]

## Listener middleware

**Listener middleware** reacts to specific actions or state changes and runs an effect outside reducers and components. Redux Toolkit positions `createListenerMiddleware` as a lightweight alternative to sagas and observables for workflows such as action sequencing, debouncing, delays, and cancellation.[2][3][8]

```jsx
// Illustrative example — listenerMiddleware.js
import { createListenerMiddleware } from "@reduxjs/toolkit";
import { transferSubmitted, transferSucceeded } from "./transferSlice";

export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: transferSubmitted,
  effect: async (action, listenerApi) => {
    const response = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action.payload),
    });

    if (response.ok) {
      listenerApi.dispatch(transferSucceeded());
    }
  },
});
```

```jsx
// Illustrative example — store.js
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware().prepend(listenerMiddleware.middleware),
```

Use listener middleware when the intent is “**when this action happens, react with a workflow**.” It is well suited to:

- Debounced search after `searchTermChanged`
- Showing a notification after a successful update
- Starting or cancelling a multi-step process
- Reacting to sign-out by clearing feature state
- Sequencing actions with delays or conditions
- Coordinating browser-side APIs outside components

For a single simple side effect, a full listener architecture may be excessive; Redux recommends choosing the lightest technique that fits.[12]

## Custom middleware

Write custom middleware when the behavior is cross-cutting and not cleanly owned by a component, thunk, RTK Query endpoint, or listener.

### Logging example

```jsx
// Illustrative example — auditMiddleware.js
export const auditMiddleware = (storeApi) => (next) => (action) => {
  const previousState = storeApi.getState();
  const result = next(action);
  const nextState = storeApi.getState();

  console.info("Redux action", {
    type: action.type,
    previousState,
    nextState,
  });

  return result;
};
```

### Analytics example

```jsx
// Illustrative example — analyticsMiddleware.js
export const analyticsMiddleware = () => (next) => (action) => {
  const result = next(action);

  if (action.type === "checkout/completed") {
    sendAnalyticsEvent("checkout_completed");
  }

  return result;
};
```

Add custom middleware while retaining defaults:

```jsx
import { configureStore } from "@reduxjs/toolkit";
import { auditMiddleware } from "./auditMiddleware";
import { analyticsMiddleware } from "./analyticsMiddleware";

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(auditMiddleware).concat(analyticsMiddleware),
});
```

Redux’s current TypeScript guidance recommends `.concat()` and `.prepend()` on `getDefaultMiddleware()` rather than spreading an array, because the helper preserves middleware type information.[4]

### Do not log sensitive data

In banking, insurance, and finance systems, middleware logging must be treated as an observability and privacy control point:

- Do not log credentials, session tokens, full account numbers, payment details, government identifiers, health information, or raw claim documents.
- Redact or tokenize identifiers before client telemetry.
- Use structured, allow-listed event schemas.
- Remember that browser logs and third-party analytics are not a compliant audit system.

## Middleware selection

| Need                                                             | Best starting choice           | Why                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Simple async logic or several related dispatches                 | Thunk / `createAsyncThunk`     | Included with RTK; straightforward `async/await` workflow. [3][7]                                                              |
| API fetching, caching, invalidation, refetching                  | RTK Query                      | Built specifically for server-state lifecycle and caching. [3][9]                                                              |
| React to actions/state with debouncing, cancellation, sequencing | RTK listener middleware        | Lightweight reactive workflow tool. [8][2]                                                                                     |
| Cross-cutting logging, telemetry, action filtering, integrations | Custom middleware              | Central interception point. [12][1]                                                                                            |
| Existing complex generator or observable architecture            | Redux-Saga or redux-observable | Consider only if their particular concurrency/stream model is truly needed; RTK listeners are a common modern default. [13][2] |

## Middleware versus reducers

| Concern                 | Reducer                  | Middleware                                                     |
| ----------------------- | ------------------------ | -------------------------------------------------------------- |
| Input                   | Current state and action | Store API, next dispatcher, action                             |
| Must be pure?           | Yes                      | No; it may perform side effects                                |
| Async work?             | No                       | Yes                                                            |
| Updates state directly? | Returns next state       | No; dispatches actions that reducers process                   |
| Good for                | Domain state transitions | API calls, telemetry, delays, orchestration                    |
| Test style              | Input/output unit tests  | Mock `dispatch`, `getState`, `next`, and external dependencies |

Do not put asynchronous work inside reducers. Redux explicitly describes the store as synchronous and positions middleware as the mechanism for side effects and async logic.[2][3]

## Banking example

A transfer workflow might use several layers:

```text
User submits transfer
        |
        v
dispatch(transferSubmitted(draft))
        |
        +--> listener middleware validates workflow conditions
        |
        +--> RTK Query mutation sends request
        |
        +--> API authorizes customer, account ownership, limits, and MFA state
        |
        +--> success action updates client UI
        |
        +--> sanitized telemetry middleware records outcome
```

The Redux store can coordinate client UI and show request state, but the backend remains responsible for payment authorization, fraud checks, limits, idempotency, and immutable audit records.

## Trade-offs

- Middleware centralizes cross-cutting logic, but excessive middleware can hide control flow and make debugging harder.
- Middleware order is behavior: changing it can alter logging, action transformation, cache handling, or error behavior.
- Thunks are simple, but large numbers of ad hoc thunks can scatter workflow rules.
- Listener middleware offers richer reactive behavior, but should not become a hidden second application architecture.
- RTK Query reduces request boilerplate, but it should manage backend-owned data rather than becoming a generic client-state store.
- Custom middleware is powerful, but it is low-level; prefer RTK Query, thunks, or listener middleware when they fit the problem. Redux recommends RTK Query for server state and listener middleware for many other reactive side effects.[12][2]

## Interview answer — 2-minute version

Redux middleware is an extension point that runs between `dispatch` and reducers. Redux reducers are pure and synchronous, so middleware handles side effects such as asynchronous API calls, logging, analytics, persistence, retries, and action-driven workflows. Middleware can inspect actions, access `getState`, dispatch follow-up actions, and decide when to call `next(action)`.[1][4]

In a modern Redux Toolkit application, `configureStore` includes thunk middleware by default. I use thunks or `createAsyncThunk` for general async orchestration, RTK Query for API fetching and caching, and listener middleware when the application needs to react to actions or state changes with patterns such as debouncing, sequencing, cancellation, or cross-feature workflows.[3][7][8]

I use custom middleware sparingly for cross-cutting concerns such as sanitized telemetry or policy-based action interception. Middleware must not be treated as security enforcement or a backend audit trail; the server remains responsible for authorization, validation, and regulated audit records.

## Hands-on exercise

Build a small **Expense Approval** Redux Toolkit application:

1. Create an `expenseSlice` with `submitted`, `approved`, and `rejected` actions.
2. Use `createAsyncThunk` or an RTK Query mutation to submit the approval decision.
3. Add listener middleware that shows a notification after `approved`.
4. Add a custom analytics middleware that records only the action type and outcome—never expense descriptions, account identifiers, or employee data.
5. Confirm default middleware remains enabled by composing additions with `getDefaultMiddleware().prepend(...).concat(...)`.

**Expected outcome:** Clicking **Approve** enters a pending state, triggers an asynchronous request, updates Redux state from the result, and displays one success notification.

**Failure symptom:** Dispatching a thunk causes “Actions must be plain objects.”  
**Diagnostic hint:** Confirm that the store is created with Redux Toolkit’s `configureStore`, or that thunk middleware has not been removed from the middleware configuration.[6][3]

**Failure symptom:** RTK Query hooks run but caching and invalidation do not behave correctly.  
**Diagnostic hint:** Verify that both the API slice reducer and `api.middleware` were added to the store.[10][9]

## Sources

1. redux.js.org › history-and-design › middlewareMiddleware - Redux https://redux.js.org/understanding/history-and-design/middleware
2. Side Effects Approaches https://redux.js.org/usage/side-effects-approaches
3. Usage Guide https://redux.js.org/toolkit/usage/usage-guide
4. Usage With TypeScript https://redux.js.org/usage/usage-with-typescript
5. Configuring Your Store https://redux.js.org/usage/configuring-your-store
6. Writing Logic with Thunks https://redux.js.org/usage/writing-logic-thunks
7. Redux Essentials, Part 5: Async Logic and Data Fetching https://redux.js.org/tutorials/essentials/part-5-async-logic
8. Ecosystem https://redux.js.org/introduction/ecosystem
9. RTK Query Quick Start https://redux.js.org/toolkit/tutorials/rtk-query
10. Redux Essentials, Part 7: RTK Query Basics https://redux.js.org/tutorials/essentials/part-7-rtk-query-basics
11. RTK Query Overview https://redux.js.org/toolkit/rtk-query/overview
12. Writing Custom Middleware https://redux.js.org/usage/writing-custom-middleware
13. Migrating to Modern Redux https://redux.js.org/usage/migrating-to-modern-redux
14. Migrating to RTK 2.0 and Redux 5.0 https://redux.js.org/usage/migrations/migrating-rtk-2
15. Learning Resources | Redux - JS.ORG https://redux.js.org/introduction/learning-resources
