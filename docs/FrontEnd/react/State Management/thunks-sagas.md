---
title: Thunks vs Sagas
sidebar_label: Thunks - Sagas
sidebar_position: 5
---

**Thunks** and **sagas** both handle side effects in Redux—such as API calls and workflow logic—but they use very different models. Use **thunks by default** for straightforward asynchronous or state-dependent logic; consider **Redux-Saga** only when you truly need long-running, highly concurrent, cancellable, event-driven background workflows.[1][2]

## Core difference

A thunk is an ordinary JavaScript function that Redux dispatches and invokes with `dispatch` and `getState`. A saga is a generator-based background process that yields declarative effect descriptions—such as “wait for this action,” “call this API,” or “start two tasks in parallel”—which saga middleware executes.[3][4]

```text
Thunk:
dispatch(function)
     |
     v
Thunk runs immediately
     |
     +--> reads state
     +--> awaits API call
     +--> dispatches result actions
```

```text
Saga:
dispatch(plain action)
     |
     v
Saga watches matching actions
     |
     v
Saga middleware runs generator workflow
     |
     +--> wait / call / fork / race / cancel
     +--> dispatch result actions
```

## Comparison

| Dimension                   | Redux Thunk                                                      | Redux-Saga                                                          |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Execution model             | Dispatch a function that runs imperative JavaScript              | Dispatch plain actions; generator “watchers” react to them          |
| Main API                    | `dispatch`, `getState`                                           | Generator effects: `take`, `put`, `call`, `fork`, `race`, `cancel`  |
| Async style                 | `async` / `await`, Promises                                      | ES6 generators plus yielded effect descriptors                      |
| Setup                       | Included by default with Redux Toolkit `configureStore`          | Requires adding saga middleware and starting root saga              |
| Learning curve              | Low; normal JavaScript                                           | Higher; generators and saga concurrency semantics                   |
| Best fit                    | Complex synchronous logic and simple-to-moderate async workflows | Long-running, concurrent, cancellable, event-driven workflows       |
| Observe future actions      | No; a thunk is one-shot                                          | Yes; watcher sagas can wait for or react to actions                 |
| Cancellation                | Manual, usually `AbortController` or custom flags                | First-class task cancellation with propagation to child tasks       |
| Concurrency                 | Manually orchestrated with Promises                              | Built-in patterns for parallel work, races, forks, and cancellation |
| Test style                  | Mock `dispatch`, `getState`, and dependencies                    | Inspect yielded effects or run saga end-to-end                      |
| Modern Redux recommendation | Default starting point                                           | Specialized option after simpler RTK approaches prove insufficient  |

Redux Toolkit includes thunk middleware by default, and Redux guidance recommends thunks for complex synchronous logic and moderate asynchronous work. Redux-Saga uses generator functions and is designed for complex side effects, including parallel execution, task racing, and cancellation.[4][5][6][1][3]

## Thunks

A thunk is a function that gets invoked by thunk middleware with the Redux store’s `dispatch` and `getState` functions.[7][1]

```jsx
// Illustrative example — accountThunks.js
import { accountRequested, accountLoaded, accountFailed } from "./accountSlice";

export function fetchAccount(accountId) {
  return async function fetchAccountThunk(dispatch, getState) {
    const existing = getState().accounts.byId[accountId];

    if (existing) {
      return; // Illustrative cache decision.
    }

    dispatch(accountRequested({ accountId }));

    try {
      const response = await fetch(`/api/accounts/${accountId}`);

      if (!response.ok) {
        throw new Error("Unable to load account");
      }

      const account = await response.json();
      dispatch(accountLoaded(account));
    } catch (error) {
      dispatch(
        accountFailed({
          accountId,
          message: error.message,
        }),
      );
    }
  };
}
```

```jsx
// Illustrative example — AccountPage.jsx
import { useDispatch } from "react-redux";
import { fetchAccount } from "./accountThunks";

export default function AccountPage({ accountId }) {
  const dispatch = useDispatch();

  return (
    <button onClick={() => dispatch(fetchAccount(accountId))}>
      Load account
    </button>
  );
}
```

### Thunk flow

