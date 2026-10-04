---
title: Event Handling
sidebar_label: Event Handling
sidebar_position: 6
---

Event handling in React is how components respond to user actions—clicks, typing, form submission, focus, pointer movement, and keyboard input. You attach a JavaScript function to a JSX event prop such as `onClick` or `onChange`; that function can update state, call parent callbacks, or interact with an external system.[1][2]

## Basic event handlers

React event props use **camelCase** and receive a function:

```jsx
function Button() {
  function handleClick() {
    alert("Button clicked");
  }

  return <button onClick={handleClick}>Save</button>;
}
```

```text
User clicks button
      |
      v
React invokes handleClick
      |
      v
Your code runs
```

The function is **passed**, not called during rendering:

```jsx
// Correct: React calls it later when the click happens
<button onClick={handleClick}>Save</button>
```

```jsx
// Incorrect: calls it immediately while rendering
<button onClick={handleClick()}>Save</button>
```

React’s event-handling guidance specifically emphasizes `onClick={handleClick}`, not `onClick={handleClick()}`.[1]

You can also write a small handler inline:

```jsx
<button onClick={() => alert("Saved")}>Save</button>
```

Inline handlers are fine for simple logic. Extract a named function when the logic is reused, multi-step, or benefits from a descriptive name.

## Common React events

| User action           | React event prop                   | Typical handler      |
| --------------------- | ---------------------------------- | -------------------- |
| Click                 | `onClick`                          | `handleClick`        |
| Double click          | `onDoubleClick`                    | `handleDoubleClick`  |
| Text input changes    | `onChange`                         | `handleChange`       |
| Form submitted        | `onSubmit`                         | `handleSubmit`       |
| Input gains focus     | `onFocus`                          | `handleFocus`        |
| Input loses focus     | `onBlur`                           | `handleBlur`         |
| Key pressed           | `onKeyDown`                        | `handleKeyDown`      |
| Pointer enters/leaves | `onPointerEnter`, `onPointerLeave` | `handlePointerEnter` |
| Mouse enters/leaves   | `onMouseEnter`, `onMouseLeave`     | `handleMouseLeave`   |

React lets you attach handlers to JSX elements for interactions including clicking, hovering, and focusing inputs.[1][2]

## Events update state

Most handlers change the UI by updating state.

```jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  function handleIncrement() {
    setCount((currentCount) => currentCount + 1);
  }

  return (
    <>
      <p>Count: {count}</p>
      <button onClick={handleIncrement}>Increment</button>
    </>
  );
}
```

```text
Click
  → handleIncrement()
  → setCount(...)
  → React schedules a new render
  → UI shows the new count
```

Use the functional updater when the next value depends on the prior value:

```jsx
setCount((currentCount) => currentCount + 1);
```

React queues state updates and processes them after the event handler has finished. This batching avoids partial UI updates and means state values inside the currently running handler remain a snapshot from that render.[3][4]

### Why this may surprise you

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log(count); // Still the old value for this render
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

`setCount` requests a future render; it does not change the `count` variable already captured by the current handler. Each render has its own snapshot of state and its own event-handler functions.[3]

For multiple updates to the same state in one handler:

```jsx
function addThree() {
  setCount((current) => current + 1);
  setCount((current) => current + 1);
  setCount((current) => current + 1);
}
```

The functional form correctly builds on the queued prior value.[4]

## Passing arguments

If the handler needs arguments, wrap the call in an arrow function:

```jsx
function ProductRow({ product, onDelete }) {
  return (
    <li>
      {product.name}
      <button onClick={() => onDelete(product.id)}>Delete</button>
    </li>
  );
}
```

```text
Do this:
onClick={() => onDelete(product.id)}

Not this:
onClick={onDelete(product.id)}
```

The first passes a function for React to invoke later. The second executes `onDelete` immediately during rendering.

The event object is available too:

```jsx
function handleDelete(event, productId) {
  console.log(event.currentTarget);
  console.log(productId);
}

<button onClick={(event) => handleDelete(event, product.id)}>Delete</button>;
```

## Form events

HTML forms have default browser behavior: submitting a form normally reloads or navigates the page. In a React single-page application, prevent that default and handle the submission yourself.[1]

```jsx
import { useState } from "react";

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!email.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }

    setMessage(`Account request submitted for ${email}.`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <button type="submit">Create account</button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

```text
User types
  → onChange
  → setEmail(event.target.value)
  → React re-renders with updated value

User submits
  → onSubmit
  → event.preventDefault()
  → validation / API request / state update
```

### Controlled inputs

A controlled input gets its displayed value from React state:

```jsx
<input value={email} onChange={(event) => setEmail(event.target.value)} />
```

React state is the source of truth. The browser produces an input event, the handler updates state, and React renders the state value back to the input.

For checkboxes, use `checked` and `event.target.checked`:

```jsx
const [acceptedTerms, setAcceptedTerms] = useState(false);

<input
  type="checkbox"
  checked={acceptedTerms}
  onChange={(event) => setAcceptedTerms(event.target.checked)}
/>;
```

## Event object

React passes an event object to the handler:

```jsx
function handleClick(event) {
  console.log(event.type); // "click"
  console.log(event.target); // element that initiated event
  console.log(event.currentTarget); // element with this handler
}
```

A useful distinction:

| Property              | Meaning                                        |
| --------------------- | ---------------------------------------------- |
| `event.target`        | The deepest element that initiated the event   |
| `event.currentTarget` | The element whose handler is currently running |

Example:

```jsx
<button onClick={handleClick}>
  <span>Save</span>
