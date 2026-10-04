---
title: External State Managers
sidebar_label: External state managers
sidebar_position: 3
---

External state managers are libraries that keep application state **outside React’s component tree** and let any eligible component subscribe to selected parts of that state. They help when shared client state becomes too broad, complex, or cross-cutting for props, Context, and local reducers alone—but they are not a default replacement for local React state.[1][2]

## Plain-language overview

React already provides `useState`, `useReducer`, and Context. An external state manager adds a separate store with an explicit read/update/subscription model:

```text
React component
  |
  | reads selected state / subscribes
  v
External store
  |
  | update event
  v
Only affected subscribers re-render
```

Use one when multiple distant screens or components need to coordinate state, the update rules need to be observable and testable, or non-React code must read or update shared application state. Keep temporary UI state—such as a single dropdown’s open state or an input’s keystrokes—local whenever possible.[1][3]

## When it helps

External state management is useful when you have:

- Cross-feature client state, such as a global notification queue, multi-step workflow draft, UI layout preferences, or complex client-side editor state
- Many components reading and updating the same feature state across distant parts of the tree
- Complex business transitions that benefit from explicit actions, logging, testability, and replayability
- State shared between React and non-React code, such as a WebSocket service, analytics integration, or imperative SDK
- A need for fine-grained subscriptions so unrelated components do not all re-render when a broad Context value changes

It is usually unnecessary for a component-specific filter, tooltip, temporary form field, hover state, or modal that has one natural owner.

## What it does not solve

An external store does **not** automatically solve data fetching, cache invalidation, authorization, persistence, or bad state design.

```text
Client store holds a representation
        |
        v
Backend remains authoritative for:
- User identity
- Permissions
- Account balances
- Claims data
- Portfolio positions
- Transaction approval
```

Do not treat a client-side store as a security boundary. A user can inspect or manipulate browser-side state; APIs must always authenticate, validate, and authorize requests.

## Core concepts

| Term             | Meaning                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Store**        | Long-lived object that holds state outside individual React components                                                |
| **Selector**     | Function that reads one specific or derived slice of store state                                                      |
| **Subscription** | Mechanism that tells React a selected value changed so it can re-render                                               |
| **Action**       | An event describing what happened, commonly used in Redux                                                             |
| **Reducer**      | Pure function that computes next state from prior state plus action                                                   |
| **Middleware**   | Interceptor around updates, often used for logging, persistence, analytics, or async workflows                        |
| **Atom**         | Small independent unit of state, used by atom-based tools such as Jotai                                               |
| **Server state** | Remote data from APIs; usually needs caching, revalidation, and invalidation rather than plain client-store treatment |

## Main families

| Family                      | Examples                       | Mental model                                                        | Good fit                                                           |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Centralized, action/reducer | Redux Toolkit                  | One structured store; dispatch actions; reducers compute next state | Large teams, regulated workflows, strong conventions, auditability |
| Minimal external store      | Zustand                        | Store plus hook selectors and update functions                      | Small-to-medium apps, focused global UI/client state               |
| Atomic state                | Jotai                          | Compose small state atoms and derived atoms                         | Fine-grained interactive UI, editors, highly compositional state   |
| Observable/stream state     | MobX, RxJS-based patterns      | Reactive values or event streams                                    | Domains already using observables or rich reactive models          |
| Server-state tools          | TanStack Query, RTK Query, SWR | Cache and synchronize API-owned data                                | API-heavy applications, caching, revalidation, mutations           |

These tools overlap, but server-state tools should not be casually substituted with a general-purpose global store. For example, Redux Toolkit includes RTK Query as a purpose-built fetching and caching solution for Redux applications.[4][5]

## Redux Toolkit

**Redux Toolkit (RTK)** is the officially recommended way to write Redux logic. It provides standard setup, reducer creation, async support, data-fetching capabilities, normalized-state utilities, development checks, and integrations with the Redux ecosystem.[4][6]

Its flow is intentionally explicit:

```text
UI event
  |
  v
dispatch({ type: "cart/itemAdded", payload })
  |
  v
Reducer calculates next immutable state
  |
  v
Store notifies subscribers
  |
  v
Selector-driven components re-render
```

