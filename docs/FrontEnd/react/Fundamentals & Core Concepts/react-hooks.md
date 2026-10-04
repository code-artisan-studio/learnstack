---
title: React Hooks Basics
sidebar_label: React Hooks
sidebar_position: 4
---

React **Hooks** are functions that let function components use React features such as state, context, effects, refs, and performance optimizations. They replaced most everyday uses of class-component lifecycle methods and `this`, while keeping component logic composable and reusable.[1][2][3]

## What Hooks are

Before Hooks, state and lifecycle behavior were mainly associated with class components:

```jsx
class Counter extends React.Component {
  state = { count: 0 };

  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        {this.state.count}
      </button>
    );
  }
}
```

With Hooks, the same component can be a function:

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

A Hook usually starts with `use`, such as `useState`, `useEffect`, or `useContext`. React uses the order in which Hooks are called to associate each Hook with the correct component instance and its stored data.

```text
Function component
     |
     +--> useState: local UI memory
     +--> useEffect: external-system synchronization
     +--> useContext: shared data
     +--> useRef: mutable value / DOM reference
     +--> useMemo/useCallback: optional performance cache
```

## Rules of Hooks

Hooks must be called:

- At the **top level** of a React function component.
- At the top level of a custom Hook.
- In the same order on every render.[1][2][4]

Do **not** call Hooks inside loops, conditions, nested functions, event handlers, or class components.

```jsx
// Incorrect: Hook runs conditionally
function Profile({ isLoggedIn }) {
  if (isLoggedIn) {
    const [profile, setProfile] = useState(null);
  }

  return <h1>Profile</h1>;
}
```

```jsx
// Correct: Hook always runs
function Profile({ isLoggedIn }) {
  const [profile, setProfile] = useState(null);

  if (!isLoggedIn) {
    return <p>Please sign in.</p>;
  }

  return <h1>{profile?.name ?? "Loading..."}</h1>;
}
```

The dependency array for Hooks such as `useEffect`, `useMemo`, and `useCallback` must include the reactive values—props, state, and values created in the component body—that the Hook uses.[2][4][5]

## State Hooks

### `useState`

`useState` adds local component state. It returns the current value and a setter that requests an update and re-render.[3]

```jsx
import { useState } from "react";

function QuantitySelector() {
  const [quantity, setQuantity] = useState(1);

  function addOne() {
    setQuantity((currentQuantity) => currentQuantity + 1);
  }

  return (
    <>
      <p>Quantity: {quantity}</p>
      <button onClick={addOne}>Add one</button>
    </>
  );
}
```

```text
const [quantity, setQuantity] = useState(1)
       |            |                  |
       |            |                  └─ initial value, first render only
       |            └─ setter that schedules a re-render
       └─ current state value
```

Use `useState` for simple local UI values:

- Form input values.
- Whether a modal, menu, or accordion is open.
- Selected tab/filter/sort option.
- Loading/error/success status.
- Small independent pieces of UI state.

When the next value depends on the old value, prefer the updater form:

```jsx
setQuantity((previousQuantity) => previousQuantity + 1);
```

This is safer when React batches multiple updates.

### `useReducer`

`useReducer` manages state using a reducer function and explicit action objects. It is similar to `useState`, but moves update rules out of event handlers into one predictable function. React defines the reducer as a pure function that receives the current state and action and returns the next state.[1][6]

```jsx
import { useReducer } from "react";

function cartReducer(state, action) {
  switch (action.type) {
    case "add":
      return {
        ...state,
        quantity: state.quantity + 1,
      };

    case "remove":
      return {
        ...state,
        quantity: Math.max(0, state.quantity - 1),
      };

    case "reset":
      return { quantity: 0 };

    default:
      return state;
  }
}

function CartCounter() {
  const [state, dispatch] = useReducer(cartReducer, {
    quantity: 0,
  });

  return (
    <>
      <p>Items: {state.quantity}</p>
      <button onClick={() => dispatch({ type: "add" })}>Add</button>
      <button onClick={() => dispatch({ type: "remove" })}>Remove</button>
      <button onClick={() => dispatch({ type: "reset" })}>Reset</button>
    </>
  );
}
```

