---
title: Route Guards, Private Routes, Redirects
sidebar_label: Route Guards
sidebar_position: 6
---

Route guards—often called **private routes** or **protected routes**—control what UI a user can reach based on client-side conditions such as authentication, role, feature entitlement, or workflow state. They improve navigation and user experience, but they are **not security boundaries**: every API and backend must independently authenticate and authorize requests.[1][2]

## Core concepts

| Term                        | Meaning                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Route guard**             | Logic that decides whether to render a route, show a loading/error state, or redirect elsewhere            |
| **Private/protected route** | A route intended only for authenticated users, such as `/dashboard` or `/account`                          |
| **Role-based guard**        | A guard requiring a permission or role, such as `admin`, `claims-adjuster`, or `portfolio-manager`         |
| **Redirect**                | Sending the user from one route to another, for example from `/login` to `/dashboard` after sign-in        |
| **Return URL**              | The originally requested path, remembered so the user can be sent back after successful login              |
| **Authentication**          | Confirming who the user is                                                                                 |
| **Authorization**           | Confirming whether that authenticated user may perform a particular action or access a particular resource |

React Router supports basic declarative routing and can also support route loaders, actions, and redirects in its Data and Framework modes.[3][4]

## Guard flow

A common private-route flow looks like this:

```text
User requests /accounts/ACC-1001
            |
            v
Is authentication state known?
            |
      +-----+-----+
      |           |
    No/loading   Yes
      |           |
      v           v
Show loading   Is user authenticated?
                    |
              +-----+-----+
              |           |
             No          Yes
              |           |
              v           v
Redirect       Render protected route
/login
```

A high-quality guard distinguishes **unknown/loading** from **unauthenticated**. Redirecting before checking the session can cause flicker, redirect loops, or incorrectly send signed-in users to login.

## Private route pattern

In declarative React Router applications, define a guard component that renders either `<Outlet />` for allowed child routes or `<Navigate />` for a redirect. Child routes render through the parent route’s outlet.[5][6]

```jsx
// Illustrative example — RequireAuth.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAuth({ auth }) {
  const location = useLocation();

  if (auth.status === "loading") {
    return <p role="status">Checking your session…</p>;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
```

```jsx
// Illustrative example — routes.jsx
import { Routes, Route } from "react-router-dom";

export default function AppRoutes({ auth }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth auth={auth} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/accounts/:accountId" element={<AccountPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

A pathless parent `<Route>` creates route nesting without adding a URL segment. Its `<Outlet />` renders the matched protected child.[6][5]

## Redirect after login

A guard should preserve the destination the user originally attempted to visit. On successful sign-in, redirect to that saved location; otherwise use a safe default such as `/dashboard`.

```jsx
// Illustrative example — LoginPage.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function LoginPage({ signIn }) {
  const location = useLocation();
  const navigate = useNavigate();

  const requestedLocation = location.state?.from;
  const destination = requestedLocation?.pathname
    ? requestedLocation.pathname +
      requestedLocation.search +
      requestedLocation.hash
    : "/dashboard";

  async function handleSubmit(event) {
    event.preventDefault();

    const result = await signIn();

    if (result.ok) {
      navigate(destination, { replace: true });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit">Sign in</button>
    </form>
  );
}
```

`replace: true` replaces the history entry rather than pushing a new entry. It prevents a Back-button loop where users return from the protected route to `/login` or the route that immediately redirects them to login again.[7][8]

## Open-redirect risk

Never send users to an arbitrary redirect destination supplied from untrusted input.

**Unsafe:**

```jsx
// Do not copy this pattern.
navigate(new URLSearchParams(location.search).get("next"));
```

An attacker could craft a link that redirects a signed-in user to an external or malicious location.

**Safer:**

```jsx
function safeInternalPath(value) {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}
```

React Router’s server-oriented `redirect` utility accepts absolute URLs and can navigate to external domains, so user-controlled redirect targets must be validated.[2]

## Role and permission guards

Authentication alone is rarely enough. A route might require a role, permission, organization membership, licensing entitlement, or feature flag.

```jsx
// Illustrative example — RequireRole.jsx
import { Navigate, Outlet } from "react-router-dom";

