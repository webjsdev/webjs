# Components

## What This Covers

- Declaring reactive properties through the `WebComponent({ ... })` factory and `prop()`, with options (`reflect`, `state`, `attribute`, `default`, `converter`, `hasChanged`)
- Signals as the default state primitive for component-local and shared state
- The Lit-aligned lifecycle and exactly which hooks SSR runs versus skips
- Light DOM (default) versus shadow DOM, and the light-host `display: block` rule
- Slots with full shadow-DOM parity in both DOM modes
- `async render()`: SSR-blocking first paint, client stale-while-revalidate, `renderFallback()` / `renderError()`
- Display-only elision (when a component is stripped from the browser)
- Inherited members app code must NOT shadow (`title`, `remove`, `render`, ...)

Read this when you are authoring or reviewing a `WebComponent`. For styling a component (Tailwind, the tag-prefix rule, host sizing) see `styling.md`. For streaming a slow region or programmatic navigation see `client-router-and-streaming.md`. For Lit habits that break WebJs see `muscle-memory-gotchas.md`.

## Reactive properties: the base-class factory

Reactive properties are declared by passing their shape into `WebComponent({ ... })`. The types flow automatically to `this.<prop>`, so there is NO `static properties` block and NO `declare` line (a `static properties` block throws at runtime, caught by `no-static-properties`).

```ts
import { WebComponent, prop, html } from '@webjsdev/core';

class Dialog extends WebComponent({
  open: prop(Boolean, { reflect: true }),                       // reflects to the `open` attribute
  showClose: prop(Boolean, { attribute: 'show-close-button' }), // custom attribute name
  variant: prop<'info' | 'danger'>(String, { reflect: true }),  // narrowed union type
  student: prop<Student>(Object),                               // narrowed object type
  items: prop<Tag[]>(Array),                                    // array-typed prop uses Array, not Object
  internal: prop({ state: true }),                             // internal state, no attribute, no type
}) {
  constructor() {
    super();
    this.open = false;             // set defaults in the constructor, after super()
    this.student = { name: '', email: '' };
    this.items = [];
  }
  render() {
    return html`<button ?disabled=${!this.open}>${this.variant}</button>`;
  }
}
Dialog.register('ui-dialog');
```

The bare form is shorthand: `count: Number` means `prop(Number)`. Use `prop()` to pass options or narrow the TS type.

| Option | Default | Meaning |
|---|---|---|
| `type` | `String` | Constructor feeding the default attribute converter |
| `reflect` | `false` | Property changes write back to the HTML attribute |
| `state` | `false` | Internal-only. No attribute, not observed |
| `attribute` | derived from name | The HTML attribute name the property rides |
| `default` | none | Declarative initial value (a function runs per instance for a fresh object / array) |
| `hasChanged` | strict `!==` | Custom change detection |
| `converter` | type-based | Custom attribute-to-property serialization |

For an array-typed prop pass `Array`, not `Object` (`array-prop-uses-array-type` flags the `Object` form). For anything the built-in converters cannot parse (Date, Map, Set) supply a `converter`.

**Never use a class-field declaration OR initializer** (`count = 0`, `student: Student = {...}`, `todos!: Todo[]`). Under `useDefineForClassFields` even a type-only `todos!: Todo[]` compiles to define an own property after `super()`, which clobbers the prototype's reactive accessor and silently breaks reactivity. Only declare props in the factory and read/write them off `this`. The `reactive-props-no-class-field` rule catches this.

## Signals are the default state primitive

Reserve the factory for values that ride an HTML attribute, reflect to one, or arrive via `.prop=${value}` SSR hydration. For everything else use signals.

```ts
import { signal, computed } from '@webjsdev/core';

const cart = signal<Item[]>([]);                 // module-scope: shared across components, survives navigations
const count = computed(() => cart.get().length); // derived
```

Read with `signal.get()` inside `render()`; the built-in `SignalWatcher` tracks the read and re-renders on change. An instance signal created in the constructor is component-local. For a fine-grained DOM swap use `${watch(signal)}` from `@webjsdev/core/directives`.

## Lifecycle (Lit-aligned) and what SSR runs

Each update cycle runs these in order; each receives a `changedProperties` Map.

