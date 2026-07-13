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

In WebJs, the granularity is different. Every component is server
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

Practical consequences for agents writing WebJs code.

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

## Use lit idioms, not vanilla DOM (the whole point of lit-style components)

WebJs components are lit-shaped on purpose: the value is the declarative
DX (typed reactive props, signals, `html` templates, declarative
bindings), not raw DOM scripting. Reaching for vanilla web-component
muscle memory (`this.getAttribute`, `this.setAttribute`, `this.classList`,
`this.addEventListener`, `this.innerHTML`, `document.createElement`,
manual `observedAttributes` / `attributeChangedCallback`, manual
`customElements.define`) inside a component is the anti-pattern. Use the
lit form unless the vanilla API is genuinely unavoidable.

| Vanilla muscle memory | Lit-style WebJs form |
|---|---|
| `this.getAttribute('x')` / `this.hasAttribute('x')` for own config | a reactive prop declared in the factory: `extends WebComponent({ x: String })`, read `this.x` (the prop rides the `x` attribute) |
| `this.setAttribute('x', v)` / `removeAttribute` to reflect own state | a reactive prop with `reflect: true`, or for non-attribute state a `signal` |
| `state: true` reactive prop for internal state | a `signal` (instance signal in the constructor, or module-scope) |
| `this.classList.add/toggle(...)` on self | a `class=${...}` binding in `render()` |
| `this.innerHTML = ...` / `appendChild` / `document.createElement` | return the markup from `render()` as `` html`...` `` |
| `this.addEventListener('click', ...)` on own/child elements | a `@click=${...}` binding in the template |
| `this.querySelector(...)` to reach own rendered DOM | the `ref()` directive + `createRef()`, or read a `<form>` with `new FormData(form)` |
| manual `observedAttributes` + `attributeChangedCallback` | a factory-declared reactive prop `WebComponent({ ... })` (the framework derives both) |
| manual `customElements.define('x', C)` | `C.register('x')` |

Emitting an event with `this.dispatchEvent(new CustomEvent(...))` is the
correct lit form, not a vanilla smell. Reading form values with
`new FormData(e.currentTarget)` inside a `@submit` handler is also fine.

**When vanilla DOM is genuinely needed (these stay):**

- **Ancestor lookup in a compound component.** `this.closest('ui-tabs')`
  to read a parent's state. There is no declarative lit equivalent. This
  resolves at SSR too (tag-name selectors, against the SSR ancestor
  chain), so a compound child's active/pressed state is correct in the
  first server paint, not just after hydration. Host attributes the
  child sets in `render()` (`this.dataset.* =`, `this.className =`,
  `this.ariaPressed =`) reflect onto the SSR'd host tag. A class or
  attribute selector still resolves to null server-side.
- **Slotted / projected content.** `this.querySelector(...)` reaching a
  `<slot>`-projected child or a sibling sub-component the template does
  not own. `ref()` only binds elements this component's own `render()`
  creates, so it cannot reach slotted content.
- **Host attributes in light DOM.** A light-DOM `render()` template
  cannot bind attributes or listeners on the host element itself, so a
  component that must style or listen on its own host writes
  `this.dataset.* =` / `this.className =` / `this.addEventListener` on
  `this` in a lifecycle hook. Shadow-DOM components avoid this.
- **Global listeners.** `document` / `window` `addEventListener` for
  click-away, global keys, resize, or reposition.
- **Reading another element's attribute.** `contentHost.getAttribute('side')`
  reads a different element's config, not `this`.
- **Browser-only globals.** `localStorage`, `matchMedia`, `navigator`,
  `document.documentElement` mutations (a theme toggle setting `<html>`),
  clipboard. These belong in `connectedCallback` or an event handler.
- **Imperative focus.** `el.focus()` has no declarative form.

The rule of thumb: if a reactive prop, a signal, an `html` binding, or
`ref()` expresses it, use that. Reach for vanilla DOM only for the cases
above, where the platform offers nothing declarative.

This is a **convention, not a lint rule.** `webjs check` is reserved for
general correctness (SSR safety, server-only imports, erasable TS, and
so on), not for policing every vanilla call, which would be noisy and
poor DX. Use your judgment: prefer the lit form by default, and when a
vanilla API genuinely has no declarative equivalent (the cases above),
just use it.

