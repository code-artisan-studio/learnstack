---
title: React Router Components
sidebar_label: Router Components
sidebar_position: 2
---

React Router components are the building blocks that connect the browser URL, route definitions, navigation links, layouts, redirects, and rendered page content. The core components to master first are the router provider, `<Routes>`, `<Route>`, `<Link>`, `<NavLink>`, `<Outlet>`, and `<Navigate>`.[1][2]

## Big picture

A typical component hierarchy looks like this:

```text
<BrowserRouter>
  <AppShell>
    <Header>
      <NavLink />
    </Header>

    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
      </Route>
    </Routes>
  </AppShell>
</BrowserRouter>
```

The router provider supplies location and navigation context, `<Routes>` finds the best matching route branch, and `<Route>` specifies which UI to render for each route pattern.[3][4][5]

## Router provider

A router provider connects React Router to a navigation source. For ordinary browser applications, `BrowserRouter` is the usual provider because it uses the browser History API.[5]

```jsx
// Illustrative example — main.jsx
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
```

Without a router provider, route components and router hooks have no location context, leading to errors such as “useNavigate may be used only in the context of a Router.”

### Common router providers

| Component         | Use case                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `<BrowserRouter>` | Default web application router; puts route paths in normal URLs such as `/products`. [5]                 |
| `<HashRouter>`    | Restricted static hosting; puts application routes after `#`, which is not sent to the server.           |
| `<MemoryRouter>`  | Tests, Storybook, React Native-like environments, or situations where URL changes should stay in memory. |
| `<StaticRouter>`  | Server-side rendering scenarios, where the location comes from the incoming server request.              |

## Routes

`<Routes>` examines its child `<Route>` declarations and renders the branch that best matches the current location.[4]

```jsx
import { Routes, Route } from "react-router-dom";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

Use one route tree as the central, understandable map of your application. Multiple `<Routes>` groups are possible, but beginners should avoid scattering route declarations across unrelated components unless there is a clear modular reason.

## Route

`<Route>` defines how a URL pattern maps to UI. It must appear within a `<Routes>` component.[3]

```jsx
<Route path="/products" element={<ProductsPage />} />
```

Key props include:

| Prop           | Purpose                                                                        | Example                                  |
| -------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| `path`         | URL pattern to match                                                           | `path="/products/:productId"`            |
| `element`      | React element to render on a match                                             | `element={<ProductPage />}`              |
| `index`        | Default child route for a parent path                                          | `<Route index element={<Overview />} />` |
| `children`     | Nested routes                                                                  | Routes below a shared layout             |
| `errorElement` | UI for route-level rendering or data-loading errors in applicable router modes | `errorElement={<RouteError />}`          |

A route with no `path` can be used as a **layout route**: it contributes shared UI and an outlet without adding a URL segment.[3]

## Link

`<Link>` is the standard component for internal navigation. It is a progressively enhanced wrapper around an HTML anchor, enabling client-side routing when possible.[6]

```jsx
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/products">Products</Link>
      <Link to="/support">Support</Link>
    </nav>
  );
}
```

Prefer `Link` rather than `<a href="/products">` for internal pages because it preserves the SPA experience, avoids an unnecessary document reload, and updates client-side history. For external destinations, use a normal `<a>` element.

## NavLink

`<NavLink>` extends `<Link>` with route-aware active-state behavior, making it appropriate for primary navigation, sidebars, and tabs. It automatically applies `aria-current="page"` when active, which helps accessibility.[7]

```jsx
import { NavLink } from "react-router-dom";

export default function MainNavigation() {
  return (
    <nav>
      <NavLink to="/" end>
        Dashboard
      </NavLink>
      <NavLink to="/accounts">Accounts</NavLink>
      <NavLink to="/reports">Reports</NavLink>
    </nav>
  );
}
```

The `end` prop matters for the root link: without it, `/` can match every URL and make “Dashboard” appear active everywhere. `NavLink` also supports active and pending styling; pending state is available in React Router’s Framework and Data modes.[7]

```jsx
<NavLink
  to="/reports"
  className={({ isActive }) => (isActive ? "active-link" : "nav-link")}