export default function RequireRole({ auth, allowedRoles }) {
  if (auth.status === "loading") {
    return <p role="status">Checking permissions…</p>;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  const hasRequiredRole = allowedRoles.some((role) =>
    auth.user.roles.includes(role),
  );

  if (!hasRequiredRole) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
```

```jsx
// Illustrative example — route configuration
<Route element={<RequireRole auth={auth} allowedRoles={["admin"]} />}>
  <Route path="/admin/users" element={<UserAdministrationPage />} />
  <Route path="/admin/audit-log" element={<AuditLogPage />} />
</Route>
```

For more complex systems, prefer capability-based checks—such as `claims:approve` or `reports:export`—over broad roles. Roles are coarse organizational labels; permissions map more directly to actual business actions.

## Guard composition

Guards can be composed as nested route layers:

```text
RequireAuth
└── RequireOrganizationMembership
    └── RequirePermission("claims:approve")
        └── ClaimsApprovalPage
```

```jsx
// Illustrative example — guard layering
<Route element={<RequireAuth auth={auth} />}>
  <Route element={<RequireOrganization auth={auth} />}>
    <Route
      element={<RequirePermission auth={auth} permission="claims:approve" />}
    >
      <Route path="/claims/:claimId/approve" element={<ClaimApprovalPage />} />
    </Route>
  </Route>
</Route>
```

This is readable when each layer represents a broad concern. Do not build a long stack of arbitrary wrappers if a single policy evaluator can clearly express the required access rule.

## Declarative redirect patterns

Use `<Navigate>` when navigation is a direct consequence of what the component is rendering—such as “unauthenticated means show the login route instead.” `Navigate` is a component-based variant of `useNavigate`, especially useful where hooks cannot be used.[9]

```jsx
import { Navigate } from "react-router-dom";

export default function OldReportsRoute() {
  return <Navigate to="/reports" replace />;
}
```

Use this for:

- Legacy URL migrations
- Default child-route redirects
- Simple conditional access redirects
- Class components that cannot use hooks

Avoid calling `navigate()` directly during render. If the redirection is conditional rendering, render `<Navigate>`; if it follows an event or lifecycle condition, use `useNavigate()` in an event handler or effect.[7][9]

## Programmatic redirects

Use `useNavigate()` for event-driven or effect-driven redirects:

```jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SessionMonitor({ sessionExpired }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionExpired) {
      navigate("/login", { replace: true });
    }
  }, [sessionExpired, navigate]);

  return null;
}
```

Appropriate cases include session expiry, automatic logout, a completed action, a time-limited workflow, or navigation after a successful mutation. React Router documents `useNavigate()` as a programmatic navigation API and advises using it less often than links for ordinary user navigation.[4][7]

## Loader redirects

In React Router’s Data and Framework modes, use a `loader` or `action` to redirect **before** rendering protected page UI. React Router supports returning `redirect()` from route loaders and actions.[2][4]

```jsx
// Illustrative example — protected-route loader
import { redirect } from "react-router-dom";

