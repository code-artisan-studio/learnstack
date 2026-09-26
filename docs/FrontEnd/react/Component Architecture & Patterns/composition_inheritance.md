---
title: Composition over Inheritance
sidebar_label: Components,Props,State
sidebar_position: 2
---

# Composition over Inheritance in React

---

## 1. Overview

Inheritance is a classic object-oriented technique: you create a base class that captures shared behavior, then subclass it to add or override specific pieces. It works well for stable, hierarchical domain models (e.g., `Vehicle` → `Car` → `SportsCar`), but it becomes brittle when applied to UI components.

React was deliberately designed around composition. A component is a function that takes inputs (props) and returns a description of the UI. Instead of extending a base component class to reuse behavior, you combine smaller, focused components together — passing data and behavior down through props, or sharing logic through custom hooks. The React team's own documentation states: "React has a powerful composition model, and we recommend using composition instead of inheritance to reuse code between components" ([React Docs](https://react.dev/learn/understanding-your-ui-as-a-tree)).

The key insight: **inheritance couples components vertically** (a subclass is permanently bound to its parent), while **composition couples them loosely and horizontally** (components are assembled at call time, and you can swap pieces without touching their internals).

---

## 2. Definition and Key Terms

| Term                             | Definition                                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inheritance**                  | A mechanism where a subclass derives behavior and state from a parent class (`class B extends A`). In React, this means extending a base component class. |
| **Composition**                  | Assembling behavior by combining smaller, independent units — components, hooks, or functions — rather than deriving from a base class.                   |
| **Containment**                  | A pattern where a parent component renders children it doesn't know about in advance (via the `children` prop).                                           |
| **Specialization**               | A pattern where a "generic" component is configured into a more specific one by passing props.                                                            |
| **Render Props**                 | A technique where a component receives a function prop that returns JSX, used to share rendering logic between components.                                |
| **Custom Hook**                  | A function (prefixed with `use`) that encapsulates reusable stateful logic, callable from any component.                                                  |
| **HOC (Higher-Order Component)** | A function that takes a component and returns a new component with added behavior. A composition-era pattern now largely superseded by hooks.             |

**Common confusion:** Composition is not the same as "just using props." Props are the mechanism; composition is the architectural philosophy of building complex things from simple, swappable pieces. HOCs and render props are composition techniques, but they have trade-offs that hooks address.

---

## 3. How It Works

### The Inheritance Problem

In class-based React (pre-16.8), developers sometimes tried to reuse component logic via inheritance:

```
BaseForm (handles form state, validation)
  └─ LoginForm extends BaseForm (adds login-specific fields)
  └─ RegistrationForm extends BaseForm (adds registration fields)
  └─ PasswordResetForm extends BaseForm (adds reset fields)
```

This looks clean initially, but breaks down because:

- `LoginForm` is permanently coupled to `BaseForm`'s internal state shape, lifecycle methods, and render logic.
- If `BaseForm` changes its state structure, every subclass can break.
- You cannot easily mix in logic from two different base classes (JavaScript is single-inheritance).
- Testing a subclass requires understanding the entire parent chain.

### The Composition Alternative

Composition flips the dependency direction. Instead of inheriting behavior, you inject it:

```
┌─────────────────────────────────────────────┐
│              Form Component                  │
│  (layout, submission, accessibility)         │
│                                              │
│  Props:                                      │
│    - fields: FieldConfig[]                  │
│    - onSubmit: (data) => Promise             │
│    - children: ReactNode (buttons, etc.)     │
│                                              │
│  Internally uses:                            │
│    - useForm hook (state management)         │
│    - useValidation hook (validation logic)   │
└─────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
   LoginForm    RegistrationForm   PasswordResetForm
   (passes      (passes different  (passes different
    field        field config +    field config +
    config)      onSubmit)          onSubmit)
```

Each "form" is now just a configuration of the same flexible `Form` component — not a subclass. The shared logic lives in hooks (`useForm`, `useValidation`), which can be used independently and combined freely.