```text
User event
   |
   v
dispatch({ type: "add" })
   |
   v
reducer(currentState, action)
   |
   v
new state
   |
   v
React re-renders
```

Use `useReducer` when:

- State has several related fields.
- There are many possible transitions/actions.
- Multiple handlers update the same state.
- You want update logic to be explicit, testable, and centralized.
- `useState` setters are making a component difficult to follow.

## Context Hook

### `useContext`

`useContext` reads and subscribes to data provided by the closest matching Context Provider above the component in the tree. When the Provider’s value changes, React re-renders components that consume that context.[7]

```jsx
import { createContext, useContext } from "react";

const ThemeContext = createContext("light");

function ThemeButton() {
  const theme = useContext(ThemeContext);

  return <button className={theme}>Save</button>;
}

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <ThemeButton />
    </ThemeContext.Provider>
  );
}
```

```text
<App>
  └─ ThemeContext.Provider value="dark"
       └─ <ThemeButton>
            └─ useContext(ThemeContext) → "dark"
```

Use context for data that many components at different depths need, such as:

- Current theme.
- Authenticated user/session.
- Locale and translation settings.
- Feature flags.
- Shared application configuration.

Avoid using context as a replacement for all state. A frequently changing, large context value can cause broad re-rendering among its consumers. For complex shared state, it is common to pair `useReducer` with Context or use a specialized state-management approach.

## Ref Hooks

### `useRef`

`useRef` stores a value that survives re-renders but does **not** trigger a re-render when changed. React describes it as a way to reference a value not needed for rendering.[8]

```jsx
import { useRef } from "react";

function SearchBox() {
  const inputRef = useRef(null);

  function focusSearch() {
    inputRef.current.focus();
  }

  return (
    <>
      <input ref={inputRef} placeholder="Search" />
      <button onClick={focusSearch}>Focus search</button>
    </>
  );
}
```

React assigns the input’s actual DOM node to `inputRef.current` after it renders.

```text
<input ref={inputRef} />
          |
          v
inputRef.current → HTMLInputElement
```

Other good `useRef` uses:

- Timer or interval IDs.
- WebSocket or third-party-library instances.
- The previous value of something.
- An `AbortController`.
- A mutable flag that should not appear in the UI.

Do not use a ref for data that must be shown on screen. Use state instead:

```jsx
// Wrong for visible UI: changing this does not re-render
const countRef = useRef(0);

// Right when the UI should change
const [count, setCount] = useState(0);
```

### `useImperativeHandle`

`useImperativeHandle` is an advanced ref-related Hook used with `ref` forwarding to expose a small custom imperative API from a child component.

```jsx
import { forwardRef, useImperativeHandle, useRef } from "react";

const SearchInput = forwardRef(function SearchInput(props, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current.focus();
    },
  }));

  return <input ref={inputRef} {...props} />;
});
```

Use it sparingly. Prefer props and declarative state flow when possible; expose imperative methods only for actions like `focus()`, `scrollIntoView()`, or integration with imperative UI libraries.

## Effect Hooks

Effects synchronize React with things outside React: browser APIs, timers, network connections, DOM listeners, subscriptions, analytics SDKs, maps, and third-party widgets.[2]

### `useEffect`

`useEffect` runs after React commits UI to the DOM. It may return a cleanup function. When dependencies change, React runs the prior cleanup and then the new setup; cleanup also runs when the component unmounts.[2]

```jsx
import { useEffect, useState } from "react";

function WindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <p>Viewport width: {width}px</p>;
}
```

```text
Mount
  → React updates DOM
  → Effect adds event listener

Unmount
  → Cleanup removes listener
```

Dependency behavior:

| Dependency list | Behavior                                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| Omitted         | Effect runs after every committed render                                            |
| `[]`            | Runs after initial mount; cleanup runs on unmount                                   |
| `[userId]`      | Runs after mount and whenever `userId` changes; cleanup occurs before the new setup |

Use `useEffect` for external synchronization—not merely to calculate values that can be derived during render.

```jsx
// Avoid an unnecessary Effect
const fullName = `${firstName} ${lastName}`;
```

