---
title: Conditional Rendering
sidebar_label: Conditional Rendering
sidebar_position: 5
---

Conditional rendering lets a React component show different UI based on JavaScript conditions. List rendering turns an array of data into JSX with `map()`, and **keys** give each rendered item a stable identity so React can update, move, insert, or remove items correctly.[1][2]

## Conditional rendering

In React, conditional UI is ordinary JavaScript branching inside a component. You commonly use:

- `if` / `return`
- Ternary operator: `condition ? A : B`
- Logical AND: `condition && A`
- Variables that hold JSX

React’s official guidance describes `if`, `&&`, and `?:` as the standard ways to conditionally render JSX.[2]

### `if` and early return

Use `if` when entire component output changes substantially.

```jsx
function UserProfile({ user, isLoading, error }) {
  if (isLoading) {
    return <p>Loading profile…</p>;
  }

  if (error) {
    return <p role="alert">Could not load the profile.</p>;
  }

  if (!user) {
    return <p>No user found.</p>;
  }

  return (
    <article>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </article>
  );
}
```

```text
isLoading = true  → Loading UI
error exists      → Error UI
user is absent    → Empty-state UI
otherwise         → Profile UI
```

This is often the clearest approach for loading, error, authentication, and permissions states.

### Ternary: choose one of two branches

Use a ternary when you need one of two alternatives:

```jsx
function LoginButton({ isLoggedIn }) {
  return <button>{isLoggedIn ? "Sign out" : "Sign in"}</button>;
}
```

```jsx
function AccountPage({ isLoggedIn }) {
  return <main>{isLoggedIn ? <Dashboard /> : <LoginForm />}</main>;
}
```

The expression:

```jsx
{
  isLoggedIn ? <Dashboard /> : <LoginForm />;
}
```

means:

```text
If isLoggedIn is true, render <Dashboard />.
Otherwise, render <LoginForm />.
```

### Logical AND: render or render nothing

Use `&&` when the UI should appear only if a condition is truthy.

```jsx
function CartSummary({ itemCount }) {
  return (
    <section>
      <h2>Cart</h2>

      {itemCount > 0 && <p>You have {itemCount} item(s) in your cart.</p>}
    </section>
  );
}
```

```jsx
{
  isAdmin && <AdminControls />;
}
```

This means: if `isAdmin` is truthy, render `<AdminControls />`; otherwise render nothing.[2]

### Important `&&` pitfall

Do not use a numeric value directly as the condition when it can be `0`:

```jsx
// Problem: if itemCount is 0, React may render 0
{
  itemCount && <p>Items in cart</p>;
}
```

Use a boolean expression instead:

```jsx
{
  itemCount > 0 && <p>Items in cart</p>;
}
```

### Store JSX in a variable

Use a variable if branching would make returned JSX hard to read:

```jsx
function StatusBadge({ status }) {
  let badge;

  if (status === "active") {
    badge = <span className="badge success">Active</span>;
  } else if (status === "suspended") {
    badge = <span className="badge warning">Suspended</span>;
  } else {
    badge = <span className="badge neutral">Unknown</span>;
  }

  return (
    <section>
      <h2>Account</h2>
      {badge}
    </section>
  );
}
```

## List rendering with `map()`

React renders lists by using JavaScript’s `map()` to transform data into an array of JSX elements.[1]

```jsx
const products = [
  { id: "p1", name: "Keyboard", price: 89.99 },
  { id: "p2", name: "Mouse", price: 39.99 },
  { id: "p3", name: "Monitor", price: 299.99 },
];

function ProductList() {
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {product.name} — ${product.price}
        </li>
      ))}
    </ul>
  );
}
```

```text
products array
    |
    v
products.map(product => <li ... />)
    |
    v
array of JSX elements
    |
    v
React renders <ul> with list items
```

`map()` returns a new array. React can render that returned JSX array directly inside `{}`.

### Mapping to components

In real applications, you often map data to a reusable component:

```jsx
function ProductCard({ product }) {
  return (
    <article className="product-card">
      <h2>{product.name}</h2>
      <p>${product.price}</p>
    </article>
  );
}

function ProductGrid({ products }) {
  return (
    <section className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </section>
  );
}
```