```text
User event
   |
   v
dispatch(fetchAccount("ACC-1001"))
   |
   v
Thunk middleware executes thunk
   |
   +--> dispatch(accountRequested)
   +--> await fetch(...)
   +--> dispatch(accountLoaded) or dispatch(accountFailed)
   |
   v
Reducers update store
   |
   v
React re-renders subscribed components
```

Thunks are particularly good for:

- One API request and resulting success/failure actions
- Conditional logic based on current state
- Sequential steps using `async` / `await`
- Calling browser APIs or application services
- Orchestrating a handful of related dispatches
- Incremental adoption in an existing Redux Toolkit app

A key limitation: thunks are **one-shot** functions. They do not naturally observe later dispatched actions or maintain a persistent background lifecycle, so they are a poor fit for long-lived connections or “wait for future event X” patterns.[1]

## createAsyncThunk

Redux Toolkit’s `createAsyncThunk` reduces boilerplate for the common lifecycle:

```text
pending -> fulfilled -> rejected
```

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
      })
      .addCase(fetchAccount.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.byId[action.payload.id] = action.payload;
      })
      .addCase(fetchAccount.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Request failed";
      });
  },
});
```

For standard API data fetching, caching, automatic re-fetching, and invalidation, Redux recommends considering RTK Query instead of hand-writing many thunks.[2][8]

## Sagas

Redux-Saga is Redux middleware for managing side effects through generator functions. Its model treats a saga like a separate background process that can be started, paused, cancelled, react to actions, access application state, and dispatch actions.[3]

```jsx
// Illustrative example — accountSaga.js
import { call, put, takeLatest } from "redux-saga/effects";
import { accountRequested, accountLoaded, accountFailed } from "./accountSlice";

async function fetchAccountApi(accountId) {
  const response = await fetch(`/api/accounts/${accountId}`);

  if (!response.ok) {
    throw new Error("Unable to load account");
  }

  return response.json();
}

function* fetchAccountWorker(action) {
  try {
    const account = yield call(fetchAccountApi, action.payload.accountId);
    yield put(accountLoaded(account));
  } catch (error) {
    yield put(
      accountFailed({
        accountId: action.payload.accountId,
        message: error.message,
      }),
    );
  }
}

export function* accountSaga() {
  yield takeLatest(accountRequested.type, fetchAccountWorker);
}
```

```text
User event
   |
   v
dispatch(accountRequested({ accountId }))
   |
   v
takeLatest watcher observes matching action
   |
   v
Worker saga starts API task
   |
   +--> a newer accountRequested action arrives
           |
           v
      prior worker can be cancelled
           |
           v
Latest worker completes
   |
   v
Saga dispatches accountLoaded or accountFailed
```

`takeLatest` is a classic search or typeahead policy: when a new request arrives, the stale in-flight task should not update the UI after the newer request. Sagas support cancellation, and cancellation propagates to child saga tasks.[9][10]

## Saga execution model

A saga does not execute the HTTP request directly in the same sense as an `async` function calling `await fetch()`. It yields an effect description:

```jsx
yield call(fetchAccountApi, accountId);
```

Saga middleware interprets that descriptor and performs the work. This indirection gives sagas their powerful control over scheduling, cancellation, concurrency, and testing. Saga tests can inspect yielded effects or run the entire saga and assert observed effects.[10][11]

```text
Generator yields: call(fetchAccountApi, "ACC-1001")
        |
        v
Saga middleware executes effect
        |
        v
Generator resumes with result or error
        |
        v
Generator yields: put(accountLoaded(account))
        |
        v
Saga middleware dispatches action
```

## Concurrency example

Suppose an order workflow must race a payment confirmation against a timeout and user cancellation.

```jsx
// Illustrative example — paymentSaga.js
import { call, cancelled, put, race, take, delay } from "redux-saga/effects";

