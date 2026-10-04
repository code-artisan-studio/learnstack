---
title: High Order Components (HOC)
sidebar_label: High Order Components
sidebar_position: 2
---

# Higher-Order Components (HOCs) in React

## 1. Overview

A HOC is a **component factory**. You hand it a component, it hands you back a _new_ component that renders the original one, with something extra wrapped around it: a login check, injected data, logging, an error boundary.

Analogy: airport security. Every gate (component) needs passengers screened, but you don't build a scanner into every gate. You put one checkpoint in front and every passenger passes through it before reaching any gate. `withAuth(Gate)` is "this gate, but behind the checkpoint".

**Why it matters:** cross-cutting concerns (auth, telemetry, feature flags, error handling) otherwise get copy-pasted into dozens of components. HOCs were React's first widely used answer to "how do I reuse _behaviour_, not just markup?". You will meet them in every React codebase older than about 2020, in libraries like Redux (`connect`) and react-i18next (`withTranslation`), and you still need them for things hooks cannot do, like error boundaries.

## 2. Definition and key terms

| Term                             | Precise meaning                                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Higher-Order Component (HOC)** | A plain JavaScript function that takes a component and returns a new component: `(Component) => EnhancedComponent`. Not a React API; a pattern built from composition. Named after higher-order functions (functions that take or return functions). |
| **Wrapped / inner component**    | The component passed into the HOC. It should not know it is being wrapped.                                                                                                                                                                           |
| **Enhanced / outer component**   | The component the HOC returns. It renders the wrapped one and supplies extra props or behaviour.                                                                                                                                                     |
| **Injected props**               | Props the HOC supplies, so callers of the enhanced component must _not_ pass them (e.g. `user`, `t`, `dispatch`).                                                                                                                                    |
| **HOC factory**                  | A function that returns a HOC, used to take configuration: `connect(mapState)(Component)`, `withEntitlement('manager')(Component)`.                                                                                                                  |
| **`displayName`**                | A static property React DevTools and error messages use to label a component. Convention for HOCs: `withX(WrappedName)`.                                                                                                                             |
| **Custom hook**                  | A `useSomething` function that packages stateful logic (React 16.8, Feb 2019). Hooks replaced HOCs for most logic reuse.                                                                                                                             |
| **Render prop**                  | A component that takes a function as a prop (or as `children`) and calls it to render: `<Mouse>{pos => ...}</Mouse>`. The other pre-hooks reuse pattern.                                                                                             |

**Distinctions that trip people up:**

- A HOC is **not a component**. `withAuth` is a function; `withAuth(Page)` is the component. You never write `<withAuth />`.
- `React.memo`, `forwardRef` and `lazy` have the same _shape_ (component in, component out), but they return special React element types handled by the reconciler, not a user-written function component. People call them "HOC-like"; the pitfalls below differ slightly for them.
- A **wrapper component** (`<RequireAuth><Page/></RequireAuth>`) solves a similar problem at _render time_; a HOC solves it at _definition time_. That difference drives most of the trade-offs.

## 3. How it works

### The minimal shape

```jsx
// Illustrative
function withLogger(Wrapped) {
  function WithLogger(props) {
    useEffect(() => {
      console.log(`${Wrapped.name} mounted`);
    }, []);
    return <Wrapped {...props} />; // pass everything through
  }
  WithLogger.displayName = `withLogger(${Wrapped.displayName || Wrapped.name})`;
  return WithLogger;
}

const LoggedProfile = withLogger(Profile); // once, at module level
```

Three things a well-behaved HOC always does: **passes through unrelated props**, **does not mutate** the wrapped component, and **sets a `displayName`**.

### Lifecycle: definition time vs render time

```
MODULE LOAD (once)                          RENDER (every time)
──────────────────                          ───────────────────
withLogger(Profile)                         <LoggedProfile id=7 />
   │  closure captures Profile                    │
   ▼                                              ▼
returns WithLogger  ──► exported            WithLogger runs (hooks, checks)
(a NEW, stable function identity)                 │
                                                  ▼
                                            <Profile id=7 /> runs
```

The HOC function itself runs **once**. The component it returns runs on **every render**. That split is the key to understanding both its power (configuration is baked in by closure) and its main pitfall (see "render-time creation" below).

### Composition order

HOCs nest like function calls. The **outermost** HOC renders first and sees props first.

```js
export default withErrorBoundary(withAuth(withAnalytics(Dashboard)));
// Tree:  ErrorBoundary → WithAuth → WithAnalytics → Dashboard
```

