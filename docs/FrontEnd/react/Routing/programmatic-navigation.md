---
title: Programmatic Navigation
sidebar_label: Programmatic Navigation
sidebar_position: 5
---

Programmatic navigation means changing the current route from JavaScript rather than through a user clicking a `<Link>`. In React Router, the primary API is the `useNavigate()` hook; it is appropriate after events such as a successful login, completed workflow, timeout, or enforced logout.[1][2]

## Core concept

Normal navigation should usually use `<Link>` or `<NavLink>` because they preserve familiar browser behavior: keyboard access, screen-reader semantics, right-click menus, and opening a route in a new tab. React Router recommends reserving `useNavigate` for cases where navigation must happen due to application logic rather than ordinary link interaction.[2]

```text
User clicks a visible page link   -> <Link> or <NavLink>
Login succeeds                    -> useNavigate()
Payment is submitted successfully -> useNavigate()
Idle session expires              -> useNavigate()
Legacy class component redirect   -> <Navigate />
```

## useNavigate

`useNavigate()` returns a `navigate` function. Calling it changes the router location, updates browser history, and causes React Router to render the route branch that matches the new URL. The function supports both a destination (`to`) and a history delta such as `-1`.[1]

```jsx
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  async function handleLogin() {
    const loginSucceeded = true; // Replace with an API call.

    if (loginSucceeded) {
      navigate("/dashboard");
    }
  }

  return <button onClick={handleLogin}>Sign in</button>;
}
```

The component using `useNavigate()` must be rendered below a router provider such as `<BrowserRouter>`.

## Basic navigation

Pass an absolute application path to navigate to a new screen:

```jsx
navigate("/dashboard");
navigate("/accounts");
navigate("/accounts/ACC-1001/transactions");
```

You can also include a query string and hash:

```jsx
navigate("/transactions?page=2&sort=date");
navigate("/help#transfer-limits");
```

`navigate(to, options?)` accepts a string path, a path object, or a numeric history delta.[1]

```jsx
navigate({
  pathname: "/transactions",
  search: "?page=2&sort=date",
  hash: "#latest",
});
```

## Browser history behavior

By default, `navigate("/dashboard")` **pushes** a new entry onto the browser history stack.

```text
Initial history:
[/login]

navigate("/dashboard")

New history:
[/login] -> [/dashboard]
                    ^
                 current
```

When the user presses Back, they return to `/login`.

### Replace navigation

Use `{ replace: true }` when the user should not return to the current page with the Back button. React Router replaces the current history entry rather than adding a new one.[1]

```jsx
navigate("/dashboard", { replace: true });
```

Typical scenarios:

- Redirecting after authentication from `/login`
- Redirecting from an obsolete URL
- Redirecting an unauthenticated user to `/login`
- Moving away from a one-time callback URL, such as an OAuth completion route

```text
Initial history:
[/login]

navigate("/dashboard", { replace: true })

New history:
[/dashboard]
    ^
 current
```

Use `replace` intentionally. For normal user journeys—such as moving from a dashboard to a report—users generally expect Back to return them to the previous page.

## Back and forward navigation

Pass a number to move through browser history:

```jsx
navigate(-1); // Back one history entry
navigate(1); // Forward one history entry
navigate(-2); // Back two entries
```

React Router documents `navigate(-1)` as a common pattern for actions such as closing a modal and `navigate(1)` for workflows such as multi-step wizards.[1]

```jsx
import { useNavigate } from "react-router-dom";

export default function ConfirmationPage() {
  const navigate = useNavigate();

  return <button onClick={() => navigate(-1)}>Go back</button>;
}
```

### History-delta risk

`navigate(-1)` is not guaranteed to remain inside your application. A user could have opened your site directly from another domain; in that case, Back might leave the site. For important business flows, provide a safe fallback:

```jsx
function handleCancel() {
  if (window.history.length > 1) {
    navigate(-1);
  } else {
    navigate("/dashboard", { replace: true });
  }
}
```

This is an illustrative heuristic. Do not use browser-history length as security logic or as the only workflow-state check.

## Relative navigation

Relative navigation is especially valuable inside nested routes because it avoids repeating long parent paths.

```jsx
// Current route: /accounts/ACC-1001
navigate("transactions");
```

