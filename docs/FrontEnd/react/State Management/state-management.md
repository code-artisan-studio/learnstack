---
title: State Management Fundamentals
sidebar_label: State Management
sidebar_position: 1
---

State management in React is the practice of deciding **what data can change**, **who owns it**, and **how updates propagate through the component tree**. Start with local `useState`, lift state only to the nearest common parent when components must coordinate, then use `useReducer` and Context for more complex shared state.[1][2]

## Overview

React components receive **props** from their parents, but props alone do not let a component remember changing information. **State** is React’s mechanism for a component to retain values between renders, such as form input, selected items, loading status, fetched data, or whether a modal is open.[2][3]

```text
User clicks "Add"
      |
      v
Event handler calls a state setter
      |
      v
React schedules a re-render
      |
      v
Component reads the new state
      |
      v
UI updates
```

The key architectural decision is not “which global state library should I install?” It is: **where should this particular state live?**

## Key terms

| Term              | Meaning                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **State**         | Data React remembers between renders that can influence the UI. [3][2]                                                         |
| **Props**         | Read-only inputs passed from a parent component to a child component.                                                          |
| **Render**        | React calling component functions to calculate the UI for the current props, state, and context.                               |
| **Re-render**     | A new render triggered when relevant state, props, or context changes.                                                         |
| **Local state**   | State owned by one component, usually with `useState`.                                                                         |
| **Lifted state**  | State moved to the nearest common parent so sibling components can share it. [4]                                               |
| **Reducer**       | A function that calculates next state from current state and an action. [5]                                                    |
| **Context**       | A way to make a value available to descendant components without manually passing it through every intermediate component. [6] |
| **Server state**  | Data owned by a remote system, such as API results, session data, account balances, or claim records.                          |
| **Derived state** | A value calculated from existing state or props rather than stored independently.                                              |

## State versus props

```text
Parent component
 ├── owns state: selectedProductId
 └── passes prop: selectedProductId
       |
       v
Child component
 └── reads the value and sends events upward
```

A parent owns data and passes it down through props. A child should not mutate a prop directly; instead, it calls a callback provided by the parent, and the parent updates its own state.

```jsx
// Illustrative example — Parent owns the state
import { useState } from "react";

function ProductSelector() {
  const [selectedProductId, setSelectedProductId] = useState(null);

  return (
    <>
      <ProductList
        selectedProductId={selectedProductId}
        onSelect={setSelectedProductId}
      />
      <ProductPreview productId={selectedProductId} />
    </>
  );
}

function ProductList({ selectedProductId, onSelect }) {
  return (
    <button
      aria-pressed={selectedProductId === "P-100"}
      onClick={() => onSelect("P-100")}
    >
      Select product P-100
    </button>
  );
}
```

This produces a predictable one-way flow: **state flows down as props; events flow up through callbacks**.

## useState fundamentals

`useState` is the default Hook for component-local state. It returns the current value and a setter that updates the value and triggers a re-render. Hooks must be called at the top level of a React function component or custom Hook.[7][2]

```jsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  function increment() {
    setCount(count + 1);
  }

  return (
    <>
      <p>Count: {count}</p>
      <button onClick={increment}>Increase</button>
    </>
  );
}
```

React gives each component instance its own state. Rendering two `Counter` components creates two independent `count` values.

## Update from previous state

When the next state depends on the previous state, use the updater-function form:

```jsx
setCount((previousCount) => previousCount + 1);
```

```jsx
function addThree() {
  setCount((count) => count + 1);
  setCount((count) => count + 1);
  setCount((count) => count + 1);
}
```

This avoids errors caused by relying on a stale value captured by an earlier render.

```jsx
// Risky when multiple updates occur together
setCount(count + 1);
setCount(count + 1);
setCount(count + 1);
```

React state updates schedule a future render; they do not synchronously rewrite the current render’s local variables. Treat state as a snapshot for the duration of the current render.

## Immutability

Do not mutate state objects or arrays in place. Create a new object or array so React can reliably identify the update and your code remains easier to reason about.

```jsx
// Incorrect: mutates the existing object
profile.name = "Avery";
setProfile(profile);
```

