---
title: Props and States
sidebar_label: Props & States
sidebar_position: 8
---

**Props** are read-only inputs passed from a parent component to a child. **State** is a component’s own memory for data that changes over time; updating it triggers React to render the UI again.[1][2]

## Core idea

A React component’s UI is based on its inputs and memory:

UI = f(props, state)

```text
Parent component
     |
     | passes props downward
     v
Child component
     |
     | owns/updates local state
     v
React re-renders affected UI
```

For example, a shopping-cart item can receive its product details as props while retaining an editable quantity as state:

```jsx
function CartItem({ product }) {
  const [quantity, setQuantity] = useState(1);

  return (
    <article>
      <h2>{product.name}</h2>
      <p>Price: ${product.price}</p>

      <button onClick={() => setQuantity((qty) => qty - 1)}>−</button>

      <span>{quantity}</span>

      <button onClick={() => setQuantity((qty) => qty + 1)}>+</button>
    </article>
  );
}
```

```text
product.name / product.price → props from parent
quantity                     → state owned by CartItem
setQuantity(...)             → requests UI update
```

## Props

**Props**—short for properties—are values supplied to a component through JSX attributes. They are like function arguments. React components use them to communicate from parent to child.[1]

```jsx
function UserCard({ name, role, avatarUrl }) {
  return (
    <article className="user-card">
      <img src={avatarUrl} alt={`${name}'s avatar`} />
      <h2>{name}</h2>
      <p>{role}</p>
    </article>
  );
}

function App() {
  return (
    <UserCard
      name="Ava Chen"
      role="Administrator"
      avatarUrl="/avatars/ava.png"
    />
  );
}
```

The parent sends values:

```jsx
<UserCard name="Ava Chen" role="Administrator" />
```

The child receives and reads them:

```jsx
function UserCard({ name, role }) {
  return (
    <h2>
      {name}: {role}
    </h2>
  );
}
```

You can pass any JavaScript value as a prop, including:

```jsx
<ProductCard
  title="Wireless keyboard" // string
  price={89.99} // number
  inStock={true} // boolean
  product={{ id: "p1" }} // object
  tags={["office", "wireless"]} // array
  onAddToCart={handleAddToCart} // function
/>
```

React documentation notes that props can include objects, arrays, and functions—not just text-like HTML attributes.[1]

### Props are read-only

A component must not modify its own props. React treats props as snapshots for a particular render.[1]

```jsx
// Incorrect: mutating a prop
function ProductCard({ product }) {
  product.price = 0;
  return <p>{product.price}</p>;
}
```

Instead, the child can tell the parent that something happened through a callback prop:

```jsx
function ProductCard({ product, onApplyDiscount }) {
  return (
    <button onClick={() => onApplyDiscount(product.id)}>Apply discount</button>
  );
}
```

The parent owns the relevant state and decides how to update it.

```jsx
function ProductCatalog() {
  const [products, setProducts] = useState(initialProducts);

  function handleApplyDiscount(productId) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, price: product.price * 0.9 }
          : product,
      ),
    );
  }

  return (
    <ProductCard product={products[0]} onApplyDiscount={handleApplyDiscount} />
  );
}
```

## State

**State** is data a component remembers between renders. It is for values that can change as a result of user interaction, data loading, timers, subscriptions, or other application events.[2]

In a function component, use `useState`:

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  function handleIncrement() {
    setCount((currentCount) => currentCount + 1);
  }

  return (
    <>
      <p>Count: {count}</p>
      <button onClick={handleIncrement}>Increment</button>
    </>
  );
}
```

```text
const [count, setCount] = useState(0)
       |        |                  |
       |        |                  └─ initial state on first mount
       |        └─ state setter
       └─ current state value
```

When `setCount` runs:

```text
Click
  → setCount(current => current + 1)
  → React schedules an update
  → Counter renders again
  → UI displays the new count
```

Common state examples:

- A form field’s current value.
- Whether a dialog/menu is open.
- Selected tab, category, or filter.
- Loading, success, and error status.
- Fetched data for the current screen.
- A local interaction such as an expanded/collapsed panel.

State should be updated with its setter, not changed directly:

```jsx
// Incorrect
count = count + 1;
```

```jsx
// Correct
setCount((currentCount) => currentCount + 1);
```

For objects and arrays, create a new object/array rather than mutating the previous one:

```jsx
const [user, setUser] = useState({
  name: "Ava",
  theme: "light",
});

function enableDarkMode() {
  setUser((currentUser) => ({
    ...currentUser,
    theme: "dark",
  }));
}
```

## Differences at a glance

| Aspect                                 | Props                                            | State                                                  |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Meaning                                | Input/configuration for a component              | Component memory                                       |
| Owned by                               | Parent component                                 | Component that declares it                             |
| Comes from                             | Parent JSX, e.g. `<Card title="..." />`          | `useState`, `useReducer`, or related state mechanism   |
| Can the receiving component change it? | No—read-only                                     | Yes, through a setter/dispatcher                       |
| What changes it?                       | Parent renders with a different value            | Component calls `setState` / setter / `dispatch`       |
| Main direction                         | Parent → child                                   | Local to owner; can be passed downward as props        |
| Persists between renders?              | The parent provides it on each render            | Yes, while component identity is preserved             |
| Typical use                            | ID, title, product data, callback, configuration | Input text, selected item, open/closed, request status |
| Triggers re-render?                    | New prop values can cause child re-rendering     | State setter schedules a re-render                     |

