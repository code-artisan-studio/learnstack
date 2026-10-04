---
title: React Router Fundamentals
sidebar_label: React Router Fundamentals
sidebar_position: 1
---

React Router maps browser URLs to React user interfaces. In a React single-page application (SPA), it changes the displayed component and browser history without normally reloading the entire document.

## Core idea

Think of routing as a lookup table:

```text
URL                     React UI
/                       HomePage
/products               ProductsPage
/products/42            ProductDetailsPage
/account/settings       SettingsPage
```

A router performs three connected jobs: it observes and updates browser history, matches the current URL against your route definitions, and renders the corresponding nested React UI.[2]

## Key terms

| Term                | Meaning                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Route**           | A rule that maps a URL pattern such as `/products` to a React element or component. [3]                         |
| **Router**          | The provider that connects the app to a navigation mechanism, commonly the browser’s URL and history stack. [2] |
| **`BrowserRouter`** | A router for normal web applications that use the browser’s History API and clean paths such as `/products`.    |
| **`Routes`**        | The container that evaluates its child routes and renders the best match. [3]                                   |
| **`Route`**         | A route declaration, usually containing `path` and `element`. [3]                                               |
| **`Link`**          | A navigation-aware alternative to an ordinary anchor tag; it enables client-side navigation when possible. [4]  |
| **`NavLink`**       | A `Link` variant that can identify the currently active route, useful for navigation menus. [3]                 |
| **`Outlet`**        | A placeholder in a parent route where its matching child route renders. [5]                                     |
| **URL parameter**   | A dynamic path value, such as `:productId` in `/products/:productId`.                                           |
| **Query string**    | URL data after `?`, such as `/products?sort=price`.                                                             |

## Minimal setup

Install the package:

```bash
npm install react-router-dom
```

Then wrap your application in `BrowserRouter`, usually in `main.jsx` or `main.tsx`.

```jsx
// Illustrative example — main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

`BrowserRouter` provides routing context to components below it, allowing route components and hooks such as `useNavigate` to work.

## Defining routes

Use `<Routes>` to group route definitions and `<Route>` to associate URL patterns with UI.

```jsx
// Illustrative example — App.jsx
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

The wildcard route, `path="*"`, is the conventional fallback for URLs that do not match another route. A route pattern is matched to the location, and its element is rendered when it matches.[2]

## Navigation flow

When a user chooses an internal link, React Router updates the browser history and re-renders the UI for the new location rather than letting the browser perform its standard full-document navigation.[2][4]

```text
User clicks <Link to="/products">
            |
            v
React Router intercepts internal navigation
            |
            v
History stack receives /products
            |
            v
Router matches URL against route tree
            |
            v
React renders ProductsPage
```

Use `Link` for in-app destinations:

```jsx
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/products">Products</Link>
      <Link to="/about">About</Link>
    </nav>
  );
}
```

Do not use a plain `<a href="/products">` for ordinary internal navigation unless you intentionally want a document reload. Use a normal anchor for external destinations such as `https://example.com`.

## Active navigation

`NavLink` is useful when a navigation item should look different on its corresponding page.

```jsx
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <nav>
      <NavLink to="/" end>
        Dashboard
      </NavLink>
      <NavLink to="/products">Products</NavLink>
      <NavLink to="/reports">Reports</NavLink>
    </nav>
  );
}
```

The `end` prop prevents the root navigation item from being considered active for every URL that starts with `/`.

## Nested routes

Nested routes model a shared layout plus a changing content area. The parent component renders `<Outlet />`, which is where the matching child route appears.[5][6]

```text
/account
├── AccountLayout
│   ├── Shared account navigation
│   └── <Outlet />
│       ├── /account          -> AccountOverview
│       ├── /account/profile  -> ProfilePage
│       └── /account/security -> SecurityPage
```

```jsx
// Illustrative example — App.jsx
import { Routes, Route } from "react-router-dom";
import AccountLayout from "./layouts/AccountLayout";
import AccountOverview from "./pages/AccountOverview";
import ProfilePage from "./pages/ProfilePage";
import SecurityPage from "./pages/SecurityPage";

export default function App() {
  return (
    <Routes>
      <Route path="/account" element={<AccountLayout />}>
        <Route index element={<AccountOverview />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
    </Routes>
  );
}
```

```jsx
// Illustrative example — AccountLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

export default function AccountLayout() {
  return (
    <>
      <h1>My Account</h1>

      <nav>
        <NavLink to="/account" end>
          Overview
        </NavLink>
        <NavLink to="profile">Profile</NavLink>
        <NavLink to="security">Security</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </>
  );
}
```

An **index route** is the default child route: it renders in its parent’s outlet when the URL matches the parent exactly.[3][6]

## Route parameters

Dynamic segments allow one route to serve many resource URLs.

