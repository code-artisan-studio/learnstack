---
title: Components and Types
sidebar_label: Components
sidebar_position: 7
---

React components are reusable pieces of UI. In modern React, the primary component type is the **function component**; class components still work but are mainly encountered in legacy code. In React Server Components–enabled frameworks, components are also classified by where they render: **Server Components** and **Client Components**.[1][2][3][4]

## What is a component?

A React component is a JavaScript function that returns JSX describing what should appear on screen. Component names begin with a capital letter.[1][5]

```jsx
function Welcome() {
  return <h1>Welcome to React</h1>;
}
```

Use the component as a JSX tag:

```jsx
function App() {
  return (
    <main>
      <Welcome />
    </main>
  );
}
```

```text
<App />
   |
   +--> <Welcome />
          |
          +--> <h1>Welcome to React</h1>
```

Components help divide a complex UI into understandable, reusable pieces:

```text
<App />
  ├── <Header />
  ├── <Navigation />
  ├── <ProductGrid />
  │     └── <ProductCard />
  └── <Footer />
```

React itself should render components through JSX. Do not call them directly as ordinary functions such as `ProductCard()`; React needs to control when components render so it can preserve state, reconcile the UI tree, and apply Hooks correctly.[6]

```jsx
// Correct
<ProductCard product={product} />;

// Incorrect
ProductCard({ product });
```

## Function components

**Function components** are the modern standard. They are regular JavaScript functions that accept props and return JSX. They can use Hooks such as `useState`, `useEffect`, `useContext`, and `useRef`.[1][2]

```jsx
import { useState } from "react";

function LikeButton({ initialLikes = 0 }) {
  const [likes, setLikes] = useState(initialLikes);

  return (
    <button onClick={() => setLikes((currentLikes) => currentLikes + 1)}>
      Likes: {likes}
    </button>
  );
}
```

Use function components for virtually all new React application code because they:

- Use Hooks for state, effects, context, refs, and reusable logic.
- Avoid `this`, constructors, and manual method binding.
- Are concise and compose naturally with custom Hooks.
- Are the recommended component style in current React documentation.[2]

### Stateless vs stateful function components

People sometimes classify components by whether they have local state:

```jsx
// Presentational / stateless in the local-state sense
function UserName({ name }) {
  return <h2>{name}</h2>;
}
```

```jsx
// Stateful: owns local UI state
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

This classification can be useful for discussion, but both are still function components. A “stateless component” may still use props, context, event handlers, or effects; it simply does not own meaningful local state.

## Class components

A **class component** extends `React.Component` and implements a `render()` method. React still supports them, but recommends function components for new code.[2]

```jsx
import React from "react";

class Counter extends React.Component {
  state = {
    count: 0,
  };

  handleIncrement = () => {
    this.setState((previousState) => ({
      count: previousState.count + 1,
    }));
  };

  render() {
    return (
      <button onClick={this.handleIncrement}>Count: {this.state.count}</button>
    );
  }
}
```

Class components use:

- `this.props` instead of function parameters.
- `this.state` and `this.setState()` instead of `useState`.
- Lifecycle methods such as `componentDidMount()` and `componentWillUnmount()` instead of most `useEffect` patterns.

| Concern                 | Function component       | Class component                                                   |
| ----------------------- | ------------------------ | ----------------------------------------------------------------- |
| Definition              | `function Profile() {}`  | `class Profile extends React.Component {}`                        |
| Props                   | Function argument        | `this.props`                                                      |
| State                   | `useState`, `useReducer` | `this.state`, `this.setState()`                                   |
| Side effects            | `useEffect`              | `componentDidMount`, `componentDidUpdate`, `componentWillUnmount` |
| Reuse stateful logic    | Custom Hooks             | Render props / higher-order components                            |
| New-code recommendation | Yes                      | Usually no                                                        |

[2]

You should understand class components when maintaining older codebases, legacy tutorials, or class-based Error Boundaries. For new feature development, prefer function components.

## Server and Client Components

In frameworks that support **React Server Components**—for example, framework setups that implement the RSC model—components can be categorized based on their rendering environment. This is separate from function-vs-class classification: Server and Client Components are generally still written as functions.[3][4]

### Server Components

Server Components render ahead of time in a server environment: at build time or per request. They can access server-side resources such as databases, files, environment secrets, or backend services without shipping that code to the browser.[3]

```jsx
// ProductPage.jsx: Server Component in an RSC-capable framework
import { db } from "./database";