Order is semantic, not cosmetic: put the error boundary outside so it catches failures in the auth check too; put auth outside analytics so you don't log page views for unauthorised users. Libraries historically offered `compose(f, g, h)(C)` (Redux, lodash `flowRight`) to flatten this.

### Data and dependency flow

```
Caller ──props (accountId)──► WithEntitlement ──props + user──► WireLimitOverride
                                   │
                         reads SessionContext
```

Dependencies point **inward**: the wrapped component knows nothing about the HOC. The HOC depends on the wrapped component's prop contract (it must accept `user`). That inward dependency is what makes the inner component independently testable.

## 4. Internal architecture (behind the scenes)

**Each HOC adds a real node to the component tree.** React's reconciler builds a _fiber_ (its internal unit of work) per component. Three stacked HOCs mean three extra fibers above your component, each with its own props object, hook state, and render call. DevTools shows this as the "wrapper hell" pyramid: `withRouter(connect(withStyles(Button)))`.

**Identity drives reconciliation.** When React re-renders, it compares each element's `type` with the previous one at the same position. Same type → update in place, keep state. Different type → unmount the old subtree and mount a new one. A HOC returns a **new function each time it is called**, so:

```jsx
function Page() {
  const Enhanced = withLogger(Profile); // ❌ new type every render
  return <Enhanced />; // → full unmount/remount, state lost,
} //   effects re-run, focus lost
```

This is the single most important HOC rule: **apply HOCs at module level (or memoise them), never inside render.**

**Refs are not props (pre-React 19).** Before React 19, `ref` was stripped from props, so `<Enhanced ref={r}/>` pointed at the _outer_ component, not the inner DOM node. Fix: wrap the outer component in `forwardRef`. In **React 19**, `ref` is a normal prop on function components, so a HOC that spreads `{...props}` forwards it automatically, and `forwardRef` is on the path to deprecation. Class components still need the old handling.

**Statics are not copied.** If `Profile.fetchData = ...` (a pattern from older server-rendering setups), `withLogger(Profile).fetchData` is `undefined`. The historical fix is the `hoist-non-react-statics` package or copying explicitly. Mostly relevant in legacy code today.

**Performance.** Each layer costs a function call and a fiber per render, which is negligible for a few layers. The real cost is **referential instability**: a HOC that builds new objects or callbacks each render (e.g. `mapStateToProps` returning `{ items: state.items.filter(...) }`) defeats `React.memo` downstream. React-Redux's `connect` did heavy internal memoisation precisely to avoid this.

**Threading/memory:** nothing special. React renders on the main thread; a HOC's closure holds a reference to the wrapped component and its config for the module's lifetime, which is fine because it is created once.

## 5. When to use it

- **Behaviour that must be a component, not a hook.** Error boundaries still require a class component (`componentDidCatch` / `getDerivedStateFromError`); there is no hook equivalent as of React 19. `withErrorBoundary(Component)` (shipped by the `react-error-boundary` package) is a legitimate modern HOC.
- **Uniform policy applied at the export boundary.** "Every route component must be behind auth and wrapped in telemetry" is easy to enforce and lint when it is `export default withPageShell(Page)`.
- **Library APIs that must support class components.** A library whose consumers still have class components cannot hand them a hook.
- **Configuration baked in at definition time**, where the configuration is static per component (required role, feature flag key, analytics screen name).
- **Maintaining a legacy codebase** that already uses them consistently. Consistency beats local optimisation.

## 6. When not to use it

- **Sharing stateful logic in new function-component code.** A custom hook does this with no extra tree nodes, no prop collisions, and explicit data flow. This is the React team's own guidance: react.dev no longer documents HOCs as a primary pattern and teaches custom hooks instead.
- **When the wrapped component needs to control the behaviour dynamically.** A HOC's config is fixed at definition time; if the required role depends on props, a hook or wrapper component is clearer.
- **When several HOCs inject props.** Names collide silently (`withUser` and `withAuth` both inject `user`: the outer one loses). Hooks return values you name yourself.
- **Just to add markup.** A layout wrapper is a component with `children`, not a HOC.

## 7. Benefits

- **Separation of concerns:** the wrapped component stays pure and ignorant of auth, data sources or telemetry, which makes it trivially testable with plain props.
- **Reuse without inheritance:** React favours composition; a HOC composes behaviour around any component without a base class.
- **Declarative, centralised policy:** one line at the export site shows every concern applied. Easy to grep and to enforce with lint rules.
- **Works with class and function components alike.**
- **Can do things hooks can't:** render a _different_ component entirely (a fallback, a sign-in screen) before the wrapped one ever mounts, and host error boundaries.

