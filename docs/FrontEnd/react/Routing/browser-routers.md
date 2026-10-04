---
title: BrowserRouter and HashRouter
sidebar_label: Browser/Hash Routers
sidebar_position: 3
---

`BrowserRouter` and `HashRouter` both let React Router map URLs to React views, but they store the client-side route in different parts of the URL. Choose **`BrowserRouter` by default**; choose **`HashRouter` only when you cannot configure the web server to support client-side routes.**[1][2][3]

## Main distinction

| Concern                          | `BrowserRouter`                                                            | `HashRouter`                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Route location                   | Normal URL path, such as `https://app.example.com/products/42`             | URL fragment after `#`, such as `https://app.example.com/#/products/42`           |
| Browser API                      | Uses the browser History API for client-side routing. [2]                  | Stores location in the URL hash/fragment. [1]                                     |
| Is the route sent to server?     | Yes: a direct request to `/products/42` reaches the server with that path. | No: fragments are not sent in HTTP requests, so the server only receives `/`. [1] |
| Server setup                     | Requires SPA fallback configuration for deep links                         | Usually works on basic static hosting without rewrite rules                       |
| URL quality                      | Clean, conventional, web-native URLs                                       | Less clean URLs containing `#`                                                    |
| Search engine optimization (SEO) | Usually the better choice, especially with server rendering                | Generally less suitable for public, indexable content                             |
| Default recommendation           | Yes, for most web applications                                             | Only when deployment constraints make path-based routing impractical              |

## URL behavior

With `BrowserRouter`, the browser address bar contains a normal path:

```text
https://bank.example.com/accounts/123/transactions
```

If the user refreshes this page, the browser requests `/accounts/123/transactions` from the server. The server must recognize it as a client-side application route and return the React app entry document—often `index.html`—so React Router can render the matching page. React Router documents `BrowserRouter` as a declarative router based on the browser History API.[2]

With `HashRouter`, the path is after `#`:

```text
https://bank.example.com/#/accounts/123/transactions
```

On refresh, the browser requests only `https://bank.example.com/`; the `#/accounts/123/transactions` fragment stays in the browser and is not sent to the server. React Router explicitly describes `HashRouter` as storing the location in the hash portion of the URL, which is not sent to the server.[1]

## How routing works

The React route configuration can be nearly identical for both:

```jsx
// Illustrative example — BrowserRouter
import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/accounts/:accountId" element={<AccountPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```jsx
// Illustrative example — HashRouter
import { HashRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/accounts/:accountId" element={<AccountPage />} />
      </Routes>
    </HashRouter>
  );
}
```

The main application-level difference is the router wrapper. Your `Route`, `Link`, `NavLink`, `Outlet`, `useParams`, and `useNavigate` usage generally remains the same. Declarative routes associate URL patterns with UI through `<Routes>` and `<Route>`.[4][5]

## Request pipeline

### BrowserRouter

```text
User opens /reports/quarterly
        |
        v
Browser requests GET /reports/quarterly
        |
        v
Server/CDN must return the SPA entry document
        |
        v
React starts
        |
        v
BrowserRouter matches /reports/quarterly
        |
        v
QuarterlyReportPage renders
```

If the server does not have an SPA fallback, direct navigation and refreshes on nested routes commonly produce an HTTP 404 error.

### HashRouter

```text
User opens /#/reports/quarterly
        |
        v
Browser requests GET /
        |
        v
Server returns SPA entry document
        |
        v
React starts
        |
        v
HashRouter reads #/reports/quarterly
        |
        v
QuarterlyReportPage renders
```

This works because the URL fragment is client-side state and is not included in the server request.[1]

## BrowserRouter setup

A deployment needs a fallback rule that returns the application entry point for client-side paths, while still allowing actual files and backend endpoints to work normally.

Conceptually:

```text
If request is a real static file -> serve it
If request is an API endpoint -> route it to the API
Otherwise -> return /index.html
```

For example, a reverse proxy should not blindly rewrite `/api/accounts/123` to `index.html`; API routes must remain server-routed. The exact configuration depends on the platform: Nginx, Apache, CloudFront, Netlify, Vercel, Azure Static Web Apps, and an application server each implement fallback behavior differently.

## When to use BrowserRouter

Use `BrowserRouter` for nearly all production web applications when you control—or can configure—the hosting environment.

It is the natural choice for:

- Public websites, documentation, product pages, and content sites
- Customer banking and insurance portals
- Investment dashboards and enterprise applications
- Applications that benefit from clean, shareable URLs
- Apps that may use server-side rendering (SSR) or other web-platform integrations
- Modern hosting platforms that support SPA rewrite rules

React Router’s guidance recommends browser-based routing for web projects because full URLs are more compatible with the web platform and better suited to SEO and server rendering; it identifies hash-based routing as the fallback when full URLs are not possible.[3][6]

## When to use HashRouter

Use `HashRouter` when a deployment environment cannot return the app entry document for arbitrary paths.

Typical examples include:

- A legacy static file server with no rewrite or redirect configuration
- A demo hosted in a restricted environment
- A static site host where you cannot change routing rules
- An internal tool where URL aesthetics and search visibility do not matter
- A constrained embedded environment where only the initial document path can be served

`HashRouter` is a pragmatic compatibility solution, not a security feature. It does not change authentication, authorization, API protection, or the requirement to validate user access on the backend.

## Trade-offs

### BrowserRouter benefits

- Clean URLs are easier to read, share, log, and integrate with analytics systems.
- It aligns with normal web routing semantics and supports direct path-based links.
- It is the stronger architectural foundation for public content, SSR, and search discovery.[6][3]

### BrowserRouter risks

- Deep-link refreshes fail without hosting configuration.
- Teams must coordinate routing between frontend, CDN, reverse proxy, and backend API.
- Misconfigured fallbacks can accidentally route API or asset requests to `index.html`.

### HashRouter benefits

- It avoids server-side routing requirements because the fragment is never included in the HTTP request.[1]
- It can be deployed quickly to limited static hosting environments.
- It reduces one common operational failure: deep-link 404s.

### HashRouter risks

- `#` URLs are less polished and less aligned with standard path-based web navigation.
- It is a poor default for public-facing, search-dependent applications.
- The URL fragment is traditionally also used for in-page anchors, so mixing anchor navigation and hash-based routing can be confusing.
- Moving later from hash URLs to browser paths requires URL migration, redirects where possible, and updates to shared links.