```jsx
// Illustrative example — cartSlice.js
import { createSlice } from "@reduxjs/toolkit";

const cartSlice = createSlice({
  name: "cart",
  initialState: { items: [] },
  reducers: {
    itemAdded(state, action) {
      state.items.push(action.payload);
    },
    itemRemoved(state, action) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
  },
});

export const { itemAdded, itemRemoved } = cartSlice.actions;
export default cartSlice.reducer;
```

```jsx
// Illustrative example — CartButton.jsx
import { useDispatch, useSelector } from "react-redux";
import { itemAdded } from "./cartSlice";

export default function CartButton() {
  const dispatch = useDispatch();
  const itemCount = useSelector((state) => state.cart.items.length);

  return (
    <button onClick={() => dispatch(itemAdded({ id: "P-104", quantity: 1 }))}>
      Cart ({itemCount})
    </button>
  );
}
```

Redux itself is framework-independent; React-Redux is the official binding that handles subscription and React re-render integration. React-Redux implements `useSelector` using React’s `useSyncExternalStore`, the React API designed for subscribing to external stores.[1]

### Redux strengths

- Explicit transitions are easy to inspect, test, log, and replay
- Redux DevTools can trace state changes and support time-travel debugging
- Strong conventions are useful for large teams and long-lived systems
- Middleware supports logging, telemetry, persistence, side effects, and integrations
- RTK Query is available for API caching and mutation workflows within Redux architectures[5][7]

### Redux trade-offs

- More concepts: slices, reducers, actions, selectors, store setup, and provider wiring
- Can be over-engineering for a few simple global UI flags
- Teams can mistakenly place all API data and temporary UI state into Redux
- Action naming and state modeling require discipline to avoid an oversized “global bucket”

Redux guidance also recommends keeping state minimal and deriving additional data through selectors rather than storing redundant calculations.[8]

## Zustand

**Zustand** is a minimal external store library. It uses hook-based selectors, avoids required providers, and can be used with React, React Native, or non-React environments. Its documentation describes a single-hook store approach with selectors, optional middleware, persistence, Immer, and DevTools integration.[2][9]

```jsx
// Illustrative example — useCartStore.js
import { create } from "zustand";

export const useCartStore = create((set) => ({
  items: [],

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
```

```jsx
// Illustrative example — CartSummary.jsx
import { useCartStore } from "./useCartStore";

export default function CartSummary() {
  const itemCount = useCartStore((state) => state.items.length);
  const addItem = useCartStore((state) => state.addItem);

  return (
    <button onClick={() => addItem({ id: "P-104", quantity: 1 })}>
      Add item ({itemCount})
    </button>
  );
}
```

Zustand’s selector model means components should select the smallest state slice they need. Avoid selecting an entire store object if the component uses only one field; broad selections can create avoidable re-renders.

### Zustand strengths

- Very small API surface and low ceremony
- No required provider wrapper
- Selective subscriptions work naturally through store hooks
- Easy to use outside React
- Optional middleware provides persistence, DevTools, Immer, and Redux-like patterns[2]

### Zustand trade-offs

- Fewer built-in architectural constraints can lead to inconsistent patterns across a large team
- Direct update methods may become a loosely structured “god store” without feature boundaries
- Complex workflows may still benefit from reducer-style events and domain-specific action conventions
- It does not replace a full server-state cache by itself

## Jotai

**Jotai** is an atom-based state library. Instead of centering everything in one store shape, you define small **atoms** that components can subscribe to independently; derived atoms can compute values from other atoms.

```jsx
// Illustrative example — Jotai atom model
import { atom, useAtom, useAtomValue } from "jotai";

const cartItemsAtom = atom([]);

const cartTotalAtom = atom((get) =>
  get(cartItemsAtom).reduce((sum, item) => sum + item.price * item.quantity, 0),
);

export function AddProductButton() {
  const [items, setItems] = useAtom(cartItemsAtom);

  return (
    <button
      onClick={() =>
        setItems([...items, { id: "P-104", price: 25, quantity: 1 }])
      }
    >
      Add product
    </button>
  );
}

export function CartTotal() {
  const total = useAtomValue(cartTotalAtom);
  return <p>Total: {total}</p>;
}
```

Zustand’s documentation contrasts its single-store model with Jotai’s composable primitive atoms.[9]

### Jotai strengths

