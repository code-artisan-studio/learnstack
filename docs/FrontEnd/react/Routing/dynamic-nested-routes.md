---
title: Dynamic & Nested Routes
sidebar_label: Dynamic & Nested Routes
sidebar_position: 4
---

Dynamic routes, nested routes, and URL parameters let React Router represent real application structure: **which resource is being viewed** and **which section of that resource is active**. For example, `/accounts/123/transactions` can mean “account 123” plus its “transactions” child view.[1][2]

## Plain-language overview

A **static route** always has the same URL shape:

```text
/about
/settings
/products
```

A **dynamic route** has a variable URL segment:

```text
/products/:productId
/users/:userId
/accounts/:accountId
```

A **nested route** expresses a parent-child relationship between URLs and user-interface layouts. The parent provides persistent UI, and its child route fills a designated `<Outlet />` area.[1][3]

```text
/accounts/123/transactions
│         │   └── Child route: TransactionsPage
│         └────── Dynamic parameter: accountId = "123"
└──────────────── Parent route: AccountLayout
```

## Dynamic routes

A route segment beginning with `:` is a **dynamic segment**. When the URL matches, React Router extracts that portion and makes it available as a route parameter.[1][2]

```jsx
// Illustrative example — dynamic route declaration
<Route path="/products/:productId" element={<ProductDetailsPage />} />
```

This single declaration matches all of these URLs:

```text
/products/42
/products/laptop-pro-15
/products/clearance-item-2026
```

For `/products/42`, React Router produces:

```js
{
  productId: "42";
}
```

Dynamic values are strings because they originate in the URL. Parse and validate values when the domain needs a number, UUID, or another specific identifier format.

```jsx
import { useParams } from "react-router-dom";

export default function ProductDetailsPage() {
  const { productId } = useParams();

  return <h1>Product: {productId}</h1>;
}
```

`useParams()` returns an object containing the dynamic parameters matched by the current route branch. Child routes inherit parameters from their parent routes.[2]

## Multiple parameters

A single URL can contain multiple dynamic segments.

```jsx
<Route
  path="/customers/:customerId/accounts/:accountId"
  element={<AccountDetailsPage />}
/>
```

```text
URL: /customers/C-1001/accounts/A-4521

Params:
{
  customerId: "C-1001",
  accountId: "A-4521"
}
```

```jsx
import { useParams } from "react-router-dom";

export default function AccountDetailsPage() {
  const { customerId, accountId } = useParams();

  return (
    <h1>
      Customer {customerId}, account {accountId}
    </h1>
  );
}
```

Use unique dynamic segment names within a route pattern. If names are duplicated, later parameter values can overwrite earlier values in the params object.[1][4]

## Nested routes

Nested routes model a shared page shell plus changing content. The route tree is also a UI tree: a matching parent component renders, then its matching child component renders inside the parent’s `<Outlet />`.[1][3]

```jsx
// Illustrative example — route configuration
import { Routes, Route } from "react-router-dom";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHomePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<DashboardSettingsPage />} />
      </Route>
    </Routes>
  );
}
```

This creates these effective URLs:

```text
/dashboard           -> DashboardLayout + DashboardHomePage
/dashboard/analytics -> DashboardLayout + AnalyticsPage
/dashboard/settings  -> DashboardLayout + DashboardSettingsPage
```

Child paths are normally **relative**. The parent path is automatically included, so `path="analytics"` becomes `/dashboard/analytics`.[1]

## Outlet

A parent route must render `<Outlet />`; otherwise, React Router has no place to display the matched child route. `<Outlet />` renders the matching child route—or nothing if there is no matching child.[3]

```jsx
// Illustrative example — DashboardLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <section>
      <header>
        <h1>Operations Dashboard</h1>
      </header>

      <nav>
        <NavLink to="/dashboard" end>
          Home
        </NavLink>
        <NavLink to="analytics">Analytics</NavLink>
        <NavLink to="settings">Settings</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </section>
  );
}
```

Notice the relative links `to="analytics"` and `to="settings"`. They resolve beneath the current dashboard route, which makes the layout more reusable and reduces duplicated path strings.

## Index routes

An **index route** is the default child page for a parent URL. It renders inside the parent outlet when the parent route itself matches exactly.[1][5]

```jsx
<Route path="/dashboard" element={<DashboardLayout />}>
  <Route index element={<DashboardHomePage />} />
  <Route path="analytics" element={<AnalyticsPage />} />
</Route>
```

Without the index route, visiting `/dashboard` renders `DashboardLayout`, but its `<Outlet />` has no matching child and is empty.[5]

## Combined example

A realistic account portal typically combines all three concepts:

```jsx
// Illustrative example — routes.jsx
import { Routes, Route } from "react-router-dom";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/accounts/:accountId" element={<AccountLayout />}>
        <Route index element={<AccountOverviewPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="beneficiaries" element={<BeneficiariesPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

```text
/accounts/ACC-1001
└── AccountLayout(accountId = "ACC-1001")
    └── AccountOverviewPage

/accounts/ACC-1001/transactions
└── AccountLayout(accountId = "ACC-1001")
    └── TransactionsPage

/accounts/ACC-1001/statements
└── AccountLayout(accountId = "ACC-1001")
    └── StatementsPage
```

The account layout and all child pages can call `useParams()` and access the inherited `accountId`.[2]

```jsx
// Illustrative example — TransactionsPage.jsx
import { useParams } from "react-router-dom";

export default function TransactionsPage() {
  const { accountId } = useParams();

  return <h2>Transactions for {accountId}</h2>;
}
```

## Route matching flow

```text
User opens /accounts/ACC-1001/transactions
                  |
                  v
Router matches /accounts/:accountId
                  |
                  v
Extracts { accountId: "ACC-1001" }
                  |
                  v
Router matches child route "transactions"
                  |
                  v
Renders AccountLayout
                  |
                  v
<AccountLayout> renders <Outlet />
                  |
                  v
<Outlet> renders TransactionsPage
```

The parent layout and child page coexist in the component tree. This is why an account header, side navigation, and selected account context can remain visible while the active child page changes.

## Params versus query strings

Do not confuse **path parameters** with **query parameters**.

| URL form              | Example                                            | Best use                                                             |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Path parameter        | `/accounts/:accountId` -> `/accounts/ACC-1001`     | Identifies the primary resource or hierarchy being viewed            |
| Nested path parameter | `/customers/:customerId/accounts/:accountId`       | Identifies resources within a parent relationship                    |
| Query string          | `/accounts/ACC-1001/transactions?page=2&sort=date` | Optional filtering, sorting, pagination, search, and display options |

Use `useParams()` for dynamic path segments. Use `useSearchParams()` for query-string state; updating search parameters triggers a navigation.[2][6]

```jsx
import { useParams, useSearchParams } from "react-router-dom";

export default function TransactionsPage() {
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const sort = searchParams.get("sort") ?? "date";

  return (
    <p>
      Account: {accountId}; page: {page}; sort: {sort}
    </p>
  );
}
```

## Internal architecture

At navigation time, React Router compares the location to the route tree and identifies a matched route branch. It gathers dynamic segment values into a params object, renders parent route elements first, and places each matching child element in the parent’s outlet.[1][2][3]

```text
Route tree                         URL
/accounts/:accountId               /accounts/ACC-1001/transactions
  ├── index
  ├── transactions
  └── statements

Matched branch:
AccountLayout -> TransactionsPage

Inherited params:
{ accountId: "ACC-1001" }
```

The route hierarchy is therefore more than an organizational convention: it determines which layouts render, where child UI appears, and which route parameters descendant components can read.

## When to use dynamic routes

Use dynamic routes when a screen represents a member of a collection or a resource selected by an identifier:

- Product details: `/products/:productId`
- Support tickets: `/tickets/:ticketId`
- Customer profile: `/customers/:customerId`
- Insurance claim: `/claims/:claimId`
- Portfolio detail: `/portfolios/:portfolioId`
- Document version: `/documents/:documentId/versions/:versionId`

They create bookmarkable, shareable URLs that accurately identify what the user is viewing.

## When to use ne

Use nested routes when the user experience and URL structure have a genuine parent-child relationship:

- An account shell with Overview, Transactions, and Statements views
- A project workspace with Board, Issues, Members, and Settings
- An administrator shell with Users, Roles, Audit Logs, and Configuration
- A claims case page with Summary, Documents, Notes, and Payment views

Avoid nesting merely because components are stored in nested folders. Nest when the parent has shared UI, shared lifecycle or data needs, and an `Outlet` region where a child page belongs.

## Trade-offs and r

- **State behavior:** moving between sibling child routes generally retains the parent layout but unmounts the departing child page; local state in that child can reset.
- **URL design:** choose stable, human-meaningful route identifiers where appropriate, but avoid exposing sensitive data in a URL.
- **Parameter validation:** a parameter can be malformed, missing, or refer to a nonexistent resource; validate it before use and present a clear Not Found or validation state.
- **Authorization:** `/accounts/ACC-1001` is only an identifier in a UI route. The backend must authenticate the user and authorize access to that particular account.
- **Data dependencies:** a layout can own data common to all child routes, while children fetch or render their own specific content. Avoid refetching the same account summary in every child unnecessarily.
- **Over-nesting:** deeply layered route trees can obscure ownership, create confusing relative links, and make loading/error behavior harder to reason about.

## Banking, insurance, and finance examples

| Domain    | Route design                        | Problem solved                                                                                              |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Banking   | `/accounts/:accountId/transactions` | Keeps account navigation and balance context stable while displaying transactions for the selected account. |
| Insurance | `/claims/:claimId/documents`        | Provides a claim-specific shell and a focused documents child page for adjusters or customers.              |
| Finance   | `/portfolios/:portfolioId/holdings` | Associates holdings, performance, activity, and settings with one selected investment portfolio.            |

In each case, `accountId`, `claimId`, or `portfolioId` selects a resource for the UI, while backend services remain responsible for resource-level authorization.

## Practical implementation pattern

A robust page usually treats route parameters as input that must be validated before data is requested:

```jsx
// Illustrative example — AccountOverviewPage.jsx
import { useParams } from "react-router-dom";