export async function requireUserLoader({ request }) {
  const user = await getCurrentUserFromSession(request);

  if (!user) {
    const requestedPath = new URL(request.url).pathname;
    return redirect(`/login?returnTo=${encodeURIComponent(requestedPath)}`);
  }

  return { user };
}
```

```jsx
// Illustrative example — data router configuration
import { createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/dashboard",
    loader: requireUserLoader,
    element: <DashboardPage />,
  },
]);
```

This approach avoids briefly rendering a protected page before client-side redirect logic runs. It is usually stronger architecturally when your routes already use loaders and actions.

For client navigations in Framework mode, React Router can call loaders automatically from the browser; on initial server rendering or pre-rendering, server-side loaders can provide the initial route data.[10]

## Authentication versus authorization

A frontend route guard can:

- Hide inaccessible navigation options
- Avoid rendering inappropriate page UI
- Redirect users to login or a forbidden page
- Preserve a requested route for post-login return
- Improve overall workflow clarity

A frontend route guard cannot:

- Stop someone from calling your API directly
- Prove the user owns `/accounts/ACC-1001`
- Protect secrets included in client-side JavaScript
- Replace backend authorization checks
- Protect server functions merely by associating them with a guarded route

React Router’s middleware documentation specifically warns not to rely on route middleware alone for access control of React Server Functions; the functions must enforce their own access control.[1]

## Banking, insurance, and finance examples

| Domain    | Guard                                                   | Route                                 | Required backend enforcement                                                       |
| --------- | ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Banking   | Authenticated customer plus ownership/entitlement check | `/accounts/:accountId/statements`     | Verify the session and confirm the customer can access that account                |
| Insurance | Claims-adjuster role plus assigned-claim access         | `/claims/:claimId/approve`            | Verify role, organization, claim assignment, and approval authority                |
| Finance   | Portfolio-manager permission plus tenant scope          | `/portfolios/:portfolioId/trades/new` | Verify trading entitlement, portfolio relationship, limits, and audit requirements |

The frontend guard improves discoverability and prevents confusing navigation, while the backend determines whether the protected data or operation is actually permitted.

## Common failure modes

| Symptom                                                 | Likely cause                                                             | Fix                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Flash of protected content                              | Guard renders child UI before auth state is resolved                     | Model an explicit `loading` state and render neither child content nor redirect until resolution |
| Endless redirect loop                                   | Login route is itself protected, or auth state never updates after login | Keep login public; inspect state transitions and redirect conditions                             |
| Back button returns to login repeatedly                 | Redirect added extra history entries                                     | Use `replace` for access-control redirects and post-login returns. [7][8]                        |
| User sees 404 after browser refresh                     | BrowserRouter host lacks SPA fallback                                    | Configure the server/CDN to return the app entry document for client-side routes                 |
| User accesses data despite hidden page                  | API trusts frontend role or resource ID                                  | Enforce authentication and resource-level authorization on the server                            |
| User is sent to an attacker-controlled site after login | Unvalidated `returnTo` or `next` URL                                     | Accept only validated internal paths; reject absolute and protocol-relative URLs. [2]            |

## Interview answer — 2-minute version

Route guards, or private routes, are client-side policy components that determine whether a route should render, display a loading state, or redirect. In declarative React Router, I commonly implement an `RequireAuth` layout route that checks session state, renders `<Outlet />` for authenticated users, and renders `<Navigate to="/login" replace />` for unauthenticated users. Nested child routes beneath that guard are then protected as one group.[5][6][9]

I always represent authentication as at least three states—loading, authenticated, and unauthenticated—to prevent flicker and incorrect redirects. I preserve the attempted internal path so the user can return after login, validate it to prevent open redirects, and use history replacement for login-related redirects to avoid Back-button loops.[2][7][8]

For more advanced React Router Data or Framework applications, I use loader or action redirects to make access decisions before a protected route renders. But neither client guards nor routing middleware replaces backend authorization: every API call must enforce identity, tenant boundaries, permissions, and resource ownership.[1][4]

## Hands-on exercise

Build protected routes for an internal **Claims Operations** application:

```text
/login                       Public
/dashboard                   Authenticated users
/claims/:claimId             Authenticated users
/claims/:claimId/approve     Users with "claims:approve"
/forbidden                   Public error page
```

1. Create a mock auth state with `loading`, `user`, and `user.roles`.
2. Implement `RequireAuth` with `<Outlet />` and `<Navigate>`.
3. Implement `RequirePermission` for `claims:approve`.
4. Store the attempted route in `location.state.from`.
5. After mock login, navigate to the validated saved route or `/dashboard`.
6. Test an authenticated user without the required permission.

**Expected outcome:** An unauthenticated user requesting `/claims/CLM-1042/approve` goes to login; an authenticated user lacking approval authority goes to `/forbidden`; an authorized user reaches the approval page.

**Failure symptom:** An unauthenticated user sees the claim screen briefly.  
**Diagnostic hint:** Ensure the guard renders a loading state while session status is unresolved and does not render `<Outlet />` until authentication is confirmed.

**Failure symptom:** Login succeeds but immediately redirects back to login.  
**Diagnostic hint:** Make `/login` public, verify the auth state updates before navigation, and use `replace` for access-control redirects.

## Sources

1. Middleware https://reactrouter.com/how-to/middleware
2. redirect https://reactrouter.com/api/utils/redirect
3. Picking a Mode https://reactrouter.com/start/modes
4. Navigating https://reactrouter.com/start/framework/navigating
5. Outlet https://reactrouter.com/api/components/Outlet
6. Routing https://reactrouter.com/start/declarative/routing
7. useNavigate https://reactrouter.com/api/hooks/useNavigate
8. replace https://reactrouter.com/api/utils/replace
9. Navigate - React Router https://reactrouter.com/api/components/Navigate
10. Data Loading https://reactrouter.com/start/framework/data-loading
11. Routing https://reactrouter.com/start/framework/routing
12. useLocation https://reactrouter.com/api/hooks/useLocation
13. State Management https://reactrouter.com/explanation/state-management
14. React Router Home https://reactrouter.com/home
15. React Router Official Documentation https://reactrouter.com/
16. Link https://reactrouter.com/api/components/Link