```jsx
// Correct: creates a new object
setProfile((previousProfile) => ({
  ...previousProfile,
  name: "Avery",
}));
```

```jsx
// Correct: creates a new array
setTasks((previousTasks) => [
  ...previousTasks,
  { id: "T-104", title: "Review deployment" },
]);
```

Immutability also makes reducers, undo/redo patterns, change detection, and debugging more reliable.

## State ownership

A useful decision rule is: **put state as close as possible to the components that need it, but no lower**. React guidance recommends preferring local state and not lifting it further up the tree than necessary.[8]

```text
Need only one component?
  -> Keep it local.

Need two sibling components?
  -> Lift it to their nearest common parent.

Need many distant descendants?
  -> Consider Context.

Need complex transitions and many related fields?
  -> Consider useReducer.

Need remote/API data?
  -> Use a server-state strategy, not just a global client store.
```

## Lifting state up

When two components must always agree, remove duplicate local state and place one authoritative value in their closest shared parent. React calls this **lifting state up**.[4][1]

```jsx
// Illustrative example — parent owns shared expanded panel
import { useState } from "react";

function Accordion() {
  const [openPanelId, setOpenPanelId] = useState(null);

  return (
    <>
      <Panel
        title="Account summary"
        isOpen={openPanelId === "summary"}
        onToggle={() =>
          setOpenPanelId((id) => (id === "summary" ? null : "summary"))
        }
      />

      <Panel
        title="Recent transactions"
        isOpen={openPanelId === "transactions"}
        onToggle={() =>
          setOpenPanelId((id) =>
            id === "transactions" ? null : "transactions",
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
      {isOpen && <p>Panel content</p>}
    </section>
  );
}
```

There is one source of truth: `openPanelId`. This prevents impossible states such as two accordion panels being open when the product rule permits only one.

## Avoid redundant state

Do not store values that can be calculated from props or existing state. React identifies avoiding redundant or duplicated state as a central state-management principle.[1]

```jsx
// Avoid: total duplicates information already in cartItems
const [cartItems, setCartItems] = useState([]);
const [total, setTotal] = useState(0);
```

```jsx
// Prefer: derive total during render
const [cartItems, setCartItems] = useState([]);

const total = cartItems.reduce(
  (sum, item) => sum + item.price * item.quantity,
  0,
);
```

Store `total` separately only if there is a specific, measured reason and you clearly manage cache invalidation. Duplicate state can drift:

```text
Cart quantity changes
      |
      +--> cartItems updated
      |
      └--> total accidentally not updated
             |
             v
          Incorrect UI
```

## useReducer

Use `useReducer` when a component’s state has several related fields, many transitions, or business rules that are becoming hard to follow in several `useState` setters. `useReducer` moves state-update logic out of event handlers into one reducer function.[5][9]

```jsx
// Illustrative example — reducer-based workflow state
import { useReducer } from "react";

const initialState = {
  status: "idle",
  amount: "",
  error: null,
};

function transferReducer(state, action) {
  switch (action.type) {
    case "amountChanged":
      return { ...state, amount: action.amount };

    case "submitted":
      return { ...state, status: "submitting", error: null };

    case "succeeded":
      return { ...state, status: "success" };

    case "failed":
      return { ...state, status: "error", error: action.message };

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export default function TransferForm() {
  const [state, dispatch] = useReducer(transferReducer, initialState);

  function handleSubmit(event) {
    event.preventDefault();
    dispatch({ type: "submitted" });

    // Illustrative asynchronous result.
    dispatch({ type: "succeeded" });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={state.amount}
        onChange={(event) =>
          dispatch({ type: "amountChanged", amount: event.target.value })
        }
      />
      <button disabled={state.status === "submitting"}>Submit transfer</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

A reducer receives the current state and an action object, then returns the next state. `useReducer` returns the current state and a `dispatch` function.[5]

## Context

Context avoids **prop drilling**: passing the same value through components that do not use it merely so a deep descendant can access it. `useContext` reads the value from the closest matching provider above the calling component.[6][10]

```jsx
// Illustrative example — ThemeContext.jsx
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  const value = { theme, setTheme };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
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