The destination resolves relative to the matched route hierarchy by default. React Router allows the `relative` option to control whether a relative destination is resolved using route hierarchy (`"route"`) or URL path segments (`"path"`).[1]

```jsx
navigate("transactions"); // Usually becomes /accounts/ACC-1001/transactions

navigate("../settings", { relative: "path" });
```

Use relative routes carefully in deeply nested route trees. Relative navigation makes reusable layouts cleaner, but absolute paths can be easier to understand for major cross-application transitions.

## Navigation state

You can pass transient state while navigating:

```jsx
navigate("/transfer/review", {
  state: {
    draftId: "TRF-2026-0042",
    initiatedFrom: "account-details",
  },
});
```

Read it at the target route with `useLocation()`:

```jsx
import { useLocation } from "react-router-dom";

export default function TransferReviewPage() {
  const location = useLocation();
  const draftId = location.state?.draftId;

  return <p>Reviewing draft: {draftId ?? "No draft selected"}</p>;
}
```

The `state` option stores optional state in the destination location’s `history.state`.[1]

### Important limitation

Navigation state is not a durable system of record. A user can open the route directly, share its URL, lose state after a new browser session, or arrive from a bookmarked link. Put durable, shareable state in the URL, server-side data store, or an appropriate client-state store. For a transfer workflow, the backend should identify the draft via a validated route parameter or secure server-side session—not solely from `location.state`.

## Redirecting with Navigate

`<Navigate>` is the component-based form of programmatic navigation. It is primarily useful in a React class component, because hooks such as `useNavigate()` cannot run there. React Router recommends `useNavigate()` instead when a function component is available.[3]

```jsx
import { Navigate } from "react-router-dom";

export default function ProtectedPage({ isAuthenticated }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <SensitiveContent />;
}
```

This component renders no visible UI; it changes location as part of rendering.

### Guarding routes

A common pattern is an authentication wrapper:

```jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAuth({ isAuthenticated }) {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
```

After login, the application may return the user to the original target:

```jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogin() {
    const authenticated = true; // Replace with real authentication.

    if (authenticated) {
      const destination = location.state?.from ?? "/dashboard";
      navigate(destination, { replace: true });
    }
  }

  return <button onClick={handleLogin}>Sign in</button>;
}
```

This improves the user experience, but it is **not authorization**. Every API and backend service must independently verify identity and permission for the requested resource.

## Effects and redirects

You may navigate inside a `useEffect` for lifecycle-driven behavior, such as automatic logout after an inactivity service signals session expiration.

```jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SessionExpiryMonitor({ sessionExpired }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionExpired) {
      navigate("/login", { replace: true });
    }
  }, [sessionExpired, navigate]);

  return null;
}
```

Avoid calling `navigate()` unconditionally during component rendering. That can cause render-navigation loops. For declarative conditional redirects, use `<Navigate>`; for event or effect-driven navigation, use `navigate()` from an event handler or `useEffect`.

## Pending navigation

In React Router’s Data and Framework modes, `useNavigation()` exposes the current navigation state, including `idle`, loading, and form-submission information. It is useful for global loading indicators and for disabling duplicate submissions.[4][5]

```jsx
// Illustrative example — Data/Framework router setup required
import { useNavigation } from "react-router-dom";

export default function GlobalNavigationIndicator() {
  const navigation = useNavigation();

  if (navigation.state === "idle") {
    return null;
  }

  return <p role="status">Loading next page…</p>;
}
```

For route-changing forms in these modes, React Router’s `<Form>` can submit to route actions and activate pending state through `useNavigation`; it also revalidates page data after the action completes.[6]

## View transitions

In React Router Data and Framework modes, `useNavigate` can enable browser View Transitions by supplying `viewTransition: true`, where browser support permits it.[1][7]

```jsx
navigate("/reports", { viewTransition: true });
```

Treat this as progressive enhancement. The navigation must still work correctly without the animation.

## Practical workflow example

A transfer-review flow could work as follows:

```text
User submits transfer form
        |
        v
Client validates obvious input errors
        |
        v
POST /api/transfers/drafts
        |
        v
Server authenticates and authorizes user
        |
        v
Server returns draft ID: TRF-2042
        |
        v
navigate("/transfers/TRF-2042/review")
        |
        v
Review page fetches and reauthorizes draft data
```

