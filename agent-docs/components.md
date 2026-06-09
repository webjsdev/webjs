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

The SSR pipeline runs the **pre-render value-deriving hooks** before `render()`: `willUpdate` (so derived state is in the first paint) and controllers' `hostUpdate`, then it reflects `reflect: true` properties to attributes. The rest stay **client-only** and SSR does not invoke them: `shouldUpdate`, the `update` DOM commit, `hostUpdated`, `updated`, `firstUpdated`, `connectedCallback`, `disconnectedCallback`. Set SSR-meaningful defaults in the constructor, derive SSR-visible state in `willUpdate`, and keep browser-only work (DOM queries, layout, localStorage, viewport) in `connectedCallback` / `firstUpdated`. A `Task` is the one controller whose `hostUpdate` does not act at SSR: it ships the `INITIAL` state and runs only on hydration, so no request fires server-side.

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
- Any code that runs at module load. A display-only module's top level may only *declare* things (imports, the `WebComponent` class, `const` / `let` / `var`, pure initializers like `css\`...\``) and *register* the component (`X.register(...)` / `customElements.define(...)`). Any other top-level call, `new`, dynamic `import(...)`, or top-level `await` is client work and ships (a top-level `fetch('/track')`, `new WebSocket(...)`, `setTimeout(...)`, `someInit()`). This is checked structurally as an allowlist of safe top-level forms, not a denylist of global names, so a brand-new browser API is caught automatically with no code change. Code inside a method, `render()`, or an uninvoked function does not count (it does not run at load), nor do these words in rendered template text or a `.fetch` / `.location` member access.
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