### Three Composition Patterns in React

**Pattern 1: Containment** — A component renders unknown children via `children`:

```tsx
// Illustrative — not production-ready
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">{children}</div>
    </div>
  );
}

// Usage: Card doesn't know what's inside
<Card title="User Profile">
  <Avatar url={user.avatarUrl} />
  <UserInfo user={user} />
  <EditButton onClick={handleEdit} />
</Card>;
```

**Pattern 2: Specialization** — A generic component is configured into a specific variant:

```tsx
// Illustrative
function Button({ variant, size, ...props }: ButtonProps) {
  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]}`;
  return <button className={classes} {...props} />;
}

// Specialization: same component, different configuration
const PrimaryButton = (props) => (
  <Button variant="primary" size="md" {...props} />
);
const DangerButton = (props) => (
  <Button variant="danger" size="md" {...props} />
);
```

**Pattern 3: Custom Hooks** — Share stateful logic without inheritance:

```tsx
// Illustrative
function useFormValidation(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      setIsSubmitting(true);
      // ... submit
    }
  };

  return { values, errors, isSubmitting, handleChange, handleSubmit };
}

// Any component can use this — no inheritance needed
function LoginForm() {
  const form = useFormValidation({ email: "", password: "" }, validateLogin);
  return <form onSubmit={form.handleSubmit}>{/* fields */}</form>;
}
```

---

## 4. Internal Architecture

### Why React's component model resists inheritance

React components are functions. A function component is literally:

```
(props) => JSX.Element
```

There is no class hierarchy to extend. Even class components, while technically extendable, are discouraged from being subclassed because:

1. **Lifecycle methods are not inheritable in practice.** A subclass that overrides `componentDidMount` replaces the parent's behavior entirely unless you manually call `super.componentDidMount()`. This is error-prone and fragile.

2. **State merging is implicit.** If a parent class manages `this.state = { loading: true }` and a subclass sets `this.state = { user: null }`, the subclass's constructor clobbers the parent's state. You must manually merge: `this.state = { ...super.state, user: null }` — but `super.state` isn't a standard pattern.

3. **Render override conflicts.** If both parent and subclass define `render()`, the subclass wins. There's no clean way to "wrap" the parent's render output — you'd have to call `super.render()`, which is unusual and breaks React's mental model.

### How hooks enable composition at the logic level

Custom hooks are the primary composition mechanism for stateful logic in modern React (16.8+). They work because:

- A hook is a plain function that calls other hooks. It has no inheritance chain.
- Multiple hooks can be combined in a single component: `useAuth()` + `useFetch()` + `useTheme()` — something impossible with single-inheritance classes.
- Hooks compose because they leverage React's internal hook dispatcher, which maintains a per-component fiber queue of hook states. Each `useState` or `useEffect` call appends to that queue, so calling hooks inside a custom hook is transparent to React — it just sees more hook calls on the same fiber.

```
Component Fiber (internal React representation)
├── useState #1  (from useAuth)
├── useEffect #1 (from useAuth)
├── useState #2  (from useFetch)
├── useEffect #2 (from useFetch)
└── useState #3  (component's own state)
```

This is why hooks obey the Rules of Hooks (call them at the top level, not conditionally) — React relies on call order to map hook calls to their stored state.

---

## 5. When to Use It

- **Almost always.** Composition is the default and recommended approach in React. Use it when:
  - Multiple components share visual structure (use containment via `children` or named slots)
  - Multiple components share stateful logic (extract a custom hook)
  - You need configurable variants of a component (use specialization via props)
  - You need to cross-cut concerns like logging, analytics, or theming (use context + hooks)

## 6. When Not to Use It

There are edge cases where composition patterns add unnecessary indirection:

- **Simple, one-off components** — Don't extract a hook or HOC for a component used in exactly one place. Premature abstraction is a real cost.
- **Deep prop drilling** — If composition requires passing props through 5+ component layers, use Context instead of manually threading props.
- **HOCs in new code** — HOCs were the dominant composition pattern before hooks (16.8). They introduce wrapper hell (deep component trees in React DevTools), prop collision, and static method copying issues. Prefer hooks or wrapper components in modern React.
- **When you genuinely need a class hierarchy** — Rare in React, but if you're building a non-UI library (e.g., a custom data structure) that models a true is-a relationship, inheritance is still appropriate — just not for component composition.

---

## 7. Benefits

| Benefit         | Explanation                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decoupling**  | Composed components depend on props/interfaces, not on a parent class's internal implementation. Swap a child without touching the parent.            |
| **Reusability** | Hooks and small components can be freely combined in ways inheritance cannot match (no single-inheritance constraint).                                |
| **Testability** | A custom hook can be tested in isolation with `renderHook`. A component can be tested with mock props. No need to instantiate a parent class.         |
| **Type safety** | TypeScript prop interfaces are explicit contracts. Inheritance hierarchies rely on `protected` fields that are harder to type-check and reason about. |
| **Flexibility** | You can pass different children, different hooks, or different render functions at call time — not at class definition time.                          |

---

## 8. Trade-offs and Limitations

**Prop drilling** — The most common pain point. When a deeply nested child needs data from a top-level parent, composition requires passing props through every intermediate component. Mitigation: Context API, or component composition patterns where the parent passes the data-hungry child as a prop.

**Indirection** — Heavy use of render props or HOCs can make it hard to trace data flow. A component wrapped in three HOCs, each adding props, can be difficult to debug. Hooks reduce this but don't eliminate it entirely.

**Naming collisions** — When composing multiple hooks or HOCs, prop names can collide (e.g., two HOCs both inject a `data` prop). Hooks avoid this by returning named values: `const { user } = useAuth(); const { data } = useFetch();`.

**Performance** — Composition via wrapper components adds depth to the component tree. Each wrapper triggers reconciliation. In performance-critical paths, `React.memo` or careful structure matters. Inheritance has zero wrapper overhead — but this advantage rarely outweighs the coupling cost.

**Misconception: "Composition means no shared state"** — Not true. Shared state is achieved via Context, state lifting, or external stores (Zustand, Redux). Composition is about how components are structured, not about where state lives.

**Misconception: "Hooks replaced HOCs entirely"** — Mostly true for logic reuse, but HOCs are still useful for cross-cutting concerns that need to intercept rendering (e.g., error boundaries, which are class components by necessity). However, even these can often be expressed as wrapper components.

---

## 9. Real-World Examples

**Banking — Transaction Dashboard:**
A bank's transaction dashboard needs to show transactions in a table, with filtering by date range, export to CSV, and pagination. Instead of a `TransactionTable extends Table extends BaseComponent` hierarchy, composition builds it as: `DataTable` (generic) + `useTransactions` (data hook) + `DateRangeFilter` (composed child) + `ExportButton` (composed child). The same `DataTable` can be reused for customer lists, audit logs, and compliance reports — each just swaps the data hook and filter components.

**Insurance — Claim Form Wizard:**
A multi-step claim form (personal info → incident details → document upload → review) is built by composing `StepWizard` (containment) with individual step components. Validation logic lives in `useClaimValidation`. The same wizard pattern serves auto claims, home claims, and life insurance claims — each just configures different step components and validation rules. Inheritance would require `AutoClaimWizard extends ClaimWizard extends BaseWizard`, coupling each variant to the parent's internal step management.

**Finance — Portfolio Analytics:**
A portfolio dashboard shows charts (line, bar, pie) with shared features: data loading, loading states, error handling, and theming. Composition: `ChartContainer` (handles loading/error states) wraps any chart component via `children`. Data logic in `usePortfolioData` hook. A `PieChart` and `LineChart` are independent components that can be dropped into any `ChartContainer`. Inheritance (`PieChart extends BaseChart`) would couple the chart to the base's rendering logic, making it hard to use the pie chart in a different container.

---

## 10. Practical Example

A realistic scenario: building a modal system for an application.

### The inheritance approach (what not to do)

```tsx
// ❌ Illustrative — anti-pattern
class BaseModal extends React.Component {
  state = { isOpen: false };
  open = () => this.setState({ isOpen: true });
  close = () => this.setState({ isOpen: false });
  render() {
    return this.state.isOpen ? (
      <div className="overlay" onClick={this.close}>
        <div className="modal">{this.renderContent()}</div>
      </div>
    ) : null;
  }
  renderContent() {
    return null;
  } // subclass overrides this
}

