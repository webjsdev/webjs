# Lit muscle-memory gotchas

AI agents trained on lit will reach for patterns that look correct but
break webjs's SSR contract, reactivity model, or styling defaults. This
file catalogs those failures with the webjs-shaped fix for each.

The architectural disagreement underneath all of these. Lit is JS-first
(hydration is the API). Webjs is HTML-first (first paint is real HTML,
JS is opt-in per interactive behavior). Every gotcha below is
downstream of that one disagreement.

## Mental model. Progressive enhancement, JS opt-in per behavior not per component

Webjs is a progressive enhancement framework. Pages render as real HTML
on the server, and every web component renders to real HTML on the
server. With JavaScript disabled in the browser, the page is still
readable, `<a>` links still navigate, and `<form action method>`
submissions still hit server actions. Display-only custom elements
still render their server-produced HTML.

JavaScript is opt-in **per interactive behavior, not per component**.
This is the distinction most lit-shaped intuitions miss.

In lit and most modern frameworks, hydration is a per-component
decision. You decide whether a given component is interactive (and
therefore needs JS shipped and run) at the component boundary.
"Hydrate this island, skip that one."

In webjs, the granularity is different. Every component is server
rendered. JavaScript is requested **by the specific interactive holes
you write in the template**. A `@click=${...}` binding requests JS for
click handling. A `signal.set(...)` call (instance or module-scope)
requests JS for reactive updates. A property binding
`.data=${richObject}` requests JS for property hydration. A controller
like `Task` requests JS for that async behavior. A plain `<a href>`
does not request JS. A `<form action="...">` does not request JS. A
purely display-time component (no event listeners, no signal
mutations, no property bindings to hydrate) does not request JS.

A single component can mix both. A product card that shows
server-rendered title, price, image, and a "View" link
(no JS needed) plus an "Add to cart" button with a `@click`
(JS needed for that one behavior). The framework loads JS for the
component because of the `@click`, runs it, and the rest of the card
stays exactly as the server painted it. You do not pick a hydration
mode for the component. You write the markup, and the JS budget
follows from which interactive behaviors that markup uses.

Practical consequences for agents writing webjs code.

1. Never reach for `fetch()` plus a JS click handler when a `<form>`
   plus a server action would do. The form is free (no JS), the
   server action is typed and CSRF-protected, the result reaches the
   page through normal navigation.
2. Never make first paint depend on hydration. If the user sees a
   blank skeleton until JS runs, you wrote the feature wrong.
3. Never assume "this component needs JS" or "this component is
   static" as a binary. Pick interactive primitives per behavior. A
   shopping cart page can have ten components, eight of them adding
   zero JS bytes, two of them adding the handlers they need.
4. When choosing between a server action invoked from `<form>` and a
   client-side action invoked from `@click`, default to the form
   unless the interaction genuinely needs client-only state
   (optimistic UI, in-flight indicators tied to client state,
   keyboard shortcuts).

## The SSR contract: constructor and `render()` only

By design, the webjs SSR pipeline runs three steps. Construct the
instance. Apply attributes. Call `instance.render()`. Nothing else
fires server-side. Not `connectedCallback`, not `willUpdate`, not
`shouldUpdate`, not `firstUpdated`, not `updated`, not controllers'
`hostConnected` / `hostUpdate` / `hostUpdated`. See
`packages/core/src/render-server.js` around line 357.

The mental model is one sentence. Code in the constructor and `render()`
must be SSR-safe (no browser APIs). Code in every other hook is
client-only and can freely use any browser API without an `isServer`
guard.

The gotchas below are all violations of that rule.

## Patterns that produce visibly broken SSR

### 1. Fetching data in `connectedCallback` or `firstUpdated`

The lit pattern is to subscribe or fetch on connect, then update
state when the data arrives. In webjs the first paint is empty because
neither hook runs server-side. Content pops in after hydration, often
with a layout shift.

Fix. Fetch in the page function and pass the data as props or
attributes.

```ts
// app/users/[id]/page.ts (correct)
import { fetchUser } from '../../modules/users/queries/fetch-user.server.ts';
export default async function User({ params }) {
  const user = await fetchUser(params.id);
  return html`<user-card .user=${user}></user-card>`;
}
```

### 2. Using `Task` for initial-paint data

Lit's canonical async pattern. The `Task` controller wires up a fetcher
that runs on host update. In webjs, `Task` is client-only by design
(`hostUpdate` does not fire server-side). SSR ships the pending state,
then the client renders the resolved state, causing a flash.

`Task` is still useful for client-time async (interaction-triggered
mutations, polling, websocket reactions). For initial-paint data, fetch
in the page function instead.

### 3. Browser-only APIs in the constructor or `render()`

Calls like `window.matchMedia(...)`, `localStorage.getItem(...)`,
`navigator.userAgent`, `document.querySelector(...)` in the constructor
or render path crash SSR. The constructor is for pure-JS init
(defaults, method binding, instance fields). Browser APIs belong in
`connectedCallback` or later hooks (which are client-only by
construction).

```ts
// wrong
constructor() {
  super();
  this.dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// right
constructor() {
  super();
  this.dark = false;
}
connectedCallback() {
  super.connectedCallback();
  this.dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
}
```

The same applies to HTMLElement instance members on `this`
(`this.setAttribute(...)`, `this.classList`, `this.querySelector(...)`,
`this.attachShadow(...)`, `this.hasAttribute(...)`): the SSR-time instance is
a bare class with no DOM, so they throw. Read an attribute that drives render
through a reactive property (`static properties` + `declare`) instead of
`this.hasAttribute(...)`; the SSR walker applies the attribute to the property
before calling render.