[1][2]

## Data flow example

Consider a reusable `LikeButton`.

```jsx
import { useState } from "react";

function LikeButton({ postId, initialLikes, onLike }) {
  const [hasLiked, setHasLiked] = useState(false);

  function handleClick() {
    if (hasLiked) return;

    setHasLiked(true);
    onLike(postId);
  }

  return (
    <button onClick={handleClick} disabled={hasLiked}>
      {hasLiked ? `Liked (${initialLikes + 1})` : `Like (${initialLikes})`}
    </button>
  );
}

function Post({ post }) {
  function handleLike(postId) {
    console.log(`Send like request for ${postId}`);
  }

  return (
    <LikeButton
      postId={post.id}
      initialLikes={post.likes}
      onLike={handleLike}
    />
  );
}
```

| Value          | Prop or state? | Reason                                                    |
| -------------- | -------------- | --------------------------------------------------------- |
| `postId`       | Prop           | The parent knows which post is displayed                  |
| `initialLikes` | Prop           | The parent provides post data                             |
| `onLike`       | Prop           | The parent decides how to persist the like                |
| `hasLiked`     | State          | The button locally remembers whether this user clicked it |

The data flow is:

```text
<Post> passes post data + onLike callback
           |
           v
<LikeButton> renders from props + hasLiked state
           |
User clicks
           |
           v
<LikeButton> updates hasLiked state
           |
           +--> invokes onLike(postId)
                    |
                    v
<Post> can update server/app state
```

This pattern keeps ownership clear: the parent controls shared/domain data, while the child controls temporary local interaction state.

## Lifting state up

When multiple components must use and change the same value, place that state in their closest common parent and pass it down as props. This is called **lifting state up**.[2]

```jsx
import { useState } from "react";

function TemperatureInput({ scale, temperature, onTemperatureChange }) {
  return (
    <label>
      Temperature in {scale}
      <input
        value={temperature}
        onChange={(event) => onTemperatureChange(event.target.value)}
      />
    </label>
  );
}

function TemperatureCalculator() {
  const [temperature, setTemperature] = useState("");

  return (
    <>
      <TemperatureInput
        scale="Celsius"
        temperature={temperature}
        onTemperatureChange={setTemperature}
      />

      <TemperatureInput
        scale="Fahrenheit"
        temperature={temperature}
        onTemperatureChange={setTemperature}
      />
    </>
  );
}
```

```text
Before:
Input A owns value
Input B owns value
→ Values can disagree

After:
Parent owns temperature state
  ├─ passes value to Input A
  ├─ passes value to Input B
  └─ passes callbacks to request updates
→ One source of truth
```

React recommends moving shared state to the closest common parent, then passing it to children via props.[2]

## Common mistakes

### Trying to change props

```jsx
function Avatar({ size }) {
  size = 100; // Avoid
  return <img width={size} />;
}
```

If a component needs changing behavior, it should hold state itself or call a parent callback that changes parent-owned state.

### Duplicating a prop in state

```jsx
function Profile({ user }) {
  const [name, setName] = useState(user.name);
}
```

This creates two possible sources of truth: `user.name` and `name`. If the parent later passes another user, the local `name` does not automatically follow.

Prefer the prop directly unless you intentionally need a local editable draft:

```jsx
function Profile({ user }) {
  return <h1>{user.name}</h1>;
}
```

### Using state for derived values

```jsx
// Usually unnecessary state
const [fullName, setFullName] = useState("");
```

If it can be calculated from existing state/props during render, calculate it directly:

```jsx
const fullName = `${firstName} ${lastName}`;
```

This avoids synchronization bugs.

### Keeping shared state in separate children

If two sibling components need to stay synchronized, do not give each independent copies of the same state. Lift it to their parent.[2]

## Props are snapshots; state follows identity

Props are read-only snapshots for each render. When a parent supplies new props, the child renders using those new values.[1]

State persists only while React considers the component to be the same instance at the same location in the UI tree. Changing a component’s `key` tells React to reset it:

```jsx
function UserEditor({ user }) {
  return <ProfileForm key={user.id} user={user} />;
}
```

When `user.id` changes, React treats `ProfileForm` as a new instance, so local state starts fresh. React documents this as a way to explicitly reset component state.[2]

## Interview answer

> Props are read-only inputs passed from a parent to a child, similar to function arguments. They let components communicate and can contain values, objects, arrays, functions, or JSX. State is a component’s own persistent memory, typically created with `useState`; it changes through a setter and causes React to re-render. The child should never mutate props. Instead, React uses one-way data flow: a parent owns shared state, sends it down as props, and children call callback props to request updates. When two components need the same changing data, I lift the state to their closest common parent so there is one source of truth.[1][2]

## Sources

1. Passing Props to a Component https://react.dev/learn/passing-props-to-a-component
2. Managing State https://react.dev/learn/managing-state