## Banking, insurance, and finance

| Domain                                                        | Recommended router             | Why                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retail banking portal                                         | `BrowserRouter`                | Clean routes such as `/accounts/123/statements` work well for authenticated deep links, customer support links, observability, and a conventional web experience. Server fallback must be configured. |
| Insurance claims portal                                       | `BrowserRouter`                | Routes such as `/claims/CLM-10294/documents` fit nested layouts and direct navigation to a claim workflow; backend authorization must verify claim ownership.                                         |
| Internal finance operations tool on restricted legacy hosting | `HashRouter` can be reasonable | If the platform cannot be configured for SPA path fallback, `/#/reconciliation/2026-10-01` may be an acceptable operational trade-off.                                                                |
| Public investment research site                               | `BrowserRouter`                | Clean URLs and compatibility with server-rendered or pre-rendered content matter more than avoiding server configuration.                                                                             |

## Practical decision rule

```text
Can your hosting platform return index.html for unknown frontend paths?
        |
        +-- Yes -> Use BrowserRouter
        |
        +-- No -> Can the platform be changed or configured?
                     |
                     +-- Yes -> Configure fallback, then use BrowserRouter
                     |
                     +-- No -> Use HashRouter as the practical fallback
```

## Interview answer — 2-minute version

`BrowserRouter` and `HashRouter` are client-side routing strategies in React Router. `BrowserRouter` uses the browser History API and stores routes in the normal pathname, giving URLs such as `/accounts/123`. It is the preferred choice for most web applications because it produces clean, standard URLs and works better with the wider web platform, including server rendering and search-oriented content.[2][3]

Its operational requirement is that the hosting layer must return the SPA entry document for unknown frontend routes. Without that fallback, refreshing a deep link such as `/accounts/123` results in a server-side 404.

`HashRouter` stores the route after `#`, such as `/#/accounts/123`. The browser does not send fragments to the server, so it avoids deep-link server configuration. It is useful for restricted static hosting or legacy environments, but I treat it as a fallback because hash URLs are less clean and less suitable for public web applications.[6][1]

## Hands-on exercise

Create two versions of the same three-route app:

```text
/            -> Dashboard
/reports     -> Reports
/reports/42  -> ReportDetails
```

1. Run it once with `BrowserRouter`.
2. Paste `http://localhost:.../reports/42` directly into the address bar and refresh.
3. Replace `BrowserRouter` with `HashRouter`.
4. Navigate to `http://localhost:.../#/reports/42` and refresh.
5. Deploy the browser-router version to a static host without a fallback rule, then test a direct deep link.

**Expected outcome:** The hash-router app continues to work on refresh even without a server rewrite, while the browser-router app requires SPA fallback behavior.

**Failure symptom:** The development server works, but production refresh of `/reports/42` returns 404.  
**Diagnosis:** The production host is trying to resolve `/reports/42` as a server file or server route. Add a frontend fallback to the React entry document.

**Failure symptom:** A `HashRouter` link appears as `/#/#/reports`.  
**Diagnosis:** Do not include `#` manually in `Link` destinations. Use `to="/reports"`; the router produces the hash-based URL.

## Sources

1. HashRouter https://reactrouter.com/api/declarative-routers/HashRouter
2. BrowserRouter https://reactrouter.com/api/declarative-routers/BrowserRouter
3. Picking a Router v6.7.0 https://reactrouter.com/6.7.0/routers/picking-a-router
4. Routing https://reactrouter.com/start/declarative/routing
5. Route https://reactrouter.com/api/components/Route
6. Picking a Router v6.30.0 https://reactrouter.com/6.30.0/routers/picking-a-router
7. React Router Official Documentation https://reactrouter.com/
8. Picking a Mode https://reactrouter.com/start/modes
9. createHashRouter https://reactrouter.com/api/data-routers/createHashRouter
10. Declarative https://reactrouter.com/api/declarative-routers/Router
11. Link https://reactrouter.com/api/components/Link
12. Routing https://reactrouter.com/start/framework/routing
13. useRoutes https://reactrouter.com/api/hooks/useRoutes
14. HistoryRouter https://reactrouter.com/api/declarative-routers/HistoryRouter
15. createHashRouter (main branch) https://reactrouter.com/main/api/data-routers/createHashRouter