>
  Reports
</NavLink>
```

## Outlet

`<Outlet>` is a placeholder where the matching child route renders. It enables nested layouts such as an account shell with a stable sidebar and a page-specific content area.[8]

```jsx
// Illustrative example — AccountLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

export default function AccountLayout() {
  return (
    <section>
      <h1>Account Center</h1>

      <nav>
        <NavLink to="/account" end>
          Overview
        </NavLink>
        <NavLink to="transactions">Transactions</NavLink>
        <NavLink to="statements">Statements</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </section>
  );
}
```

```jsx
// Illustrative example — routes.jsx
<Routes>
  <Route path="/account" element={<AccountLayout />}>
    <Route index element={<AccountOverview />} />
    <Route path="transactions" element={<TransactionsPage />} />
    <Route path="statements" element={<StatementsPage />} />
  </Route>
</Routes>
```

For `/account/transactions`, React Router renders `AccountLayout`, then renders `TransactionsPage` inside `AccountLayout`’s `<Outlet />`. An outlet renders the matching child route or nothing when no child route matches.[8]

## Navigate

`<Navigate>` redirects by rendering a component that changes the location. It is primarily useful in class components, where hooks cannot be used; React Router recommends `useNavigate` for function components.[9]

```jsx
import { Navigate } from "react-router-dom";

export default function LegacyProtectedPage({ isAuthenticated }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <SensitivePage />;
}
```

`replace` substitutes the current history entry instead of adding another one. It is useful after redirects such as an unauthenticated attempt to view a protected page, so users do not loop back to the blocked URL with the Back button.[9]

For function components, use the hook instead:

```jsx
import { useNavigate } from "react-router-dom";

export default function CheckoutComplete() {
  const navigate = useNavigate();

  function continueShopping() {
    navigate("/products");
  }

  return <button onClick={continueShopping}>Continue shopping</button>;
}
```

For an ordinary user-clicked navigation, prefer `Link` or `NavLink`; they provide better native affordances such as keyboard behavior, opening in a new tab, and context-menu support. Use programmatic navigation for logic-driven transitions such as completed sign-in, timed logout, or successful form submission.[2]

## Form

React Router also offers a `<Form>` component in its data-oriented and framework modes. It progressively enhances an HTML form so submissions can invoke route actions and expose navigation state for pending user interfaces.[10]

```jsx
// Illustrative example — requires a data/framework router setup
import { Form } from "react-router-dom";

export default function TransferForm() {
  return (
    <Form method="post">
      <input name="amount" type="number" min="1" />
      <button type="submit">Submit transfer</button>
    </Form>
  );
}
```

Do not confuse this with a standard controlled React form. Use React Router’s `Form` when you have adopted route actions and want browser-like submission semantics, route-aware pending states, and progressive enhancement.

## Component flow

```text
<BrowserRouter>
        |
        | Provides current location and navigation methods
        v
<Routes>
        |
        | Selects best matching route branch
        v
<Route path="/account" element={<AccountLayout />}>
        |
        v
<AccountLayout>
        |
        | Renders persistent account shell
        v
<Outlet>
        |
        v