### `useLayoutEffect`

`useLayoutEffect` is like `useEffect`, but it runs after DOM changes and **before the browser repaints**. It is useful for layout measurement or preventing visual flicker.[9]

```jsx
import { useLayoutEffect, useRef, useState } from "react";

function Tooltip() {
  const tooltipRef = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    setHeight(tooltipRef.current.getBoundingClientRect().height);
  }, []);

  return (
    <div ref={tooltipRef} style={{ top: -height }}>
      Helpful text
    </div>
  );
}
```

Use it only where pre-paint measurement is necessary. It can delay painting, so `useEffect` is the normal default.[9]

### `useInsertionEffect`

`useInsertionEffect` is a specialized Hook mainly for CSS-in-JS library authors. It runs before layout Effects so libraries can insert styles before layout measurement occurs. Application code almost never needs it.

### `useEffectEvent`

`useEffectEvent` lets you separate event-like logic from Effects. It is intended for code called from an Effect that needs access to the latest props/state without causing the Effect itself to resubscribe every time those values change. It must be called at the top level, and the returned Effect Event should only be invoked from Effects or other Effect Events—not render code or normal UI event handlers.[10]

```jsx
import { useEffect, useEffectEvent } from "react";

function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification("Connected!", theme);
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on("connected", onConnected);
    connection.connect();

    return () => connection.disconnect();
  }, [roomId]);

  return <h1>Room: {roomId}</h1>;
}
```

Here, changing `theme` updates the notification behavior without unnecessarily reconnecting the chat room.

## Performance Hooks

These Hooks are optimizations, not default requirements. First write correct, readable code and measure whether a performance issue exists.

### `useMemo`

`useMemo` caches the **result of a calculation** between renders until one of its dependencies changes. Its calculation should be pure.[5]

```jsx
import { useMemo } from "react";

function ProductList({ products, query }) {
  const visibleProducts = useMemo(() => {
    return products.filter((product) =>
      product.name.toLowerCase().includes(query.toLowerCase()),
    );
  }, [products, query]);

  return (
    <ul>
      {visibleProducts.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

Use `useMemo` when:

- A calculation is meaningfully expensive.
- You need stable object/array identity for another memoized component or Hook dependency.
- Profiling identifies avoidable repeated work.

Do not use it for trivial calculations:

```jsx
const total = price * quantity;
```

### `useCallback`

`useCallback` caches a **function identity** between renders until dependencies change. It returns the function; it does not call it.[4]

```jsx
import { useCallback, useState } from "react";

function TodoApp() {
  const [todos, setTodos] = useState([]);

  const addTodo = useCallback((text) => {
    setTodos((currentTodos) => [
      ...currentTodos,
      { id: crypto.randomUUID(), text },
    ]);
  }, []);

  return <TodoForm onAdd={addTodo} />;
}
```

It is useful when:

- Passing a callback to a memoized child component using `React.memo`.
- A function appears in an Effect dependency list and needs stable identity.
- A custom Hook requires stable callbacks.

```text
useMemo     → caches a computed value
useCallback → caches a function definition
```

Conceptually:

```jsx
useCallback(fn, dependencies);
```

is similar to:

```jsx
useMemo(() => fn, dependencies);
```

### `useTransition`

`useTransition` marks some state updates as non-urgent “Transitions.” Use it when a user action should remain responsive while React prepares a potentially expensive UI update, such as filtering a huge list after typing.

```jsx
import { useState, useTransition } from "react";

function SearchPage({ products }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleChange(event) {
    const nextQuery = event.target.value;
    setQuery(nextQuery);

    startTransition(() => {
      setFilter(nextQuery);
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <p>Updating results…</p>}
      <ProductList products={products} query={filter} />
    </>
  );
}
```

### `useDeferredValue`

`useDeferredValue` lets a non-urgent value lag behind a frequently changing value. It is useful when an input should update immediately but a slow derived view can update shortly afterward.

```jsx
import { useDeferredValue, useState } from "react";

function SearchPage({ products }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ProductList products={products} query={deferredQuery} />
    </>
  );
}
```

Use it for rendering responsiveness, not as a request debounce mechanism.

## Custom Hooks

A **custom Hook** is a reusable function whose name starts with `use` and that calls other Hooks. It shares stateful logic, not state itself: each component that calls a custom Hook gets its own independent Hook state.[1]

```jsx
import { useEffect, useState } from "react";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }

    function goOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

