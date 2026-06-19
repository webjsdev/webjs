# WebComponent deep-dive

## Property options in full detail

| Option | Type | Default | Meaning |
|---|---|---|---|
These options are passed to the `prop()` helper inside the `WebComponent({ ... })` factory (e.g. `count: prop(Number, { reflect: true })`); the bare form `count: Number` is shorthand for `prop(Number)`.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `type` | `Number\|String\|Boolean\|Object\|Array` | `String` | Used by the default attribute converter (the first `prop()` argument) |
| `reflect` | `boolean` | `false` | Property changes write back to the HTML attribute |
| `state` | `boolean` | `false` | Internal-only. No attribute, not in `observedAttributes` |
| `attribute` | `string` | derived from the prop name | The HTML attribute name the property rides |
| `default` | value or `() => value` | none | Declarative initial value (a function runs per instance for a fresh object / array) |
| `hasChanged` | `(newVal, oldVal) => boolean` | strict `!==` | Custom change detection |
| `converter` | `{ fromAttribute?, toAttribute? }` | type-based | Custom attribute ↔ property serialization |

Built-in constructors (`String`, `Number`, `Boolean`, `Array`, `Object`) feed
the default attribute coercion. For anything the default can't parse correctly
(Date, Map, Set, discriminated unions) supply a custom `converter`.

For an array-typed prop, pass `Array`, not `Object` (`items: prop<Tag[]>(Array)`).
The default converter handles both identically (each JSON-encodes the value), so
`Object` does not break anything, but `Array` states the prop's shape to the next
reader. The `array-prop-uses-array-type` `webjs check` rule flags an array-typed
generic (`T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>`) declared with the
`Object` constructor.

## Declaring reactive properties: the base-class factory

Reactive properties are declared by passing the property shape into the **base-class factory** `WebComponent({ ... })`. The types flow automatically to `this.<prop>`, so there is no `static properties` block and no `declare` line. A direct `static properties` block throws at runtime (caught statically by the `no-static-properties` rule).

```ts
class Counter extends WebComponent({
  count: Number
}) {
  constructor() {
    super();
    this.count = 0; // fully typed, no declare needed
  }
}
```

The bare form takes a type constructor (`count: Number`, `label: String`, `open: Boolean`). The `prop()` helper carries options and narrows the TS type:

```ts
class Dialog extends WebComponent({
  open: prop(Boolean, { reflect: true }),                 // reflects to the `open` attribute
  showClose: prop(Boolean, { attribute: 'show-close-button' }), // custom attribute name
  variant: prop<'info' | 'danger'>(String, { reflect: true }),  // narrowed union type
  student: prop<Student>(Object),                          // narrowed object type
  internal: prop({ state: true }),                         // internal state, no attribute, no type
}) {
  constructor() {
    super();
    this.student = { name: '', email: '' };
  }
}
```

Set defaults via the `default` option (a function default runs per instance for a fresh object / array) or in the constructor after `super()`. **Never** use a class-field initializer (e.g., `count = 0` or `student: Student = { ... }`): the framework installs reactive getter/setter on `this` inside the constructor via `Object.defineProperty`, and a class-field initializer compiles to an assignment after `super()` that uses `[[Define]]` to overwrite the accessor, silently breaking reactivity. The `reactive-props-no-class-field` rule catches this.

```ts
// default via the option (no constructor needed)
class Counter extends WebComponent({
  count: prop(Number, { default: 0 }),
  items: prop(Array, { default: () => [] }), // function default = fresh array per instance
}) {}
```

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

## Async render: bare-await data fetch (#469)

A component can fetch its own server data into the first paint. `render()` may be `async`, so you write the natural line directly:

```ts
class UserProfile extends WebComponent({ uid: String }) {
  async render() {
    const u = await getUser(this.uid);   // a 'use server' action: real fn at SSR, RPC stub on the client
    return html`<h3>${u.name}</h3>`;
  }
}
UserProfile.register('user-profile');
```