## 8. Trade-offs

| Concern                    | Detail                                                                                                               | Why it matters architecturally                                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Indirection**            | Props appear "from nowhere" in the inner component. New readers must trace wrappers to learn where `user` came from. | Hurts onboarding and reviews; the six-month-later reader pays.                                                                                                                                                                      |
| **Prop collisions**        | Two HOCs injecting the same prop name silently override each other. No error.                                        | A classic source of production bugs that tests with mocked props never catch.                                                                                                                                                       |
| **Wrapper hell**           | Deep trees in DevTools, noisy stack traces, harder profiling.                                                        | Observability degrades as layers grow.                                                                                                                                                                                              |
| **Static composition**     | Config is fixed when the module loads.                                                                               | Poor fit for per-request or per-prop policy.                                                                                                                                                                                        |
| **TypeScript friction**    | Typing "props minus injected props" needs generics and `Omit`, and inference across `compose()` is weak.             | Weak typing lets callers pass or forget injected props; see the typed example below.                                                                                                                                                |
| **Render-time creation**   | Calling the HOC inside render remounts the subtree every time.                                                       | Symptoms look like random state loss and input focus loss, which are hard to diagnose.                                                                                                                                              |
| **Security misconception** | A `withAuth` HOC hides UI; it does **not** protect data.                                                             | The API must enforce authorisation independently. Client-side gating is UX, never a control.                                                                                                                                        |
| **Server Components**      | HOCs that use hooks or Context make the result a Client Component.                                                   | In React Server Components (RSC) apps (e.g. Next.js App Router), wrapping a server component in a client-side HOC pushes it to the client, losing the server benefits. Do auth checks on the server (layout or middleware) instead. |

**Common misconception:** "hooks killed HOCs." Hooks killed HOCs _for logic reuse_. HOCs remain the right tool for wrapping a component in another component, notably error boundaries.

## 9. Real-world examples

_These are illustrative architectures of the kind used in these industries, not descriptions of any specific company's code._

**Banking: entitlement gating in a branch operations portal.** Teller screens, manager overrides and auditor views share one React app. Each screen is exported as `withEntitlement(Screen, 'branch-manager')`. Security reviewers can audit gating by grepping export lines, and the screens themselves stay pure. The server enforces the same entitlements on every API call; the HOC only prevents confusing UI.

**Insurance: error isolation and audit telemetry on claims widgets.** A claims adjuster dashboard embeds a dozen widgets (policy summary, fraud score, payment history) that call different back-end services. Each is wrapped with `withErrorBoundary` so one failing service shows a "section unavailable" card instead of blanking the whole dashboard, plus a `withAuditView('claim-payments')` HOC that records which adjuster viewed which sensitive panel, a common regulatory requirement.

**Finance: feature flags and regional compliance on a trading UI.** A trading front end rolls out a new order ticket to one desk at a time and must hide certain products in some jurisdictions. `withFeatureFlag('new-order-ticket', LegacyTicket)(NewTicket)` renders the new component or falls back to the old, and the flag decision is logged once per mount. Keeping flag logic out of the ticket means removing the flag later is a one-line change.

## 10. Practical example

**Scenario:** a banking portal needs a "wire limit override" screen that only branch managers can see. The screen should be testable without auth plumbing.

_Illustrative TypeScript. Typechecked (TypeScript 7.0, `strict`) and rendered with React 19 in a scratch project; review before production use._

```tsx
import { createContext, useContext, type ComponentType } from "react";

type Role = "teller" | "branch-manager" | "auditor";
interface User {
  id: string;
  name: string;
  roles: Role[];
}

export const SessionContext = createContext<User | null>(null);

// ---- The HOC -------------------------------------------------------------
export interface WithUserProps {
  user: User;
}

export function withEntitlement<P extends WithUserProps>(
  Wrapped: ComponentType<P>,
  required: Role,
) {
  // Callers see P minus the injected `user` prop.
  function WithEntitlement(props: Omit<P, keyof WithUserProps>) {
    const user = useContext(SessionContext);
    if (!user) return <p role="alert">Please sign in.</p>;
    if (!user.roles.includes(required)) {
      return <p role="alert">You need the “{required}” role to view this.</p>;
    }
    // In React 19, `ref` travels inside props, so spreading forwards it.
    return <Wrapped {...(props as P)} user={user} />;
  }
  const name = Wrapped.displayName ?? Wrapped.name ?? "Component";
  WithEntitlement.displayName = `withEntitlement(${name})`;
  return WithEntitlement;
}

// ---- A plain component that knows nothing about auth --------------------
interface OverrideProps extends WithUserProps {
  accountId: string;
  limit: number;
}

function WireLimitOverride({ user, accountId, limit }: OverrideProps) {
  return (
    <section>
      <h2>Override wire limit for {accountId}</h2>
      <p>
        Current limit: {limit}. Approver: {user.name}
      </p>
    </section>
  );
}

// Created ONCE at module level, never inside render.
export const ProtectedWireLimitOverride = withEntitlement(
  WireLimitOverride,
  "branch-manager",
);
```

