---
title: JSX & Rendering Model
sidebar_label: JSX & Rendering Model
sidebar_position: 1
---

JSX is a JavaScript syntax extension used to describe React user interfaces with HTML-like markup. React components return JSX, React evaluates that JSX into lightweight element descriptions, compares the new description with the previous one, and updates only the necessary parts of the browser DOM.[1][2][3]

## JSX: UI written in JavaScript

JSX looks like HTML, but it is **not HTML**. It is syntax that a build tool such as Vite, Babel, or TypeScript transforms into JavaScript that creates React elements.[1][4][5]

```jsx
const element = <h1 className="title">Hello, React</h1>;
```

Conceptually, JSX becomes a JavaScript element-creation call:

```js
const element = React.createElement(
  "h1",
  { className: "title" },
  "Hello, React",
);
```

Modern React builds usually use the automatic JSX runtime rather than requiring explicit `React.createElement` calls in source, but the mental model is the same: JSX produces a JavaScript description of UI, not a DOM node.[1][4]

```text
JSX source
   |
   v
Compiled JavaScript
   |
   v
React element objects
   |
   v
React DOM updates browser DOM
```

A React element is an immutable object that describes what should appear on screen at a particular moment. It is not the actual DOM element.[1][2]

## Basic JSX rules

### Return one parent

A component returns one JSX tree. Use a wrapping element or a Fragment:

```jsx
function Profile() {
  return (
    <>
      <h1>Ada Lovelace</h1>
      <p>Mathematician and programmer</p>
    </>
  );
}
```

`<>...</>` is a Fragment: it groups elements without creating an extra DOM element.[3]

### Close every tag

JSX is stricter than HTML:

```jsx
<img src="/avatar.png" alt="Profile" />
<br />
<input type="email" />
```

Self-closing tags need `/>`.[3]

### Use `className`, not `class`

```jsx
<div className="card">Content</div>
```

Many JSX property names follow JavaScript DOM-property conventions, such as `className`, `htmlFor`, `onClick`, and camel-cased style properties.

### Embed JavaScript with `{}`

Curly braces let JSX evaluate a JavaScript expression:

```jsx
function Greeting({ user }) {
  const message = `Welcome back, ${user.name}`;

  return <h1>{message}</h1>;
}
```

They also work in attributes:

```jsx
<img src={user.avatarUrl} alt={`${user.name}'s profile`} />
```

Inside JSX braces, you can use expressions such as variables, function calls, arithmetic, ternaries, array transformations, and property access. You cannot place a full statement such as `if`, `for`, or `switch` directly inside braces.[3]

## Components and rendering

A React component is usually a JavaScript function that returns JSX.

```jsx
function ProductCard({ product }) {
  return (
    <article className="product-card">
      <h2>{product.name}</h2>
      <p>${product.price}</p>
    </article>
  );
}
```

Use a component in JSX with an uppercase name:

```jsx
function App() {
  return <ProductCard product={{ name: "Keyboard", price: 99.95 }} />;
}
```

```text
<App />
   |
   +--> <ProductCard />
          |
          +--> <article>
                <h2>Keyboard</h2>
                <p>$99.95</p>
```

Lowercase tags such as `<div>` represent browser DOM elements. Uppercase tags such as `<ProductCard>` represent React components.

## Root rendering

A React application begins by creating a root and rendering the top-level component:

```jsx
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
```

React owns and manages the DOM inside the root element.[2][5]

```html
<div id="root"></div>
```

```text
index.html
  |
  +--> <div id="root"></div>
          |
          +--> React renders <App />
```

## The rendering model

React rendering is best understood as a repeated process:

```text
State / props change
       |
       v
React calls affected component functions
       |
       v
Components return new JSX / React element descriptions
       |
       v
React compares new tree with previous tree
       |
       v
React commits minimal necessary DOM changes
       |
       v
Browser paints updated UI
```

React calls the component function to calculate what the UI **should look like** for the current props and state. This is called the **render phase**. React then applies necessary changes to the real DOM during the **commit phase**.[2][6]

## Render is not “redraw everything”

A common misconception is:

> “React re-renders the whole DOM every time state changes.”

More accurately:

- A state update can cause React to call component functions again.
- Those functions create a new React element tree description.
- React compares that tree with the previous tree.
- React DOM updates only the changed DOM nodes needed to match the new result.[2]

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </>
  );
}
```

When `setCount` runs:

```text
count = 0
  ↓ click
setCount(1)
  ↓
Counter() runs again
  ↓
New JSX says: <p>Count: 1</p>
  ↓
React updates the text node from 0 to 1
```

React does not recreate the entire page merely because the component function ran again.

## What triggers a render?

A component can re-render when:

1. It is rendered for the first time.
2. Its own state changes.
3. Its parent re-renders and supplies new props.
4. A consumed context value changes.[3][6]

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