Writing `await` makes the function async by the JS rule, and every render path awaits a promise-returning `render()` automatically. There is no flag. Plain sync `render()` stays the zero-cost default.

**Three concerns, decoupled. Do not conflate them.**

1. **SSR always blocks by default.** The server awaits `async render()`, so the resolved DATA is baked into the first paint. There is no fallback on first paint, ever. JS-off reads the data (a progressive-enhancement UPGRADE over a client-fetched `Task`, which shows nothing without JS).
2. **The client re-fetch default is stale-while-revalidate.** When a prop / dependency change re-runs `async render()`, the previously rendered content stays until the new render resolves. No blank, no flash, no user code.
3. **`renderFallback()` is the OPTIONAL re-fetch loading UI.** Define it to OVERRIDE the stale-while-revalidate default with a loading state (skeleton / spinner) shown DURING a client re-fetch. It is shown ONLY on a re-fetch, NEVER on the first paint, and it does NOT create a server-streaming boundary. It is a prop-aware method (not a static field), so it can branch on the component's current state.

```ts
class UserActivity extends WebComponent({ uid: String }) {
  renderFallback() { return html`<div class="skeleton h-24"></div>`; }  // shown only while a re-fetch is in flight
  async render() {
    const items = await getActivity(this.uid);
    return html`<ul>${items.map((i) => html`<li>${i.label}</li>`)}</ul>`;
  }
}
```

**Errors are isolated per component by default, no user code.** A thrown `await getData()` (or any render throw) renders a component-scoped error state while its siblings render normally; it never bubbles to the route `error.js`. The default surfaces the tag and message in dev and renders a silent empty element in prod (no leak). Override `renderError(error)` only to customize the error UI:

```ts
class Report extends WebComponent {
  async render() { return html`<pre>${await getReport()}</pre>`; }
  renderError(error) { return html`<p class="error">Could not load the report.</p>`; }  // optional
}
```

`Task` and a signal cannot replace this: a `Task` renders its pending state at SSR (it loses the first-paint data), and you cannot wrap a signal around your own `await` inside `render()`. So `async render()` plus `renderFallback()` is the only way to get SSR-first-paint data AND a custom re-fetch loading state.

**Decision rules (which tool to reach for):**

1. Server data knowable at request time: fetch it IN the component with `async render()`. Co-located, no prop-drilling, data in the first paint. The default, simplest case.
2. Client re-fetch where stale content would mislead: add `renderFallback()` for a loading state during the re-fetch.
3. Genuinely CLIENT-ONLY data (depends on a click, viewport, localStorage, or live updates, and does NOT need to be in the first paint): use `Task` / signals plus an RPC action.
4. Slow server data where blocking the first byte hurts: stream it. Wrap the component in `<webjs-suspense .fallback=${html\`…\`}>` to flush the fallback on the first byte and stream the data in (the only way to show a first-paint fallback; concurrent across boundaries; progressive on soft nav). Do it deliberately for slow regions, not by default.

**Anti-patterns (likely footguns):**

- Do NOT prop-drill server data through layers when the leaf component can fetch it itself.
- Do NOT put `await getData()` in a page / layout function if it can live in a component (page / layout fetches run sequentially, a route-level waterfall).
- Do NOT fetch in `connectedCallback` / `Task` for data that is knowable server-side (that yields a fallback-then-RPC, not first-paint data).
- Do NOT expect `renderFallback()` to affect the first paint (it is the CLIENT re-fetch loading state).
- Do NOT add `renderError()` on every component (isolation is automatic).

**How it works.** On the server the SSR walker already awaits a promise-returning `render()` and bakes the data in; a throw is caught per component and rendered as the error state. On the client, `update()` detects a thenable from `render()` and routes to a stale-while-revalidate commit: the current DOM stays until the promise resolves, a monotonic render token drops a superseded resolution (an out-of-order fetch never commits stale DOM), and a rejection routes to `renderError()`. `firstUpdated` / `updated` / `updateComplete` fire after the async commit lands. Only signal reads BEFORE the first `await` establish reactive dependencies.