| # | Hook | When |
|---|---|---|
| 1 | `shouldUpdate(changed)` | Return `false` to skip. Default `true`. |
| 2 | `willUpdate(changed)` | Pre-render. Assignments here fold into THIS cycle. |
| 3 | `update(changed)` | Default calls `render()` + commits. Override rarely. |
| 4 | `firstUpdated(changed)` | Once, on the first render only. |
| 5 | `updated(changed)` | Every commit. Ad-hoc post-render DOM work. |
| 6 | `updateComplete` resolves | `await el.updateComplete` to read post-render DOM in tests. |

**SSR runs only the value-deriving path**: the constructor, attribute application, `willUpdate` (and controllers' `hostUpdate`), `reflect: true` reflection, then `render()`. It does NOT invoke `connectedCallback`, `disconnectedCallback`, `firstUpdated`, `updated`, `update`'s DOM commit, `hostUpdated`, or `shouldUpdate`. So set first-paint defaults in the constructor, derive SSR-visible state in `willUpdate`, and keep browser-only work (DOM queries, layout, `localStorage`, viewport) in `connectedCallback` / `firstUpdated`. A browser global in the constructor or `render()` throws at SSR (flagged by `no-browser-globals-in-render`; attribute methods and `closest()` are shimmed).

## Light DOM (default) vs shadow DOM

Light DOM is the default: global CSS and Tailwind utilities apply directly, no `:host` or CSS-var plumbing. Set `static shadow = true` only for `static styles = css\`...\`` scoped styles, third-party embed isolation, or the native `::slotted()` selector.

```ts
class Panel extends WebComponent({ label: String }) {
  static shadow = true;
  static styles = css`:host { display: block } .body { padding: 16px }`;
  render() { return html`<div class="body">${this.label}</div>`; }
}
```

- A light-DOM component authoring custom CSS MUST prefix every class selector with its tag name (`.my-card__body` or `my-card .body`). Prefer Tailwind, unique by construction. `static styles` on a light-DOM component is silently ignored.
- **Never interpolate into a component's `<style>` or `<script>` body** (`html\`<style>${x}</style>\``). The server emits it but the client drops the raw-text hole, so it paints then wipes to empty on hydrate (flagged by `no-interpolation-in-raw-text-element`). Use `static styles` or Tailwind.
- Light-DOM hosts are marked `display: block` via one low-priority `@layer webjs-host` rule (overridable by any Tailwind utility). Shadow hosts are NOT marked; set `:host { display: block }` in `static styles`. Size the HOST (put `w-full max-w-[...]` on the render root), not only an inner wrapper. See `styling.md`.

## Slots

The full `<slot>` surface works in light DOM with shadow-DOM parity; migrating modes never requires a template rewrite.

```ts
class MyCard extends WebComponent {
  render() {
    return html`
      <header><slot name="header"></slot></header>
      <main><slot></slot></main>
      <footer><slot name="footer">no actions</slot></footer>`;
  }
}
```

Named slots, the default slot (unnamed children, text, comments), fallback content (a slot's inner markup when nothing matches), first-wins resolution, and dynamic `name=${...}` all behave per spec. The DOM API mirrors shadow slots: `assignedNodes` / `assignedElements` (with `{ flatten: true }`), `element.assignedSlot`, and the `slotchange` event. Both modes are SSR'd (light DOM projects into `<slot data-webjs-light data-projection="actual">`, shadow DOM via Declarative Shadow DOM), so slotted content renders with no JS.

A compound child reads its parent at the first server paint via `closest('ui-tabs')` (only tag-name selectors resolve at SSR, and the compound parent must be light DOM). Genuine live-DOM reads (`querySelector`, `classList`, geometry) still throw at SSR, so keep them in `connectedCallback` / `firstUpdated`.

## Async render: first-paint server data

`render()` may be `async`, so a leaf component fetches its own server data into the first paint with no prop-drilling.

```ts
class UserActivity extends WebComponent({ uid: String }) {
  renderFallback() { return html`<div class="skeleton h-24"></div>`; } // optional, re-fetch only
  async render() {
    const items = await getActivity(this.uid); // 'use server' action: real fn at SSR, RPC stub on client
    return html`<ul>${items.map((i) => html`<li>${i.label}</li>`)}</ul>`;
  }
}
```

Three decoupled concerns, do not conflate them.

1. **SSR always blocks by default.** The server awaits `async render()`, so the resolved data is baked into the first paint. There is no first-paint fallback, ever (a progressive-enhancement upgrade over a client-fetched `Task`).
2. **The client re-fetch default is stale-while-revalidate.** When a prop or dependency change re-runs `async render()`, the previous content stays until the new render resolves. No blank, no flash, no user code.
3. **`renderFallback()` is the OPTIONAL re-fetch loading UI.** Shown ONLY during a client re-fetch, NEVER on first paint, and it does NOT create a server-streaming boundary.

Errors are isolated per component by default (no user code): a thrown `await` renders a component-scoped error state while siblings render, never bubbling to the route `error.ts`. Override `renderError(error)` only to customize it (dev shows the message, prod stays silent).

Decision rules. Use `async render()` for request-time server data that should be in the first paint (the default). Add `renderFallback()` when a client re-fetch's stale content would mislead. Use `Task` / signals for genuinely client-only data (a click, viewport, live updates). For SLOW data where blocking the first byte hurts, wrap the region in `<webjs-suspense .fallback=${html\`Loading...\`}>` to stream it (the only way to show a first-paint fallback; see `client-router-and-streaming.md`). Do NOT fetch in `connectedCallback` for data knowable server-side, and do NOT prop-drill what a leaf can fetch itself.

## Display-only elision

A component that does no client-side work renders the same SSR'd HTML with or without its JS, so WebJs strips its import from the served source (and any vendor reachable only through it). This is automatic and conservative. A component stays elidable while it has NONE of:

- an `@event` binding or native handler property (`.onclick`)
- a factory-declared reactive property that is not `{ state: true }`
- an overridden lifecycle hook (including `renderFallback` / `renderError`)
- an imported `signal` / `computed` / `watch` / `Task` / `ref` / streaming directive, or `addController` / `requestUpdate`
- code that runs at module load (a top-level call, non-data `new`, dynamic `import(...)`, top-level `await`); only declarations and `X.register(...)` are allowed
- a rendered `<slot>`, or being rendered by a component that itself ships

A bare `async render()` (no other signal, light DOM) is elided too: the SSR'd data is the complete first paint. Force shipping with `static interactive = true` when interactivity is invisible to static analysis (a dynamically-built tag string, a `:defined` rule in an external stylesheet). `static shadow = true` always ships (Declarative Shadow DOM re-attaches only during parsing). Turn elision off app-wide with `{ "webjs": { "elide": false } }` or `WEBJS_ELIDE=0`.

## Members app code must not shadow

A `WebComponent` inherits `HTMLElement` (browser) or an `ElementShim` (SSR) plus the framework reactivity base. A reactive prop or method whose NAME collides either fails to compile (`TS2415` for a type-incompatible property, `TS2416` for a method signature) or silently hijacks the native member at runtime. The fix is always to rename.

- HTMLElement / Element: `title`, `id`, `slot`, `role`, `hidden`, `dir`, `lang`, `translate`, `draggable`, `tabIndex`, `className`, `dataset`, `remove`, `closest`, `matches`, `focus`, `blur`, `click`, `append` / `prepend`, `before` / `after`. Rename (`postTitle`, `removeItem`, `handleClick`).
- WebComponent base: `render`, `update`, `requestUpdate`, `updated` / `firstUpdated`, `willUpdate` / `shouldUpdate`, `connectedCallback`, `renderError` / `renderFallback`, `addController` / `removeController`, `updateComplete`. Only override one deliberately, with its exact signature; never repurpose the name for app logic.

Framework-private fields are underscore-prefixed (`_renderRoot`, `_connected`, `_changedProperties`, `_updatePromise`, `_isUpdating`); never declare a prop or field that matches one. Safe, non-inherited names: `label`, `open`, `count`, `value`, `name`, `items`, `todos`, `active`, `variant`, `size`, `checked`, `selected`, `heading`, `message`, `status`. When in doubt, grep the base surface in `node_modules/@webjsdev/core/src/component.js`.
