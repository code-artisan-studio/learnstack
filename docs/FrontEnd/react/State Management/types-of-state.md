---
title: Types of State Management
sidebar_label: State Management Types
sidebar_position: 2
---

React state is not one thing: it can be local, shared, persisted, URL-based, derived, or server-owned. The core rule is **store only the minimum source-of-truth data; derive everything else when rendering**. React specifically recommends avoiding redundant and duplicate state because it easily falls out of sync.[1][2]

## State taxonomy

| Type                        | What it means                                          | Typical home                        | Example                                   |
| --------------------------- | ------------------------------------------------------ | ----------------------------------- | ----------------------------------------- |
| **Stored state**            | Values React must remember between renders             | `useState` or `useReducer`          | `selectedId`, form values, `isOpen`       |
| **Derived state**           | Value computed from props or stored state              | During render; optionally `useMemo` | Cart total from items                     |
| **Local state**             | Stored state used by one component instance            | Component `useState`                | Search input text                         |
| **Lifted state**            | Shared state moved to the nearest common parent        | Parent `useState`/`useReducer`      | Selected row shared by list and details   |
| **Context state**           | Shared state made available to deep descendants        | Context provider                    | Theme, locale, authenticated-user summary |
| **Reducer state**           | Related stored values updated through explicit actions | `useReducer`                        | Complex form or workflow                  |
| **URL state**               | Shareable location-driven state                        | Route params / query parameters     | `/orders/42?tab=history`                  |
| **Server state**            | Remote, backend-owned data cached in the UI            | Query/cache or route loader         | Account balance, claims, inventory        |
| **Persistent client state** | State surviving refresh or restart                     | Browser storage, carefully          | Theme preference, unsent draft            |
| **Transient UI state**      | Short-lived visual interaction state                   | Usually local state                 | Hover state, tooltip, modal open state    |

These categories can overlap: for example, a selected report period may be both **URL state** and **derived input** to a server-data request.

## Stored state

**Stored state** is the minimum changing information React needs to remember across renders. `useState` adds a state variable to a component, along with a setter that requests a new render.[3][4]

```jsx
import { useState } from "react";

export default function ProductSearch() {
  const [query, setQuery] = useState("");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products"
      />

      <button onClick={() => setIsFilterPanelOpen((open) => !open)}>
        Filters
      </button>

      {isFilterPanelOpen && <FilterPanel />}
    </>
  );
}
```

Here, `query` and `isFilterPanelOpen` are stored because the user can change them and React must remember their latest values after rendering.

### State is a snapshot

A React state value is a snapshot for one render, not a normal mutable variable that changes immediately when its setter runs. Calling a setter schedules a future render with the updated state.[5][6]

```jsx
function handleClick() {
  setCount(count + 1);

  console.log(count); // Still the value from this render.
}
```

When the next value depends on the previous one, use a functional update:

```jsx
setCount((previousCount) => previousCount + 1);
```

## Derived state

**Derived state** is a value you can calculate from existing props, stored state, or context during rendering. It is usually **not stored in `useState`**. React advises removing state that can be computed entirely from current props or other state.[4][1]

```jsx
// Illustrative example
function CartSummary({ cartItems }) {
  const itemCount = cartItems.length;

  const total = cartItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return (
    <p>
      {itemCount} items — total: {total}
    </p>
  );
}
```

`itemCount` and `total` are derived from `cartItems`. Storing them separately introduces a synchronization problem.

```jsx
// Avoid unless there is a very specific need.
const [cartItems, setCartItems] = useState([]);
const [total, setTotal] = useState(0);
```

```text
cartItems change
     |
     +--> total updated correctly? Maybe
     |
     +--> total forgotten? UI is now inconsistent
```

### Derivation versus memoization

Derivation means calculating a value during render. Memoization using `useMemo` is an optional performance optimization when a calculation is actually expensive or referential stability matters—not a requirement for correctness.

```jsx
import { useMemo } from "react";

function TransactionList({ transactions, query }) {
  const visibleTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return transactions.filter((transaction) =>
      transaction.description.toLowerCase().includes(normalized),
    );
  }, [transactions, query]);

  return <TransactionRows transactions={visibleTransactions} />;
}
```

The value remains derived; `useMemo` only caches a previous computation when dependencies are unchanged.

### A common derived-state mistake

Avoid synchronizing a prop into state using an Effect merely to obtain a computed value:

```jsx
// Usually avoid.
const [fullName, setFullName] = useState("");

useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

```jsx
// Prefer.
const fullName = `${firstName} ${lastName}`;
```

React advises calculating values from existing props or state during rendering rather than storing them redundantly.[7][1]

## Local state

**Local state** belongs to one component instance and is isolated from other instances of the same component. React keeps state according to a component’s position in the rendered UI tree.[8][3]

```jsx
function SearchBox() {
  const [query, setQuery] = useState("");
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}

export default function Page() {
  return (
    <>
      <SearchBox />
      <SearchBox />
    </>
  );
}
```

Each `SearchBox` has its own `query`; typing in one does not alter the other.

### Good local-state candidates

- Text currently typed into one form field
- Whether one dropdown, tooltip, or modal is open
- Hovered or focused element
- Local validation display state
- A component-specific sorting preference that does not need a shareable URL
- Temporary animation or interaction state

React recommends keeping transient state local and not lifting it higher than necessary.[9]

## Lifted state

**Lifted state** is state moved from child components into their nearest shared parent because two or more components must agree on it. React calls this “lifting state up.”[2][10]

```text
Before: two sources of truth

Panel A -> isOpen
Panel B -> isOpen

After: one source of truth

Accordion -> openPanelId
   ├── Panel A receives isOpen + onToggle
   └── Panel B receives isOpen + onToggle
```

```jsx
import { useState } from "react";

function Accordion() {
  const [openPanelId, setOpenPanelId] = useState(null);

  return (
    <>
      <Panel
        id="details"
        title="Details"
        isOpen={openPanelId === "details"}
        onToggle={() =>
          setOpenPanelId((current) =>
            current === "details" ? null : "details",
          )
        }
      />

      <Panel
        id="history"
        title="History"
        isOpen={openPanelId === "history"}
        onToggle={() =>
          setOpenPanelId((current) =>
            current === "history" ? null : "history",
          )
        }
      />
    </>
  );
}

function Panel({ title, isOpen, onToggle }) {
  return (
    <section>
      <button onClick={onToggle} aria-expanded={isOpen}>
        {title}
      </button>
      {isOpen && <p>Content shown here.</p>}
    </section>
  );
}
```

### When to lift

Lift state when:

- Siblings must display the same selection
- One child changes data that another child must immediately reflect
- A parent needs to control a child—making it a **controlled component**
- You are trying to keep duplicate state variables synchronized

Do not lift state merely because components are related. Lift only to the **closest common parent** that genuinely needs to coordinate them.[10][9]

## Controlled and uncontrolled state

This is a component-design distinction, not a different React storage mechanism.

A **controlled component** receives important state through props and reports changes through callbacks. Its parent is the source of truth.

```jsx
function Toggle({ isOn, onChange }) {
  return (
    <button aria-pressed={isOn} onClick={() => onChange(!isOn)}>
      {isOn ? "Enabled" : "Disabled"}
    </button>
  );
}
```

An **uncontrolled component** keeps that state internally.

```jsx
function Toggle() {
  const [isOn, setIsOn] = useState(false);

  return (
    <button aria-pressed={isOn} onClick={() => setIsOn((current) => !current)}>
      {isOn ? "Enabled" : "Disabled"}
    </button>
  );
}
```

Controlled components are useful when a parent must coordinate behavior, validate, reset, or persist the state. Uncontrolled components reduce wiring when no other component needs that state.

## Context state

**Context state** is state or a value exposed to many descendants without manually threading props through every intermediate component. `useContext` reads and subscribes to the nearest matching provider.[11]

```jsx
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return value;
}
```

Appropriate uses include theme, language/locale, authenticated-user summary, feature flags, dependency services, and narrow feature-level shared state. Context distributes values; it does not automatically make the value persistent, secure, or globally appropriate.

### Context trade-off

When a context value changes, consuming descendants subscribe to that change. Keep providers focused, split unrelated contexts, and avoid putting rapidly changing large objects into a broad application-wide context without a performance plan.

## Reducer state

**Reducer state** is stored state whose possible transitions are described as actions. It is helpful when related values have many transitions or business rules.

```jsx
import { useReducer } from "react";

const initialState = {
  amount: "",
  status: "editing",
  error: null,
};