The `key` belongs where the array is being mapped:

```jsx
// Correct: key is on the JSX directly returned by map()
products.map((product) => <ProductCard key={product.id} product={product} />);
```

```jsx
// Incorrect: ProductCard cannot receive a usable key via props
function ProductCard({ product }) {
  return <article key={product.id}>{product.name}</article>;
}
```

`key` is special metadata used by React; it is not passed to the component as a normal prop. If the child needs the ID, pass it explicitly:

```jsx
<ProductCard key={product.id} productId={product.id} product={product} />
```

## Filtering then rendering

Use `filter()` to choose data, then `map()` to render it.[1]

```jsx
function AvailableProducts({ products }) {
  const availableProducts = products.filter((product) => product.inStock);

  return (
    <ul>
      {availableProducts.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

```text
All products
    |
    v
filter(product => product.inStock)
    |
    v
Only in-stock products
    |
    v
map(product => <ProductCard ... />)
    |
    v
Rendered list
```

Do not mutate the original state array while filtering or sorting. Make new arrays instead:

```jsx
// Good: creates a new array
const availableProducts = products.filter((product) => product.inStock);

// Good: creates a copy before sort mutates it
const sortedProducts = [...products].sort((a, b) =>
  a.name.localeCompare(b.name),
);
```

React recommends creating a new array when updating array state rather than mutating the current state array.[3]

## What keys do

A `key` is a string or number that uniquely identifies an item among its siblings. Keys tell React which data item corresponds to which rendered component, particularly when items move, are inserted, removed, filtered, or sorted.[1]

```jsx
<li key={product.id}>{product.name}</li>
```

Think of it as a stable label:

```text
Without keys:
Position 0 → item at position 0
Position 1 → item at position 1

With keys:
product-a12 → Keyboard
product-b43 → Mouse
product-c95 → Monitor
```

If a list is reordered, React uses keys to understand that the same item moved rather than assuming that an item at a particular position became a different item.

```text
Before sort:
key=a → Keyboard
key=b → Mouse

After sort:
key=b → Mouse
key=a → Keyboard

React sees: same items, different order.
```

This matters especially when list rows contain local state, inputs, animations, focus, or effects.

## Why array indexes are risky

This works syntactically:

```jsx
products.map((product, index) => <ProductCard key={index} product={product} />);
```

But it is often incorrect.

Suppose every row has an editable input:

```text
Before inserting at top:
index 0 → Keyboard input state
index 1 → Mouse input state

After inserting "Monitor" at top:
index 0 → Monitor receives Keyboard's former component state
index 1 → Keyboard receives Mouse's former component state
```

The UI can display the wrong draft text, preserve focus on the wrong item, or associate internal row state with the wrong record.

Use an index only when all of these are true:

- The list is static.
- Its items are never inserted, deleted, filtered, or reordered.
- List items have no meaningful local state.
- There is no stable ID available.

In most data-driven applications, use a database ID, UUID, or other stable item identifier. React specifically notes that keys matter when list items can move, be inserted, or be deleted.[1]

## Choosing a good key

| Data situation            | Best key                                                             | Avoid                                   |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Database-backed record    | `item.id`                                                            | Array index                             |
| Todo created on client    | Generated stable ID, e.g. `crypto.randomUUID()` stored with the item | Generating a new ID during every render |
| Nested list               | Identifier unique among that list’s siblings                         | Assuming global uniqueness is required  |
| Static hard-coded content | Stable label if guaranteed unique                                    | Index unless the list is truly fixed    |
| Composite identity        | A stable combination, e.g. `` `${orderId}:${lineId}` ``              | Display label that users can edit       |

Keys need to be unique among **siblings**, not across the entire application.[4]

### Never generate keys during render

```jsx
// Incorrect: key changes every render
products.map((product) => (
  <ProductCard key={crypto.randomUUID()} product={product} />
));
```

A new key makes React treat every item as a new component each render. That destroys and recreates the row, resetting local state, losing focus, and reducing performance.

Generate IDs when creating the data:

```jsx
function addProduct(name) {
  setProducts((currentProducts) => [
    ...currentProducts,
    {
      id: crypto.randomUUID(),
      name,
      inStock: true,
    },
  ]);
}
```

## Keys preserve—or reset—state

React associates component state with a component’s position in the rendered UI tree. A stable key helps React preserve the right component instance as lists change.[4]

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

When a todo moves, `key={todo.id}` tells React to move the existing `TodoItem` identity rather than recreate a new one.

You can intentionally change a key to reset a component’s local state:

```jsx
function UserEditor({ user }) {
  return <ProfileForm key={user.id} user={user} />;
}
```

When `user.id` changes:

```text
Old <ProfileForm> unmounts
    ↓