**The three statically visible forms are now detected and force the
observed component to ship**: a literal `whenDefined('the-tag')`, a CSS
`the-tag:defined` selector, and `instanceof TheClass` (mapped back to the
tag via the component's class name) anywhere in a graph-reachable module
mark `the-tag`'s component as must-ship, so it is never elided. The bias
stays conservative: detection only ever forces MORE components to ship.

What remains an author-facing caveat is the part static analysis cannot
see: a tag built from a dynamic string (`whenDefined(\`x-\${name}\`)`), or
a `:defined` rule in an external stylesheet that is not part of the module
graph. If you observe a component that way, add an interactivity signal
(an `@event`, a non-`state` reactive property, or a lifecycle hook) so it
ships. In idiomatic webjs this is rare: a display-only element is
server-rendered to its final HTML and read as plain markup, and
`:defined` FOUC-hiding works against progressive enhancement (it would
hide content that already painted). But if you reach for those dynamic
patterns, treat the component as interactive.

The detection lists live in `packages/server/src/component-elision.js`
and are the single source of truth. They are kept in lockstep with the
lifecycle table above by `packages/server/test/elision/lifecycle-coverage.test.js`,
which fails if a new `WebComponent` hook is added without teaching the
analyser about it. If you add an interactivity feature to the framework,
update that file.

### Elision is what keeps a server import off a display-only page (and `webjs check` guards the seam)

Elision is also why a page can call a server-only utility and stay
browser-safe, and why the same code crashes once the page gains client
work. A page that does `const s = await auth()` (where `auth` comes from
a `lib/auth.server.ts` UTILITY, no `'use server'`) is fine while the page
is display-only: the framework elides the page, strips the server import,
and the browser never sees it. The moment the page also imports a
component to register it (`import '../components/workspace.ts'`), enables
the client router, or uses a reactive primitive, the page stops being
display-only, must load in the browser to do that work, and drags the
server import with it. In the browser that import is a throw-at-load
stub, so the page crashes the instant its module loads. `webjs typecheck`
and the rest of `webjs check` pass; only the running page fails. This was
the single biggest source of extra AI iterations when porting a real app.

`webjs check`'s `no-server-import-in-browser-module` rule catches it
statically. It reuses the SAME elision verdict described above (over the
module graph, scanned components, and route table), so it flags ONLY a
module that genuinely ships: a display-only page the framework elides is
never flagged, because its server import really is stripped. The fix it
suggests is the three legitimate shapes: gate the route in
`middleware.ts` (server-only, never shipped), call the server through a
`'use server'` ACTION (its browser stub is a working RPC, so it is
exempt), or register the component in a `layout.{ts,js}` so the page
elides again. Server-to-server imports (`.server.ts` importing
`.server.ts`) and `middleware.ts` / `route.ts` are never flagged.

The rule covers every module the build ships, not just pages: a shipping
component, and `error.{ts,js}` / `loading.{ts,js}` / `not-found.{ts,js}`
modules, are checked too. Those three boundaries always ship and are
never elided (only an elidable component import is ever stripped), so a
personalized 404 that does `await auth()` is the same throw-at-load crash
and is flagged. One known gap: a DYNAMIC `import('./x.server.ts')` is not
caught, because the framework's import scanner tracks only static
`import` / `export … from`, not the `import(` call form. That is
consistent with the rest of the framework (a dynamic import is also not
elided framework-wide, and its crash is deferred to call time, not module
load), so the rule leaves it to the runtime.

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

There is also a `WEBJS_ELIDE` environment override that wins over the
`package.json` switch: `WEBJS_ELIDE=0` (also `false` / `off` / `no`) forces
elision off, `WEBJS_ELIDE=1` (`true` / `on` / `yes`) forces it on, and any
other value (or an unset variable) falls through to the `package.json`
switch. It is the deploy-time escape hatch (rule elision out while
debugging a suspected wrong-strip without editing committed code) and the
seam the differential elision test uses to render the same app on and off
in one process. Like the `package.json` switch, it is re-read on every
rebuild.

### The differential guard: elision never changes observable output

Elision's defining invariant is that removing the elided JS NEVER changes
what the user sees or can do (the SSR'd HTML is the progressive-enhancement
baseline; elision only drops JS that would have done nothing). Because the
analyser is heuristic and its long tail of inputs (comments, dynamic tag
strings, multi-line templates, vendor side-effects, future interactivity
surfaces) is open-ended, that invariant is verified DIFFERENTIALLY rather
than only by example: a test renders a corpus of routes with elision on and
off and asserts the observable output is identical, both at the SSR layer
(served HTML, modulo the boot script and modulepreload JS set) and in a
real browser after hydration (DOM and key interactions). The conservative
bias means a mistake almost always only over-ships (wastes bytes, ignored
by the diff); the dangerous direction (a needed module wrongly dropped)
changes post-hydration behaviour and fails the e2e diff loudly. This is the
guard that lets per-component elision stay a safe default rather than a
leap of faith, and it is what would have caught the comment-scanning (#179)
and cross-module-observation (#169) bug classes instantly. The test lives
at `packages/server/test/elision/differential-elision.test.js` (SSR layer)
and the `differential elision` cases in `test/e2e/e2e.test.mjs` (browser
layer).

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

### Compound components read their parent via `closest()` at SSR

A compound component (a tabs trigger, a toggle-group item) typically
derives its active/pressed state by walking to the parent and reading
its value:

```ts
get _tabs() { return this.closest('ui-tabs'); }
render() {
  const active = this._tabs?.value === this.value;
  this.dataset.state = active ? 'active' : 'inactive';
  return html`<button data-state=${active ? 'active' : 'inactive'}><slot></slot></button>`;
}
```

This works in the **first server paint**, not only after hydration. The
SSR walker threads the chain of enclosing custom-element instances into
each instance, and the server element shim's `closest()` resolves a
parent over that chain (so `this.closest('ui-tabs').value` reads the
live parent property the walker already applied). Host IDL properties a
`render()` mutates on `this` (`this.dataset.*`, `this.className`,
`this.hidden`, `this.ariaPressed`, the rest of the `aria*` mixin)
reflect to the matching attribute on the SSR'd host tag, so the active
tab is marked before any JavaScript runs. The first client render
produces the identical state (the browser's real `closest()` against the
real DOM), so there is no hydration flash.

Limits:

- Only **tag-name selectors** resolve at SSR (`closest('ui-tabs')`). A
  class, attribute, or descendant selector returns null server-side and
  resolves on the client. That covers the compound-component pattern;
  anything finer is client-only.
- The compound **parent** must be light DOM (the default, and what every
  kit Tier-2 component uses). A shadow-DOM parent projects its children
  through a native `<slot>`, and those slotted children are not threaded
  the SSR ancestor chain, so their `closest(parent)` resolves to null in
  the first server paint (it still resolves on the client after
  hydration). Keep compound parents light DOM for a correct first paint.
- Genuine layout / live-DOM reads (`querySelector`, `classList`,
  `attachShadow`, geometry) still throw at SSR, so keep them in
  `connectedCallback` / `firstUpdated`.

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