export default async function ProductPage() {
  const products = await db.products.findMany();

  return (
    <main>
      <h1>Products</h1>
      <ProductList products={products} />
    </main>
  );
}
```

Typical strengths:

- Fetch data close to the server-side data source.
- Keep database credentials and private logic out of browser bundles.
- Reduce JavaScript sent to the client.
- Render static or data-driven content before client interactivity is needed.[3]

Server Components cannot directly use browser-only APIs or client interactivity such as `useState`, `useEffect`, click handlers, `window`, or `document`. Add an interactive Client Component inside them when needed.

### Client Components

A Client Component is code that runs in the browser and supports interactive behavior. In an RSC framework, mark a module as client code using `"use client"` at the very top of the file. The directive creates a client/server boundary, and its module dependencies become part of client code.[4]

```jsx
"use client";

import { useState } from "react";

export default function QuantitySelector() {
  const [quantity, setQuantity] = useState(1);

  return (
    <section>
      <button onClick={() => setQuantity((qty) => Math.max(1, qty - 1))}>
        −
      </button>

      <span>{quantity}</span>

      <button onClick={() => setQuantity((qty) => qty + 1)}>+</button>
    </section>
  );
}
```

Use Client Components for:

- `useState`, `useReducer`, `useEffect`, and many other client Hooks.
- Event handlers such as `onClick`, `onChange`, and `onSubmit`.
- Browser APIs including `window`, `document`, `localStorage`, and `navigator`.
- Interactive forms, menus, modals, drag-and-drop, and client-only libraries.[4]

| Capability                            | Server Component                     | Client Component                             |
| ------------------------------------- | ------------------------------------ | -------------------------------------------- |
| Fetch directly from server data layer | Yes                                  | Usually through an API or Server Function    |
| Access secret environment values      | Yes, when properly configured        | No—do not send secrets to client code        |
| Use `useState` / event handlers       | No                                   | Yes                                          |
| Use browser APIs                      | No                                   | Yes                                          |
| Adds JavaScript to browser bundle     | Minimal/no component logic shipped   | Yes                                          |
| Best fit                              | Data fetching and non-interactive UI | User interaction and browser-dependent logic |

[3][4]

A good design starts with Server Components where the framework supports them, then places Client Components only at the interactive boundaries:

```text
<ProductPage>                    Server Component
   ├── <ProductDetails />        Server Component
   ├── <ProductReviews />        Server Component
   └── <AddToCartButton />       Client Component
```

This reduces client JavaScript while preserving interactivity where users need it.

## Presentational and container components

This is an architectural pattern, not an official React component category.

### Presentational components

Presentational components primarily receive data through props and focus on rendering UI.

```jsx
function ProductCard({ product, onAddToCart }) {
  return (
    <article className="product-card">
      <h2>{product.name}</h2>
      <p>${product.price}</p>
      <button onClick={() => onAddToCart(product.id)}>Add to cart</button>
    </article>
  );
}
```

They are easier to reuse and test because their required inputs are explicit.

### Container or smart components

Container components coordinate data, state, fetching, and domain-level event handling, then pass focused props to display components.

```jsx
import { useState } from "react";

function ProductCatalog({ products }) {
  const [cart, setCart] = useState([]);

  function handleAddToCart(productId) {
    setCart((currentCart) => [...currentCart, productId]);
  }

  return (
    <>
      <p>Cart items: {cart.length}</p>

      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={handleAddToCart}
        />
      ))}
    </>
  );
}
```

```text
<ProductCatalog>                  Container / state owner
       |
       +--> product data + callback props
                |
                v
       <ProductCard>              Presentational / display-focused
```

Modern React often uses custom Hooks, Context, Server Components, or dedicated data libraries instead of a strict “container versus presentational” split. Still, separating data coordination from display concerns remains a useful design principle.

## Controlled and uncontrolled components

This classification refers mainly to form elements.

### Controlled component

A controlled form field takes its value from React state. React is the source of truth.

```jsx
import { useState } from "react";

function EmailField() {
  const [email, setEmail] = useState("");

  return (
    <input
      type="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
    />
  );
}
```

```text
User types
   → onChange
   → setEmail(...)
   → React state updates
   → React renders the input's value
