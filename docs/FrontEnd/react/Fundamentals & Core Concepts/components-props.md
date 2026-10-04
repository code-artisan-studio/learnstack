---
title: Components, Props & State
sidebar_label: Components,Props,State
sidebar_position: 2
---

React applications are built from **components**—reusable functions that return UI. **Props** are inputs a parent passes into a component, while **state** is data the component retains and updates over time; a state update tells React to render again.[1][2]

## The three concepts

```text
Component = reusable UI unit
Props     = input from a parent
State     = component-owned memory
```

A useful function analogy is:

```text
UI = Component(props, state)
```

For the same props and state, a component should return the same UI description. That is why React components should be pure with respect to their props: they should not change values they receive.[1]

| Concept   | Controlled by              | Can it change?                       | Main purpose                                |
| --------- | -------------------------- | ------------------------------------ | ------------------------------------------- |
| Component | Developer composing the UI | Its output changes with inputs/state | Encapsulate reusable UI and logic           |
| Props     | Parent component           | Parent can pass different values     | Configure a child / pass data and callbacks |
| State     | Component that owns it     | Yes, through a setter                | Remember changing UI data across renders    |

[1][2][3]

## Components

A component is typically a JavaScript function with a capitalized name that returns JSX.

```jsx
function Welcome() {
  return <h1>Welcome to the app</h1>;
}
```

Use it like a custom HTML tag:

```jsx
function App() {
  return (
    <main>
      <Welcome />
    </main>
  );
}
```

Components let you divide a page into focused, independent pieces—such as `Header`, `Sidebar`, `ProductCard`, `SearchBox`, and `CheckoutForm`—rather than writing one large component for the entire page. React describes components as reusable UI pieces that can be considered in isolation.[1]

```text
<App />
  ├── <Header />
  ├── <Sidebar />
  ├── <ProductList />
  │     ├── <ProductCard />
  │     ├── <ProductCard />
  │     └── <ProductCard />
  └── <Footer />
```

A component can contain:

- JSX markup.
- JavaScript logic.
- Props received from its parent.
- State that belongs to that component.
- Event handlers such as `onClick` or `onChange`.
- Effects for work outside React, such as network requests or subscriptions.

## Props

“Props” is short for **properties**. They are values passed from a parent to a child through JSX attributes, much like function arguments.[1][3]

```jsx
function UserCard(props) {
  return (
    <article>
      <h2>{props.name}</h2>
      <p>{props.role}</p>
    </article>
  );
}

function App() {
  return <UserCard name="Ava Chen" role="Administrator" />;
}
```

More commonly, destructure props in the function parameter:

```jsx
function UserCard({ name, role }) {
  return (
    <article>
      <h2>{name}</h2>
      <p>{role}</p>
    </article>
  );
}
```

The parent owns the values:

```jsx
function App() {
  const currentUser = {
    name: "Ava Chen",
    role: "Administrator",
  };

  return <UserCard name={currentUser.name} role={currentUser.role} />;
}
```

### Props are read-only

A child should never mutate its props.

```jsx
// Incorrect: mutating an object received through props
function ProductCard({ product }) {
  product.price = 0;
  return <p>{product.price}</p>;
}
```

Instead, ask the parent to change the data by invoking a callback prop:

```jsx
function ProductCard({ product, onDiscount }) {
  return (
    <article>
      <h2>{product.name}</h2>
      <button onClick={() => onDiscount(product.id)}>Apply discount</button>
    </article>
  );
}
```

```jsx
function App() {
  function handleDiscount(productId) {
    // Update state owned by App here
  }

  return <ProductCard product={product} onDiscount={handleDiscount} />;
}
```

This reflects React’s normal one-way data flow:

```text
Parent state
    |
    | props flow down
    v
Child component
    |
    | callback / event flows up
    v
Parent updates state
```

React’s documentation emphasizes that components must not modify their own props.[1]

## State

State is a component’s memory: information that must persist across renders and may change due to user actions, network responses, timers, or other events.[2]

In modern function components, add state with the `useState` Hook:

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <section>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </section>
  );
}
```

```text
const [count, setCount] = useState(0)
       |       |                  |
       |       |                  └─ initial value, used on first render
       |       └─ function that requests a state update
       └─ current state value
```

`useState` gives you two things:

1. A state variable that preserves a value between renders.
2. A setter function that updates that value and triggers React to render again.[2]

### Do not mutate state directly

This will not reliably update the screen:

```jsx
function Counter() {
  let count = 0;

  function increment() {
    count = count + 1;
  }

  return <button onClick={increment}>{count}</button>;
}
```

`count` is only a normal local variable. Every render starts the function again, so it does not persist as component memory.

Also avoid directly changing an object or array held in state:

```jsx
// Incorrect
user.name = "Sam";
setUser(user);
```

Create a new value instead:

```jsx
// Correct
setUser((previousUser) => ({
  ...previousUser,
  name: "Sam",
}));
```

```jsx
// Correct array update
setTodos((previousTodos) => [
  ...previousTodos,
  { id: crypto.randomUUID(), text: "Review pull request" },
]);
```

## Props versus state

Consider a reusable `Counter` component:

```jsx
import { useState } from "react";