Its state and Effects are cleaned up
    ↓
New <ProfileForm> mounts
    ↓
It starts with fresh form state
```

Keys are therefore not only for arrays; they can explicitly control the identity of any component at a position in the tree.[4]

## Full example

This component combines conditional rendering, filtered list rendering, stable keys, and immutable state updates:

```jsx
import { useMemo, useState } from "react";

function TodoApp() {
  const [todos, setTodos] = useState([
    { id: "t1", text: "Review React keys", completed: false },
    { id: "t2", text: "Build list rendering demo", completed: true },
  ]);

  const [showCompleted, setShowCompleted] = useState(true);

  const visibleTodos = useMemo(() => {
    return todos.filter((todo) => showCompleted || !todo.completed);
  }, [todos, showCompleted]);

  function toggleTodo(id) {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  }

  function removeTodo(id) {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
  }

  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(event) => setShowCompleted(event.target.checked)}
        />
        Show completed todos
      </label>

      {visibleTodos.length === 0 ? (
        <p>No todos match this filter.</p>
      ) : (
        <ul>
          {visibleTodos.map((todo) => (
            <li key={todo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span>
                  {todo.completed ? "Completed: " : "Pending: "}
                  {todo.text}
                </span>
              </label>

              <button onClick={() => removeTodo(todo.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Why it is correct:

- `visibleTodos.length === 0 ? ... : ...` renders either an empty state or the list.
- `filter()` derives visible data without modifying `todos`.
- `map()` turns each todo into JSX.
- `key={todo.id}` remains stable through deletion, filtering, and reordering.
- `map()` and `filter()` create new arrays during state updates rather than mutating existing state.[1][2][3]

## Common mistakes

- Calling `map()` but not returning JSX from its callback.
- Omitting a `key` for JSX directly returned by `map()`.
- Using `index` as a key in a changing list.
- Generating a random key while rendering.
- Putting `key` inside the child instead of on the mapped element.
- Mutating a state array with `.push()`, `.splice()`, or in-place `.sort()`.
- Using an Effect to compute a filtered/sorted list that can be calculated during render; derive it directly instead.[1][3][5]

## Interview answer

> Conditional rendering in React uses normal JavaScript control flow, typically `if` statements, ternaries, and logical `&&`. For lists, I use `map()` to transform an array of data into JSX, and often `filter()` first when only a subset should be shown. Every item directly returned from `map()` needs a stable `key`, usually a database or generated item ID. Keys let React match a rendered component with the same logical data item when the list is updated, reordered, filtered, inserted into, or deleted from; this preserves the correct DOM and component state. I avoid array indexes as keys for dynamic lists and never generate random keys during render, because unstable keys can cause state, focus, and performance problems.[1][2][4]

## Sources

1. Rendering Lists https://react.dev/learn/rendering-lists
2. Conditional Rendering https://react.dev/learn/conditional-rendering
3. Updating Arrays in State https://react.dev/learn/updating-arrays-in-state
4. Preserving and Resetting State https://react.dev/learn/preserving-and-resetting-state
5. You Might Not Need an Effect https://react.dev/learn/you-might-not-need-an-effect
6. Describing the UI https://he.react.dev/learn/describing-the-ui
7. Choosing the State Structure https://react.dev/learn/choosing-the-state-structure
8. Lifecycle of Reactive Effects https://react.dev/learn/lifecycle-of-reactive-effects
