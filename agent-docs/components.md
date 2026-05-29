# WebComponent deep-dive

## Property options in full detail

| Option | Type | Default | Meaning |
|---|---|---|---|
| `type` | `Number\|String\|Boolean\|Object\|Array` | `String` | Used by the default attribute converter |
| `reflect` | `boolean` | `false` | Property changes write back to the HTML attribute |
| `state` | `boolean` | `false` | Internal-only. No attribute, not in `observedAttributes` |
| `hasChanged` | `(newVal, oldVal) => boolean` | strict `!==` | Custom change detection |
| `converter` | `{ fromAttribute?, toAttribute? }` | type-based | Custom attribute ↔ property serialization |

Built-in constructors (`String`, `Number`, `Boolean`, `Array`, `Object`) feed
the default attribute coercion. For anything the default can't parse correctly
(Date, Map, Set, discriminated unions) supply a custom `converter`.

## Why `declare` is required in TypeScript

The framework installs reactive getter/setter on `this` inside the
constructor via `Object.defineProperty`. Without `declare`, TypeScript
emits `student = undefined` after `super()`, which under modern class-
field semantics uses `[[Define]]` to overwrite the accessor. Result:
`this.student = …` no longer goes through the setter, no `requestUpdate`,
no `hasChanged`, no reflect, and reactivity silently breaks.

The `.d.ts` overlay shipped with the framework makes every other class
member fully typed, so only the reactive properties need the `declare`
line, and only in TypeScript files.

## Lifecycle hooks (lit-aligned)

`WebComponent` ships lit's full reactive lifecycle. Every update cycle runs these hooks in order; each receives a `changedProperties` Map (`Map<string, oldValue>`, where keys are reactive-property names).

| # | Hook | When |
|---|---|---|
| 1 | `shouldUpdate(changedProperties)` | Return `false` to skip the update. Default `true`. |
| 2 | `willUpdate(changedProperties)` | Pre-render. Property assignments here fold into THIS cycle. |
| 3 | controllers' `hostUpdate()` | Pre-render controller hook |
| 4 | `update(changedProperties)` | Default calls `render()` + commits. Override to wrap or short-circuit (rare). |
| 5 | controllers' `hostUpdated()` | Post-render controller hook |
| 6 | `firstUpdated(changedProperties)` | Once, on the first render only |
| 7 | `updated(changedProperties)` | Every render commit. Right place for ad-hoc post-render DOM work. |
| 8 | `updateComplete` Promise resolves | `await el.updateComplete` to read post-render DOM in tests |

Assignments during `willUpdate` fold into the current cycle (no new render scheduled); assignments during `updated` or `firstUpdated` queue a fresh cycle. The framework gates this via an internal flag, so authors don't manage it.

All hooks are **client-only**. The SSR pipeline calls `instance.render()` directly and does not invoke `shouldUpdate` / `willUpdate` / `update` / `updated` / `firstUpdated` / `connectedCallback` / `disconnectedCallback`. Set SSR-meaningful defaults in the constructor; use lifecycle hooks for browser-only work.

For component-local state, create an instance signal in the constructor and call `signal.set(...)` to mutate. The built-in `SignalWatcher` re-runs `render()` on the next microtask; the same lifecycle hooks fire as for reactive-property changes.

