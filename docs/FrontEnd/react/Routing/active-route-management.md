---
title: Active Route Management
sidebar_label: Active Route Management
sidebar_position: 7
---

Active route management is how a React app detects the user’s current URL and reflects it in the interface—for example, highlighting the active sidebar item, expanding the correct menu section, selecting a tab, or rendering route-specific actions. In React Router, use `<NavLink>` for navigation links and `useMatch()` or `useLocation()` when route-aware state is needed outside a link.[1][2]

## Core idea

The current browser location is the source of truth:

```text
Current URL: /accounts/ACC-1001/transactions

UI consequences:
- "Accounts" sidebar section is active
- "Transactions" tab is active
- AccountLayout renders
- TransactionsPage renders in <Outlet />
- Page title may read "Transactions | Account ACC-1001"
```

Avoid duplicating this information in local React state, such as `useState("transactions")`. If the URL changes through Back, Forward, a deep link, or code-driven navigation, manually maintained “active” state can become incorrect. React Router instead determines whether a path pattern matches the current location.[2][3]

## NavLink

`<NavLink>` is the simplest and most appropriate tool for active navigation items. It wraps `<Link>` and exposes active and pending state for styling or conditional rendering.[1][4]

```jsx
import { NavLink } from "react-router-dom";

export default function MainNavigation() {
  return (
    <nav aria-label="Main navigation">
      <NavLink to="/" end>
        Dashboard
      </NavLink>
      <NavLink to="/accounts">Accounts</NavLink>
      <NavLink to="/reports">Reports</NavLink>
    </nav>
  );
}
```

When the link’s target matches the current route, React Router considers it active. An active `NavLink` also receives `aria-current="page"`, which gives screen-reader users useful location context.[1]

## Active styling

For simple styling, React Router applies an `active` class to an active `NavLink`.[4]

```css
nav a {
  color: #475569;
  text-decoration: none;
}

nav a.active {
  color: #0f172a;
  font-weight: 700;
  border-bottom: 2px solid currentColor;
}
```

For richer control, supply a callback to `className`, `style`, or `children`. The callback receives `isActive`; in Data and Framework modes, it can also receive `isPending` and `isTransitioning`.[1][5]

```jsx
<NavLink
  to="/reports"
  className={({ isActive, isPending }) =>
    [
      "nav-item",
      isActive ? "nav-item--active" : "",
      isPending ? "nav-item--pending" : "",
    ]
      .filter(Boolean)
      .join(" ")
  }
>
  Reports
</NavLink>
```

## Exact versus prefix matching

By default, a link can remain active when the current URL is beneath its path.

```text
NavLink target: /accounts
Current URL:    /accounts/ACC-1001/transactions

Result: active
```

This is useful for a sidebar section: “Accounts” remains active while the user views one account, its transactions, or statements. React Router documents this behavior for paths such as `/tasks` and child locations such as `/tasks/123`.[1]

Use `end` when you want an exact terminal match:

```jsx
<NavLink to="/accounts" end>
  All accounts
</NavLink>
```

```text
Link target              Current URL                         Active?
/accounts                /accounts                           Yes
/accounts                /accounts/ACC-1001                  Yes
/accounts end            /accounts                           Yes
/accounts end            /accounts/ACC-1001                  No
```

React Router treats the root link specially: `<NavLink to="/">` matches only the root location so it does not become active across the entire application.[1]

## Tabs with active routes

Tabs are often route-driven because each tab should be shareable, bookmarkable, and Back-button friendly.

```jsx
// Illustrative example — AccountTabs.jsx
import { NavLink } from "react-router-dom";

export default function AccountTabs() {
  return (
    <nav aria-label="Account sections" className="tabs">
      <NavLink to="." end className="tab">
        Overview
      </NavLink>

      <NavLink to="transactions" className="tab">
        Transactions
      </NavLink>

      <NavLink to="statements" className="tab">
        Statements
      </NavLink>
    </nav>
  );
}
```

```css
.tab {
  padding: 0.75rem 1rem;
  border-bottom: 2px solid transparent;
}

.tab.active {
  border-bottom-color: #2563eb;
  color: #1d4ed8;
  font-weight: 600;
}
```

This pattern works naturally with nested routes:

```text
/accounts/ACC-1001               -> Overview tab active
/accounts/ACC-1001/transactions  -> Transactions tab active
/accounts/ACC-1001/statements    -> Statements tab active
```

## useMatch

Use `useMatch()` when you need match information in a component that is **not itself a link**. It returns a match object when the pattern matches the current URL, or `null` when it does not.[2]

```jsx
import { useMatch } from "react-router-dom";

export default function AccountsMenuGroup() {
  const isAccountsArea = Boolean(useMatch("/accounts/*"));

  return (
    <section className={isAccountsArea ? "menu-group expanded" : "menu-group"}>
      <h2>Accounts</h2>
      {isAccountsArea && <p>Account-related navigation is expanded.</p>}
    </section>
  );
}
```