class ConfirmModal extends BaseModal {
  renderContent() {
    return <p>Are you sure?</p>; // tightly coupled to BaseModal
  }
}
```

Problems: `ConfirmModal` cannot exist without `BaseModal`. It can't reuse the open/close logic with a different overlay. It can't compose with a second base class (e.g., a theme provider).

### The composition approach

```tsx
// ✅ Illustrative — composition pattern
// Hook: reusable open/close logic
function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}

// Generic component: containment via children + render prop
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Specialization: compose the pieces together
function ConfirmDialog({ message, onConfirm, onCancel }) {
  const { isOpen, open, close } = useModal();
  return (
    <>
      <button onClick={open}>Delete</button>
      <Modal isOpen={isOpen} onClose={close}>
        <p>{message}</p>
        <div className="actions">
          <button
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            Confirm
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </Modal>
    </>
  );
}
```

Benefits: `useModal` can be used anywhere. `Modal` can wrap any content. `ConfirmDialog` is just one assembly of these pieces — you can build `AlertDialog`, `FormModal`, or `ImageLightbox` the same way without touching `Modal` or `useModal`.

---

## 11. Interview Answer — 2-Minute Version

> Composition over inheritance in React is the principle of building complex UIs by combining small, focused, independent components rather than creating class hierarchies where subclasses extend base components. React's component model is function-based — a component is a function from props to JSX — so inheritance doesn't fit naturally. Instead, React provides three composition mechanisms: containment (using `children` to let a parent render unknown content), specialization (configuring a generic component via props), and custom hooks (extracting reusable stateful logic into functions that can be called from any component). The key advantage is decoupling: a composed component depends only on the props or hooks it receives, not on a parent class's internal state and lifecycle. This makes components more testable, reusable, and flexible — you can swap any piece at call time. The main trade-off is prop drilling when data must pass through many layers, which Context addresses. In practice, I use hooks for logic reuse, `children` for layout composition, and Context for cross-cutting state — and I avoid HOCs and class inheritance unless there's a specific need like error boundaries.

---

## 12. Hands-On Exercise

**Exercise: Refactor an inheritance-based component to composition**

Given this inheritance-based code (intentionally flawed):

```tsx
// Starting point — refactor this
class BaseList extends React.Component {
  state = { items: [], loading: false };
  componentDidMount() {
    this.fetch();
  }
  fetch = async () => {
    this.setState({ loading: true });
    const res = await fetch(this.props.url);
    const items = await res.json();
    this.setState({ items, loading: false });
  };
  render() {
    if (this.state.loading) return <p>Loading...</p>;
    return (
      <ul>
        {this.state.items.map((i) => (
          <li key={i.id}>{i.name}</li>
        ))}
      </ul>
    );
  }
}

