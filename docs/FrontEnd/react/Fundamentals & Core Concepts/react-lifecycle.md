---
title: React Lifecycle
sidebar_label: React Lifecycle
sidebar_position: 3
---

React lifecycle describes how a component is created, updated, and removed from the UI. In modern React function components, you usually manage lifecycle-related work with Hooks—especially `useEffect` and its cleanup function—rather than class lifecycle methods.[1][2]

## The lifecycle phases

A component’s lifetime has three main phases:

```text
Mount → Update (zero or more times) → Unmount
```

| Phase      | Meaning                                            | Typical reason                                      |
| ---------- | -------------------------------------------------- | --------------------------------------------------- |
| Mounting   | The component appears in the UI for the first time | A page loads or a condition becomes true            |
| Updating   | React calculates and commits a new UI result       | State, props, or consumed context changes           |
| Unmounting | The component is removed from the UI               | Navigation, conditional removal, or a changed `key` |

Class-component documentation identifies mounting, updating, and unmounting as the core lifecycle stages.[1][3]

```jsx
function App() {
  const [showProfile, setShowProfile] = useState(true);

  return (
    <>
      <button onClick={() => setShowProfile(!showProfile)}>
        Toggle profile
      </button>

      {showProfile && <Profile />}
    </>
  );
}
```

```text
showProfile = true   → <Profile /> mounts
showProfile changes  → App updates
showProfile = false  → <Profile /> unmounts
showProfile = true   → a new <Profile /> mounts
```

## Modern React lifecycle

Function components do not have methods such as `componentDidMount` or `componentWillUnmount`. Instead, React calls the component function to render, then Effects synchronize the component with systems outside React—such as APIs, timers, browser events, WebSockets, maps, or subscriptions.

```text
State / prop / context change
            |
            v
Render phase: React calls component functions
            |
            v
Commit phase: React applies needed DOM changes
            |
            v
Effect phase: useEffect runs after commit
```

The important rule is: **rendering is for calculating UI**; Effects are for interacting with external systems after React has committed the UI. A component may render more than once, and React can discard an in-progress render, so render logic must remain pure.[2][4]

## `useEffect` lifecycle

The most common lifecycle pattern uses `useEffect`:

```jsx
import { useEffect, useState } from "react";

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  return <p>{time.toLocaleTimeString()}</p>;
}
```

```text
Component mounts
   |
   +--> React commits <Clock /> to the DOM
   |
   +--> Effect starts interval
   |
Component updates each second
   |
   +--> React re-renders time display
   |
Component unmounts
   |
   +--> Cleanup clears interval
```

The empty dependency array, `[]`, means the Effect is associated with the component’s mount/unmount lifetime:

- Run the setup after the initial component commit.
- Run the cleanup when the component unmounts.
- In development with React Strict Mode, React may intentionally perform an extra setup/cleanup cycle to reveal unsafe Effects; code should remain correct under that behavior.

Timers should be cleared, event listeners removed, subscriptions unsubscribed, and external resources closed when a component no longer needs them. The classic lifecycle example similarly starts a timer when mounted and clears it at unmount.[2][5]

## Effects with dependencies

An Effect can synchronize with a changing value, such as an ID passed through props.

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createChatConnection(roomId);
    connection.connect();

    return () => {
      connection.disconnect();
    };
  }, [roomId]);

  return <h1>Chat room: {roomId}</h1>;
}
```

Lifecycle behavior:

```text
Mount with roomId = "general"
  → connect to "general"

roomId changes to "engineering"
  → disconnect from "general"
  → connect to "engineering"

Component unmounts
  → disconnect from current room
```

React runs cleanup **before** rerunning the Effect because a dependency changed, and also when the component unmounts. This prevents connections, subscriptions, or timers from accumulating.

| Dependency array | Effect behavior                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Omitted          | Runs after every committed render                                                         |
| `[]`             | Runs after mount; cleanup runs at unmount                                                 |
| `[roomId]`       | Runs after mount and whenever `roomId` changes; cleans up before rerunning and on unmount |

Use an Effect only when synchronizing with something outside React. You usually do **not** need one to derive display values from props/state, transform an array for rendering, or handle a user action; those belong in normal render logic or event handlers.

## Class lifecycle methods

You will still see class components in legacy React applications. Their lifecycle methods map roughly to the Hook patterns below.[1][2]

| Lifecycle stage                  | Class component             | Function component equivalent                               |
| -------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Initialize state                 | `constructor()`             | `useState(initialValue)`                                    |
| Calculate UI                     | `render()`                  | Function body returning JSX                                 |
| After first DOM commit           | `componentDidMount()`       | `useEffect(..., [])`                                        |
| After a prop/state update        | `componentDidUpdate()`      | `useEffect(..., [dependencies])`                            |
| Before removal                   | `componentWillUnmount()`    | Effect cleanup: `return () => { ... }`                      |
| Capture DOM info before a commit | `getSnapshotBeforeUpdate()` | Usually a ref plus `useLayoutEffect` for special cases      |
| Error handling                   | Error boundary methods      | Class-based Error Boundary, or a framework/library approach |

A typical legacy class component looks like this:

```jsx
class Clock extends React.Component {
  state = { time: new Date() };