**Elision (#474).** A **bare** `async render()` (no other client signal, light DOM) is **elided** like any display-only component: the SSR'd data is the complete first paint, so the framework drops the module and the redundant on-hydration re-fetch (a common content / docs leaf shape). It ships only when it ALSO carries an independent signal (an `@event`, a non-`state` reactive prop, a signal / reactive import, a lifecycle hook including `renderFallback()`, a `<slot>`, cross-module observation, or a transitively-reachable interactive child). Two carve-outs always ship. `static shadow = true` ships because Declarative Shadow DOM attaches only during HTML parsing, so a streamed (`<webjs-suspense>`) or soft-navigated shadow component arrives via a JS DOM insertion and needs its module to re-run `attachShadow`. `static refresh = true` is the explicit opt-in to keep the stale-while-revalidate on-load re-fetch that eliding drops (moot for request-stable data, the default; reach for it only when fresh-on-load matters). The only behaviour eliding removes is that on-load refresh; the first paint is byte-identical, verified by the differential-elision guard.

**SSR action seeding (#472).** For a SHIPPING async component (one that hydrates because it carries an interactivity signal), the on-hydration re-fetch is eliminated without eliding the module. Each `'use server'` action result invoked during a (non-streamed) SSR render is serialized into the page as one `<script type="application/json" id="__webjs-seeds">` block, keyed by the action's hash + function name + serialized args. The generated client RPC stub reads that seed on its FIRST call: a hit resolves synchronously (no network, no hydration flicker), a later refetch or arg-change misses (consume-once) and goes to RPC as normal. So `const u = await getUser(this.id)` runs once, server-side, and its result is reused on the client's first render. The capture is a transparent server-side facade over the `'use server'` module (a synchronous load hook wraps each export in a recording `Proxy`), so there is **no source transform and no build step**: the browser source tab and the on-disk files are byte-unchanged, and the RPC stub the browser fetches is the same shape as before (it just consults the seed first). The install mechanism is runtime-neutral (#529): Node uses `module.registerHooks`, Bun uses a `Bun.plugin` `onLoad` (Bun has no `module.registerHooks`), and both emit the identical seed, so a page seeds the same on either runtime. Fail-open by construction: a key miss is always a normal RPC, never wrong data. Default on; opt out with `"webjs": { "seed": false }` or `WEBJS_SEED=0` (then the client re-fetches on hydration, hidden by stale-while-revalidate as before). A soft navigation carries the seed too: the client router ingests the incoming page's payload (`applySwap` -> `scanSeeds`) before its components hydrate, so a navigated async component also skips the refetch. Streamed regions (`<webjs-suspense>`) are NOT seeded (their data resolves after the first flush), so a slow boundary keeps the stale-while-revalidate refetch.

**Interactivity during a COLD on-hydration re-fetch (#528).** Seeding matters for more than a wasted round trip. When a SHIPPING async component DOES re-fetch on hydration (seeding off via `WEBJS_SEED=0`, a `static refresh = true` leaf, or a seed miss), its FIRST client commit is deferred until that re-fetch resolves, and that commit is the step that binds the component's event listeners. So for the fetch's duration the SSR'd markup is visible but NOT yet interactive: an `@click` does nothing until the data lands (the window equals the action's latency, not a constant). Seeding erases this by resolving the first render synchronously, so the component hydrates and binds its listeners immediately, which is the default and works on both Node and Bun (#529, seeding is no longer Node-only). The component is fully reactive once that first commit lands: this is purely a cold-start window, NOT a lost signal subscription (a bump after the commit re-renders normally). To keep an async leaf interactive from the first paint regardless, give it a synchronous first render (read request-known data from a prop / the constructor) and move the async work to a signal-driven `Task` or an `@event` handler.

### Streaming a slow region with `<webjs-suspense>` (#471)

`async render()` BLOCKS the first byte by default (the SSR HTML waits for the data). For a SLOW region where that wait hurts time-to-first-byte, wrap it in `<webjs-suspense>` to stream it: the fallback flushes immediately, the resolved content streams in.

```ts
html`
  <webjs-suspense .fallback=${html`<p>Loading section…</p>`}>
    <user-profile uid="42"></user-profile>
    <user-activity uid="42"></user-activity>
  </webjs-suspense>
`;
```

- **The fallback is on the first byte, the content streams in.** This is the ONLY way a fallback appears on the first paint. It is a deliberate choice for slow data (fast TTFB, accepting a fallback-then-content swap), exactly like page-level `Suspense`. PE-critical content stays unwrapped (blocking) so it is in the first paint with no JS.
- **Grouping + override.** One boundary wraps several components under ONE fallback. The boundary `.fallback` wins over a contained component's `renderFallback()`.
- **Concurrent.** Multiple `<webjs-suspense>` boundaries on a page fetch their data in parallel (each is a non-blocking boundary resolved together), so they stream fast-before-slow with no server waterfall.
- **Error-isolated.** A throwing component inside a boundary renders its component-scoped error state (via `renderError()` or the default) while its siblings stream normally.
- **Progressive on soft navigation (#473).** A client-router navigation to a streamed page applies the shell (with fallbacks) immediately, advances the URL, then streams each boundary in, matching the initial-load experience instead of buffering the whole response.
- **`.fallback` is special-cased at SSR:** the renderer reads it inline as the placeholder, never through the `data-webjs-prop-*` path (a `TemplateResult` is not serializer-safe). It must be an UNQUOTED property hole (`.fallback=${...}`, invariant 4).

Decision: a bare `async render()` for request-time data that should be in the first paint (the default); `<webjs-suspense>` ONLY when the data is slow enough that blocking the first byte is the worse tradeoff.

## Display-only components are elided from the browser

A component that does no client-side work renders the same SSR'd HTML
whether or not its JavaScript ever reaches the browser. webjs detects
these statically and strips their import from the served source, so the
browser never downloads them (and their unique vendor dependencies drop
from the importmap). This is automatic, with no opt-in keyword and no
server/client split to reason about. A component stays elidable as long
as it has none of the following.

- An `@event` binding in a template (`@click=${...}`), or a native event-handler property (`.onclick=${...}`).
- A factory-declared reactive property (`WebComponent({ ... })`) that is not `{ state: true }`. Attribute-driven or `.prop`-driven values are the channel a parent uses to push client updates.
- An overridden lifecycle hook (anything in the table above), as a method or an arrow class field.
- A `signal` / `computed` / `watch` / `Task` / `ref` / `live` / streaming directive imported from `@webjsdev/core`, OR a transitive import of a module that reads shared module-scope signal state.
- An `addController(...)` or `requestUpdate()` call.
- Any code that runs at module load. A display-only module's top level may only *declare* things (imports, the `WebComponent` class, `const` / `let` / `var`, pure initializers like `css\`...\``) and *register* the component (`X.register(...)` / `customElements.define(...)`). Any other top-level call, a non-data `new`, dynamic `import(...)`, or top-level `await` is client work and ships (a top-level `fetch('/track')`, `new WebSocket(...)`, `setTimeout(...)`, `someInit()`). A module-scope pure-DATA constructor is the one exception (`const TAGS = new Set([...])`, a compiled `new RegExp(...)`, a parsed `new URL(...)`, a typed array): it produces inert data with no side effect, so it does not force shipping. This is checked structurally as an allowlist of safe top-level forms, not a denylist of global names, so a brand-new browser API is caught automatically with no code change. Code inside a method, `render()`, or an uninvoked function does not count (it does not run at load), nor do these words in rendered template text or a `.fetch` / `.location` member access.
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