Usage: `<ProtectedWireLimitOverride accountId="ACC-42" limit={25000} />`. Passing `user={...}` is a compile error, because `Omit` removed it from the public props.

Observed output when rendered with no user, a teller, and a branch manager:

```text
<p role="alert">Please sign in.</p>
<p role="alert">You need the “branch-manager” role to view this.</p>
<section><h2>Override wire limit for ACC-42</h2><p>Current limit: 25000. Approver: Priya</p></section>
displayName: withEntitlement(WireLimitOverride)
```

**Testing benefit:** `WireLimitOverride` is tested with `render(<WireLimitOverride user={fakeManager} accountId="A" limit={1} />)`, with no Context providers. The HOC gets its own three tests (no user, wrong role, right role) once, and every screen that uses it inherits that coverage.

**The same thing as a hook, for comparison:**

```tsx
export function useEntitlement(required: Role) {
  const user = useContext(SessionContext);
  return { user, allowed: !!user && user.roles.includes(required) };
}

function WireLimitOverrideScreen(props: { accountId: string; limit: number }) {
  const { user, allowed } = useEntitlement("branch-manager");
  if (!user || !allowed) return <p role="alert">Not authorised.</p>;
  return <WireLimitOverride {...props} user={user} />;
}
```

The hook version is more explicit (you can see where `user` comes from) but every screen repeats the guard. The HOC version centralises the guard and fallback UI. Neither is universally better; pick by whether the _policy_ (HOC) or the _data_ (hook) is what you want to reuse.

## 11. Interview answer (2-minute version)

> "A higher-order component is a function that takes a component and returns a new one that wraps it, typically to inject props or add cross-cutting behaviour like auth, telemetry or error handling. It's pure composition, not a React API. Redux's `connect` and React Router's old `withRouter` are the classic examples.
>
> Architecturally, it keeps the inner component ignorant of the concern, so it's testable with plain props, and it centralises policy at the export boundary.
>
> The costs are real, though. Each HOC adds a node to the tree, props appear from nowhere, two HOCs can silently collide on a prop name, TypeScript typing needs `Omit` gymnastics, and if you create a HOC inside render you get a new component type every render, so React remounts the subtree and loses state. Refs and statics also needed special handling, though React 19 makes `ref` a normal prop.
>
> Since hooks arrived in 16.8, I use custom hooks for logic reuse by default: no extra tree nodes and explicit data flow. I still reach for HOCs where the concern must _be_ a component, error boundaries being the main case since there's no hook for them, or for uniform policies like 'every route is wrapped in the page shell'. And I'm clear that a client-side auth HOC is UX, not security; the API enforces authorisation. In Server Component architectures I'd move gating to the server layer entirely."

## 12. Hands-on exercise and troubleshooting

**Exercise (about 45 minutes, any Vite + React + TypeScript app):**

1. Build `withFeatureFlag(flagKey, Fallback)(Component)`, a HOC _factory_. It reads flags from a `FlagsContext` (`Record<string, boolean>`) and renders `Component` when the flag is on, `Fallback` otherwise. Set a `displayName` of `withFeatureFlag(flagKey)(Name)`.
2. Wrap a `NewCheckout` component with it, using `OldCheckout` as the fallback.
3. Add a text input with local state inside `NewCheckout`. Type into it.
4. Write the same thing as a `useFeatureFlag(key)` hook and compare the two call sites.
5. Write three tests (React Testing Library): flag on, flag off, flag missing.

**Expected outcome:** toggling the flag in the provider swaps components; DevTools shows `withFeatureFlag(new-checkout)(NewCheckout)`; typed text survives unrelated parent re-renders.