```jsx
import { Routes, Route } from "react-router-dom";
import ProductDetailsPage from "./pages/ProductDetailsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/products/:productId" element={<ProductDetailsPage />} />
    </Routes>
  );
}
```

For the URL `/products/42`, the route parameter is `productId = "42"`.

```jsx
// Illustrative example — ProductDetailsPage.jsx
import { useParams } from "react-router-dom";

export default function ProductDetailsPage() {
  const { productId } = useParams();

  return <h1>Product {productId}</h1>;
}
```

Treat route parameters as untrusted input: validate their format and authorization server-side before returning sensitive data. A route like `/customers/123` must not by itself grant access to customer 123.

## Programmatic navigation

Use `useNavigate()` when navigation results from application logic rather than a direct click on a visible link—for example, after login, form submission, or a successful checkout. React Router identifies `Link` and programmatic `navigate` as its two primary navigation mechanisms.[2]

```jsx
// Illustrative example — LoginPage.jsx
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  async function handleLogin() {
    const authenticated = true; // Replace with real authentication logic.

    if (authenticated) {
      navigate("/dashboard");
    }
  }

  return <button onClick={handleLogin}>Sign in</button>;
}
```

Use `navigate("/dashboard", { replace: true })` after a login redirect if the user should not return to the login page when pressing Back.

## Query strings

Query strings represent optional URL state, often used for filtering, sorting, pagination, or search.

```text
/products?category=laptops&sort=price&page=2
```

```jsx
import { useSearchParams } from "react-router-dom";

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get("category") ?? "all";
  const page = Number(searchParams.get("page") ?? "1");

  function showLaptops() {
    setSearchParams({ category: "laptops", page: "1" });
  }

  return (
    <>
      <p>Category: {category}</p>
      <p>Page: {page}</p>
      <button onClick={showLaptops}>Show laptops</button>
    </>
  );
}
```

A useful rule is: place **shareable, bookmarkable UI state** in the URL, but keep purely temporary component state—such as whether a small dropdown is open—in React component state.

## Internal architecture

At runtime, React Router maintains the current **location**—typically pathname, search string, hash, and history state—and compares it with the route tree. A single URL can match a branch of nested routes, and each route in that branch contributes part of the resulting UI.[2]

```text
Route definitions
      |
      v
Current browser location: /account/security
      |
      v
Matched route branch:
AccountLayout -> SecurityPage
      |
      v
React renders AccountLayout
      |
      v
<Outlet /> renders SecurityPage
```

The router does not normally create a new browser document or reset JavaScript memory during client-side navigation. React instead reconciles the old and new component trees. Components outside the changing route branch, such as a top-level application shell, may remain mounted; components that leave the matched branch can unmount, so local state within them can be lost.

This behavior matters architecturally: keep durable state in appropriate places, such as URL state, a context provider above the changing route branch, or a dedicated client-state store when necessary. Avoid automatically putting all state into a global store.

## When to use it

React Router is a strong fit when your application has multiple addressable screens or views:

- A customer portal with Dashboard, Accounts, Transfers, Statements, and Support pages
- An e-commerce application with catalog, search, product details, cart, and checkout flows
- An internal operations tool with nested areas such as `/claims`, `/claims/:claimId`, and `/claims/:claimId/documents`
- Any app where users should be able to bookmark, share, refresh, and use the Back and Forward buttons reliably

## When not to use it

Do not introduce a full routing layer for a tiny embedded React widget with one view and no meaningful URL-driven navigation.

Also avoid using routes as a substitute for every piece of UI state. For example, a tooltip, local modal visibility, or an input’s unsaved keystrokes usually belong in component state unless making that state URL-addressable has a deliberate user benefit.

## Benefits

- **Deep linking:** users can bookmark or share a specific product, account view, report, or workflow step.
- **Browser-native navigation:** Back, Forward, history, and URL visibility behave as users expect.[2]
- **Composable layouts:** nested routes plus `Outlet` let teams implement stable application shells and focused child pages.[5][6]
- **Separation of concerns:** URL-to-UI mappings become explicit rather than being scattered through conditional rendering logic.
- **Incremental complexity:** declarative routing is sufficient for simple apps, while React Router also supports more advanced data-routing and framework-oriented capabilities.[1][7]

## Trade-offs

- **Server configuration:** with `BrowserRouter`, directly refreshing `/products/42` requires the web server or hosting platform to return the React entry document for unknown application paths; otherwise users may receive a server-side 404.
- **Authorization:** hiding a route or redirecting a user is a user-experience control, not a security boundary. APIs and backend services must enforce authorization independently.
- **State loss:** a route transition can unmount page components, removing their local state unless it is deliberately preserved.
- **Complexity:** deeply nested layouts, ad hoc redirects, and inconsistent URL conventions can make an application difficult to reason about.
- **Data coordination:** basic declarative routes map URLs to UI, but fetching, mutation, loading states, and error recovery need a coherent strategy—either component-managed fetching or React Router’s route-level data features. Route modules can define loaders, actions, revalidation, and error boundaries in the data-oriented approach.[7]