<Route path="transactions" element={<TransactionsPage />} />
```

This design separates responsibilities: the router manages location, route declarations map locations to UI, layouts define shared structure, and pages implement screen-specific behavior.[1][4][8]

## When to use each

| Need                                                     | Component or approach |
| -------------------------------------------------------- | --------------------- |
| Connect app to normal browser URLs                       | `<BrowserRouter>`     |
| Declare a set of route matches                           | `<Routes>`            |
| Associate a URL pattern with page UI                     | `<Route>`             |
| Navigate from a normal clickable UI element              | `<Link>`              |
| Render a menu item with active styling                   | `<NavLink>`           |
| Render child pages inside a parent layout                | `<Outlet>`            |
| Redirect declaratively, especially from class components | `<Navigate>`          |
| Navigate after application logic completes               | `useNavigate()`       |
| Submit to a route action in data/framework mode          | `<Form>`              |

## Common mistakes

- **Using `<a>` for internal app routes:** this triggers a document navigation instead of router-aware client-side navigation; prefer `<Link>`.[6]
- **Forgetting `<Outlet>`:** child routes technically match, but no child page appears inside the parent layout.[8]
- **Writing absolute paths unnecessarily:** inside a nested layout, `to="transactions"` clearly represents a child route, while `to="/account/transactions"` is absolute.
- **Omitting `end` on a root `NavLink`:** the root item can remain active on all pages.[7]
- **Using frontend redirects as access control:** redirects improve user experience, but server APIs must enforce authentication and authorization.
- **Placing `<Route>` outside `<Routes>`:** route declarations must be descendants of `<Routes>`.[3]

## Banking example

A banking portal could use an `AccountLayout` route to retain account navigation while switching only the detail area:

```text
/accounts/:accountId
├── AccountLayout
│   ├── Account summary header
│   ├── NavLink: Overview
│   ├── NavLink: Transactions
│   ├── NavLink: Statements
│   └── Outlet
│       ├── OverviewPage
│       ├── TransactionsPage
│       └── StatementsPage
```

This makes account pages consistent and helps users move predictably between related information. The account ID in the route selects a requested resource, but the API must independently ensure that the signed-in user may access it.

## Interview answer — 2-minute version

React Router components divide routing into clear responsibilities. A router provider—typically `BrowserRouter`—connects the application to browser location and history. `Routes` chooses the best matching branch of `Route` elements, and each `Route` maps a URL pattern to React UI.[3][4][5]

For navigation, I use `Link` for ordinary internal links and `NavLink` when an active state is needed in menus or tabs. For route composition, nested routes plus `Outlet` let me build shared layouts where the parent shell persists and only the matching child view changes.[1][6][8]

For redirects, I generally use `useNavigate` in function components after an application event, and use `Navigate` mainly where a class component requires a declarative redirect. I also distinguish client-side route protection from actual authorization: route guards are UX controls; APIs remain responsible for enforcing access.[2][9]

## Hands-on exercise

Build an “Operations Console” containing:

```text
/                  Dashboard
/incidents         Incident list
/incidents/:id     Incident details
/settings          Settings
/unknown-url       Not Found
```

Requirements:

1. Use `BrowserRouter`, `Routes`, and `Route`.
2. Add a sidebar with `NavLink` items for Dashboard, Incidents, and Settings.
3. Create an `AppLayout` containing the sidebar and `<Outlet />`.
4. Make `/incidents` an incident-list route and `/incidents/:id` a child detail route.
5. Add `path="*"` for the Not Found page.

**Expected outcome:** The sidebar remains visible while pages appear inside the layout outlet, and the active `NavLink` changes as the URL changes.

**Failure symptom:** The URL becomes `/incidents`, but the page area is blank.  
**Diagnostic hint:** Confirm that the layout component renders `<Outlet />`.

**Failure symptom:** The Dashboard navigation item remains active when viewing Incidents.  
**Diagnostic hint:** Add the `end` prop to the `NavLink` whose `to` value is `/`.

## Sources

1. Routing | React Router https://reactrouter.com/start/declarative/routing
2. reactrouter.com › start › libraryNavigating | React Router https://reactrouter.com/start/declarative/navigating
3. Route https://reactrouter.com/api/components/Route
4. Routes https://reactrouter.com/api/components/Routes
5. BrowserRouter https://reactrouter.com/api/declarative-routers/BrowserRouter
6. Link https://reactrouter.com/api/components/Link
7. NavLink https://reactrouter.com/api/components/NavLink
8. Outlet https://reactrouter.com/api/components/Outlet
9. Navigate https://reactrouter.com/api/components/Navigate
10. Form https://reactrouter.com/api/components/Form
11. PrefetchPageLinks https://reactrouter.com/api/components/PrefetchPageLinks
12. ScrollRestoration https://reactrouter.com/api/components/ScrollRestoration
13. Await https://reactrouter.com/api/components/Await
14. reactrouter.com https://reactrouter.com/api/components/NavLink.md
15. Links https://reactrouter.com/api/components/Links
16. Installation https://reactrouter.com/start/declarative/installation