  componentDidMount() {
    this.timerId = setInterval(() => {
      this.setState({ time: new Date() });
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerId);
  }

  render() {
    return <p>{this.state.time.toLocaleTimeString()}</p>;
  }
}
```

Class lifecycle order is broadly:

```text
Mount:
constructor → render → componentDidMount

Update:
render → componentDidUpdate

Unmount:
componentWillUnmount
```

There are additional, less frequently used methods such as `shouldComponentUpdate`, `getDerivedStateFromProps`, and `getSnapshotBeforeUpdate`.[1][3]

## Render vs lifecycle work

A frequent source of bugs is putting lifecycle work in the render body.

```jsx
// Incorrect: executes during rendering
function Dashboard() {
  fetch("/api/metrics");
  return <h1>Dashboard</h1>;
}
```

Why it is problematic:

- Every render can start another request.
- React may render but not commit.
- Rendering should not mutate external systems.
- The request has no cleanup or cancellation strategy.

Use an Effect with cancellation handling instead:

```jsx
import { useEffect, useState } from "react";

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMetrics() {
      try {
        const response = await fetch("/api/metrics", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load metrics");
        }

        setMetrics(await response.json());
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err);
        }
      }
    }

    loadMetrics();

    return () => controller.abort();
  }, []);

  if (error) return <p>Something went wrong.</p>;
  if (!metrics) return <p>Loading…</p>;

  return <p>Total users: {metrics.totalUsers}</p>;
}
```

## `useLayoutEffect` versus `useEffect`

Most work belongs in `useEffect`.

Use `useLayoutEffect` only when you must measure or synchronously adjust layout before the browser paints—for example, calculating a tooltip position from its rendered dimensions.

```jsx
useLayoutEffect(() => {
  const rect = tooltipRef.current.getBoundingClientRect();
  setPosition({ top: rect.bottom, left: rect.left });
}, []);
```

Because it runs before paint and can block visual updates, prefer `useEffect` unless pre-paint DOM measurement is truly needed.

## Lifecycle and keys

A component’s position and identity determine whether React preserves its state. Changing a component’s `key` tells React it is a different instance:

```jsx
function UserEditor({ user }) {
  return <Editor key={user.id} user={user} />;
}
```

When `user.id` changes:

```text
Old <Editor> unmounts
  → its Effect cleanups run

New <Editor> mounts
  → it gets fresh state
  → its Effects set up again
```

This is useful when changing to a different record should deliberately reset form state, local UI state, and external subscriptions.

## Practical checklist

- Keep component rendering pure: calculate JSX only.
- Put API subscriptions, timers, DOM listeners, analytics connections, and other external synchronization in Effects.
- Return cleanup for anything you start: `clearInterval`, `removeEventListener`, `unsubscribe`, `disconnect`, or `abort`.
- Include every reactive value used by an Effect in its dependency array, unless you restructure the code so it is no longer a dependency.
- Prefer event handlers for user-caused actions such as a button-triggered POST request.
- Avoid copying props into state unless you deliberately need an independently editable draft.
- Test both mounting and unmounting—especially navigation away, route changes, and conditional UI removal.

## Interview answer

> React lifecycle describes a component’s progression through mounting, updating, and unmounting. On mount, React renders the component, commits the needed DOM, and then Effects can synchronize with external systems. Updates happen when state, props, or consumed context changes; React re-renders, commits minimal DOM changes, then cleans up and reruns any Effects whose dependencies changed. On unmount, React runs Effect cleanup functions. In modern function components, `useEffect` plus its cleanup function replaces most class lifecycle use cases such as `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount`. I keep render pure and use Effects only for external work such as subscriptions, timers, API synchronization, and DOM event listeners.[1][2][4]

## Sources

1. React.Component https://legacy.reactjs.org/docs/react-component.html
2. State and Lifecycle - React https://legacy.reactjs.org/docs/state-and-lifecycle.html
3. React Lifecycle - W3Schools https://www.w3schools.com/react/react_lifecycle.asp
4. React Component Lifecycle: A Deep Dive for Beginners https://www.fullstackfoundations.com/blog/react-component-lifecycle
5. React Component Lifecycle | Web Development - CodePath Guides https://guides.codepath.org/webdev/React-Component-Lifecycle
6. The React Component Lifecycle - KIRUPA https://www.kirupa.com/react/component_lifecycle.htm
7. React Component Lifecycle: Methods and Hooks - Fireart Studio https://fireart.studio/blog/react-component-lifecycle-methods-and-hooks/
8. The React Lifecycle of a Functional Component - YouTube https://www.youtube.com/watch?v=Zz9pLellSQA