- Natural fine-grained subscriptions
- Derived state can be represented directly as derived atoms
- Composable approach works well for complex interactive interfaces
- Less need to model one large global state tree

### Jotai trade-offs

- The distributed atom graph can be harder to discover and govern in very large codebases
- Naming, module organization, and ownership standards become important
- It may be less intuitive than a centralized event log for teams accustomed to Redux

## Server-state managers

Server state needs a different mindset because the backend owns the truth.

```text
Component requests data
       |
       v
Cache checks freshness
       |
       +--> Fresh -> return cached result
       |
       +--> Missing/stale -> fetch from API
                              |
                              v
                           cache result
                              |
                              v
                    subscribers re-render
```

Tools such as **TanStack Query**, **RTK Query**, and **SWR** manage request lifecycle, caching, deduplication, refetching, invalidation, retry behavior, and mutation coordination. RTK Query is explicitly designed for data fetching and caching in Redux applications.[5][10]

Use a server-state manager for:

- Account summaries, transactions, customer profiles, policy records, claims, holdings, market data
- Pagination and query caching
- Mutation aftermath, including invalidation or optimistic updates
- Data freshness and background refetches
- Network errors, retries, and loading states

Do not use it as the default home for an accordion’s `isOpen` flag or a temporary hover state.

## Decision framework

```text
Is the value derived from props or existing state?
  -> Derive it; do not store it.

Does one component need it?
  -> Local useState or useReducer.

Do nearby siblings need it?
  -> Lift it to the closest common parent.

Do many deep components need a stable shared value?
  -> Context may be enough.

Is it complex, cross-feature client state?
  -> Consider an external state manager.

Is it remote API data?
  -> Use a server-state cache/tool.

Must it be shareable, bookmarkable, Back/Forward aware?
  -> Put the relevant part in the URL.
```

## Choosing a tool

| Need                                                     | Practical choice                                     |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Simple local form/modal/filter                           | React `useState`                                     |
| Complex feature-local transitions                        | React `useReducer`                                   |
| Theme, locale, current-user summary                      | Context, often with local reducer/state              |
| A few shared UI concerns with low ceremony               | Zustand                                              |
| Complex, fine-grained composable UI state                | Jotai                                                |
| Large team, explicit workflows, audit/debug requirements | Redux Toolkit                                        |
| API caching and data synchronization                     | TanStack Query, RTK Query, or SWR                    |
| Existing organization-wide Redux convention              | Redux Toolkit, unless there is a clear reason not to |

The best choice depends more on state ownership, workflow complexity, team conventions, and operational needs than on application size alone.

## Financial-services examples

| Domain              | State concern                                                                                      | Suitable approach                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Banking             | Authenticated app-shell preferences, global alerts, transfer-draft workflow                        | Zustand for focused shell/UI state, or Redux Toolkit where formal workflow events and extensive audit/debug visibility are needed    |
| Insurance           | Multi-screen claims-edit workflow with validation, documents, assignment, and approval transitions | Redux Toolkit or feature-scoped reducer plus Context; server-state tool for claim data                                               |
| Investment finance  | Holdings, positions, quotes, and transaction history that can become stale                         | Server-state manager with cache invalidation and freshness policy; external client store only for UI-specific selection/layout state |
| Trading workstation | Dense, interactive grids with per-panel selection and derived state                                | Atom-based or selector-based state can help reduce unnecessary updates; market/order APIs must remain authoritative                  |

For regulated workflows, client-side action histories may assist debugging but are not an audit ledger. Audit evidence belongs in controlled backend systems with appropriate integrity, retention, and access controls.

## Architecture example

Consider a claims dashboard:

```text
URL:
  /claims/CLM-1042?tab=documents

React local state:
  documentSearchText
  isUploadDialogOpen

External client store:
  selectedTableRow
  notification queue
  layout preference

Server-state cache:
  claim details
  documents
  claim timeline
  adjuster assignment

Backend:
  authorization, policy validation, persistence, audit trail
```

This separation prevents one oversized global store from mixing unrelated ownership models.

## Common failure modes