```jsx
// Illustrative example — deep child
import { useTheme } from "./ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      Current theme: {theme}
    </button>
  );
}
```

Good context candidates include app theme, locale, authenticated-user summary, feature flags, dependency services, and narrow shared workflow state. Context distributes a value; it is not automatically a complete state-management architecture.

## Reducer plus Context

Combining reducer and context works well for a complex feature area whose state is shared among several deep components. React documents this as a common scaling approach.[10][11]

```text
ClaimsProvider
  |
  +-- useReducer owns claim-workflow state
  |
  +-- Context exposes state and dispatch
       |
       +-- ClaimHeader reads status
       +-- DocumentUploader dispatches attachment action
       +-- ApprovalPanel dispatches approval action
```

A useful performance pattern is to provide state and dispatch separately. Components that only dispatch actions do not need to re-render merely because state changed. React’s scaling guidance demonstrates separate contexts for state and dispatch.[11]

## Client state versus server state

This distinction prevents many architecture problems.

| Category                    | Examples                                                   | Typical owner                                           |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| **Local UI state**          | Modal open/closed, input text, hovered item                | Component                                               |
| **Shared UI state**         | Sidebar collapsed, active multi-step workflow state        | Common parent, Context, or feature store                |
| **URL state**               | Selected account ID, page, sort, filters, active route tab | React Router / URL                                      |
| **Server state**            | Accounts, claim records, holdings, permissions from APIs   | Backend; client caches a fetched representation         |
| **Persistent client state** | Theme preference, draft recovery preference                | Browser storage, with careful validation and versioning |

For example, `/accounts/ACC-1001/transactions?page=2` belongs in URL state because it is shareable and bookmarkable. A dropdown’s open state should generally remain local. An account balance belongs to the bank’s backend, not a React global store.

## State lifecycle and rendering

```text
Initial render
  -> useState supplies initial value
  -> component returns UI

User/API event
  -> event handler calls setState or dispatch

React update scheduling
  -> React calculates a new render from new state
  -> React reconciles UI changes into the DOM

Unmount
  -> component-local state is discarded
```

Component-local state is associated with a component’s position in the rendered tree. When a component unmounts—often during conditional rendering or route changes—its local state is normally lost. Preserve only the state that needs to survive by lifting it, using URL state, or persisting it intentionally.

## Practical example

A claim submission screen needs several kinds of state, each owned in a suitable place:

```text
Claim ID              -> URL: /claims/:claimId
Active screen         -> Nested route or query parameter
Attachment picker open -> Local component state
Draft form fields     -> Feature-level useReducer
Current claim record  -> Server state from API
Authenticated user    -> Auth provider/context summary
```

```jsx
// Illustrative example — local state plus derived state
import { useMemo, useState } from "react";

export default function ClaimDocuments({ documents }) {
  const [query, setQuery] = useState("");

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return documents.filter((document) =>
      document.name.toLowerCase().includes(normalizedQuery),
    );
  }, [documents, query]);

  return (
    <>
      <label>
        Search documents
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <p>{filteredDocuments.length} matching documents</p>
    </>
  );
}
```

`query` is local state because only this screen needs it. `filteredDocuments` is derived, so it should not become another independent state variable.

## When to use what

| Situation                                               | First choice                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| One component needs changing data                       | `useState`                                                      |
| New value depends on prior value                        | Functional setter, such as `setCount(previous => previous + 1)` |
| Siblings must coordinate                                | Lift state to the nearest common parent                         |
| Complex feature state and many action types             | `useReducer`                                                    |
| Deep descendants need a shared, relatively stable value | Context                                                         |
| Complex shared feature state across deep descendants    | `useReducer` plus Context                                       |
| Data comes from an API or backend                       | Server-state query/cache approach                               |
| State must appear in a shareable URL                    | Route params or query parameters                                |
| State must survive application restarts                 | Backend or carefully designed browser persistence               |

## Trade-offs