export default function AccountOverviewPage() {
  const { accountId } = useParams();

  if (!accountId || !/^ACC-\d+$/.test(accountId)) {
    return <p>Invalid account reference.</p>;
  }

  // Fetching and authorization are illustrative only.
  return <h2>Overview for account {accountId}</h2>;
}
```

In a production application, the server should return a suitable 400, 404, or 403 response as appropriate. Do not rely on a client-side regular expression to enforce access controls.

## Interview answer — 2-minute version

Dynamic routes let a route pattern contain variable segments, such as `/accounts/:accountId`. React Router extracts the matched values as strings and exposes them through `useParams()`. Child routes inherit parameters from their parent route branch.[1][2]

Nested routes let the URL hierarchy mirror the UI hierarchy. A parent route renders shared layout content—such as an account header and navigation—and uses `<Outlet />` as the placeholder for whichever child route matches. An index route is the default child that fills the outlet when the user visits the parent URL directly.[3][5][1]

I use dynamic parameters for identity and hierarchy, such as `/claims/:claimId`, and query parameters for optional view state, such as filtering or pagination. I validate parameters, handle missing resources, and ensure the backend—not the frontend route—enforces authorization.

## Hands-on exercise

Build an **Incident Management** section with these URLs:

```text
/incidents
/incidents/:incidentId
/incidents/:incidentId/timeline
/incidents/:incidentId/assignees
```

1. Create an `IncidentLayout` parent route with `path="/incidents/:incidentId"`.
2. Add an index child route for incident details.
3. Add `timeline` and `assignees` child routes.
4. Render `NavLink` navigation and `<Outlet />` inside `IncidentLayout`.
5. In every child page, read `incidentId` through `useParams()` and display it.

**Expected outcome:** Navigating from `/incidents/INC-1042` to `/incidents/INC-1042/timeline` retains the incident shell and only changes the outlet content. All child routes can read `incidentId`.[2]

**Failure symptom:** The URL changes to `/incidents/INC-1042/timeline`, but no timeline appears.  
**Diagnostic hint:** Confirm that `IncidentLayout` includes `<Outlet />`, and that `timeline` is declared as a child route rather than as an unrelated route.[3]

**Failure symptom:** `useParams().incidentId` is `undefined`.  
**Diagnostic hint:** Verify that the matching ancestor route contains exactly `:incidentId`, and that the actual URL matches the intended route hierarchy.

## Knowledge check

1. What does `:accountId` mean in `/accounts/:accountId`?  
   **Answer:** It is a dynamic URL segment. Its matched value becomes `params.accountId`, available through `useParams()`.[1][2]

2. Why does a parent layout need `<Outlet />`?  
   **Answer:** It is the location where the matching child route renders; without it, the child route has no visible place in the parent UI.[3]

3. When should information be a route parameter rather than a query parameter?  
   **Answer:** Use a route parameter to identify the primary resource or hierarchy, such as an account or claim. Use query parameters for optional view state such as `page`, `sort`, or filters.

## Sources

1. Routing https://reactrouter.com/start/declarative/routing
2. useParams https://reactrouter.com/api/hooks/useParams
3. Outlet https://reactrouter.com/api/components/Outlet
4. Routing (main branch) https://reactrouter.com/main/start/declarative/routing
5. Address Book https://reactrouter.com/tutorials/address-book
6. useSearchParams https://reactrouter.com/api/hooks/useSearchParams
7. Routing https://reactrouter.com/start/framework/routing
8. Routing https://reactrouter.com/start/data/routing
9. File Route Conventions https://reactrouter.com/how-to/file-route-conventions
10. CHANGELOG.md https://reactrouter.com/changelog
11. useNavigate https://reactrouter.com/api/hooks/useNavigate
12. createHashRouter https://reactrouter.com/api/data-routers/createHashRouter
13. NavLink https://reactrouter.com/api/components/NavLink
14. Routing v8.2.0 https://reactrouter.com/8.2.0/start/declarative/routing
15. Routing v7.18.2 https://reactrouter.com/7.18.2/start/framework/routing