See [`/docs/lifecycle`](https://docs.webjs.com/docs/lifecycle) for per-hook usage examples.

## Display-only components are elided from the browser

A component that does no client-side work renders the same SSR'd HTML
whether or not its JavaScript ever reaches the browser. webjs detects
these statically and strips their import from the served source, so the
browser never downloads them (and their unique vendor dependencies drop
from the importmap). This is automatic, with no opt-in keyword and no
server/client split to reason about. A component stays elidable as long
as it has none of the following.

- An `@event` binding in a template (`@click=${...}`), or a native event-handler property (`.onclick=${...}`).
- A reactive property in `static properties` that is not `{ state: true }`. Attribute-driven or `.prop`-driven values are the channel a parent uses to push client updates.
- An overridden lifecycle hook (anything in the table above), as a method or an arrow class field.
- A `signal` / `computed` / `watch` / `Task` / `ref` / `live` / streaming directive imported from `@webjsdev/core`, OR a transitive import of a module that reads shared module-scope signal state.
- An `addController(...)` or `requestUpdate()` call.
- A module-scope browser global. Beyond `window` / `document` / `navigator` / storage / `matchMedia` / `addEventListener`, this covers network and scheduling and observer globals (`fetch`, `WebSocket`, `EventSource`, `location`, `history`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `requestIdleCallback`, `queueMicrotask`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `indexedDB`, `caches`, `BroadcastChannel`, `Worker`, `Notification`). A same-named object member (`this.fetch`, `route.location`) does not count, and these words in rendered template text do not count.
- A dynamic `import(...)`. It loads code on the client at runtime, which the static module graph does not follow, so a module containing one ships (and its route is not inert) or the loaded code would be silently lost.
- A rendered `<slot>`. Light-DOM slots rely on the client projection runtime, and proving a slot is purely native (shadow DOM) is beyond static analysis, so any `<slot>` ships.
- Being rendered or imported by a component that itself ships (an interactive parent can re-create the child on the client).

The analysis is deliberately conservative: anything it cannot prove
inert ships normally, so correctness never depends on it. The elidable
case in practice is a component with no inputs and no behavior: static
markup, or values seeded in the constructor. Note a slotted wrapper does
NOT qualify (the `<slot>` itself forces shipping per the list above).

**The one boundary the static model cannot see.** Elision proves a
component's own `render()` is inert; it does NOT prove that no *other*
client code observes the element's registration. An elided module never
loads, so its `customElements.define` never runs in the browser and the
tag stays an un-upgraded `HTMLElement`. That is invisible for a tag that
exists only as SSR'd markup, but it changes behavior if shipping client
code depends on the definition:

- `customElements.whenDefined('the-tag')` never resolves.
- reading an upgraded property or method off `document.querySelector('the-tag')` is `undefined` / throws.
- `el instanceof TheClass` is `false`.
- a CSS `the-tag:defined { … }` rule never matches.

If a component is observed any of these ways, it is interactive in
practice; add an interactivity signal (an `@event`, a non-`state`
reactive property, or a lifecycle hook) so it ships. In idiomatic webjs
this is rare: a display-only element is server-rendered to its final
HTML and read as plain markup, and `:defined` FOUC-hiding works against
progressive enhancement (it would hide content that already painted).
But if you reach for those patterns, treat the component as interactive.

The detection lists live in `packages/server/src/component-elision.js`
and are the single source of truth. They are kept in lockstep with the
lifecycle table above by `packages/server/test/elision/lifecycle-coverage.test.js`,
which fails if a new `WebComponent` hook is added without teaching the
analyser about it. If you add an interactivity feature to the framework,
update that file.

### Turning elision off

Elision is on by default. To disable it app-wide, set `elide` to `false`
under the `webjs` key in `package.json`:

```jsonc
{ "webjs": { "elide": false } }
```

With the switch off, every component and route module ships exactly as it
did before the feature existed (no import stripping, no dropped preloads,
the importmap keeps every vendor dep). The switch is pure opt-out, so any
value other than the literal `false`, or an absent key, leaves elision on.
Reach for it if the conservative analyser ever mis-elides a component, or
to A/B the wire-byte difference. Because the analyser biases toward
shipping, needing this should be rare.

## ReactiveControllers: composable lifecycle

```js
class FetchController {
  constructor(host, url) {
    this.host = host;
    this.url = url;
    this.data = null;
    host.addController(this);     // ← register
  }
  async hostConnected() {
    this.data = await (await fetch(this.url)).json();
    this.host.requestUpdate();
  }
  hostDisconnected() { /* cleanup */ }
}

class MyEl extends WebComponent {
  #users = new FetchController(this, '/api/users');
  render() { return html`${this.#users.data?.length} users`; }
}
```

Use controllers when the same lifecycle logic (fetch, timer, subscription,
resize observer) is needed in multiple unrelated components. The built-in
`Task`, `ContextProvider`, and `ContextConsumer` are all controllers.

## Light DOM (default) vs Shadow DOM (opt-in), full detail

Light DOM is the default because global CSS and Tailwind utility classes
apply directly, with no `::part`, no `:host`, no CSS-var plumbing, no
`adoptedStyleSheets` needed. The browser renders a plain element with
normal children, and hydration replaces SSR content in place.

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Just use `class="..."` in your `html\`...\`` template |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` + bare selectors are scoped |
| `<slot>` content projection | **Both** | Same `<slot>` / `<slot name="x">` syntax. Light DOM uses framework projection; shadow DOM uses native browser projection. Full spec parity in both modes (see "Slots" section below). |
| Third-party embeds needing isolation | Shadow DOM | CSS can't leak in or out |

Both modes are fully SSR'd (shadow DOM via Declarative Shadow DOM, light
DOM as direct HTML with a `<!--webjs-hydrate-->` marker) and hydrate
without flash on the client.

### Class-prefix rule for light-DOM components

If a light-DOM component authors its own custom CSS (a `<style>` block
inside `render()`, or an imported stylesheet), every class selector MUST
be prefixed with the component's tag name. Pick one of these two
patterns per component:

```ts
// Pattern A: BEM-ish class names prefixed with tag
class MyCard extends WebComponent {
  render() {
    return html`
      <style>
        .my-card__body { padding: 16px; }
        .my-card__title { font-weight: 600; }
      </style>
      <div class="my-card__body">
        <h3 class="my-card__title"><slot name="title"></slot></h3>
      </div>
    `;
  }
}

// Pattern B: descendant selector rooted at the tag
class MyCard extends WebComponent {
  render() {
    return html`
      <style>
        my-card .body  { padding: 16px; }
        my-card .title { font-weight: 600; }
      </style>
      <div class="body">
        <h3 class="title"><slot name="title"></slot></h3>
      </div>
    `;
  }
}
```

Prefer Tailwind utility classes first. They're unique by construction.
Drop down to custom CSS only when Tailwind can't express it.

### When to opt in to shadow DOM

Set `static shadow = true` when:
- You author styles via `static styles = css\`...\`` and want them
  `adoptedStyleSheets`-scoped without a prefix discipline.
- You're publishing a component for third parties who won't have your
  Tailwind build, and you need the embed to look right in any host.
- You want the browser's built-in `::slotted()` CSS selector for
  styling projected children from inside the shadow tree.

Slots themselves are no longer a reason to opt into shadow DOM. The
same `<slot>` / `<slot name="x">` syntax works in light DOM with full
shadow-DOM spec parity (`assignedNodes`, `assignedElements`,
`assignedSlot`, `slotchange`, named slots, fallback content, first-wins
resolution). See the "Slots" section below.

`static styles` on a light-DOM component is silently ignored.

## Slots: full shadow-DOM parity in both DOM modes

webjs supports the entire shadow-DOM `<slot>` surface in light DOM. The
same `render()` template projects children identically whether your
component declares `static shadow = true` or leaves it at the default
`false`. Migrating between modes never requires a template rewrite.

### Syntax

```ts
class MyCard extends WebComponent {
  // static shadow defaults to false. Either value works for everything
  // below.
  render() {
    return html`
      <header><slot name="header"></slot></header>
      <main><slot></slot></main>
      <footer><slot name="footer">no actions</slot></footer>
    `;
  }
}
MyCard.register('my-card');
```

Author markup:

```html
<my-card>
  <h2 slot="header">Title</h2>
  <p>Body content</p>
  <p>More body content</p>
  <button slot="footer">Save</button>
</my-card>
```

The `<h2>` projects into the `header` slot, both `<p>` elements into the
default slot in source order, and the `<button>` into the `footer` slot.

### Default slot

A `<slot>` without a `name` attribute receives all authored children
without a `slot=""` attribute. Text nodes, comments, and whitespace also
route to the default slot.

```ts
class Wrapper extends WebComponent {
  render() { return html`<div><slot></slot></div>`; }
}
```

```html
<wrapper>
  Plain text
  <p>An element</p>
  <!-- a comment -->
</wrapper>
```

### Named slot

`<slot name="x">` receives authored children with `slot="x"`. A child
with `slot=""` (empty string) routes to the default slot, matching the
shadow-DOM spec.

### Fallback content

A slot's authored inner content is its fallback. If no children match
the slot, the fallback renders.

```ts
render() { return html`<slot name="actions">no actions</slot>`; }
```

When no `slot="actions"` child is provided, the slot shows "no actions".
When projection happens, the fallback is replaced by the projected
content.

### First-wins resolution

Multiple slots with the same `name` (or multiple default slots) are
permitted. Per shadow-DOM spec, the first one in document order receives
the assignment; subsequent same-named slots show their fallback content.

```ts
render() {
  return html`
    <slot name="title">Untitled</slot>
    <slot name="title">never shown</slot>
  `;
}
```

### Dynamic slot name and child slot attribute

A slot's `name` attribute can be a template hole. Re-projection happens
automatically when the value changes. Likewise, a child's `slot=""`
attribute can change at runtime; the child re-routes to the new slot.

```ts
render() {
  return html`<slot name=${this.section}></slot>`;
}
```

### DOM API

Every shadow-DOM slot API is mirrored on light-DOM slots:

| API | Returns |
|---|---|
| `slot.assignedNodes(options?)` | Projected nodes in source order; empty array when slot shows fallback |
| `slot.assignedNodes({ flatten: true })` | Recursively unwraps nested forwarding slots to the leaf nodes |
| `slot.assignedElements(options?)` | Element-only filter of `assignedNodes` |
| `element.assignedSlot` | Returns the slot a child is projected into, or `null` |
| `slotchange` event | Fires on a slot when its assigned-node set actually changes (with equality detection to avoid no-op fires) |

The polyfills are gated on a `data-webjs-light` attribute that the
framework places on its slots, so the polyfill never interferes with
real shadow-DOM slots elsewhere on the page.

### SSR + hydration

Both modes are SSR'd:

- **Light DOM.** The server emits projected children directly inside
  `<slot data-webjs-light data-projection="actual">` elements. Without
  JavaScript, the page renders correctly because the projection is
  baked into the HTML. On hydration the framework adopts the SSR-placed
  Node references; DOM identity (event listeners, focus, scroll, input
  values) survives the round-trip.
- **Shadow DOM.** The server emits Declarative Shadow DOM
  (`<template shadowrootmode="open">…<slot>…</slot>…</template>`). The
  browser opens the shadow root on parse and projects natively, again
  without JavaScript.

### Slot inside conditionals and lists

A slot can live inside any `html\`\`` template fragment: conditional
ternaries, `${repeat()}` iterations, async `Task` results. When a slot
disappears (e.g., its containing template collapses), the projected
children move to a per-host pending map and re-attach with DOM identity
preserved when the slot reappears.

```ts
render() {
  return html`
    <div>
      ${this.expanded
        ? html`<section><slot></slot></section>`
        : html`<i>collapsed</i>`}
    </div>
  `;
}
```

Toggling `this.expanded` between true and false preserves the projected
child Node references.

### Composition with Suspense

A slot composes naturally with `Suspense`. Authored children that
include `${Suspense({ fallback, children })}` project the fallback HTML
into the slot at SSR time; when the children promise resolves and
streams in, the `data-webjs-resolve` swap targets the
`<webjs-boundary>` element which lives inside the slot, updating the
slot's content in place.

## Helper methods

| Method | Purpose |
|---|---|
| `signal.set(v)` (instance signal) | Component-local reactive state; auto-tracked by SignalWatcher |
| `this.requestUpdate()` | Manually schedule a re-render (controllers) |
| `this.shadowRoot.querySelector(sel)` | Query shadow DOM (native API) |
