# Components

## What This Covers

- What a component owns (markup, state, listeners, styling), and the rules that follow from it: refs over selectors, no state on `<body>`, ARIA derived in `render()`
- Declaring reactive properties through the `WebComponent({ ... })` factory and `prop()`, with options (`reflect`, `state`, `attribute`, `default`, `converter`, `hasChanged`)
- Signals as the default state primitive for component-local and shared state, plus `effect` / `batch`
- The Lit-aligned lifecycle and exactly which hooks SSR runs versus skips
- Light DOM (default) versus shadow DOM, and the light-host `display: block` rule
- `async render()`: SSR-blocking first paint, client stale-while-revalidate, `renderFallback()` / `renderError()`
- Inherited members app code must NOT shadow (`title`, `remove`, `render`, ...)

Read this when you are authoring or reviewing a `WebComponent`. For slots, `Task`, context, the directive set, lazy loading and display-only elision see `components-advanced.md`. For styling a component (Tailwind, the tag-prefix rule, host sizing) see `styling.md`. For streaming a slow region or programmatic navigation see `client-router-and-streaming.md`. For Lit habits that break WebJs see `muscle-memory-gotchas.md`.

## Ownership: what a component owns

A component owns four things together: its markup, its state, its listeners, and its styling. The moment one of them lives in a different file from the rest, the feature can no longer be read, tested, or deleted as a unit, and the parts drift apart. These are CONVENTIONS, judged by a reader. `webjs check` has no rule for any of them, and adding one would be wrong, because a sensible app can legitimately want a delegated listener to pass.

Most of what follows restates widely held component-model advice, ported. Lit's base class exists to hold reactive state, scoped styles, and a declarative template TOGETHER (the `lit` package README), and Lit documents a ref's value as `undefined` once the node "is no longer rendered", which is precisely the signal a selector lookup cannot give you. React frames the same ideas as lifting state to the closest common owner (react.dev, "Sharing State Between Components") and treating a ref as an escape hatch rather than the normal way to reach a node (react.dev, "Escape Hatches"). Where WebJs moves the boundary, the rule that needs it says so inline and names the mechanism.