`setCount` requests a new render. React schedules the update, calls the component again, and commits the required DOM update.

## Render should be pure

A component’s render logic should behave like a pure calculation:

```text
Same props + same state
        ↓
Same JSX result
```

Do not perform side effects during rendering:

```jsx
// Avoid: side effect during render
function Dashboard() {
  fetch("/api/metrics");
  return <h1>Dashboard</h1>;
}
```

Instead, run side effects after React commits UI, usually with `useEffect`:

```jsx
function Dashboard() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((response) => response.json())
      .then(setMetrics);
  }, []);

  return <h1>{metrics ? metrics.totalUsers : "Loading..."}</h1>;
}
```

Why? React may render components more than once, pause/restart rendering work, or discard a render before committing it. Side effects in render can therefore run unexpectedly.

## Props, state, and UI

React follows a declarative model:

```text
UI = f(props, state)
```

- **Props** are external inputs passed from parent to child.
- **State** is component memory that persists across renders.
- JSX describes the UI for the current props and state.[3]

```jsx
function StatusBadge({ isOnline }) {
  return (
    <span className={isOnline ? "online" : "offline"}>
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
```

You do not manually find and mutate a DOM element:

```js
// Imperative style: not the normal React approach
document.querySelector("#status").textContent = "Online";
```

Instead, you update state or props and let React determine the DOM changes.

## Conditional rendering

Because JSX is JavaScript-friendly, use standard JavaScript expressions for conditional UI.

```jsx
function LoginPanel({ isAuthenticated }) {
  return <section>{isAuthenticated ? <Dashboard /> : <LoginForm />}</section>;
}
```

Render something only when a condition is true:

```jsx
{
  isAdmin && <AdminControls />;
}
```

Return nothing for a branch:

```jsx
function Warning({ show }) {
  if (!show) return null;

  return <p className="warning">Check your input.</p>;
}
```

## Lists and keys

Render arrays with `map`:

```jsx
function ProductList({ products }) {
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

The `key` gives each sibling a stable identity. It helps React match old and new items correctly when items are added, removed, sorted, or filtered.

```text
Without stable keys:
React may confuse item identity and preserve wrong UI state.

With key={product.id}:
React knows which rendered item represents which product.
```

Do not use an array index as a key when the list can be reordered, inserted into, deleted from, or contains stateful child components.

## Reconciliation

**Reconciliation** is React’s process of comparing the previous element tree with the next element tree.

React generally uses:

- Element/component type.
- Tree position.
- `key` for list siblings.

to decide whether to preserve, update, remove, or recreate a DOM subtree.

```jsx
// Same position, same type: React usually preserves component state
<UserForm user={user} />

// Different key: React treats it as a new component instance
<UserForm key={user.id} user={user} />
```

Changing a key intentionally resets component state because React treats it as a different identity.

## JSX is safe by default

React escapes values embedded in JSX before rendering. This means ordinary text interpolation does not interpret a string as HTML:

```jsx
const comment = "<script>alert('xss')</script>";

return <p>{comment}</p>;
```

React displays the text rather than executing it as a script.[1]

The escape hatch, `dangerouslySetInnerHTML`, should be used only with trusted or rigorously sanitized HTML:

```jsx
<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

## Interview answer

> JSX is a syntax extension that lets developers describe React UI using HTML-like markup inside JavaScript. It compiles into JavaScript that creates React element objects, which are immutable descriptions of the desired UI—not real DOM nodes. A component returns JSX based on props and state. When state, props, or context changes, React re-renders by calling component functions to produce a new element tree, reconciles that tree with the previous one, and commits only the minimal necessary DOM mutations. Render logic should be pure; side effects such as fetching data or subscribing belong in effects. Stable keys are essential when rendering lists because they preserve component identity across updates.[1][2][3]

## Sources

1. Introducing JSX - React https://legacy.reactjs.org/docs/introducing-jsx.html
2. Rendering Elements - React https://legacy.reactjs.org/docs/rendering-elements.html
3. Quick Start - React https://react.dev/learn
4. Documentation - JSX - TypeScript https://www.typescriptlang.org/docs/handbook/jsx.html
5. Getting started with React - Learn web development | MDN https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Frameworks_libraries/React_getting_started
6. The React Handbook for Beginners – JSX, Hooks, and Rendering ... https://www.freecodecamp.org/news/react-handbook-for-beginners-learn-jsx-hooks-rendering/
7. Is it possible to use if...else... statement in React render function? https://stackoverflow.com/questions/40477245/is-it-possible-to-use-if-else-statement-in-react-render-function
8. Demystifying React: How does React actually render JSX? https://dev.to/joe_jngigi/demystifying-react-how-does-react-actually-render-jsx-3099
9. React Conditional Rendering - W3Schools https://www.w3schools.com/react/react_conditional_rendering.asp