function paymentReducer(state, action) {
  switch (action.type) {
    case "amountChanged":
      return { ...state, amount: action.value };

    case "submissionStarted":
      return { ...state, status: "submitting", error: null };

    case "submissionSucceeded":
      return { ...state, status: "complete" };

    case "submissionFailed":
      return { ...state, status: "editing", error: action.message };

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export default function PaymentForm() {
  const [state, dispatch] = useReducer(paymentReducer, initialState);

  return (
    <input
      value={state.amount}
      onChange={(event) =>
        dispatch({ type: "amountChanged", value: event.target.value })
      }
    />
  );
}
```

Use `useReducer` when it makes transitions easier to test and reason about; do not use it for a simple checkbox just because it is available.

## URL state

**URL state** is state represented in the address bar, usually using route parameters, query parameters, or hash fragments.

```text
/accounts/ACC-1001/transactions?page=2&sort=date
           └─────── route parameter
                                      └──────────── query state
```

Use URL state for information that should survive refresh, deep linking, sharing, bookmarking, or Back/Forward navigation:

- Selected account, product, claim, report, or document
- Active subpage or nested route
- Search phrase, filters, sorting, pagination, selected report period
- Optional UI state that is explicitly intended to be shareable

Do not place secrets, access tokens, personally identifiable information (PII), or sensitive bank/insurance data in URLs: URLs can appear in history, logs, analytics, referrer headers, and screenshots.

## Server state

**Server state** is remotely owned data that the frontend reads, displays, and sometimes mutates. The browser can cache it, but it is not the authoritative owner.

```text
Browser UI
   |
   | GET /api/accounts/ACC-1001
   v
Backend service / database
   |
   v
Authoritative account data
```

Examples include customer profiles, account balances, insurance claims, portfolio holdings, entitlements, and feature configuration fetched from a service. A good server-state strategy handles:

- Loading and error states
- Caching and cache invalidation
- Revalidation after a mutation
- Stale data and concurrency
- Authentication and authorization failures
- Retry behavior and observability

Do not copy server data into a global client store by default. Store only UI-specific edits or transient workflow state locally; refetch or invalidate backend-owned data after writes.

## Persistent client state

**Persistent client state** survives page refresh or browser restart, usually through `localStorage`, IndexedDB, cookies, or a server-side profile.

```text
In-memory React state  -> lost on refresh
localStorage           -> remains in browser
Backend profile        -> follows the user across devices
```

Good candidates:

- Theme preference
- Last-selected non-sensitive view preference
- UI density or accessibility preference
- Recoverable non-sensitive draft metadata

Risks include schema changes, stale values, quota limits, cross-tab coordination, and security exposure. Never treat browser storage as trusted or store sensitive session credentials there unless your organization’s security model explicitly permits and protects that approach.

## Ephemeral UI state

**Ephemeral** or **transient UI state** exists only for the current interaction and usually belongs close to the UI that uses it.

```jsx
const [isTooltipVisible, setIsTooltipVisible] = useState(false);
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [draggedItemId, setDraggedItemId] = useState(null);
```

This state normally should not be global, persistent, or encoded in the URL. Its value is usually unimportant once the user leaves the component or refreshes the page.

## State placement guide

```text
Can it be computed from current props/state?
    |
    +-- Yes -> Derived value; do not store it.
    |
    +-- No -> Must React remember it across renders?
                 |
                 +-- No -> Plain local variable.
                 |
                 +-- Yes -> Does only one component need it?
                              |
                              +-- Yes -> Local useState.
                              |
                              +-- No -> Closest common parent can coordinate?
                                           |
                                           +-- Yes -> Lift state.
                                           |
                                           +-- No -> Context or a focused store.
```

Then ask two more questions:

```text
Must it survive refresh, sharing, or Back/Forward?
    -> URL state, persistence, or server state.

Is the backend authoritative?
    -> Treat it as server state, not client-owned state.
```

## Banking, insurance, finance example

Consider an investment-portfolio screen:

```text
/portfolios/PF-220/holdings?sort=marketValue
```

| Data                           | Type                               | Why                                                                             |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| `portfolioId = PF-220`         | URL route parameter                | Identifies the selected portfolio and supports deep links                       |
| `sort = marketValue`           | URL/query state                    | User can bookmark or share the chosen view                                      |
| Holdings and market values     | Server state                       | The brokerage or investment backend is authoritative                            |
| Search input in holdings table | Local state                        | Used only by that visible component unless intentionally shared                 |
| Selected holding               | Lifted state                       | List, chart, and details drawer may need the same selection                     |
| Total portfolio value          | Derived state                      | Compute from holdings; do not independently store it                            |
| Trade ticket workflow          | Reducer state                      | It has explicit steps, validation, submission, success, and failure transitions |
| UI theme                       | Context plus persistent preference | Many descendants need it, and the user expects it to persist                    |

A React route or local store must never be treated as authorization. The backend must verify the user’s portfolio access and trading permissions for every protected API operation.

## Internal behavior

React associates state with a component’s position in the UI tree; each displayed component instance has isolated state. When React renders a component, it supplies a snapshot for that render, and a state update asks React to render again with the next snapshot.[5][8]

```text
Render #1
state: { query: "" }
        |
User types "bond"
        |
setQuery("bond")
        |
React schedules Render #2
        |
Render #2
state: { query: "bond" }
```

If the component unmounts, its local state is normally discarded. If important state must outlive that component, lift it to a surviving parent, place it in the URL, persist it deliberately, or store it on the server.[8]

## Benefits and trade-offs

- **Derived state** minimizes moving parts and eliminates synchronization bugs, but expensive derivations may need measured optimization with `useMemo`.
- **Local state** is isolated and simple, but cannot coordinate distant UI.
- **Lifted state** creates one source of truth for siblings, but lifting too high can lead to prop drilling and broader re-renders.
- **Context** avoids prop drilling, but broad frequently changing contexts can trigger wide updates.
- **Reducer state** makes complex transitions explicit and testable, but is unnecessary ceremony for trivial state.
- **URL state** supports deep linking and browser navigation, but must not contain secrets or sensitive data.
- **Server state** models reality more accurately for remote data, but needs caching, loading, error, and invalidation strategies.
- **Persistent client state** improves continuity, but must handle stale schema, privacy, and security risks.

## Interview answer — 2-minute version

In React, stored state is the minimum information React must remember between renders, usually through `useState` or `useReducer`. Derived state is calculated from existing props or state during rendering—such as a cart total from cart items—and should normally not be stored separately because redundant state can become inconsistent.[1][4]

Local state belongs to one component instance. When multiple components must agree on a value, I lift the state to their closest common parent and pass it down with props and update callbacks, creating one source of truth.[3][10]

For deeply shared but focused values, I use Context. For complex workflows with explicit transitions, I use a reducer. I distinguish URL state for shareable navigation state, server state for backend-owned data, and persistent client state for carefully chosen user preferences. The guiding principle is to keep state as local and minimal as possible, derive what can be calculated, and use the URL or server when state must outlive a component or be shareable.[9][1]

## Hands-on exercise

Build a simple **Portfolio Holdings** page with:

```text
Portfolio page
├── HoldingsSearch
├── HoldingsTable
├── HoldingDetails
├── PortfolioSummary
└── TradeTicket
```

1. Store the search text locally in `HoldingsSearch`.
2. Lift `selectedHoldingId` to the portfolio page so the table and detail panel share one selection.
3. Derive visible holdings from the holdings array plus search text.
4. Derive the total portfolio value from holdings; do not store it separately.
5. Use `useReducer` for the trade-ticket state: `editing`, `validating`, `submitting`, `success`, and `error`.
6. Represent the selected portfolio with a route such as `/portfolios/:portfolioId`, and represent table sorting with `?sort=marketValue`.

**Expected outcome:** Selecting a holding updates both the table and detail view; filtering does not require a separate stored “filtered holdings” list; totals remain correct after holdings updates.

**Failure symptom:** The displayed portfolio total becomes incorrect after editing a holding.  
**Diagnostic hint:** Remove a separately stored total and calculate it from the current holdings array.

**Failure symptom:** The list and detail panel disagree about which holding is selected.  
**Diagnostic hint:** Remove duplicate selection state and lift one authoritative `selectedHoldingId` to their nearest common parent.

## Sources

1. Choosing the State Structure https://react.dev/learn/choosing-the-state-structure
2. Managing State https://react.dev/learn/managing-state
3. State: A Component's Memory https://react.dev/learn/state-a-components-memory
4. useState https://react.dev/reference/react/useState
5. State as a Snapshot https://react.dev/learn/state-as-a-snapshot
6. useReducer https://react.dev/reference/react/useReducer
7. You Might Not Need an Effect https://react.dev/learn/you-might-not-need-an-effect
8. Preserving and Resetting State https://react.dev/learn/preserving-and-resetting-state
9. memo https://react.dev/reference/react/memo
10. Sharing State Between Components https://react.dev/learn/sharing-state-between-components
11. useContext https://react.dev/reference/react/useContext
12. Quick Start https://react.dev/learn
13. Reusing Logic with Custom Hooks https://react.dev/learn/reusing-logic-with-custom-hooks
14. Reacting to Input with State https://react.dev/learn/reacting-to-input-with-state
15. Updating Objects in State https://react.dev/learn/updating-objects-in-state
16. Component - React https://react.dev/reference/react/Component