**1. Markup and the code that drives it live in the same component.** A class selector is not an interface. `document.querySelector('.nav-toggle')` keeps compiling, keeps type-checking, and keeps passing `webjs check` after someone renames the class in the other file. It just starts returning `null` at runtime. If you are writing a selector to find markup that another file rendered, write the component that renders it instead. Where a value genuinely has to exist in two places (a layout's pre-paint inline script cannot import), the second place READS the first declaration rather than restating it.

**2. Reach your own rendered node with a ref, never with a selector.** `render()` already owns the node, so let the handle flow out of the template with `ref()` / `createRef()` from `@webjsdev/core/directives` (the directives table below carries the one-line summary). A ref is scoped to the component, so it cannot match a node some other component rendered, and it goes `undefined` when the node stops being rendered, which makes a stale handle visible instead of silent. Two reads a ref cannot express stay vanilla: `this.closest('parent-tag')` for compound-component ancestor lookup, and `assignedNodes()` for slotted content.

**3. State lives on the component, never on `<body>` or `<html>`.** The client router swaps a range INSIDE the document, so the document shell sits outside every swap. An open flag parked on `<body>` therefore survives a navigation that removed the markup it described, and it re-opens a panel over the next page or leaves scrolling locked on a page with nothing open. State held in a reactive property or an INSTANCE signal dies with the element, which is the behaviour you wanted in the first place. A module-scope signal deliberately outlives it, which is what rule 7 reaches for, so it is the right home for state genuinely shared between components and the wrong one for one element's own open flag. The carve-out is a document-level EFFECT rather than one component's state, and it comes in two shapes. A TRANSIENT effect, a scroll lock being the usual case, belongs to the element that opened it and must be released in `disconnectedCallback`. A PERSISTENT one is a document-wide SETTING, the theme being the case the framework itself ships: the scaffold's theme toggle writes `data-theme` on `<html>` and persists it, deliberately without releasing it on disconnect, because it describes the document rather than the element (`styling.md` carries that pattern). What the rule forbids is neither of those. It is one component's own open / selected / active flag parked on the shell because that was the convenient place to reach it from.

**4. ARIA state is a hole in `render()`, derived from the same state that drives behaviour.** `aria-expanded=${this.open ? 'true' : 'false'}` cannot disagree with `this.open`. A second function that re-finds the button and calls `setAttribute` can, and does, the first time someone adds a close path that forgets to call it. The same holds for `class`, `?disabled`, and any `.prop`. Two caveats ride this rule:

- A plain-attribute hole follows one rule on the server and the client (#1573): `null` / `undefined` omit the attribute, `false` omits it except on an `aria-*` name, where it is written as `"false"`, and `true` on an HTML boolean attribute (`checked`, `selected`, `disabled`, ...) writes the empty value like `?attr` (#1579). So `checked=${isDefault}` and `selected=${i === 0}` behave exactly like `?checked` / `?selected`, though `?attr` stays the clearer spelling for a boolean attribute. So `aria-expanded=${this.open}` serves `"true"` / `"false"` and hydrates unchanged, and `aria-current=${active ? 'page' : null}` omits the attribute on an inactive link. `?attr=${bool}` is not a substitute for a tri-state ARIA attribute, since a boolean binding omits the attribute when false.
- A hole commits on the next render, one microtask later. The one place a direct write is still correct is a synchronous snapshot read such as `webjs:before-cache`, where the router reads `outerHTML` in the same task. That is a documented exception, not the normal path.

**5. Behaviour needs an importable surface, or its test is a copy of it.** An inline `<script>` in a layout has no module identity, so a browser test cannot import it. It can only transcribe the listener into the test file and assert against the transcription, which then needs a SECOND test to grep the original for drift. Two tests, neither running shipping code. A component is importable, so its browser test mounts the real element and drives real events. A page or layout may still carry an inline `<script>`, but only for pre-paint boot work no module can do: reading a stored theme before first paint so the wrong palette never flashes, or measuring the header height into a CSS custom property. It must not be interactivity, and WHERE it sits decides how often it runs. The ROOT layout's markup sits OUTSIDE every swap range, so a soft navigation does not re-run its script, which is what makes it the right home for boot work and the wrong home for anything that has to respond to a later navigation. A page or a NESTED layout sits inside the swap range instead, so its script re-executes on every navigation that swaps that range (#1102), which means it has to be idempotent or guard on a flag it sets the first time. Neither shape gives you a listener that simply works, which is what a custom element is for. Under an opt-in CSP the script also needs the nonce from `cspNonce()`. `client-router-and-streaming.md` carries the full re-execution rule.

**6. Listening on `document` is legitimate. Querying `document` usually is not.** An outside-click dismissal or an Escape handler has no choice, because the event happens outside the element, so the listener has to be global. What decides whether that is ownership or a reach across the app is what the handler then READS. `this.contains(e.target)` is a decision about the component's own subtree. `document.querySelector('.other-thing')` is a decision about someone else's markup. Add the listener in `connectedCallback`, remove it in `disconnectedCallback`, and store the handler in a field so `removeEventListener` gets the same reference back (a function created inline at add time can never be removed).

**7. Talk to an ancestor with an event, and to a stranger with a module-scope signal.** A child telling its own ancestor something dispatches a `CustomEvent` with `bubbles: true`, and the ancestor binds `@my-event=${...}` in the template that rendered it. Add `composed: true` as well when the component sets `static shadow = true`, or the event stops at the shadow boundary. Two components with NO ancestor relationship share a module-scope `signal` that both import, which is typed, greppable, and owned by a module. What neither case is: a made-up event name on `document` used as a global bus, which is a global variable with extra steps. Framework events such as `webjs:navigate` ride `document` because the router has no element to dispatch from, and that is not a licence to add your own.

The shape to fix, all four pieces in different places:

```js
// In a layout's inline script, driving markup that another file rendered.
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-toggle')) document.body.toggleAttribute('data-nav-open');
});
function syncNav() {
  const btn = document.querySelector('.nav-toggle');   // another file's markup
  const open = document.body.hasAttribute('data-nav-open');  // outlives the markup
  if (btn) btn.setAttribute('aria-expanded', String(open));  // a second home for the state
}
```

The shape to write, one component owning all four:

```ts
import { WebComponent, prop, html } from '@webjsdev/core';
import { createRef, ref } from '@webjsdev/core/directives';

class NavDrawer extends WebComponent({ open: prop(Boolean, { reflect: true }) }) {
  private toggleRef = createRef<HTMLButtonElement>();
  // Stored in a field, so removeEventListener gets the same reference back.
  private onDocClick = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) this.open = false;   // reads its OWN subtree
  };
  private onDocKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.open) return;
    this.open = false;
    // The ref lands after the FIRST client commit, and `ref()` is a no-op at
    // SSR, so read `.value` from a handler or `firstUpdated`, never from the
    // constructor. This is the reach a selector would otherwise have done.
    this.toggleRef.value?.focus();
  };

  constructor() { super(); this.open = false; }                // SSR runs the constructor

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this.onDocClick);       // listening globally is fine
    document.addEventListener('keydown', this.onDocKeydown);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.onDocClick);    // the state dies with the element
    document.removeEventListener('keydown', this.onDocKeydown);
  }

  render() {
    return html`
      <button ${ref(this.toggleRef)}
        aria-expanded=${this.open ? 'true' : 'false'}
        @click=${() => { this.open = !this.open; }}>Menu</button>
      <nav ?hidden=${!this.open}><slot></slot></nav>
    `;
  }
}
NavDrawer.register('nav-drawer');
```

This repo's own website is the worked example. Before commit `b80de906` the docs drawer and the header menu were exactly the first shape, and every accessibility bug their tests now pin came out of the split. `website/components/docs-drawer.ts` and `website/components/site-nav-menu.ts` are the second shape, and `website/AGENTS.md` records the app-level version of these rules under "What stays inline script in the root layout".

## Sizing an island: own the behaviour, not the section

The ownership rules above answer "what must not be split apart". They do NOT answer "how much to pull in", and read alone they push in one direction only: rule 1 says that if you are reaching for a selector, write the component that renders that markup instead. Applied without a stopping rule, that argument never terminates, because there is always more surrounding markup a component could render.

Here is the stopping rule. **A component owns the markup its own behaviour reads or writes.** Static markup that no handler touches, no state change re-renders, and no template hole depends on belongs to the page, not to the island.

This is a byte-cost rule, not a taste one. A page never hydrates, so markup it renders is free in the browser. Markup an island renders is not: the island's module is fetched, `@webjsdev/core` comes with it, and on upgrade the component re-renders, replacing the server's DOM for that subtree. Moving static markup across that boundary converts free HTML into shipped JavaScript that reproduces markup the server already sent.

```ts
// TOO BIG. One button's worth of behaviour, a whole page's worth of markup.
class ProductPage extends WebComponent({ product: prop<Product>(Object) }) {
  render() {
    return html`
      <h1>${this.product.name}</h1>
      <p>${this.product.description}</p>
      <spec-table .rows=${this.product.specs}></spec-table>
      <button @click=${() => addToCart(this.product.id)}>Add to cart</button>
      <review-list .reviews=${this.product.reviews}></review-list>
    `;
  }
}
```

```ts
// RIGHT SIZE. The page renders the static markup. The island is the button.
class AddToCart extends WebComponent({ productId: String }) {
  render() {
    return html`<button @click=${() => addToCart(this.productId)}>Add to cart</button>`;
  }
}
```

The first version ships three modules instead of one: itself, plus `<spec-table>` and `<review-list>`, which were display-only and elidable until a shipping component rendered them (see "Display-only elision" below). The second ships one small module, and the heading, description, spec table, and reviews stay HTML the browser never pays for.

**How to tell, on a component you are about to write.** Walk its template and ask of each element: does a handler in this class touch it, does a state or property change alter it, or does it sit in a template hole? If the answer is no for all three, that element is a passenger. A template that is mostly passengers is an island that wants splitting, and the split is usually "hoist the static markup back to the page and keep the interactive fragment".

**The exception, and it is a real one.** Markup that is static *today* but is the thing a near-term behaviour will read is fine to keep, because the alternative is a component that reaches outward for it later, which is what rule 1 forbids. Judge the behaviour you are building, not one you are speculating about. When those genuinely collide, ownership wins over bytes: a coherent component that ships a little extra markup beats a split feature that a selector holds together.

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
| `reflect` | `false` | Property changes write back to the HTML attribute (a value with no attribute representation removes it instead, see below) |
| `state` | `false` | Internal-only. No attribute, not observed, and never read from one at SSR either |
| `attribute` | derived from name | The HTML attribute name the property rides |
| `default` | none | Declarative initial value (a function runs per instance for a fresh object / array) |
| `hasChanged` | strict `!==` | Custom change detection |
| `converter` | type-based | Custom attribute-to-property serialization. `fromAttribute` runs on BOTH readers (the client upgrade and SSR), ahead of type coercion |

For an array-typed prop pass `Array`, not `Object` (`array-prop-uses-array-type` flags the `Object` form). For anything the built-in converters cannot parse (Date, Map, Set) supply a `converter`.

**A `converter.fromAttribute` runs SERVER-SIDE too.** Both attribute readers go through one shared implementation, so the converter fires during SSR as well as on the client upgrade, and it wins over the declared `type` on both. So keep it free of browser globals (`document`, `window`, `navigator`), since SSR has no DOM and touching one throws where the same code worked in the browser. A converter that THROWS is not caught by either reader, because an author who writes one owns the conversion: at SSR the throw lands in per-component error isolation (an error box in dev, an empty element at a 200 in production, with the cause in the server log) while sibling components still render, and on the client it escapes `attributeChangedCallback` during upgrade. Both readers hand the converter DECODED attribute text, so a converter that parses its input (`JSON.parse` for a Map or a Set, `new Date(...)`) sees the same string on both sides even when the attribute carries `&quot;` or `&amp;`.

**A `reflect: true` property holding a FUNCTION drops its attribute instead of writing one, and so does one holding an array that carries a function, unless the prop is `Object` or `Array` typed.** A function has no HTML attribute representation, and the serializations it would otherwise get are both useless and dangerous. `String(fn)` is the function's SOURCE, so a reflected `'use server'` action would ship its whole body, closure secrets included, to every visitor, and `JSON.stringify(fn)` is `undefined`, which lands in the attribute as the literal four-character string. So the reflection path treats a function like `null`, removes the attribute, and warns naming the property, the tag, and the attribute. This holds on both sides, since SSR and the client-side setter run the same path, and it holds for every property name (the leak was never specific to one called `action`). Two exceptions. A property with a custom `converter.toAttribute` runs that converter first and is left alone, because an author who writes one has taken responsibility for serializing whatever they are handed. And an `Object` or `Array` typed property CARRYING a function keeps its data, because `JSON.stringify` drops the function to `null` and omits the key, so `[1, 2, fn]` reflects as `[1,2,null]` with no source and nothing else lost. If you need a function on a component, use a plain property or a signal and do not mark it `reflect`.

**An `Object` or `Array` typed reflected property whose value `JSON.stringify` cannot serialize AT ALL drops its attribute the same way, and warns.** Three shapes do this: a cycle (an object or array that reaches itself, which arrives from a parent/child graph, a linked node, a memo table, or anything a library hands back with a back-reference), a `BigInt` anywhere inside the value, and an author `toJSON()` that throws. The line to keep straight is that a value which serializes WITH A GAP in it keeps its data (the carried-function case above), while one that does not serialize at all has no string to put in the attribute and so has no attribute representation, exactly like a function. The property itself is untouched and still holds the value; only the attribute goes. Before this guard the throw escaped reflection entirely, which meant a client upgrade threw before the component's first render, and an SSR render was swallowed by per-component error isolation, which shows an error box in dev and renders the component EMPTY on a page that still returned 200 in production. To reflect something about a graph-shaped value, reflect a derived scalar (an id, a count) and keep the graph on a non-reflected property. On the read side an attribute that is PRESENT but not parseable JSON reads back as `null` rather than as the raw string, on both the SSR and the client reader. An ABSENT attribute is a different case: neither reader sees it, so the property keeps its constructor value. The two readers also see the same attribute SET, not merely the same fallback: a `state: true` prop and an attribute matching no declared property are ignored by both, and a camelCase attribute name reaches its prop on both through the lowercased alias, and both are handed a value whose HTML character references are already decoded.

**Writing attributes in markup.** Names are case-insensitive and the browser lowercases them while parsing, so a camelCase prop answers to BOTH its kebab-case name (`user-name`, the one reflection writes) and its lowercased name (`username`, lit's default), which is what a camelCase attribute in markup (`userName="…"`) arrives as; all three spellings reach `userName` on both sides. Prefer kebab-case. A prop that renames its attribute answers to the new name ONLY, so `open: prop(Boolean, { attribute: 'is-open' })` is written `<my-el is-open>` and `<my-el open>` reaches nothing. Character references are decoded before the value is coerced, so `cfg="&#123;&quot;a&quot;:1&#125;"` parses as the object it spells and `label="Tom &amp; Jerry"` is `Tom & Jerry`; the legacy semicolon-less forms decode exactly where a browser decodes them (`&nbsp` at the end of a value is a non-breaking space, `&nbspx` and `&nbsp=x` stay literal), and writing the semicolon avoids the question. A `state: true` prop takes an SSR value only through a `.prop=${value}` binding from the parent template, never from an attribute.

**Never use a class-field declaration OR initializer** (`count = 0`, `student: Student = {...}`, `todos!: Todo[]`). Under `useDefineForClassFields` even a type-only `todos!: Todo[]` compiles to define an own property after `super()`, which clobbers the prototype's reactive accessor and silently breaks reactivity. Only declare props in the factory and read/write them off `this`. The `reactive-props-no-class-field` rule catches this.

## Signals are the default state primitive

Reserve the factory for values that ride an HTML attribute, reflect to one, or arrive via `.prop=${value}` SSR hydration. For everything else use signals.

```ts
import { signal, computed } from '@webjsdev/core';

const cart = signal<Item[]>([]);                 // module-scope: shared across components, survives navigations
const count = computed(() => cart.get().length); // derived
```

Read with `signal.get()` inside `render()`; the built-in `SignalWatcher` tracks the read and re-renders on change. An instance signal created in the constructor is component-local. For a fine-grained DOM swap use `${watch(signal)}` from `@webjsdev/core/directives`.

Two more signal primitives from `@webjsdev/core` cover client-side reactions and batched writes:

- `effect(fn)` runs `fn` now and re-runs it whenever a signal it read changes. It is a BROWSER-ONLY side-effect primitive (a subscription, a `document.title` sync, an analytics ping), not a render path. It returns a disposer, so create it in `connectedCallback` and call the disposer in `disconnectedCallback` to avoid a leak.
- `batch(fn)` coalesces several `.set()` writes inside `fn` into ONE re-render instead of one per write. Reach for it when a handler updates multiple signals at once.

```ts
import { signal, effect, batch } from '@webjsdev/core';
const open = signal(false), count = signal(0);
connectedCallback() { super.connectedCallback(); this.dispose = effect(() => { document.title = `(${count.get()})`; }); }
disconnectedCallback() { super.disconnectedCallback(); this.dispose?.(); }
reset() { batch(() => { open.set(false); count.set(0); }); }   // one re-render, not two
```

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

Errors are isolated per component by default (no user code): a thrown `await` renders a component-scoped error state while siblings render, never bubbling to the route `error.ts`. Override `renderError(error)` only to customize it (dev shows the message, prod stays silent). The boundary covers the COMMIT as well as the fetch, so a template that throws while being applied (a refused binding, a value whose `toString` throws) reaches `renderError()` too, and `updateComplete` still settles. Those two halves used to disagree: a fetch rejection was contained and a commit throw escaped as an unhandled rejection that also left `updateComplete` pending forever.

The boundary also covers `watch(signal)` (its notify microtask) and `until()` (its promise resolution), which commit outside the update cycle. A throw from either used to surface at the window instead of the owning component. It routes to the component whose TEMPLATE holds the binding, which is not always the element the binding sits inside: `html`<child-el>${watch(sig)}</child-el>`` belongs to the parent that wrote it, not to `child-el`. `asyncAppend` / `asyncReplace` is the third such site and is covered the same way: a chunk's own commit throw, and a `watch` / `until` nested inside a chunk, both reach the owning component's `renderError()`. A chunk's own commit throw also STOPS the stream, since the boundary is about to render an error state and appending into a region it may have replaced is not a recovery; a nested directive throws from its own handler outside that loop, so it reaches the boundary but does not stop the stream, the same as a directive nested anywhere else. What stays at `console.error` is the author's own code, the iterable AND any `mapper` passed alongside it, on the standing reasoning that an author's iterable should handle its own errors. That ends the stream too, and always has. With a bare `render()` into a plain container there is no component to receive a commit throw, so it surfaces rather than being swallowed, which is what `watch` and `until` already do.

**A commit that throws leaves the directive's own state consistent, so the NEXT valid render is correct.** This matters because the corruption is otherwise silent: the renders that expose it are fully valid and log nothing after the first throw. The hole whose commit threw is marked so the next render re-applies it rather than skipping it as unchanged (its recorded value is never advanced past a throw, and would otherwise match exactly what the recovering render supplies, leaving a child region blank for good). Both list reconcilers additionally repair their own bookkeeping so it describes the DOM again, and the next render is an ordinary reconcile rather than a rebuild of the region, which would discard the node identity the reconcilers exist to preserve. `repeat()` re-unites its key map and repositions every row (the failure was a permanently duplicated row). A plain `.map()` array splices the part of its slot list the failed pass never reached back on, which matters whenever a slot is REPLACED rather than updated in place (its template shape changed, its kind changed between text, template and empty, or the array grew past its old length), since that is the branch that inserts the replacement before removing what it replaced (the failure was a stranded row that outlived even a render of an empty array). `guard()` records its new deps only once the commit succeeds, so a later render with those same deps re-renders the region instead of short-circuiting past a region the throw had blanked; `until()` advances its resolved priority only after the commit succeeds, so a failed high-priority resolution does not refuse the lower-priority one behind it.

**Teardown is total as well.** Removing a row is not a commit and has no retry, so a throw while tearing one down cannot be allowed to abandon the rest. Unbinding a `ref` during teardown can never abort the removal of the remaining rows, and `repeat()` drops each leftover key from its map before touching that row, so the map never describes a row that has already been removed (which used to leave the row the app DELETED on screen, reorder the survivors, and let a later render that re-added that key reinsert the disposed instance). To make that hold, a `ref` whose object `value` setter throws is now SWALLOWED on teardown, matching the ref CALLBACK, which was already swallowed everywhere. That is a deliberate divergence from lit, which guards neither and propagates from both. It applies to teardown only: on the COMMIT path a throwing object-ref setter still reaches `renderError()`, because there the boundary can report it and the next render can repair it. Total also means a removal takes the row's own boundary markers with it, so a list that grows and shrinks all day is net zero on the nodes the renderer added, rather than accruing one invisible comment per removed row for the life of the region.

Decision rules. Use `async render()` for request-time server data that should be in the first paint (the default). Add `renderFallback()` when a client re-fetch's stale content would mislead. Use `Task` / signals for genuinely client-only data (a click, viewport, live updates). For SLOW data where blocking the first byte hurts, wrap the region in `<webjs-suspense .fallback=${html\`Loading...\`}>` to stream it (the only way to show a first-paint fallback; see `client-router-and-streaming.md`). Do NOT fetch in `connectedCallback` for data knowable server-side, and do NOT prop-drill what a leaf can fetch itself.

## Members app code must not shadow

A `WebComponent` inherits `HTMLElement` (browser) or an `ElementShim` (SSR) plus the framework reactivity base. A reactive prop or method whose NAME collides either fails to compile (`TS2415` for a type-incompatible property, `TS2416` for a method signature) or silently hijacks the native member at runtime. The fix is always to rename. The DOM MUTATION methods WebJs instruments for the light-DOM slot API (`append`, `prepend`, `before`, `after`, `replaceWith`, `replaceChildren`, `remove`, `appendChild`, `insertBefore`, `removeChild`, `replaceChild`) are the dangerous case TypeScript does NOT catch (a shorter override is assignable to the native signature), so a handler named `append()` compiles yet silently never runs. `webjs check`'s `no-shadowed-native-member` rule catches exactly these.

- HTMLElement / Element: `title`, `id`, `slot`, `role`, `hidden`, `dir`, `lang`, `translate`, `draggable`, `tabIndex`, `className`, `dataset`, `remove`, `closest`, `matches`, `focus`, `blur`, `click`, `append` / `prepend`, `before` / `after`. Rename (`postTitle`, `removeItem`, `handleClick`).
- WebComponent base: `render`, `update`, `requestUpdate`, `updated` / `firstUpdated`, `willUpdate` / `shouldUpdate`, `connectedCallback`, `renderError` / `renderFallback`, `addController` / `removeController`, `updateComplete` (#1021: there is no WebJs slot API to override; slots are native). Only override one deliberately, with its exact signature; never repurpose the name for app logic.

Framework-private fields are underscore-prefixed (`_renderRoot`, `_connected`, `_changedProperties`, `_updatePromise`, `_isUpdating`); never declare a prop or field that matches one. Safe, non-inherited names: `label`, `open`, `count`, `value`, `name`, `items`, `todos`, `active`, `variant`, `size`, `checked`, `selected`, `heading`, `message`, `status`. When in doubt, grep the base surface in `node_modules/@webjsdev/core/src/component.js` and its sibling `component/` directory, where the class body actually lives.