## Financial-services example

A banking application might model a customer’s account area this way:

```text
/accounts
/accounts/:accountId
/accounts/:accountId/transactions
/accounts/:accountId/statements
/accounts/:accountId/beneficiaries
```

The layout route can keep an account summary and navigation visible while child routes render transactions, statements, or beneficiaries inside an outlet. The UI route parameter identifies the requested account, but every API call must still verify that the authenticated customer is entitled to access that account.

For insurance, `/claims/:claimId` can lead to nested claim details, documents, timeline, and payments pages. For investment platforms, `/portfolio/:portfolioId/holdings` and `/portfolio/:portfolioId/activity` support shareable, auditable navigation while preserving a consistent portfolio shell.

## Interview answer — 2-minute version

React Router is the routing library commonly used to map browser URLs to React user interfaces in a single-page application. At its core, the router observes browser history, matches the current location against a declarative route tree, and renders the matching route elements.[2]

For a basic application, I wrap the app in `BrowserRouter`, define paths with `Routes` and `Route`, use `Link` or `NavLink` for internal navigation, and use `useNavigate` for navigation triggered by business logic. Nested routes enable shared layouts, with the parent rendering `Outlet` where the active child page appears.[3][5]

Architecturally, I treat the URL as state for pages, resource identifiers, filters, and other shareable state. I avoid treating the frontend router as an authorization mechanism; APIs must validate both authentication and resource-level permission. In production, I also ensure the deployment platform supports SPA history fallback so deep links work on page refresh.

## Hands-on exercise

Build a three-page “IT Operations Portal” with these URLs:

- `/` — Dashboard
- `/incidents` — Incident list
- `/incidents/:incidentId` — Incident details
- Any other path — Not Found

**Expected outcome:** Clicking an incident updates the URL and renders its details without a full document reload. Opening `/incidents/INC-1042` directly should show the detail screen after your server fallback is configured.

**Common symptom:** `useNavigate() may be used only in the context of a <Router> component.`  
**Hint:** Confirm that `BrowserRouter` wraps the component where the hook runs.

**Common symptom:** Navigation works during development, but refreshing `/incidents/INC-1042` returns a 404 after deployment.  
**Hint:** Configure the hosting server to serve `index.html` for unknown client-side routes, while preserving real static asset and API paths.

## Knowledge check

1. Why is `<Link to="/products">` generally preferable to `<a href="/products">` for internal navigation?  
   **Answer:** `Link` participates in client-side routing and browser-history management, avoiding the normal full-document navigation when possible.[2][4]

2. What problem does `<Outlet />` solve?  
   **Answer:** It identifies where a matching child route renders inside a parent layout.[5]

3. Should `/accounts/:accountId` be considered an authorization control?  
   **Answer:** No. It is only a UI routing pattern; the backend must authenticate the caller and authorize access to the requested account.

## Sources

1. React Router Official Documentation https://reactrouter.com/
2. Main Concepts v6.30.4 - React Router https://reactrouter.com/6.30.4/start/concepts
3. Routing | React Router https://reactrouter.com/start/declarative/routing
4. Link - React Router https://reactrouter.com/api/components/Link
5. Outlet - React Router https://reactrouter.com/api/components/Outlet
6. Routing https://reactrouter.com/start/framework/routing
7. Route Object - React Router https://reactrouter.com/start/data/route-object
8. React Router - W3Schools https://www.w3schools.com/react/react_router.asp
9. react-router/docs/start/declarative/routing.md at main - GitHub https://github.com/remix-run/react-router/blob/main/docs/start/declarative/routing.md
10. React Navigation | Ionic Framework https://ionicframework.com/docs/react/navigation
11. How to use React Router v7 in React apps - LogRocket Blog https://blog.logrocket.com/react-router-v7-guide/
12. React Router v7: Declarative, Custom, and Framework Routing https://dev.to/tishonator/react-router-v7-declarative-custom-and-framework-routing-a-developers-quick-guide-21bc
13. React Router Demystified: A Developer's Guide to Efficient Routing https://www.travis-ci.com/blog/react-router-demystified-a-developers-guide-to-efficient-routing/
14. How to handle route specificity issues when incrementally adopting ... https://www.reddit.com/r/reactjs/comments/1hwi2ka/how_to_handle_route_specificity_issues_when/
15. learn.react-js.dev › ecosystem › routingRouting | React Deep Dive https://learn.react-js.dev/ecosystem/routing