- **Globalizing everything:** makes ownership unclear and increases coupling; retain local state where possible.
- **Duplicating server data:** keeping the same claim record in an external store and a query cache produces stale-data conflicts.
- **Storing derived values:** store cart items, not separately maintained totals; derive values with selectors or during rendering.[8]
- **Selecting too broadly:** subscribing to an entire store causes re-renders for unrelated changes; use focused selectors.
- **Unstructured mutation:** update methods named `setData` or `setState` lose domain meaning; use intent-revealing operations such as `transferDraftUpdated` or `notificationDismissed`.
- **Using browser persistence for secrets:** `localStorage` is accessible to JavaScript running on the page and is not a secure authorization store.
- **Treating client state as trusted:** route guards and client stores cannot replace backend checks.

## Interview answer — 2-minute version

External state managers keep state outside React’s component tree and let components subscribe to only the parts they need. I do not introduce one by default: local `useState`, lifted state, reducers, Context, URL state, and a dedicated server-state cache cover many cases.[1][3]

I consider an external store when client-owned state is shared across distant features, has complex transitions, needs consistent cross-team conventions, or must be accessed outside React. Redux Toolkit is the standard Redux approach and is a strong choice for large teams that value explicit actions, reducers, middleware, DevTools, and RTK Query integration.[4][7]

For smaller focused shared state, Zustand offers a low-boilerplate selector-based store without a required provider. For highly compositional UI state, Jotai’s atom model offers fine-grained subscriptions. Regardless of tool, I keep state minimal, derive computed values, keep remote data in a server-state cache, and enforce security and authorization on the backend.[2][8][9]

## Hands-on exercise

Build a small **Claims Workbench**:

```text
Claims page
├── ClaimList
├── ClaimDetails
├── NotificationTray
└── ViewPreferences
```

1. Keep `documentSearchText` local to `ClaimDetails`.
2. Store `selectedClaimId`, global notifications, and table-density preference in a small Zustand store or a Redux Toolkit slice.
3. Use selectors so `NotificationTray` subscribes only to notifications and `ViewPreferences` only to density.
4. Derive unread notification count from the notifications list rather than storing it separately.
5. Fetch claim records through a server-state tool or route loader; do not duplicate the returned claim list in the external client store.
6. Add a mock “claim updated” mutation and invalidate or refetch the affected server data.

**Expected outcome:** Selecting a claim updates the detail panel, changing table density does not re-render unrelated notification UI, and claim records refresh after a mutation.

**Failure symptom:** Every component re-renders after adding a notification.  
**Diagnostic hint:** Check whether components subscribe to the whole external store rather than selecting their specific field.

**Failure symptom:** A claim display remains stale after an update succeeds.  
**Diagnostic hint:** Identify duplicate ownership of server data and invalidate or revalidate the authoritative server-state cache.

## Sources

1. React Redux https://redux.js.org/faq/react-redux
2. Zustand Docs https://zustand.docs.pmnd.rs/
3. memo https://react.dev/reference/react/memo
4. Usage Guide https://redux.js.org/toolkit/usage/usage-guide
5. RTK Query Overview https://redux.js.org/toolkit/rtk-query/overview
6. Migrating to RTK 2.0 and Redux 5.0 https://redux.js.org/usage/migrations/migrating-rtk-2
7. Redux - A JS library for predictable and maintainable global ... https://redux.js.org/
8. Deriving Data with Selectors https://redux.js.org/usage/deriving-data-selectors
9. Comparison - Zustand Docs https://zustand.docs.pmnd.rs/learn/getting-started/comparison.html
10. createAsyncThunk https://redux.js.org/toolkit/api/createAsyncThunk
11. Redux Toolkit vs Zustand — real-world use cases & decision ... https://www.reddit.com/r/react/comments/1q7yoz1/redux_toolkit_vs_zustand_realworld_use_cases/
12. Redux Quick Start https://redux.js.org/tutorials/quick-start
13. Learning Resources | Redux - JS.ORG https://redux.js.org/introduction/learning-resources
14. Frontend System Design: Redux Toolkit vs Zustand vs Jotai https://dev.to/zeeshanali0704/frontend-system-design-redux-toolkit-vs-zustand-vs-jotai-1npn
15. Zustand vs Redux Toolkit - Picking React State https://theroadtoenterprise.com/blog/zustand-vs-redux-toolkit
16. Streaming Updates https://redux.js.org/toolkit/rtk-query/usage/streaming-updates