This is valuable for:

- Expanding the correct sidebar accordion group
- Showing a section-specific toolbar
- Applying an active border to a non-link container
- Switching route-aware page layout behavior
- Determining whether to display an “Account context” panel

A pattern can include dynamic segments:

```jsx
const match = useMatch("/accounts/:accountId/*");

if (match) {
  console.log(match.params.accountId);
}
```

For `/accounts/ACC-1001/transactions`, this matches and exposes `accountId: "ACC-1001"`.[2]

## useLocation

`useLocation()` returns the current location object, including `pathname`, `search`, `hash`, and optional navigation state. It is useful when active status depends on details outside ordinary path matching.[1][6]

```jsx
import { useLocation } from "react-router-dom";

export default function ReportsToolbar() {
  const location = useLocation();
  const isReportsSection = location.pathname.startsWith("/reports");

  return (
    <header>
      <h1>{isReportsSection ? "Reports" : "Workspace"}</h1>
    </header>
  );
}
```

Use `useLocation()` for cross-cutting concerns such as analytics, title updates, scroll policies, route-transition instrumentation, or query-string-aware UI. For simple path matching, favor `NavLink` or `useMatch()` because they state intent more clearly than manual string checks.[2][6]

## Query-aware active state

`NavLink` active matching is primarily path-based. If distinct screens are distinguished by query-string values, use `useSearchParams()` or `useLocation()` and define the active condition explicitly.

```text
/reports?period=monthly
/reports?period=quarterly
```

```jsx
import { Link, useSearchParams } from "react-router-dom";

export default function ReportPeriodTabs() {
  const [searchParams] = useSearchParams();
  const period = searchParams.get("period") ?? "monthly";

  return (
    <nav aria-label="Reporting period">
      <Link
        to="/reports?period=monthly"
        className={period === "monthly" ? "tab active" : "tab"}
      >
        Monthly
      </Link>

      <Link
        to="/reports?period=quarterly"
        className={period === "quarterly" ? "tab active" : "tab"}
      >
        Quarterly
      </Link>
    </nav>
  );
}
```

Query strings are appropriate for shareable view state such as filters, sorting, pagination, and report periods. Do not infer query-state activity using only a `pathname` comparison because both examples have the same pathname.

## Pending state

In React Router Data and Framework modes, `NavLink` can expose `isPending`, enabling feedback while a destination route’s data is loading.[1][7]

```jsx
<NavLink
  to="/claims"
  className={({ isActive, isPending }) => {
    if (isPending) return "nav-item nav-item--loading";
    if (isActive) return "nav-item nav-item--active";
    return "nav-item";
  }}
>
  Claims
</NavLink>
```

```text
idle -> user selects Claims -> pending -> active
```

Pending navigation feedback improves perceived responsiveness and helps prevent users from wondering whether their click was registered. It is not generally available in basic declarative routing without the Data or Framework router capabilities.[5][1]

## Route-driven page metadata

The active route can also control document title, breadcrumbs, and context actions.

```jsx
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export default function RouteTitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith("/accounts")) {
      document.title = "Accounts | Operations Portal";
    } else if (pathname.startsWith("/reports")) {
      document.title = "Reports | Operations Portal";
    } else {
      document.title = "Operations Portal";
    }
  }, [pathname]);

  return null;
}
```

For a large application, centralize route metadata or derive it from the matched route hierarchy rather than maintaining a long chain of `if` statements in a global component.

## Architecture pattern

A maintainable navigation system separates these responsibilities:

```text
URL / router location
        |
        +--> Route tree: selects page/layout
        |
        +--> NavLink: active menu and tabs
        |
        +--> useMatch: active non-link sections
        |
        +--> useLocation/useSearchParams: URL-based UI state
        |
        +--> Route metadata: title, breadcrumbs, analytics
```

The key architectural principle is **derive navigation state from the URL** whenever it must survive refresh, sharing, bookmarks, Back/Forward navigation, or deep linking.

## When to use each approach

| Requirement                                          | Preferred API                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Highlight a normal menu, tab, or sidebar link        | `<NavLink>`                                                          |
| Highlight a parent section for all descendant routes | `<NavLink to="/section">` without `end`, or `useMatch("/section/*")` |
| Highlight only one exact route                       | `<NavLink end>`                                                      |
| Expand a non-link accordion or show a context panel  | `useMatch()`                                                         |
| React to pathname, query, hash, or location state    | `useLocation()`                                                      |
| Track filter/tab state represented in query strings  | `useSearchParams()`                                                  |
| Show a loading style before the destination is ready | `NavLink` with `isPending` in Data/Framework mode                    |

## Trade-offs and common mistakes