function* confirmPaymentWorker(action) {
  try {
    const outcome = yield race({
      confirmed: call(confirmPaymentApi, action.payload.paymentId),
      timeout: delay(30_000),
      userCancelled: take("payments/cancelRequested"),
    });

    if (outcome.confirmed) {
      yield put({ type: "payments/confirmed" });
    } else if (outcome.timeout) {
      yield put({ type: "payments/timedOut" });
    } else {
      yield put({ type: "payments/cancelled" });
    }
  } finally {
    if (yield cancelled()) {
      yield put({ type: "payments/cancellationObserved" });
    }
  }
}
```

This illustrates why sagas exist: they model workflows involving several concurrent event sources—not merely “call API, then dispatch result.” Saga cancellation uses generator control flow and can cancel an active effect and attached child tasks.[9][10]

## When to choose thunks

Choose thunks when:

- Your app uses Redux Toolkit and has ordinary async needs
- You need a straightforward API call with pending/success/failure UI
- You need access to `getState()` before deciding what to do
- The workflow is short-lived and understandable as `async` / `await`
- Your team prefers standard JavaScript over generator syntax
- You want the smallest conceptual and operational footprint

```text
“On Save, call API; then show success or error.”
-> Thunk or createAsyncThunk

“Before submitting, read current state and dispatch a few updates.”
-> Thunk
```

Redux currently describes thunks as the standard middleware for Redux logic and recommends them as the normal starting point for imperative and moderately complex async work.[5][4]

## When to choose sagas

Consider sagas when your application genuinely needs:

- Long-running background jobs
- Persistent WebSocket or server-sent event lifecycles
- Action-driven processes that wait for future actions
- Debouncing, throttling, polling, retries with backoff, and cancellation with complex coordination
- “Latest wins,” “first wins,” “run in parallel,” or “race these outcomes” workflow semantics
- Complex workflow orchestration across multiple independent events
- A team already experienced with Redux-Saga and invested in it

```text
“When a user logs in, start a stream.
When they sign out, cancel it.
If their tenant changes, restart it.
If three retries fail, announce a connection problem.”
-> Saga can be justified.
```

Redux’s current guidance positions sagas as an advanced option for complex asynchronous workflows and background-thread-like behavior, beyond what the RTK listener middleware covers.[12][2]

## Modern Redux alternatives

Before adding Redux-Saga to a new application, evaluate the built-in Redux Toolkit options:

| Need                                                             | Prefer first                | Why                                                                                     |
| ---------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| API query, cache, invalidation, refetching                       | RTK Query                   | It is purpose-built for server-state fetching and caching. [8][2]                       |
| Simple/moderate async orchestration                              | Thunks / `createAsyncThunk` | Default RTK approach, familiar `async` / `await`. [4][1]                                |
| React to dispatched actions, debouncing, cancellation, sequences | RTK listener middleware     | A lighter saga/observable alternative with cancellation and debounce support. [13][12]  |
| Highly complex background workflows / concurrency graphs         | Redux-Saga                  | Generator-based control over forks, races, cancellation, and long-running tasks. [6][2] |

The Redux documentation says listener middleware covers many cases previously handled with sagas or observables, and recommends starting with RTK Query, thunks, and listeners before adopting sagas unless requirements demand them.[8][14]

## Banking, insurance, and finance examples

| Domain             | Scenario                                                 | Better first choice         | When saga may be justified                                                                                           |
| ------------------ | -------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Banking            | Submit a transfer and render pending/success/error state | Thunk or RTK Query mutation | A long-lived payment-status stream with cancellation, timeouts, retries, and user/session changes                    |
| Insurance          | Submit a claim document and refresh claim details        | RTK Query mutation or thunk | Coordinated document uploads, malware-scan status events, retry policies, and user-driven cancellation               |
| Investment finance | Load a portfolio and display holdings                    | RTK Query query             | Live market-data stream with reconnect backoff, subscription changes, competing sources, and teardown on logout      |
| Trading workflow   | Submit one order                                         | Thunk or RTK Query mutation | A complex order-state machine reacting to market events, risk holds, cancellation, expiry, and acknowledgement races |

Neither thunks nor sagas enforce payment authorization, account ownership, trading limits, fraud rules, or auditability. Those controls must reside in backend systems; frontend effects only coordinate the user experience.

## Trade-offs

### Thunks

**Benefits**

- Small API and minimal setup
- Native `async` / `await` readability
- Built into Redux Toolkit configuration by default
- Easy fit for feature-local logic and incremental adoption[4][1]

**Costs**

- No built-in action observation or persistent lifecycle
- Complex cancellation and concurrency must be designed manually
- Large numbers of interconnected thunks can spread workflow logic across files
- Testing external behavior may require mocks and integration-style tests

### Sagas

**Benefits**

- Strong abstractions for concurrency, races, parallel work, and cancellation
- Can react to arbitrary action streams and maintain long-running processes
- Declarative effect descriptors permit focused generator-level tests[6][11][3]

**Costs**

- Generators are unfamiliar to many React developers
- More setup, indirection, and debugging concepts
- Effect ordering and cancellation semantics require expertise
- Overuse can make normal business logic harder to trace than direct `async` / `await`
- A separate saga “background architecture” can compete with clearer RTK Query, thunk, or listener patterns

## Practical decision rule

```text
Need to fetch/mutate cached server data?
    -> RTK Query.