Two guards catch this. `webjs check` flags browser globals and HTMLElement
members used in a constructor or render body (the `no-browser-globals-in-render`
rule). And if one slips through, the SSR crash is now actionable: the log names
the offending member and tells you to move it to `connectedCallback` or a
lifecycle hook, instead of a raw `document is not defined`.

### 4. Top-level imports of browser-only libraries

`import * as d3 from 'd3'`, `import Chart from 'chart.js'`, or any
library that touches `window` at import time. The page module loads on
the server during SSR, so the offending top-level access crashes.

Two fixes. Use a dynamic `import()` inside `connectedCallback` for
client-only behavior. Or wrap server-side work in a `.server.ts` file
if the library has both server and client uses.

```ts
connectedCallback() {
  super.connectedCallback();
  import('chart.js').then(({ Chart }) => {
    this.chart = new Chart(this.canvas, this.config);
  });
}
```

## Patterns that compile but silently break reactivity

### 5. Class-field initializers for reactive properties

This looks fine in TypeScript. It silently breaks the framework's
accessor.

```ts
// wrong (the initializer overwrites the framework accessor after super())
class StudentCard extends WebComponent {
  static properties = { student: { type: Object } };
  student: Student = { name: '', email: '' };
}

// right
class StudentCard extends WebComponent {
  static properties = { student: { type: Object } };
  declare student: Student;
  constructor() {
    super();
    this.student = { name: '', email: '' };
  }
}
```

`webjs check` flags this via the `reactive-props-use-declare` rule, but
AI agents emit the broken form on autopilot. The convention check is
the safety net, not the primary defense. Authoring code should use
`declare` plus constructor defaults from the start.

### 6. The `@property()` decorator

Banned by framework invariant 10 (erasable TS). The replacement is
`static properties = { ... }` plus a matching `declare` for the typed
accessor, as shown above. Decorators are non-erasable, so they would
force the framework to depend on a build step.

## Patterns that produce different visual output

### 7. Expecting shadow DOM by default

Lit components default to shadow DOM. `static styles = css` scoping
works automatically. Webjs defaults to light DOM. A `static styles`
block without `static shadow = true` does nothing useful (the framework
warns at runtime), and styles authored for the component bleed into
the global namespace.

Two correct paths. Add `static shadow = true` to the class and keep
`static styles`. Or drop `static styles` and use Tailwind utilities,
which webjs treats as the styling default. If authoring vanilla CSS in
light-DOM mode, every selector must be prefixed with the component
tag, per the styling invariant.

### 8. `<slot>` timing differs across DOM modes

Both modes accept `<slot>` syntax in templates and provide
`assignedNodes`, `assignedElements`, `slotchange`, named slots,
fallback content, and first-wins resolution. The public surface
aligns.

What differs is timing. In shadow DOM, slot projection is a browser
primitive that fires synchronously on parse. In light DOM, projection
is framework-driven (`packages/core/src/slot.js`) and observes
mutations via `MutationObserver`. Code that reads
`slot.assignedNodes()` synchronously in `connectedCallback` may see an
empty list in light DOM and a populated list in shadow DOM. Use
`slotchange` to react instead of reading synchronously.

## Lifecycle hooks that do not run server-side

### 9. `willUpdate` computing state that needs to appear in SSR

```ts
// wrong
willUpdate(changedProperties) {
  this.fullName = `${this.first} ${this.last}`;
}
render() {
  return html`<p>${this.fullName}</p>`;
}
```

The SSR HTML shows `<p></p>` because `willUpdate` is client-only.

Fix. Compute in `render()` directly, in a property setter, or via a
`static properties` setter wrapper. The rule is broader than this one
hook. Any value that needs to appear in SSR output must be computable
from constructor-initialized state plus applied attributes plus
`render()` body alone.

```ts
render() {
  const fullName = `${this.first} ${this.last}`;
  return html`<p>${fullName}</p>`;
}
```

### 10. `ContextProvider` for server-known data

Context providers in lit publish on connect via `hostConnected`. In
webjs SSR, `connectedCallback` does not run, so descendants that read
context during SSR see the default value (or undefined). On hydration
the provider connects and consumers re-render, causing a content
shift.

Rule of thumb. For data known on the server (session, user, theme,
locale, feature flags, A/B variants), pass it through props from the
page function rather than through context. Reserve `ContextProvider`
for client-time concerns (interaction state, focus management,
transient UI state).

## Quick reference

| Lit pattern | Webjs equivalent |
|---|---|
| Fetch in `connectedCallback` or `firstUpdated` | Fetch in the page function, pass as props |
| `Task` for initial-paint data | Page function fetch and pass as props |
| `Task` for client-time async | `Task` (no change, that's its job) |
| `window.X` or `document.X` in constructor or `render()` | Move to `connectedCallback` |
| Top-level `import` of browser-only library | Dynamic `import()` inside `connectedCallback` |
| `student: Student = { ... }` field initializer | `declare student: Student` plus constructor default |
| `@property()` decorator | `static properties = { ... }` plus `declare` |
| `static styles = css` with default shadow | Add `static shadow = true`, or switch to Tailwind |
| `willUpdate` for SSR-visible derived state | Compute inline in `render()` |
| `ContextProvider` for server-known data | Pass via props from the page function |

## When in doubt

If a pattern needs to influence the first paint, it has to be in the
constructor, the page function, or `render()`. If a pattern needs the
DOM, the event loop, or a browser API, it has to be in
`connectedCallback` or later. There is no third category. Anything
that violates this split either crashes SSR or produces a hydration
flash.