class UserList extends BaseList {
  // "extends" just to reuse fetch + render — but coupled forever
}
```

**Tasks:**

1. Extract the data-fetching logic into a custom hook `useFetch`
2. Create a generic `List` component that uses `children` for rendering items
3. Create a `UserList` component that composes `useFetch` + `List` + a render function

**Expected outcome:** `UserList` should work identically but have zero inheritance. The `List` component should be reusable for any data type, and `useFetch` should be usable in non-list contexts.

**Failure symptom to watch for:** If your `List` component has a hardcoded `<li>` with `{item.name}`, it's not truly composable — it should accept a render function or `children` that receives each item. If `useFetch` is tied to a specific response shape, it's not reusable — it should return raw data and let the caller interpret it.

---

## 13. Alternatives and Comparison

| Approach                   | Mechanism                                   | Best For                                   | Drawbacks                                                   |
| -------------------------- | ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| **Custom Hooks**           | Function that calls React hooks             | Reusable stateful logic                    | Cannot share render logic directly                          |
| **Containment (children)** | Parent renders `children` prop              | Layout, wrapper components                 | Limited to one slot unless you use named props              |
| **Render Props**           | Component receives a function returning JSX | Sharing rendering logic between components | Can cause unnecessary re-renders; verbose syntax            |
| **HOC**                    | Function wrapping a component               | Cross-cutting concerns (legacy code)       | Wrapper hell, prop collisions, static method issues         |
| **Context**                | Provider/consumer for shared data           | Cross-cutting state (theme, auth, locale)  | Can cause re-render storms if overused                      |
| **Inheritance**            | `class B extends A`                         | Almost never in React                      | Tight coupling, single-inheritance limit, fragile lifecycle |

**Selection criteria:** Start with hooks for logic. Use `children` for layout composition. Use Context only when prop drilling exceeds 2-3 levels. Use render props when you need to share rendering logic (not just state). Avoid HOCs in new code unless integrating with a library that requires them. Avoid inheritance for components entirely.

---

## 14. Summary

- React's design is fundamentally compositional — components are functions, not classes in a hierarchy
- Inheritance creates tight vertical coupling; composition creates loose horizontal coupling
- Three primary composition patterns: containment (`children`), specialization (props), and custom hooks (logic)
- HOCs and render props are composition techniques but are largely superseded by hooks in modern React
- The main trade-off is prop drilling, mitigated by Context
- Use hooks for logic reuse, `children` for layout, Context for cross-cutting state, and avoid class inheritance for components

---

## 15. Knowledge Check

**Q1:** Your team has a `BaseTable` class component that manages sorting, pagination, and rendering. Three subclasses override `renderRow()` for different data types. What are two specific problems with this approach, and how would you refactor it using composition?

**Q2:** You need to share a "fetch data with loading and error states" pattern across 5 unrelated components. You could use an HOC, a render prop, or a custom hook. Which do you choose and why? What would change your decision?

**Q3:** A deeply nested component tree needs theme data (colors, spacing) that only the root component possesses. Prop drilling through 6 levels is painful. What's the composition-friendly solution, and what's one performance pitfall to watch for?

**A1:** Problem 1: Each subclass is permanently coupled to `BaseTable`'s internal state shape and lifecycle — if `BaseTable` changes how it stores sort state, every subclass breaks. Problem 2: JavaScript's single inheritance means you can't also mix in, say, a `useExportable` behavior. Refactor: Extract sorting/pagination into `useTableState` hook. Make `Table` a generic component that accepts `data`, `columns`, and a `renderRow` prop (or uses `children` with a render function). Each "subclass" becomes a composition: `<Table data={users} columns={userColumns} renderRow={row => <UserRow user={row} />} />`.

**A2:** Choose the custom hook (`useFetch`). It's the most composable — it returns named values (`{ data, loading, error }`) that can be used anywhere in the component, not just in the render path. It doesn't add wrapper components to the tree (unlike HOCs) and doesn't require the consumer to structure their JSX around a function prop (unlike render props). You'd reconsider if you needed to share rendering logic, not just data — then a render prop or wrapper component would be appropriate. If you're integrating with a library that only provides HOCs (e.g., `withRouter` in older React Router), use the HOC for that specific case.

**A3:** Use the Context API — create a `ThemeContext` with a Provider at the root and `useContext(ThemeContext)` in any consumer. The performance pitfall: when the context value changes, every component that calls `useContext` re-renders, even if it only uses one field. Mitigate by splitting contexts (e.g., separate `ColorContext` and `SpacingContext`) or by memoizing the context value and using selectors/memoization patterns.