</button>
```

If the user clicks `<span>`:

```text
event.target        → <span>
event.currentTarget → <button>
```

For behavior tied to the element that owns the handler, `currentTarget` is often the safer choice.

## Event bubbling

Most React events propagate upward through the component/DOM tree. If a user clicks a button inside a clickable card, both handlers can run.[1]

```jsx
function ProductCard({ product }) {
  function handleCardClick() {
    console.log("Open product details");
  }

  function handleDeleteClick() {
    console.log("Delete product");
  }

  return (
    <article onClick={handleCardClick}>
      <h2>{product.name}</h2>

      <button onClick={handleDeleteClick}>Delete</button>
    </article>
  );
}
```

Clicking `Delete` logs:

```text
Delete product
Open product details
```

### Stop propagation

If the nested action should not trigger the parent action:

```jsx
function handleDeleteClick(event) {
  event.stopPropagation();
  console.log("Delete product");
}

<button onClick={handleDeleteClick}>Delete</button>;
```

`event.stopPropagation()` prevents the event from continuing upward to parent handlers.[1]

### Prevent default vs stop propagation

| Method                    | Stops what?                       | Example                                                   |
| ------------------------- | --------------------------------- | --------------------------------------------------------- |
| `event.preventDefault()`  | Browser’s built-in action         | Prevent form reload or link navigation                    |
| `event.stopPropagation()` | Event movement to parent handlers | Prevent a card click when clicking an inner delete button |

They solve different problems and can be used together when necessary.

## Parent-child communication

React uses one-way data flow: data and handler functions flow from parent to child through props. The child invokes the callback to request that the parent change state.[1]

```jsx
function SaveButton({ onSave }) {
  return <button onClick={onSave}>Save changes</button>;
}

function Editor() {
  const [isSaved, setIsSaved] = useState(false);

  function handleSave() {
    setIsSaved(true);
  }

  return (
    <>
      <SaveButton onSave={handleSave} />
      {isSaved && <p>Saved.</p>}
    </>
  );
}
```

You can name custom handler props after domain actions instead of browser events:

```jsx
<Toolbar onPlayMovie={handlePlayMovie} onUploadImage={handleUploadImage} />
```

This makes reusable components easier to understand because the child describes what happened, while the parent decides what it means for the application. React recommends application-specific event-prop names for custom components.[1]

## Event handlers vs Effects

Event handlers and Effects are different:

```text
Event handler:
Runs because the user performed a specific action.

Effect:
Runs because React needs to synchronize with an external system after rendering.
```

For example:

```jsx
function PurchaseButton({ productId }) {
  function handlePurchase() {
    // Correct place for a user-triggered action
    buyProduct(productId);
  }

  return <button onClick={handlePurchase}>Buy</button>;
}
```

Do not place a purchase request in an Effect simply because a component mounted. Effects can rerun whenever dependencies change, whereas handlers run in response to a specific interaction.[5]

## Practical patterns

### Disable repeated submission

```jsx
function SaveForm() {
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) return;

    setIsSaving(true);

    try {
      await saveChanges();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
    </form>
  );
}
```

### Keyboard interaction

Use semantic HTML first:

```jsx
<button onClick={handleSave}>Save</button>
```

A real `<button>` automatically supports keyboard activation, focus behavior, and accessibility semantics. Avoid creating clickable `<div>` elements unless you also deliberately implement keyboard handling, focusability, role, and accessibility behavior.

For an input that should submit when Enter is pressed, a semantic `<form onSubmit={...}>` is usually better than manually checking for `Enter` in `onKeyDown`.

## Common mistakes

- Writing `onClick={handleClick()}` instead of `onClick={handleClick}`.
- Calling a callback while rendering instead of wrapping it when it needs arguments.
- Mutating state directly instead of using its setter.
- Assuming state updates immediately within the same handler.
- Forgetting `event.preventDefault()` on SPA form submissions.
- Forgetting `event.stopPropagation()` for nested interactive elements when necessary.
- Using Effects for user-triggered actions.
- Using non-semantic clickable elements instead of `<button>`, `<a>`, or a form control.
- Updating an input’s `value` without an `onChange` handler, making it effectively read-only.

## Interview answer

> Event handling in React uses camel-cased JSX props such as `onClick`, `onChange`, and `onSubmit`. I define a handler function and pass it to the element—`onClick={handleClick}`, not `onClick={handleClick()}`—so React calls it when the interaction occurs. Handlers usually update component state, call a callback passed from a parent, or start a user-triggered operation such as a form submission. React batches state updates after the handler finishes, so state inside the current handler is a snapshot; when the next value depends on the previous value, I use the functional setter form. For forms I call `preventDefault()`, and for nested interactive elements I use `stopPropagation()` only when I need to prevent parent handlers from running.[1][3][4][5]

## Sources

1. Responding to Events https://react.dev/learn/responding-to-events
2. Adding Interactivity https://react.dev/learn/adding-interactivity
3. State as a Snapshot https://react.dev/learn/state-as-a-snapshot
4. Queueing a Series of State Updates https://react.dev/learn/queueing-a-series-of-state-updates
5. Separating Events from Effects https://react.dev/learn/separating-events-from-effects
6. 回應Event https://zh-hant.react.dev/learn/responding-to-events
7. Menanggapi Event https://id.react.dev/learn/responding-to-events