**Failure symptom 1: typed text disappears whenever the parent re-renders, and the input loses focus.**
Hint: find where you call `withFeatureFlag(...)`. If it is inside a component body, each render creates a new component type and React remounts it. Move the call to module level, or wrap it in `useMemo` keyed on the flag if the config truly is dynamic. Confirm in DevTools with "Highlight updates" or by adding a `useEffect(() => console.log('mount'), [])`: it will log on every keystroke in the broken version.

**Failure symptom 2: TypeScript complains that `Component` is missing a prop, or callers can pass a prop they shouldn't.**
Hint: the HOC's returned component must be typed as `Omit<P, InjectedKeys>`, and you spread `props as P` when rendering the inner component. If a caller _can_ pass the injected prop, your outer props type isn't omitting it. If you see "not assignable to `IntrinsicAttributes & P`", your generic constraint is missing (`P extends InjectedProps`).

## 13. Alternatives and comparison

| Approach                                                        | Reuses                 | Tree cost       | Explicit data flow  | Can render something else first | Works with classes | Best for                                                                                      |
| --------------------------------------------------------------- | ---------------------- | --------------- | ------------------- | ------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| **Custom hook**                                                 | Logic                  | None            | Yes                 | No (caller decides)             | No                 | Default for logic reuse in function components                                                |
| **HOC**                                                         | Behaviour + wrapper    | +1 node per HOC | No (props injected) | Yes                             | Yes                | Error boundaries, uniform policy at export, class-compatible libraries                        |
| **Wrapper component** (`<RequireAuth>{children}</RequireAuth>`) | Wrapper                | +1 node         | Moderate            | Yes                             | Yes                | Gating decided at the call site, layout, providers                                            |
| **Render prop**                                                 | Logic + render control | +1 node         | Yes                 | Yes                             | Yes                | Largely superseded by hooks; still in some libraries (e.g. virtualised lists, form libraries) |
| **Server-side gating** (RSC layout, middleware)                 | Policy                 | None on client  | Yes                 | Yes (redirect)                  | N/A                | Auth and data access in RSC/Next.js apps                                                      |

**Selection rule of thumb:** if you are reusing _logic_, use a hook. If you are reusing a _wrapper around_ a component and the decision is per-component and static, a HOC is fine. If the decision belongs to whoever renders it, use a wrapper component. If it's security, do it on the server as well.

## 14. Summary

- A HOC is a function `Component → Component`; it is a composition pattern, not a React feature.
- It keeps inner components pure and centralises cross-cutting policy, at the cost of indirection, prop collisions, extra tree depth and harder typing.
- Apply HOCs at module level. Creating one in render causes remounts and state loss.
- Always pass through props, never mutate the wrapped component, and set `displayName`. In React 19, refs pass through as props; earlier versions need `forwardRef`.
- Custom hooks are the default for logic reuse since React 16.8. HOCs remain right for error boundaries and uniform, static wrappers.
- Client-side gating is UX, not security.

## 15. Further learning and knowledge check

**Next topics:** render props vs hooks in depth; error boundaries and `react-error-boundary`; React Server Components and where auth belongs; the compound component pattern; dependency injection via Context.

**Q1 (explain):** Why does calling a HOC inside a component's render body cause an input inside the wrapped component to lose its value?

> **Answer:** Each call returns a brand-new function, so the element's `type` differs from the previous render. React's reconciler treats a changed type as a different component, unmounts the old subtree (destroying its state) and mounts a fresh one. Fix: create the enhanced component once at module level.

**Q2 (apply):** Your app has `withUser` and `withAuth`, both injecting a `user` prop, applied as `withAuth(withUser(Profile))`. `Profile` sometimes shows stale data. What's happening and how do you fix it?

> **Answer:** A prop collision: the inner HOC (`withUser`) renders `Profile` last, so its `user` overrides whatever `withAuth` passed in. Which value wins depends on nesting and spread order, and there is no error. Fix by renaming injected props, collapsing to one source of truth, or replacing both with hooks whose return values the component names explicitly.

**Q3 (decide):** A new Next.js App Router project needs (a) admin-only pages, (b) per-widget crash isolation, and (c) shared form-validation logic. Which pattern for each?

> **Answer:** (a) Server-side gating in the route's layout or middleware, because that runs before any data leaves the server; a client HOC would push the page to the client and only hide UI. (b) An error-boundary HOC or wrapper component (e.g. `withErrorBoundary`), since error boundaries must be class components and hooks can't do this. (c) A custom hook (`useFormValidation`): it's pure logic reuse with no need for an extra component.