- **Local state is simple and isolated**, but it becomes awkward when many distant components need it.
- **Lifting state up coordinates siblings**, but lifting too high creates unnecessary re-renders and turns parents into large orchestration components.
- **Context prevents prop drilling**, but large frequently changing context values can cause many consumers to re-render; split contexts by concern and keep provider values focused.[6][8]
- **Reducers centralize transitions**, improving testability and clarity, but can be excessive for a simple boolean or input field.[9][5]
- **Global state libraries can help at scale**, but adding one too early increases indirection, debugging surface, and coupling.
- **Server state is not truly owned by the browser**; cache it, invalidate or revalidate it, handle loading/error states, and do not assume a client store is always current.
- **Sensitive data should not be trusted simply because it is in client state**. Frontend state is observable and modifiable by the user; backend systems must enforce authorization and validate all operations.

## Common mistakes

- Storing duplicate values instead of deriving them.[1]
- Mutating objects or arrays in place rather than creating new values.
- Putting every input, modal, or hover state into global context.
- Lifting state to the root application component “just in case.”
- Treating Context as a secure store for secrets or authorization.
- Using `useEffect` to synchronize state that could be calculated during render.
- Calling Hooks inside conditions, loops, nested functions, or event handlers. Hooks must be called at the top level of a component or custom Hook.[7]
- Mixing server data, URL state, and transient UI state in one unstructured global object.

## Interview answer — 2-minute version

State management in React is about placing mutable data at the correct ownership level and keeping one source of truth. I start with `useState` for local UI concerns, such as form inputs or modal visibility. When sibling components need to stay synchronized, I lift that state to their nearest common parent and pass values down with props and events back through callbacks. React describes this as lifting state up.[4][1]

When a feature has many related transitions, I use `useReducer` to centralize update rules as actions and state transitions. When many deep descendants need access, I distribute state with Context; for complex feature areas, reducer plus Context is a practical built-in approach.[9][11][6]

I avoid duplicate state and keep data close to where it is used. I also distinguish local UI state, URL state, and server state: route identifiers and filters belong in the URL when they should be shareable, while remote data remains backend-owned and requires loading, error, caching, and revalidation strategies.

## Hands-on exercise

Build a small **Expense Review** interface:

```text
ExpenseReviewPage
├── ExpenseFilter
├── ExpenseList
├── ExpenseSummary
└── ApprovalPanel
```

1. Use `useState` for a filter text field inside `ExpenseFilter`.
2. Lift `selectedExpenseId` to `ExpenseReviewPage` so `ExpenseList` can select an item and `ApprovalPanel` can display the same selected item.
3. Derive the total pending amount from the expenses array; do not store it separately.
4. Replace multiple approval-related `useState` fields—such as `status`, `comment`, and `error`—with `useReducer`.
5. Optionally create a narrow `ExpenseReviewContext` if deeply nested approval components need the selected expense and dispatch function.

**Expected outcome:** Selecting an expense updates both the list and approval panel; the summary always remains accurate because it is derived; approval actions follow explicit reducer transitions.

**Failure symptom:** The list highlights one expense but the panel displays another.  
**Diagnostic hint:** Find duplicate `selectedExpenseId` state and keep one authoritative copy in the nearest shared parent.

**Failure symptom:** The total does not change after a quantity or amount update.  
**Diagnostic hint:** Remove separately stored total state and compute the total from the current expense array during render.

## Sources

1. Managing State https://react.dev/learn/managing-state
2. useState https://react.dev/reference/react/useState
3. Built-in React Hooks https://hu.react.dev/reference/react
4. Sharing State Between Components https://react.dev/learn/sharing-state-between-components
5. Reducer Function https://react.dev/learn/extracting-state-logic-into-a-reducer
6. useContext https://react.dev/reference/react/useContext
7. Rules of Hooks https://react.dev/reference/rules/rules-of-hooks
8. memo https://react.dev/reference/react/memo
9. useReducer – React https://react.dev/reference/react/useReducer
10. Passing Data Deeply with Context https://react.dev/learn/passing-data-deeply-with-context
11. Scaling Up with Reducer and Context https://react.dev/learn/scaling-up-with-reducer-and-context
12. إدارة الحالة https://ar.react.dev/learn/managing-state
13. Mengelola State https://id.react.dev/learn/managing-state
14. use https://react.dev/reference/react/use
15. React Reference Overview https://react.dev/reference/react