function SaveButton() {
  const isOnline = useOnlineStatus();

  return <button disabled={!isOnline}>{isOnline ? "Save" : "Offline"}</button>;
}
```

```text
<Component A> → useOnlineStatus() → its own Hook state
<Component B> → useOnlineStatus() → its own Hook state
```

Custom Hooks are ideal for reusable concerns such as authentication, form fields, media queries, debouncing, browser storage, data fetching conventions, and subscriptions.

## Less common built-ins

React also provides specialized Hooks for particular situations:

| Hook                   | Typical use                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `useId`                | Generate stable IDs for accessibility relationships, such as a label and input |
| `useSyncExternalStore` | Subscribe safely to external stores outside React                              |
| `useDebugValue`        | Add labels for custom Hooks in React DevTools                                  |
| `useImperativeHandle`  | Customize a ref API exposed by a component                                     |
| `useActionState`       | Track state from Actions, commonly form submissions                            |
| `useOptimistic`        | Show an immediate optimistic UI while an Action is pending                     |
| `use`                  | Read a Promise or Context in supported React rendering patterns                |
| `useFormStatus`        | Read pending form-submission status within a form subtree                      |

These are valuable in specific architectures, but most React components begin with `useState`, `useEffect`, `useContext`, and `useRef`.

## Choosing the right Hook

| Need                                                             | Prefer                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| Store a simple UI value that changes                             | `useState`                            |
| Manage complex, action-driven state                              | `useReducer`                          |
| Share a value down many levels                                   | `useContext`                          |
| Store a DOM node, timer ID, or mutable non-UI value              | `useRef`                              |
| Connect to API, timer, listener, subscription, map, or WebSocket | `useEffect`                           |
| Measure DOM layout before paint                                  | `useLayoutEffect`                     |
| Cache an expensive calculation                                   | `useMemo`                             |
| Keep callback identity stable                                    | `useCallback`                         |
| Keep typing/clicking responsive during slow updates              | `useTransition` or `useDeferredValue` |
| Reuse stateful behavior across components                        | Custom Hook                           |

## Practical guidance

- Start with normal JavaScript, `useState`, and props.
- Use `useEffect` only for external synchronization; do not use it simply to derive a value from state/props.
- Always clean up subscriptions, listeners, timers, connections, and in-flight requests when appropriate.
- Use `useReducer` when state transitions are complex enough that many separate setters hide the logic.
- Use Context for broadly needed data, but keep its value focused and stable where possible.
- Treat `useMemo` and `useCallback` as measured optimizations, not boilerplate.
- Use a custom Hook when repeated components share behavior or side-effect logic—not merely because code can be extracted.

## Interview answer

> Hooks are functions that let function components use React features such as state, effects, context, refs, and concurrency without class components. The core Hooks are `useState` for local state, `useEffect` for synchronizing with external systems, `useContext` for consuming shared context, `useRef` for mutable values or DOM references that should not trigger renders, and `useReducer` for complex state transitions. `useMemo` caches computed values and `useCallback` caches function identities, usually as performance optimizations. React Hooks must be called only at the top level of a function component or custom Hook, never conditionally or inside loops, so React can preserve Hook state by call order.[1][2][3][4][6][7][8]

## Sources

1. Built-in React Hooks https://react.dev/reference/react/hooks
2. useEffect https://react.dev/reference/react/useEffect
3. useState https://react.dev/reference/react/useState
4. useCallback https://react.dev/reference/react/useCallback
5. useMemo https://react.dev/reference/react/useMemo
6. useReducer https://react.dev/reference/react/useReducer
7. useContext https://react.dev/reference/react/useContext
8. useRef https://react.dev/reference/react/useRef
9. useLayoutEffect https://react.dev/reference/react/useLayoutEffect
10. useEffectEvent https://react.dev/reference/react/useEffectEvent