- **Duplicating active state:** avoid `useState` for data already represented by the URL; it falls out of sync on refresh or Back/Forward navigation.
- **Incorrect matching depth:** decide whether a navigation item represents one exact view or an entire section, then use `end` accordingly.[1]
- **Manual prefix checks:** `pathname.startsWith("/accounts")` can incorrectly match unrelated routes such as `/accounts-payable`; `useMatch("/accounts/*")` expresses the route boundary safely.
- **Ignoring query strings:** paths can match while the active filter, period, or tab differs; inspect `useSearchParams()` when query state drives the UI.
- **Using a link as a button:** a route-changing visible control should normally be a `Link` or `NavLink`; an action that happens to navigate after completion should be a button with programmatic navigation.
- **Accessibility omission:** active styling should not rely solely on color. `NavLink`’s `aria-current` helps communicate current-page status to assistive technologies.[1]
- **Overusing pending UI:** a global spinner for every fast route transition can feel noisy; use subtle per-link or content-area indicators where they improve clarity.

## Banking, insurance, and finance examples

| Domain    | Active-route design                                                                                                               | Value                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Banking   | Keep **Accounts** active for `/accounts/:accountId`, `/transactions`, and `/statements`; activate the current account tab exactly | Preserves account context while showing the user where they are             |
| Insurance | Expand **Claims** in the sidebar for `/claims/*` and show active child tabs for Summary, Documents, and Payments                  | Clarifies long, multi-step claims workflows                                 |
| Finance   | Drive report-period tabs from `?period=monthly` or `?period=quarterly`                                                            | Makes a selected period shareable, bookmarkable, and back-button compatible |

## Interview answer — 2-minute version

Active route management means deriving navigation state from the current React Router location rather than storing it separately in component state. For normal menus and tabs, I use `NavLink`, which determines whether its target matches the current URL, applies active styling, and supplies `aria-current="page"` for accessibility.[1][4]

I use the `end` prop when an item should be active only for an exact route. Without it, a parent item can remain active for descendant URLs, which is useful for sidebar sections such as Accounts or Claims.[1]

When active state is needed outside a link—for example, expanding a menu group or showing a section-specific toolbar—I use `useMatch()`. For query-string-driven state such as filters or report period tabs, I use `useSearchParams()` or `useLocation()`. In Data or Framework router mode, `NavLink` also exposes pending state so the UI can indicate the destination is loading.[2][5][1]

## Hands-on exercise

Build an **Analytics Portal** sidebar and report tabs:

```text
/dashboard
/reports
/reports/revenue
/reports/risk
/reports?period=monthly
/reports?period=quarterly
```

1. Use `NavLink` for Dashboard and Reports.
2. Make Reports remain active for `/reports/revenue` and `/reports/risk`.
3. Add an exact “All Reports” item using `end`.
4. Use `useMatch("/reports/*")` to expand a Reports submenu only while the user is in the Reports area.
5. Build Monthly and Quarterly query-string tabs using `useSearchParams()`.
6. Add visible active styling that is not color-only.

**Expected outcome:** The Reports section remains active across report detail pages, “All Reports” is active only at `/reports`, and query-string period tabs reflect the selected period.

**Failure symptom:** Dashboard appears active on every screen.  
**Diagnostic hint:** Use `end` on the dashboard link or verify it targets `/` correctly. React Router handles root-route matching specially, but explicit intent makes navigation behavior clearer.[1]

**Failure symptom:** Both Monthly and Quarterly tabs appear active.  
**Diagnostic hint:** Read the `period` query parameter and compare it to one explicit value per tab.

## Sources

1. NavLink https://reactrouter.com/api/components/NavLink
2. useMatch | React Router https://reactrouter.com/api/hooks/useMatch
3. Feature Overview v6.30.4 https://reactrouter.com/6.30.4/start/overview
4. Navigating https://reactrouter.com/start/declarative/navigating
5. Navigating https://reactrouter.com/start/framework/navigating
6. useLocation https://reactrouter.com/api/hooks/useLocation
7. Address Book https://reactrouter.com/tutorials/address-book
8. Routing https://reactrouter.com/start/declarative/routing
9. Navigation Blocking https://reactrouter.com/how-to/navigation-blocking
10. Feature Overview v6.30.0 https://reactrouter.com/6.30.0/start/overview
11. useMatch (main branch) | React Router https://reactrouter.com/main/api/hooks/useMatch
12. NavLink (main branch) https://reactrouter.com/main/api/components/NavLink
13. Feature Overview v6.29.0 https://reactrouter.com/6.29.0/start/overview
14. Feature Overview v6.30.1 - React Routerreactrouter.com › start › overview https://reactrouter.com/6.30.1/start/overview
15. Feature Overview v6.30.2 https://reactrouter.com/6.30.2/start/overview
16. Feature Overview v6.30.3 - React Router https://reactrouter.com/6.30.3/start/overview