Need a one-shot async operation or state-dependent orchestration?
    -> Thunk / createAsyncThunk.

Need to react to actions with debounce, waiting, or cancellation?
    -> RTK listener middleware.

Need durable background processes with complex forks, races,
parallelism, and coordinated cancellation?
    -> Evaluate Redux-Saga.
```

## Interview answer — 2-minute version

Thunks and sagas are both Redux middleware approaches for side effects. A thunk is a function dispatched to the store and invoked with `dispatch` and `getState`, so it is ideal for straightforward async work and state-dependent orchestration using ordinary `async` / `await`. Redux Toolkit includes thunk middleware by default, and that is my normal starting point.[1][4]

A saga is a generator-based background process that watches action streams and yields effect descriptors. Saga middleware executes those effects, which gives sagas strong support for action-driven workflows, forks, parallel tasks, races, cancellation, and long-running processes.[6][3]

For standard API data, I would first use RTK Query. For ordinary application async logic, I would use thunks. For action-driven workflows such as debouncing or waiting for another action, I would consider RTK listener middleware. I introduce sagas only if the application has truly complex, long-lived concurrency or cancellation requirements that justify their learning and maintenance cost.[2][8]

## Hands-on exercise

Implement a live **Portfolio Quote Monitor** in two stages.

1. **Thunk version:** Create a `refreshPortfolio` thunk that fetches one portfolio snapshot and dispatches loading, success, or failure actions.
2. **Saga version:** Create a watcher that starts polling when `quotes/startRequested` is dispatched and stops when `quotes/stopRequested` or `auth/loggedOut` occurs.
3. Add a policy where a new `quotes/startRequested` cancels the old poller and starts a new one for the latest portfolio.
4. Test that navigating away or logging out stops the background request loop.

**Expected outcome:** The thunk handles one snapshot request cleanly. The saga demonstrates why a persistent, cancellable polling lifecycle may merit a saga or a listener-based alternative.

**Failure symptom:** Old pollers keep running after the user selects another portfolio.  
**Diagnostic hint:** Use a “latest wins” pattern and explicitly cancel the prior task; saga cancellation can propagate through attached tasks.[10][9]

**Failure symptom:** A simple one-request form submission has more generator code than business logic.  
**Diagnostic hint:** Use a thunk, `createAsyncThunk`, or RTK Query mutation instead of a saga.

## Sources

1. Writing Logic with Thunks https://redux.js.org/usage/writing-logic-thunks
2. Actions https://redux.js.org/faq/actions
3. About https://redux-saga.js.org/docs/About/
4. Redux Essentials, Part 5: Async Logic and Data Fetching https://redux.js.org/tutorials/essentials/part-5-async-logic
5. Redux Style Guide https://redux.js.org/style-guide/
6. Redux-Saga - An intuitive Redux side effect manager. | Redux ... https://redux-saga.js.org/
7. Usage With TypeScript https://redux.js.org/usage/usage-with-typescript
8. Learning Resources | Redux - JS.ORG https://redux.js.org/introduction/learning-resources
9. Task Cancellation https://redux-saga.js.org/docs/advanced/TaskCancellation/
10. API Reference https://redux-saga.js.org/docs/api/
11. Testing Sagas https://redux-saga.js.org/docs/advanced/Testing/
12. Ecosystem https://redux.js.org/introduction/ecosystem
13. Usage Guide https://redux.js.org/toolkit/usage/usage-guide
14. Migrating to Modern Redux https://redux.js.org/usage/migrating-to-modern-redux
15. Side Effects Approaches https://redux.js.org/usage/side-effects-approaches
16. Writing Custom Middleware https://redux.js.org/usage/writing-custom-middleware