```

Use controlled inputs for validation, conditional UI, synchronized form fields, and predictable form behavior.

### Uncontrolled component

An uncontrolled input stores its current value in the browser DOM; React reads it through a ref when necessary.

```jsx
import { useRef } from "react";

function SearchForm() {
  const searchRef = useRef(null);

  function handleSubmit(event) {
    event.preventDefault();
    console.log(searchRef.current.value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input ref={searchRef} defaultValue="" />
      <button>Search</button>
    </form>
  );
}
```

Use an uncontrolled approach selectively—often for simple forms, file inputs, or integration with non-React form libraries. For rich, interactive forms, controlled inputs are usually easier to coordinate.

## Higher-order components and render props

These are older patterns for reusing behavior. They remain relevant in legacy code, but custom Hooks are the preferred modern approach for sharing stateful logic.

### Higher-order component (HOC)

An HOC is a function that takes a component and returns an enhanced component:

```jsx
function withLoading(WrappedComponent) {
  return function WithLoading({ isLoading, ...props }) {
    if (isLoading) {
      return <p>Loading…</p>;
    }

    return <WrappedComponent {...props} />;
  };
}
```

```jsx
const ProductListWithLoading = withLoading(ProductList);
```

### Render props

A component receives a function prop and calls it to decide what to render:

```jsx
function MouseTracker({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div
      onPointerMove={(event) =>
        setPosition({
          x: event.clientX,
          y: event.clientY,
        })
      }
    >
      {render(position)}
    </div>
  );
}
```

```jsx
<MouseTracker
  render={({ x, y }) => (
    <p>
      Pointer: {x}, {y}
    </p>
  )}
/>
```

These patterns were especially valuable before Hooks. In new code, a custom Hook is often simpler:

```jsx
function useMousePosition() {
  // State and event-listener behavior goes here
}
```

## Choosing the right type

| Situation                                               | Best component style                      |
| ------------------------------------------------------- | ----------------------------------------- |
| New interactive React UI                                | Function Component                        |
| Maintaining older lifecycle-based React code            | Class Component when already present      |
| RSC framework: database fetch / non-interactive content | Server Component                          |
| RSC framework: events, state, browser APIs              | Client Component                          |
| Reusable display-focused UI                             | Presentational function component         |
| Form needing React-driven validation and values         | Controlled component                      |
| File input or simple DOM-owned form value               | Uncontrolled component with a ref         |
| Reusing stateful behavior in new code                   | Custom Hook, rather than HOC/render props |

## Key takeaways

- Every React UI is composed from reusable components.[1][5]
- Prefer function components for new React code; class components are supported but not recommended for new implementations.[2]
- Server and Client Components are environment categories in RSC-capable frameworks, not replacements for function components.[3][4]
- Use Server Components for server-side data access and non-interactive rendering; isolate interactivity in Client Components.
- “Presentational,” “container,” “controlled,” “uncontrolled,” “HOC,” and “render-prop” labels describe architectural or behavior patterns, not separate core React syntaxes.
- Let React invoke your components through JSX so it can preserve identity, state, reconciliation behavior, and Hook ordering.[6]

## Interview answer

> A React component is a reusable JavaScript function that returns JSX, and its name begins with a capital letter. The main component type in modern React is the function component, which uses Hooks for state, effects, context, and refs. Class components are still supported and use `this.state`, `setState`, and lifecycle methods, but I would normally use function components for new work. In an RSC-enabled framework, components can also be Server Components, which run on the server and are good for direct data access and non-interactive UI, or Client Components, which use the `"use client"` boundary for browser APIs, event handlers, and local interactive state. Architecturally, I also distinguish presentational components from container components and choose controlled form components when React needs to own the input value.[1][2][3][4]

## Sources

1. Your First Component https://react.dev/learn/your-first-component
2. Component https://react.dev/reference/react/Component
3. Server Components https://react.dev/reference/rsc/server-components
4. 'use client' directive https://react.dev/reference/rsc/use-client
5. React https://react.dev/
6. React calls Components and Hooks https://react.dev/reference/rules/react-calls-components-and-hooks
7. Server Functions https://react.dev/reference/rsc/server-functions
8. Thinking in React https://react.dev/learn/thinking-in-react
9. 'use server' directive https://react.dev/reference/rsc/use-server