function Counter({ label, initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  return (
    <section>
      <h2>{label}</h2>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>Add one</button>
    </section>
  );
}

function App() {
  return (
    <>
      <Counter label="Cart items" initialCount={2} />
      <Counter label="Notifications" initialCount={5} />
    </>
  );
}
```

Here:

| Value          | Type         | Why                                                |
| -------------- | ------------ | -------------------------------------------------- |
| `label`        | Prop         | The parent configures the text to display          |
| `initialCount` | Prop         | The parent supplies the initial setup value        |
| `count`        | State        | Each `Counter` remembers and changes its own count |
| `setCount`     | State setter | It requests the update and re-render               |

The two counters share the same component definition but have separate state because each rendered component instance has its own memory.

```text
<Counter label="Cart items" initialCount={2} />
  └─ own state: count = 2

<Counter label="Notifications" initialCount={5} />
  └─ own state: count = 5
```

A subtle point: `initialCount` initializes the state only on the component’s first mount. If the parent later changes `initialCount`, React does not automatically overwrite the child’s existing `count` state. That behavior prevents parent re-renders from unexpectedly erasing a user’s in-progress interaction.

## When to use each

Use a **component** when you have a distinct, reusable UI responsibility:

```text
Button, modal, form field, product card, navigation bar, user profile
```

Use **props** when data should come from the parent, including:

- Text, IDs, configuration options, and styling variants.
- Objects or arrays to display.
- Event handlers such as `onSave`, `onDelete`, or `onChange`.
- Children passed between opening and closing tags.

```jsx
function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

<Card title="Account">
  <p>Account details go here.</p>
</Card>;
```

Use **state** when the component must remember data that changes over time:

- Input field values.
- Whether a menu/modal is open.
- Selected tabs or filters.
- Loading, success, and error status.
- Local UI counters.
- Data fetched for the current view.

```jsx
function PasswordField() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <>
      <input type={isVisible ? "text" : "password"} />
      <button onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? "Hide" : "Show"}
      </button>
    </>
  );
}
```

## Lifting state up

When two components must stay synchronized, state should live in their closest common parent. React calls this **lifting state up**.[4]

For example, two panels cannot independently own the same “currently active panel” state without getting out of sync.

```jsx
import { useState } from "react";

function Accordion({ items }) {
  const [activeId, setActiveId] = useState(null);

  return (
    <section>
      {items.map((item) => (
        <Panel
          key={item.id}
          title={item.title}
          isActive={activeId === item.id}
          onShow={() => setActiveId(item.id)}
        >
          {item.content}
        </Panel>
      ))}
    </section>
  );
}

function Panel({ title, isActive, onShow, children }) {
  return (
    <section>
      <h2>{title}</h2>
      {isActive ? children : <button onClick={onShow}>Show</button>}
    </section>
  );
}
```

```text
Before:
Panel A owns active state
Panel B owns active state
→ Possible disagreement

After:
Accordion owns activeId
  ├─ passes isActive to Panel A
  ├─ passes isActive to Panel B
  └─ receives onShow events
→ One source of truth
```

React’s recommended pattern is to move shared state to the closest common parent, pass values down through props, and pass event handlers down so children can request changes.[4]

## Common mistakes

### Copying props into state unnecessarily

```jsx
// Usually avoid this
function Profile({ user }) {
  const [name, setName] = useState(user.name);
}
```

If the parent later provides a different `user`, the local `name` does not automatically update. Use the prop directly unless the component intentionally needs an editable local draft.

```jsx
// Better if no editable local draft is needed
function Profile({ user }) {
  return <h1>{user.name}</h1>;
}
```

### Updating state from stale values

When the next value depends on the prior value, use the functional updater:

```jsx
// Can be incorrect with batched updates
setCount(count + 1);
setCount(count + 1);
```

```jsx
// Correct
setCount((previousCount) => previousCount + 1);
setCount((previousCount) => previousCount + 1);
```

### Putting everything in one component

A giant component becomes hard to test, reuse, and reason about. Extract a component when a section has a clear responsibility or is repeated, but do not split trivial one-line markup merely for the sake of splitting.

## Interview answer

> Components are reusable JavaScript functions that return JSX describing part of the user interface. Props are read-only inputs passed from a parent to a child, similar to function parameters; they configure the child and can include both data and callback functions. State is a component’s private memory for data that changes over time, such as form values, loading status, or whether a modal is open. In function components, `useState` provides the current state value and a setter that triggers re-rendering. React uses one-way data flow: state is usually owned by a parent, passed down as props, and updated in response to callback events from children. When multiple components need the same changing data, I lift that state to their closest common parent.[1][2][4]

## Sources

1. Components and Props https://legacy.reactjs.org/docs/components-and-props.html
2. State: A Component's Memory https://react.dev/learn/state-a-components-memory
3. React Fundamentals https://reactnative.dev/docs/intro-react
4. Sharing State Between Components https://react.dev/learn/sharing-state-between-components
5. What is the difference between state and props in React? https://stackoverflow.com/questions/27991366/what-is-the-difference-between-state-and-props-in-react
6. React.Component https://legacy.reactjs.org/docs/react-component.html
7. Basics of State and Props in React (2020 edition) https://chenhuijing.com/blog/state-and-props-in-react/
8. 05 - Understanding React Components - What are States https://www.youtube.com/watch?v=GgurJ_3y0Jg
9. React Class Components https://www.w3schools.com/react/react_class.asp