## The SSR contract: the pre-render lifecycle plus `render()`

By design, the WebJs SSR pipeline constructs the instance, applies
attributes, runs the **pre-render value-deriving hooks** (`willUpdate`,
then controllers' `hostUpdate`), reflects `reflect: true` properties,
and calls `instance.render()`. Nothing past render fires server-side.
Not `connectedCallback`, not `shouldUpdate`, not the `update` DOM
commit, not `firstUpdated`, not `updated`, not controllers'
`hostConnected` / `hostUpdated`. See the `performServerUpdate()`
pre-render pass in `packages/core/src/render-server.js` (called from
`injectDSD`).

The mental model is one sentence. Code in the constructor, `willUpdate`,
and `render()` must avoid the genuinely browser-only surface (`document`,
`window`, `localStorage`, `navigator`, `querySelector`, layout reads),
though the attribute, event, and `attachInternals` methods are backed by
a server shim and are safe. Code in every other hook is client-only and
can freely use any browser API without an `isServer` guard.

The gotchas below are all violations of that rule.

## Patterns that produce visibly broken SSR

### 1. Fetching data in `connectedCallback` or `firstUpdated`

The lit pattern is to subscribe or fetch on connect, then update
state when the data arrives. In WebJs the first paint is empty because
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
that runs on host update. Controllers' `hostUpdate` does fire at SSR, but
`Task` deliberately does not auto-run server-side: it keeps its `INITIAL`
state and runs only on hydration, so no request fires during SSR. The
client then renders the resolved state, causing a flash.

`Task` is still useful for client-time async (interaction-triggered
mutations, polling, websocket reactions). For initial-paint data, fetch
in the page function OR in the component itself with an `async render()`
(see the next entry), which Lit does not have.

### 2b. Lit has no async render; WebJs does (#469)

Lit keeps `render()` synchronous (its async-SSR work signals a promise the
renderer awaits BEFORE a still-sync render). WebJs lets `render()` itself be
`async`, so you write `const u = await getUser(this.id)` directly in the
component and SSR bakes the resolved data into the first paint. Three things
trip up Lit muscle memory:

- **SSR blocks by default. Streaming is NOT automatic.** A bare `async
  render()` (no wrapper) renders real data in the first paint with no
  fallback. There is no skeleton flash. To STREAM slow data (fallback on
  first byte), wrap the region in `<webjs-suspense .fallback=${html`…`}>`.
  Do not reach for a fallback expecting it to show on first load; the
  unwrapped default is block-real-data, and streaming is the deliberate
  opt-in for slow regions.
- **`renderFallback()` is NOT a first-paint concern.** It is the OPTIONAL
  client re-fetch loading UI, shown only when a prop / dependency change
  re-runs `async render()`, never on the first paint. The first-paint and
  re-fetch defaults are both no-flash: SSR has the data, and a re-fetch keeps
  the stale content (stale-while-revalidate) until the new render resolves.
- **You do not need an error boundary.** A thrown `await getData()` is
  isolated to that component automatically (siblings render, the page does
  not blank). Add `renderError()` only to customize the error UI.

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

This applies only to the genuinely browser-only HTMLElement members on
`this` (`this.classList`, `this.querySelector(...)`,
`this.attachShadow(...)`, `this.getBoundingClientRect(...)`, `this.focus()`):
the SSR-time instance has no DOM, so they throw. The attribute methods
(`this.getAttribute` / `setAttribute` / `hasAttribute` / `toggleAttribute`),
the event methods (`addEventListener` / `removeEventListener` /
`dispatchEvent`), and `this.attachInternals()` ARE backed by a server shim,
so reading an attribute in `render()`, wiring a delegated listener in the
constructor, or reflecting a property during the SSR update cycle all work.
Reading attributes that drive render through a factory-declared reactive
property (`WebComponent({ ... })`) is still the idiomatic path, but
`this.hasAttribute(...)` no longer crashes.

Two guards catch the browser-only cases. `webjs check` flags browser
globals and the still-unsupported HTMLElement members used in a constructor
or render body (the `no-browser-globals-in-render` rule). And if one slips
through, the SSR crash is actionable: the log names the offending member and
tells you to move it to `connectedCallback` or a lifecycle hook, instead of
a raw `document is not defined`.

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

In Lit, class-field initializers (like `student: Student = { name: '', email: '' }`) are commonly used. In WebJs, the base class installs reactive accessors on `this` inside the constructor via `Object.defineProperty` (to support SSR property hydration and signals). Under modern V8 class-field semantics, a class-field initializer compiles to an assignment after `super()`, which uses `[[Define]]` and overwrites the accessor, silently breaking reactivity. The footgun is still live with factory-declared props, so it stays a gotcha.

The fix is to declare the prop in the base-class factory `WebComponent({ ... })` (which types it automatically, no `declare` line) and set its default in the constructor after `super()`, never as a class-field initializer:

```ts
// set the default in the constructor (fully typed, no declare needed)
class StudentCard extends WebComponent({
  student: prop<Student>(Object),
}) {
  constructor() {
    super();
    this.student = { name: '', email: '' };
  }
}
```

`webjs check` flags a class-field initializer on a factory-declared prop via the `reactive-props-no-class-field` rule.

### 6. The `@property()` decorator and a direct `static properties` block

The `@property()` decorator is banned by framework invariant 10 (erasable TS): decorators are non-erasable, so they would force the framework to depend on a build step. A direct `static properties = { ... }` block is also gone, and WebJs THROWS at runtime if a class body declares one (flagged by the `no-static-properties` rule). The single replacement for both is the declare-free base-class factory `WebComponent({ ... })` (the `prop()` helper carries options), as shown above.

## Patterns that produce different visual output

### 7. Expecting shadow DOM by default (and reaching for scoped CSS instead of Tailwind)

Lit components default to shadow DOM. `static styles = css` scoping
works automatically. Webjs defaults to light DOM. A `static styles`
block without `static shadow = true` does nothing useful (the framework
warns at runtime), and styles authored for the component bleed into
the global namespace.

This is also the **styling reflex** to unlearn, not just a config
default. Because lit scopes, the lit habit is to author scoped CSS
(`static styles = css\`\``) or an inline `<style>` with semantic class
names (`.hero`, `.feature`, `.card`) for every component. In a WebJs
light-DOM component that CSS either does nothing (the scoped block) or
leaks globally (the inline `<style>` with bare class names). **The
webjs-shaped fix is Tailwind utilities, which apply directly in light
DOM and are webjs's strong styling default.** Reach for raw CSS only for
the short allowlist (design tokens, `@property` + `@keyframes`,
`::-webkit-scrollbar`, `prefers-reduced-motion`, complex `color-mix()` /
gradients); see `agent-docs/styling.md` for the full Tailwind-first rule
and that allowlist.

Three correct paths. Use Tailwind utilities in light DOM (the default,
and the answer for the vast majority of components). Or add
`static shadow = true` to the class and keep `static styles` (scoped CSS
genuinely belongs in a shadow root). Or, if authoring vanilla CSS in
light-DOM mode anyway, prefix every selector with the component tag, per
the styling invariant. When a utility bundle repeats across light-DOM
components, extract it into a `lib/utils/ui.ts` helper returning an
`` html`...` `` fragment, never a shared CSS class.

### 7b. Reaching for `:host { display: block }` on a light-DOM component

A custom element is `display: inline` by default, so a component used as
a block container (a board, a card, a panel) collapses to its content
size. In lit the reflex is to fix this with `:host { display: block }` in
`static styles`. That works in lit because lit is **shadow-DOM-first**, so
every component has a shadow root and `:host` always exists. A WebJs
component is **light-DOM by default**, and a light-DOM component has NO
shadow root, so **there is no `:host` to write** (a `static styles`
`:host` block without `static shadow = true` does nothing, per #7).

**The webjs-shaped fix is: nothing to do.** The framework already defaults
every LIGHT-DOM host to `display: block`, by stamping the host with a
`data-wj-host` attribute and injecting one low-priority head rule
(`@layer webjs-host { :where([data-wj-host]) { display: block } }`). It is
overridable by any author style, INCLUDING a Tailwind utility (`class="flex"`,
`grid`, `hidden` win, because their layer is ordered after `webjs-host`), and
`[hidden]` still hides. So do not reach for `:host` on a light component; just
use Tailwind on the host or let the block default stand.

For a **shadow-DOM** WebJs component (`static shadow = true`), it works
exactly like lit: the framework does NOT mark shadow hosts (a document rule
would override the shadow tree's `:host`), so you set `:host { display: block }`
in `static styles` yourself and it is fully respected. One reflex to keep for
a shadow block container: set that `:host` display (an unstyled shadow host
stays `display: inline`). See `agent-docs/components.md` and
`agent-docs/styling.md`.

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

## Lifecycle subtleties at SSR

### 9. `willUpdate` computing state for SSR (this now works)

This used to be a gotcha. The SSR pipeline now runs `willUpdate` (and
controllers' `hostUpdate`) before `render()`, so deriving render state
there is correct in the first paint:

```ts
willUpdate(changedProperties) {
  this.fullName = `${this.first} ${this.last}`;
}
render() {
  return html`<p>${this.fullName}</p>`;
}
```

The SSR HTML now shows `<p>Ada Lovelace</p>`. The value must still be a
pure function of constructor state plus applied attributes (no
browser-only APIs), since SSR has no DOM. What still does NOT run
server-side is the post-render and connection hooks (`update` commit,
`firstUpdated`, `updated`, `connectedCallback`, controllers'
`hostConnected` / `hostUpdated`), so state those compute is absent from
the first paint.

One tradeoff to know: overriding `willUpdate` is an interactivity
signal for the elision analyser, so a component that uses it (even
purely to derive SSR state) ships its JS to the browser and is never
elided. For a truly display-only component, prefer computing the value
inline in `render()` so the module can still be elided; reach for
`willUpdate` when the component is interactive anyway, or when the
derivation is shared across `render()` and a client hook.

### 10. `ContextProvider` for server-known data

Context providers in lit publish on connect via `hostConnected`. In
WebJs SSR, `connectedCallback` does not run, so descendants that read
context during SSR see the default value (or undefined). On hydration
the provider connects and consumers re-render, causing a content
shift.

Rule of thumb. For data known on the server (session, user, theme,
locale, feature flags, A/B variants), pass it through props from the
page function rather than through context. Reserve `ContextProvider`
for client-time concerns (interaction state, focus management,
transient UI state).

## List rendering

### 11. Reordering a `.map()` list needs a keyed `repeat()`

A plain `.map()` list reconciles in place, matching lit-html's non-keyed
child-part behaviour. When one item's binding changes (a card flips its
`dragging` class on `@dragstart`, a row's input is edited), the framework
patches that item's existing nodes instead of rebuilding the whole list,
so DOM node identity survives. That is what makes native drag-and-drop,
focus, caret, text selection, scroll position, and uncontrolled input
value all survive an item-level update, no `repeat()` required. (This
used to be a real gotcha. Before the fix, any change to a `.map()`'s
output tore down and replaced every node, which silently aborted a
drag-in-progress and lost focus and input state.)

```ts
// Item updates preserve node identity. Drag-and-drop, focus, and
// input state all survive. No repeat() needed.
render() {
  return html`<ul>${this.cards.map((c) => html`
    <li class=${c.id === this.draggingId ? 'dragging' : 'idle'}
        draggable="true"
        @dragstart=${() => (this.draggingId = c.id)}>${c.text}</li>`)}</ul>`;
}
```

What plain `.map()` still does NOT do is **keyed reordering**.
Reconciliation is positional (by index): if the array is reordered or an
item is inserted/removed in the MIDDLE, index *i* is patched from the new
item at *i*, so the nodes stay put and their contents are rewritten
rather than the nodes themselves moving. For an item carrying live state
(a focused input, a playing media element, an in-flight CSS transition)
across a reorder, that state stays with the old position. When a list
**reorders** or splices in the middle and node identity must follow the
item, reach for the keyed directive, exactly as in lit:

```ts
import { repeat } from '@webjsdev/core/directives';
render() {
  return html`<ul>${repeat(this.cards, (c) => c.id, (c) => html`
    <li>${c.text}</li>`)}</ul>`;
}
```

Rule of thumb. Append-only or update-in-place list, where items keep
their position, plain `.map()` is fine and preserves identity. List that
**reorders or splices in the middle** and each item owns DOM state that
must move with it, use `repeat()` with a stable key.

## More silent traps

### 12. Interpolating into a `<style>` or `<script>` inside a component

In lit you can write a binding inside a `<style>` and it works. In a WebJs
**component** it does not, and it fails in the worst way (silently, only after
hydration). The server renderer emits the interpolated content, so the first
paint looks right; the client renderer drops a raw-text hole (the compile cache
is keyed on the static strings, so a per-render value cannot be baked in), so on
hydration the element is rebuilt EMPTY and the styles vanish.

```ts
// BROKEN in a component: paints at SSR, wipes to empty on hydrate.
const STYLE = `my-widget { color: red; }`;
render() { return html`<style>${STYLE}</style><div>hi</div>`; }
```

Do this instead. For a shadow-DOM component use `static styles`; for a light-DOM
component use Tailwind utilities (the strong default) or a `css` template applied
via `static styles`. A fully STATIC `<style>...</style>` with no `${}` is fine.

```ts
class MyWidget extends WebComponent({}) {
  static styles = css`:host { color: red; }`;   // scoped, survives hydration
  render() { return html`<div>hi</div>`; }
}
```

Note the one exception. **Pages and layouts never hydrate** (they render
server-only), so a page's `<style>${STYLES.text}</style>` is a legitimate,
documented pattern. The trap is specific to components, which is exactly where
the `no-interpolation-in-raw-text-element` check scopes its flag.

### 13. A GET server action's first client call returns the SSR seed, not a fresh read

WebJs seeds each GET-action result rendered during SSR into the page, and the
generated RPC stub reads that seed on its FIRST client call instead of hitting
the network (#472). This kills the redundant on-hydration refetch. The muscle
memory that bites: reaching for a re-call of the same query to REFRESH after a
mutation. That first client call resolves from the SSR snapshot (the pre-mutation
value), so the UI looks stale.

```ts
// Looks stale: this is the first client call of getScore(), so it
// resolves from the SSR seed (the value from before the mutation).
await likePost(id);
this.score = await getScore(id);   // returns the seeded, pre-like value
```

Refresh a value the client just mutated with an **optimistic update** (the
recommended default, deterministic and instant) or `revalidate()`, not a re-call:

```ts
import { optimistic, revalidate } from '@webjsdev/core';
// deterministic optimistic bump (preferred)
this.score = this.score + 1;
await likePost(id);
// or force the browser snapshot to refetch from the network
revalidate();
```

## Quick reference

| Lit pattern | Webjs equivalent |
|---|---|
| Fetch in `connectedCallback` or `firstUpdated` | Fetch in the page function, pass as props |
| `Task` for initial-paint data | Page function fetch and pass as props |
| `Task` for client-time async | `Task` (no change, that's its job) |
| `window.X` or `document.X` in constructor or `render()` | Move to `connectedCallback` |
| Top-level `import` of browser-only library | Dynamic `import()` inside `connectedCallback` |
| `student: Student = { ... }` field initializer | Base-class factory `WebComponent({ student: Object })`, default in the constructor after `super()` |
| `@property()` decorator / `static properties` block | Base-class factory `WebComponent({ ... })` (the `prop()` helper carries options) |
| `static styles = css` / inline `<style>` with semantic class names in a light-DOM component | Tailwind utilities (the default); or `static shadow = true` for genuinely scoped CSS |
| Plain `.map()` for an interactive/stateful list | Works (reconciles in place, keeps node identity); use `repeat(items, key, t)` only when the list **reorders** |
| `willUpdate` for SSR-visible derived state | Works (runs at SSR); keep it a pure derivation |
| `this.hasAttribute` / `getAttribute` in `render()` | Works (server attribute shim) |
| `ContextProvider` for server-known data | Pass via props from the page function |

## When in doubt

If a pattern needs to influence the first paint, it has to be in the
constructor, the page function, or `render()`. If a pattern needs the
DOM, the event loop, or a browser API, it has to be in
`connectedCallback` or later. There is no third category. Anything
that violates this split either crashes SSR or produces a hydration
flash.