```jsx
// Illustrative example — CreateTransferPage.jsx
import { useNavigate } from "react-router-dom";

export default function CreateTransferPage() {
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();

    // Illustrative: replace with a real API request and error handling.
    const draft = { id: "TRF-2042" };

    navigate(`/transfers/${draft.id}/review`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit">Review transfer</button>
    </form>
  );
}
```

The URL stores the durable identity of the draft, while the backend remains the source of truth for its data and access policy.

## When to use it

Use programmatic navigation when an application event—not a normal “go to this page” link—determines the destination:

- Successful sign-in, sign-out, registration, or password reset
- A successful create, update, or delete operation
- Completing a checkout, claim submission, or multi-step onboarding flow
- Session expiry or account lockout
- A timed quiz or workflow deadline
- Closing a route-driven modal with a history-aware Back operation
- Redirecting away from deprecated routes

## When not to use it

Avoid `useNavigate()` for simple navigation buttons, menus, breadcrumbs, cards that behave as links, and standard page-to-page navigation. Prefer `Link` or `NavLink` because they have better accessibility and native browser interaction semantics.[2]

Also avoid:

- Using navigation state as the only storage for business-critical data
- Calling `navigate()` directly during render
- Redirecting continuously in an effect without stable conditions
- Treating navigation guards as access control
- Using `replace: true` for every navigation and breaking expected Back-button behavior

## Interview answer — 2-minute version

Programmatic navigation is changing routes from application code rather than from a visible link. In React Router, I use `useNavigate()` to obtain a `navigate` function, then call `navigate("/target")` after events such as a completed login, successful submission, session timeout, or workflow transition. React Router recommends using `Link` or `NavLink` for ordinary user-driven navigation because they preserve better browser and accessibility behavior.[1][2]

The function can push a history entry by default, replace the current entry with `{ replace: true }`, move with history deltas like `navigate(-1)`, or carry transient location state. I use replace for login and authorization redirects so users do not return to an unusable page through Back.[1]

For protected routes, client redirects improve UX but do not secure data. I always require API and backend authorization checks. In route architectures that use React Router Data or Framework mode, I also use `useNavigation()` to surface pending state during navigations and submissions.[4][5]

## Hands-on exercise

Build a two-step **Expense Approval** flow:

```text
/expenses/new
/expenses/:expenseId/review
/expenses/:expenseId/complete
```

1. In the New Expense page, submit a small form.
2. Simulate a successful API response with an ID such as `EXP-1042`.
3. Navigate to `/expenses/EXP-1042/review`.
4. Add a **Cancel** button that navigates to `/expenses` using `replace: true`.
5. Add a **Back to edit** button that calls `navigate(-1)`.
6. Pass transient state such as `{ source: "new-expense" }`, then safely handle its absence in the Review page.

**Expected outcome:** A successful submission creates a new history entry for the review page, while cancellation replaces the workflow route with the list route.

**Failure symptom:** `useNavigate() may be used only in the context of a <Router> component.`  
**Diagnostic hint:** Ensure the hook runs below `BrowserRouter`, `HashRouter`, or another appropriate router provider.

**Failure symptom:** The page repeatedly redirects or the browser becomes unresponsive.  
**Diagnostic hint:** Check for `navigate()` being called directly in render or inside an effect whose condition remains true after the redirect.

## Sources

1. useNavigate https://reactrouter.com/api/hooks/useNavigate
2. Navigating https://reactrouter.com/start/declarative/navigating
3. Navigate - React Router https://reactrouter.com/api/components/Navigate
4. useNavigation https://reactrouter.com/api/hooks/useNavigation
5. State Management https://reactrouter.com/explanation/state-management
6. Form https://reactrouter.com/api/components/Form
7. View Transitions https://reactrouter.com/how-to/view-transitions
8. createHashRouter https://reactrouter.com/api/data-routers/createHashRouter
9. Navigating https://reactrouter.com/start/framework/navigating
10. Declarative https://reactrouter.com/api/declarative-routers/Router
11. Routing https://reactrouter.com/start/declarative/routing
12. Link https://reactrouter.com/api/components/Link
13. createMemoryRouter https://reactrouter.com/api/data-routers/createMemoryRouter
14. useParams https://reactrouter.com/api/hooks/useParams
15. useBlocker https://reactrouter.com/api/hooks/useBlocker
