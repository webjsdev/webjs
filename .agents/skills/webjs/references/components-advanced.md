# Components: advanced

## What This Covers

- Slots with full shadow-DOM parity in both DOM modes
- `Task` for client-only async data, and context (`createContext` / `ContextProvider` / `ContextConsumer`) to avoid attribute drilling
- The lit-html directive set (`repeat`, `watch`, `live`, `keyed`, `guard`, `cache`, `until`, `unsafeHTML`, `ref`, `asyncAppend` / `asyncReplace`, `templateContent`)
- Display-only elision (when a component is stripped from the browser)
- Lazy components that load on first sight

Read this when a component needs one of these and `components.md` does not cover it. Start with `components.md`: it holds what a component owns, reactive properties, signals, the lifecycle, light versus shadow DOM, `async render()` and the members not to shadow.

## Slots

The full `<slot>` surface works in light DOM with shadow-DOM parity; migrating modes never requires a template rewrite. A forwarded slot projects its content everywhere (client, SSR, hydration).

**A tag name inside an HTML comment is not instantiated.** `<!-- <my-card> is the wrapper -->` documents the template and renders no component, the same as in a browser. That holds for component tags, `<slot>`, and `<webjs-suspense>`. It extends to attribute values and to every element whose content the HTML parser reads as text rather than markup: `<script>`, `<style>`, `<iframe>`, `<xmp>`, `<noembed>`, `<noframes>`, `<plaintext>`, `<textarea>`, `<title>`. (Before #1128 a commented tag was constructed as a real element and ate the rest of the comment along with the markup after it, so an ordinary explanatory comment could silently delete part of the page.)

Two elements are deliberately excluded, and the second matters more. `<template>` content IS parsed and legitimately carries components, which is what Declarative Shadow DOM and streamed swaps rely on. `<noscript>` content is also parsed, because a browser with scripting disabled reads it as markup, and that is the case a progressive-enhancement framework exists to serve, so components inside `<noscript>` render normally.

Element nesting respects comments too: a comment holding the open or close tag of the element it sits inside (`<my-card>kid<!-- </my-card> --></my-card>`) rides along as content, and the element still ends at its real close tag. Script bodies follow the parser's double-escape rule, so the legacy `<!-- <script>... -->` wrapper pattern stays text to its true end.

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

Named slots, the default slot (unnamed children, text, comments), fallback content (a slot's inner markup when nothing matches), and first-wins resolution all behave per spec. The DOM API mirrors shadow slots: `assignedNodes` / `assignedElements` (with `{ flatten: true }`), `element.assignedSlot`, and the `slotchange` event. Both modes are SSR'd (light DOM places children into `<slot data-webjs-light data-projection="actual">`, shadow DOM via Declarative Shadow DOM), so slotted content renders with no JS.

**Light-DOM slots ARE the native DOM slot API (#1021, full shadow parity).** There is no WebJs-specific slot API. Post-mount writes are live exactly as in shadow DOM, and moving a component between `static shadow = false` and `true` never needs a rewrite:

```ts
const card = document.querySelector('my-card');
card.appendChild(node);                         // live, projected
card.querySelector('[slot=old]').slot = 'new';  // flip re-projects
card.innerHTML = '<p>replaced</p>';             // replaces slotted content
card.querySelector('slot').assignedNodes();     // read, mirrors shadow
node.assignedSlot;
card.querySelector('slot').addEventListener('slotchange', ...); // async + coalesced
```

Things to internalize. (1) Every native mutation is live: `appendChild` / `insertBefore` / `removeChild` / `el.remove()` / `innerHTML` / `el.slot=` flip / `HTMLSlotElement.assign()`. Reorder-by-append moves a child to the end (native semantics), a fragment expands and drains, and `insertBefore` against a renderer/non-child ref throws `NotFoundError`. One caveat rides `assign()`: the light-DOM version is an EXTENSION (an element-bound overlay while name matching keeps working), and native shadow `assign()` needs `slotAssignment: 'manual'` which WebJs does not set, so `assign()` is the one write that does NOT survive flipping to `static shadow = true`; avoid it in mode-portable components. (2) Four inherent gaps (from light DOM having no shadow boundary). The gaps: structural host reads (`host.children` / `host.childNodes` / `querySelector(':scope > ...')` / the `innerHTML` GETTER read the rendered template, not the authored children, so read slotted content with `assignedNodes()`); `assignedChild.parentNode` is the `<slot>`; `::slotted()` CSS is shadow-only (style slotted content with normal selectors / Tailwind); and initial-projection lifecycle timing (`firstUpdated` sees the `<slot>` element with EMPTY `assignedNodes()`, because the first light-DOM projection lands one microtask after the first render, where shadow DOM projects natively before it; read assigned content from a `slotchange` listener or after a microtask). (3) Conditional-on-slot at render time does not exist in EITHER mode (a shadow template can't branch on light-child presence at render time either); use CSS `:has()` / `slot:empty` or a `slotchange` listener. (4) The name `default` is a reserved alias for the default slot; do not name a slot `default`. (5) A display-only slotted wrapper still elides; a component whose slots are mutated at runtime is already shipped because a consumer references its tag (force a ship with `static interactive = true` only for a dynamically-resolved reference the analyser cannot see). (6) A generic DOM library should operate on the assigned nodes, never on the host element itself; writes into an ACTIVELY ASSIGNED slot container are folded into the record (self-heal), while a fallback-mode slot's content is renderer-owned and out of contract. (7) A FORWARDED slot projects its content everywhere (#1023): a template may forward a slot into a nested component (html`<inner-shell><slot></slot></inner-shell>`), and the outer component's content projects through it on a client-only mount, in the SSR first paint, and across hydration (no flash back to fallback). The renderer stamps each slot with its template owner (carried across SSR as `data-wj-slot-owner`), so a forwarded slot routes to the outer host that rendered it, not the child it nests in. (8) A LAYOUT's named slots stay in sync across soft navigation (#1024): when a layout renders its `${children}` inside a slotted shell and a page emits top-level `slot=`-attributed children, the named-slot slices update on a soft-nav boundary swap just as the default slice does (the swap resyncs every own slot of the enclosing shell from the incoming page).

A compound child reads its parent at the first server paint via `closest('ui-tabs')` (only tag-name selectors resolve at SSR, and the compound parent must be light DOM). Genuine live-DOM reads (`querySelector`, `classList`, geometry) still throw at SSR, so keep them in `connectedCallback` / `firstUpdated`.

## Task: client-only async data

For async data that is genuinely CLIENT-only (it depends on a click, viewport, or a live source, so `async render()` cannot bake it in at SSR), use the `Task` reactive controller. It shows its pending state at SSR (staying `INITIAL`), then runs in the browser.

```ts
import { Task, TaskStatus } from '@webjsdev/core/task';

class SearchResults extends WebComponent({ q: String }) {
  #search = new Task(this, {
    task: async ([q], { signal }) => (await fetch(`/api/s?q=${q}`, { signal })).json(),
    args: () => [this.q],   // the args array spreads into the task's first parameter
  });
  render() {
    switch (this.#search.status) {
      case TaskStatus.PENDING: return html`<p>Searching...</p>`;
      case TaskStatus.ERROR:   return html`<p>${this.#search.error.message}</p>`;
      case TaskStatus.COMPLETE: return html`<ul>${this.#search.value.map((r) => html`<li>${r.title}</li>`)}</ul>`;
      default: return html`<p>Type to search.</p>`;   // INITIAL (also the SSR state)
    }
  }
}
```

`args()` re-runs the task whenever its return changes; call `this.#task.run()` to trigger it manually. `TaskStatus` is `INITIAL` / `PENDING` / `COMPLETE` / `ERROR`. Prefer `async render()` for server data that should be in the first paint; reach for `Task` only when the data cannot exist until the browser runs.

## Context: share state without attribute drilling

When a value must reach a deep descendant without threading it through every intermediate component's attributes, use context (from `@webjsdev/core/context`). This is a CLIENT-TIME concern: a provider publishes on connect, so context is empty at SSR. For server-known data, pass it through the page function or a `.prop` instead (see `muscle-memory-gotchas.md`).

```ts
import { createContext, ContextProvider, ContextConsumer } from '@webjsdev/core/context';

export const themeContext = createContext<'light' | 'dark'>('theme');

class ThemeRoot extends WebComponent({}) {
  #provider = new ContextProvider(this, { context: themeContext, initialValue: 'dark' });
  toggle() { this.#provider.setValue(this.#provider.value === 'dark' ? 'light' : 'dark'); }
}

class ThemedCard extends WebComponent({}) {
  #theme = new ContextConsumer(this, { context: themeContext, subscribe: true }); // re-renders on change
  render() { return html`<div class=${this.#theme.value === 'dark' ? 'bg-black' : 'bg-white'}>...</div>`; }
}
```

`subscribe: true` re-renders the consumer on every provider change; omit it for a one-shot read. A component can also fire a `ContextRequestEvent` to pull a value imperatively.

## Directives (lit-html parity)

Import from `@webjsdev/core/directives`. Everything a `class`/`style`/conditional needs is plain JS (`classMap` is `class=${cond ? 'a' : 'b'}`, `when` is a ternary, `map` is `.map`); reach for a directive only for the jobs below.

| Directive | Use it for |
|---|---|
| `repeat(items, keyFn, tpl)` | A keyed list where items reorder / insert / remove (preserves DOM + state per key). A static list is a plain `.map`. |
| `watch(signal)` | A fine-grained DOM swap of one signal's value without re-rendering the whole component. |
| `live(value)` | An `input` / `textarea` `.value` bound to state, so a user edit that equals the last committed value still resets. |
| `keyed(key, tpl)` | Force a fresh subtree (discard old DOM + state) when `key` changes. |
| `guard(deps, () => tpl)` | Skip re-rendering an expensive subtree unless `deps` change. |
| `cache(tpl)` | Keep the DOM of an inactive branch around when toggling between templates. |
| `until(promise, fallback)` | Render `fallback` until `promise` resolves (prefer `Task` in a component, `Suspense` for a page). |
| `unsafeHTML(str)` | Render a TRUSTED raw HTML string. NEVER pass user input (XSS). |
| `ref(cb)` / `createRef()` | Get a handle to the rendered DOM node. |
| `asyncAppend(iter)` / `asyncReplace(iter)` | Stream from an async iterable, appending each value or replacing with the latest. |
| `templateContent(el)` | Render the content of a `<template>` element. |

Every directive here is CLIENT behaviour. At SSR the server renders one shot, so
`guard` always invokes its function, `watch` reads its signal once and inlines
the value, and `live` is fully transparent, resolving to the value it wraps in
every hole position (a child, a plain attribute, a `?bool`, a `.prop`). So
`?open=${live(false)}` omits its attribute exactly as `?open=${false}` does. It
was previously resolved only in a child hole, which served `open=""` and let
hydration close the element a moment later (#1443).

## Lazy components: load on first sight

`static lazy = true` defers a component's module until an element with its tag is first visible: scrolled within 200px of the viewport, or shown when a `hidden` tab panel or a closed `<dialog>` around it opens. Reach for it for heavy panes and dialogs a first screen does not show (an editor behind a Code tab, a data browser, a settings dialog). It stays lazy when the component that renders it imports it (`import './code-pane.ts'`): the server keeps that import for SSR, and the browser copy of the importer gets an `observeLazy` registration in its place, with no preload for the lazy subtree (#1524). Only a SIDE-EFFECT import defers; a binding import (`import { CodePane } from ...`) stays eager, and one anywhere in the app makes that component eager everywhere. Until the module arrives the element is not upgraded, so a parent calling into it uses optional calls (`this.#pane.value?.save?.()`). The loader scans light DOM only, so do not render a lazy tag inside a shadow root. Browser tests (`webjs test --browser`) get every import as written, so a test that imports a lazy component has it defined at once. A component opened by a window event rather than by becoming visible (a panel that renders nothing until an `open` event) does not fit `static lazy`: dynamically `import()` its module in the code that dispatches the event, then dispatch.

## Display-only elision

A component that does no client-side work renders the same SSR'd HTML with or without its JS, so WebJs strips its import from the served source (and any vendor reachable only through it). This is automatic and conservative. A component stays elidable while it has NONE of:

- an `@event` binding or native handler property (`.onclick`)
- a factory-declared reactive property that is not `{ state: true }`
- an overridden lifecycle hook (including `renderFallback` / `renderError`)
- an imported `signal` / `computed` / `watch` / `Task` / `ref` / streaming directive, or `addController` / `requestUpdate`
- code that runs at module load (a top-level call, non-data `new`, dynamic `import(...)`, top-level `await`); only declarations and `X.register(...)` are allowed. A call inside a declaration does not run at load, so it is not a blocker: an arrow's expression body (`export const usd = (m) => Math.round(m) / MICROS`) and a function parameter default (`function relativeTime(when, now = Date.now())`) are both fine. TypeScript types are erased before the analyser reads a module, so an annotation can never be a blocker however call-shaped it looks (`readonly (readonly [number, number, number])[]` is fine)
- the dynamic slot READ surface (`slotchange`, `assignedNodes` / `assignedElements` / `assignedSlot`); merely RENDERING a `<slot>` does not ship (the SSR output carries the placed children, so a display-only slotted wrapper is byte-identical without its JS; native-write liveness is consumer-driven and the consumer's tag reference forces the ship)
- being rendered by a component that itself ships

That last blocker is the one to DESIGN around rather than merely inspect, because it is the only one that is not about the component you are looking at. Elision propagates downward from whatever ships, so the size of your islands decides how much of the tree stays elidable. Ten display-only components rendered by a page are ten modules the browser never fetches. The same ten rendered by one oversized interactive wrapper all ship, and nothing about any of them changed. This is why "Sizing an island" above is a byte-cost rule and not a tidiness preference.

A bare `async render()` (no other signal, light DOM) is elided too: the SSR'd data is the complete first paint. Force shipping with `static interactive = true` when interactivity is invisible to static analysis. `static shadow = true` always ships (Declarative Shadow DOM re-attaches only during parsing). Turn elision off app-wide with `{ "webjs": { "elide": false } }` or `WEBJS_ELIDE=0`.

### What `static interactive = true` does and does not rescue

The analyser reads source lexically, so a few real shapes escape it. The override covers them:

- **An OBSERVER that computes the tag it waits for.** `customElements.whenDefined(TAG)` where `TAG` is a variable does not name a tag the analyser can resolve, so the observed component is elided, its `register` never runs, and the `await` never settles. Put `static interactive = true` on the OBSERVED component.
- **A `:defined` rule in an external stylesheet.** `public/app.css` is not in the module graph, so a `my-badge:defined { … }` rule is invisible. Same fix, on the component the rule names.
- **A consumer that reaches the element through a string selector.** The analyser matches `whenDefined` / `:defined` / `instanceof`, so a `document.querySelector('my-wrapper')` consumer escapes all three. Same fix, on the component being reached.

**It does NOT rescue a component whose OWN registration tag is computed.** `Badge.register(TAG)` is not a registration the scanner recognises (invariant 3 requires a literal tag), so that component is never in the component set at all: it gets no verdict, nothing consults the analyser for it, and the override has nothing to attach to. The registration still runs if the module reaches the browser, so what you ALWAYS lose is the verdict, the tag-to-module registry entry, and the preload hint. Whether the element upgrades depends on one thing: the importing module has to ship WHOLE. An inert, import-only, or elided importer is dropped from the boot and takes the import with it, and then the element never registers at all. A page rendering a real component alongside the orphan is import-only unless it ALSO does its own client work, so shipping whole is the narrower case: assume the element does not upgrade. Always pass a literal: `Badge.register('my-badge')`.

`webjs dev` warns, and `webjs elision` / `webjs doctor` report it, as an **orphan**. That name covers TWO shapes and they fail differently, so read the warning carefully: a computed tag is the case above, while a class with NO registration call anywhere in the app is the plainer one (someone forgot to register it), and that element never upgrades. The check is app-wide, so registering the class from a sibling module is fine and is not reported. Both lose the verdict, the registry entry, and the preload hint.

### Inspecting and proving the verdict

Elision is the one thing WebJs decides about your code that you did not write down, so it is inspectable rather than something to reason about from the rules above.

```sh
webjs elision                      # per-module verdict, and the evidence behind every ship
webjs elision --json               # the same object, for a tool or an agent
webjs elision --verify             # prove elision changed nothing your app serves
webjs elision --verify --routes /,/blog/hello   # add paths (the only way to cover a dynamic route)
```

**Reading the report.** Every component is `elided` or `shipped`. A shipped one carries the `evidence` that forced it, first match wins:

| `evidence` | Means | `by` |
|---|---|---|
| `own` | its own source carries a signal; `reason` is the exact one | null |
| `observed` | another module observes its registration (`whenDefined` / `:defined` / `instanceof`) | the observer |
| `closure` | something it imports does client work | the import |
| `render` | a shipping component can render its tag | that component |
| `import` | a shipping component imports it | that component |
| `unreadable` | its source could not be read, so it ships conservatively | null |

An elided row carries no reason on purpose: elision is the ABSENCE of every signal, so there is no positive fact to report.

**What to do with each verdict.** `elided` on a component you believe is interactive is the one result worth acting on: find the signal it is missing (the list above), and if the interactivity is genuinely invisible to static analysis, add `static interactive = true`. `shipped` with an `evidence` you did not expect is usually a `closure` row, and the fix is to move the client-effecting import out of that component's path. An `orphans` row is always a bug, and the fix depends on which shape it is: give the class a literal registration tag if its tag is computed, or add the missing `Class.register('my-tag')` call if there is none at all (delete the class instead if nothing uses it).

**What `--verify` proves.** It renders every static page route with elision on and off and diffs the bytes with the JS-loaded set masked out, which is the framework's own guard pointed at your app. So it proves elision did not change what your app SERVES. It does not prove post-hydration behaviour, because a wrongly dropped module shows up as a dead click, not as different bytes. Cover that half by running your own browser or e2e suite twice:

```sh
WEBJS_ELIDE=1 npm run test:e2e
WEBJS_ELIDE=0 npm run test:e2e
```

It exits non-zero on a divergence AND on a corpus where nothing could be compared, so it is safe to put in CI. The ON side is forced on rather than read from your config, so the comparison is a real one even in an app that has elision switched off, and the run reports how many modules elision actually dropped so a trivially-true pass is visible. Dynamic routes are skipped by name (rendering one would mean inventing param values); pass real ones with `--routes`. A route whose two same-side renders already differ is reported as nondeterministic and excluded, since a differential over live data proves nothing.

`webjs doctor` carries the same verdict as a one-line inventory, and warns only on an orphan.
