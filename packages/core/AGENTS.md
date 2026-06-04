# AGENTS.md for @webjsdev/core

The webjs **core runtime**: `html` / `css` tagged templates, the
`WebComponent` base class, isomorphic renderers, directives, the
client router, the `Task` controller, the Context Protocol, and
testing helpers.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules)
live in the **framework root [`../../AGENTS.md`](../../AGENTS.md)**
and apply here. Read that first.

This file only covers what's specific to `@webjsdev/core`.

## Role

Shared by every webjs runtime path:
- Server (SSR via `renderToString` / `renderToStream`).
- Browser (fine-grained client renderer + hydration).
- Tests (`renderToString` + `fixture()` helpers).

The same `html` / `css` tag and the same `WebComponent` class produce
the same output in all three.

## Module map (`src/`)

| File | What it owns |
|---|---|
| `html.js` | `` html`` `` tagged-template → `TemplateResult`, plus `MARKER` and `isTemplate` |
| `css.js` | `` css`` `` → `CSSResult`, `adoptStyles`, `stylesToString` |
| `component.js` | `WebComponent` base class: lifecycle, properties, reactive accessors, light-vs-shadow DOM, scheduling, slot host wiring. On the server the base is a DOM shim (attribute methods backed by a Map, no-op events, inert `attachInternals`, `closest()` over the SSR ancestor chain, and the host IDL reflections `dataset` / `className` / `hidden` / `id` / `title` / `slot` / `role` / `tabIndex` / `aria*`); `performServerUpdate` runs the pre-render lifecycle (`willUpdate` + controllers' `hostUpdate` + reflection) for SSR |
| `render-server.js` | `renderToString`, `renderToStream` (async, with Suspense streaming), SSR slot substitution in `injectDSD`. The walker seeds the server attribute shim from the source attributes, threads the enclosing-instance ancestor chain into each instance (so the shim's `closest()` resolves a parent), calls `performServerUpdate` before `render()`, and appends reflected/added attributes (including host attributes set inside `render()`) to the opening tag |
| `render-client.js` | Client-side patcher + hydration; the only file that touches `document`. Also discovers and binds light-DOM slot parts |
| `slot.js` | Light-DOM `<slot>` runtime: `HTMLSlotElement` polyfills (`assignedNodes`, `assignedElements`, `slotchange`), projection scheduling, MutationObserver, first-wins resolution, fallback swap, pending-fragment recovery |
| `directives.js` | the lit-html-parity directive set (`unsafeHTML`, `live`, `keyed`, `guard`, `templateContent`, `ref` / `createRef`, `cache`, `until`, `asyncAppend` / `asyncReplace`, `watch`, plus each `is*` guard). `repeat` lives in `repeat.js`. All are re-exported from `index.js` / `index-browser.js` so the bare specifier and the `/directives` subpath (which collapses onto the dist browser bundle) expose the full set |
| `repeat.js` | `repeat(items, keyFn, templateFn)` for keyed list reconciliation |
| `suspense.js` | `Suspense()` boundary primitive |
| `context.js` | Context Protocol: `createContext`, `ContextProvider`, `ContextConsumer`, `ContextRequestEvent` |
| `task.js` | `Task` / `TaskStatus` controller for async data in components |
| `router-client.js` | Turbo Drive–style client router; entry: `enableClientRouter` / `navigate`. Also exports `loadFrame(frameEl, url)` (#253), the reusable frame self-load `webjs-frame.js` calls: it fetches `url` as a frame nav (the `x-webjs-frame` header) and applies the matched subtree through the SAME `fetchAndApply` frame-swap path a click uses (no history push / snapshot / optimistic skeleton, since it swaps one region) |
| `webjs-frame.js` | The `<webjs-frame id>` custom element (a swap anchor; the router does the swap). Adds the `src` + `loading` self-load (#253): an eager (`connectedCallback`) or lazy (viewport, via `lazy-loader.js`'s `observeViewportOnce`) self-fetch through `router-client.js`'s `loadFrame`, with a per-element loaded-URL guard so eager connect / the lazy observer / a `src` mutation never double-fetch. SSR-inert (defined client-side only) |
| `registry.js` | Custom-element bookkeeping (`register`, `lookup`, `allTags`, `tagOf`, `isLazy`, `primeModuleUrl`) |
| `lazy-loader.js` | IntersectionObserver-based lazy module loading for `static lazy = true`, plus `observeViewportOnce(el, cb)` (#253): a per-ELEMENT one-shot viewport callback (vs the per-tag module loader) reusing the same `rootMargin: '200px'` budget, used by `<webjs-frame loading="lazy">` to defer its self-load until the frame scrolls into view |
| `nav.js` | `notFound()`, `redirect()` sentinels for page/action handlers |
| `optimistic.js` | `optimistic(signal, value, action)` (#246): optimistic-UI helper. Sets the signal to `value`, awaits `action()`, rolls back on a throw or an `ActionResult` `{ success: false }`. A thin wrapper over the signal primitive; re-exported from `index.js` + `index-browser.js`, and classified in `component-elision.js` as a reactive (client-work) import |
| `expose.js` | `expose('METHOD /path', fn)` REST endpoint tagging, plus `validateInput(fn, validate)` (#245): attaches an input validator through the SAME `__webjsHttp` metadata `expose` writes (so `getExposed(fn)` surfaces it) WITHOUT creating a REST route, so the validator runs on the RPC path too. Both are server-only (stripped from `index-browser.js`). `getExposed` reads the metadata back |
| `escape.js` | HTML attribute / text escaping (the only sanitiser) |
| `csp-nonce.js` | Isomorphic CSP nonce reader: `cspNonce()` (returns the request nonce, `''` in the browser) + `setCspNonceProvider` (server-only wiring). The provider is installed by `@webjsdev/server`'s `context.js`; as of #233 it returns a freshly-MINTED per-request nonce (not just an inbound-header parse). `setCspNonceProvider` is stripped from the browser surface |
| `rich-fetch.js` | Content-negotiated fetch helper |
| `websocket-client.js` | `connectWS()` with auto-reconnect |
| `serialize.js` | Wire-format primitives (Date/Map/Set/BigInt/cycles…) used by RPC |
| `testing.js` | `fixture`, `ssrFixture` (SSR + hydrate, awaits the native `updateComplete`), `waitForUpdate` (awaits `updateComplete` when present), `assertNoA11yViolations` (opt-in axe-core a11y assertion, dynamically imports the test-only `axe-core` peer), `click`, `shadowQuery`, `shadowQueryAll` |

## Public exports (re-exported from `index.js`)

See the [package.json `exports` field](./package.json) for subpaths:
`@webjsdev/core/client`, `/server`, `/component`, `/registry`,
`/client-router`. Everything else is exposed via the main `index.js`
re-exports. Keep this list in sync if you add or remove a barrel
export.

**Type-only exports.** `index.d.ts` (the overlay) re-exports the
type-only public surface alongside the runtime exports. The component
typing lives in `src/component.d.ts`; the page-metadata typing
(`Metadata`, `MetadataContext`, and the nested shapes, including
`PreconnectHint` for the `metadata.preconnect` / `metadata.dnsPrefetch`
connection-warming hints, #243) lives in
`src/metadata.d.ts`; the typed page / layout / route-handler props plus the
opt-in route union (`PageProps`, `LayoutProps`, `RouteHandlerContext`, `Route`,
`RouteParams`, and the `WebjsRoutes` / `RouteParamMap` augmentation targets,
#258) live in `src/routes.d.ts`. The `webjs` package.json config-block typing
(`WebjsConfig` plus the nested `WebjsHeaderRule` / `WebjsRedirectRule` /
`WebjsCspConfig` / `WebjsTrailingSlash`, #259) lives in
`src/webjs-config.d.ts`; it mirrors the `@webjsdev/server` config readers and
the companion JSON Schema (`packages/server/webjs-config.schema.json`), and
those three MUST stay in lockstep (the procedure is documented in
`packages/server/AGENTS.md`). All are pure declaration files (erased at
runtime, zero build cost). A page imports them with `import type { Metadata,
PageProps } from '@webjsdev/core'`. The `Metadata` and `PageProps` /
`LayoutProps` shapes MUST stay in lockstep with what
`packages/server/src/ssr.js` actually reads / constructs, never Next.js's
superset. `routes.d.ts`'s `WebjsRoutes` / `RouteParamMap` are EMPTY by default
(so `Route = string`); `webjs types` generates `.webjs/routes.d.ts` to augment
them per app.

## Package-specific invariants

1. **No build step in your edit-and-refresh loop.** `.js` only,
   plain JSDoc types. What you grep in `node_modules/@webjsdev/core/
   src/` is what served as source IS what runs when the browser
   fetches per-file. Workspace dev (this monorepo) serves per-file
   from `packages/core/src/` until you opt into the bundle by
   running `npm run build:dist --workspace=@webjsdev/core`.
   Published-to-npm copies ship pre-built `dist/` bundles alongside
   `src/`; the browser fetches them when `dist/` is present
   (`scripts/build-framework-dist.js` is wired to the `prepare`
   lifecycle so `npm publish` always rebuilds). The browser surface is
   ONE self-contained file, `dist/webjs-core-browser.js` (built with
   `splitting` off, so no `chunk-*.js`): it re-exports the whole browser
   API, so the bare specifier and the `/directives`, `/context`,
   `/task`, `/client-router` subpaths all resolve to it. `dist/` also
   carries `webjs-core.js` (the full Node surface), the on-demand
   `webjs-core-lazy-loader.js`, and the test-only `webjs-core-testing.js`.
   Only `@webjsdev/core` has this dual-layout. Other framework packages
   stay source-only. `index-browser.js` (and its `dist/webjs-core-browser.js`
   build) strip `render-server.js`, `expose.js`, and
   `setCspNonceProvider` from the public surface. `packages/server/src/importmap.js` routes the
   bare specifier `@webjsdev/core` to that browser entry on the
   client side; Node-side consumers (SSR pipeline, framework
   internals, unit tests) keep landing on `index.js` via the
   package.json `default` condition and still see the full surface.
   `renderToString` / `renderToStream` are reachable from Node via
   the canonical `@webjsdev/core/server` subpath when an explicit
   import is desired.
2. **`html\`\`` returns an inert `TemplateResult`.** Templates don't
   touch the DOM until a renderer (server or client) consumes them.
3. **The renderer is the boundary between server and client.** Server
   code: `renderToString`, `renderToStream`. Client code: `render`.
   Never import client renderer code from server-only paths.
4. **Custom-element tags must contain a hyphen** (HTML spec). See
   `registry.js` `register()`. The framework convention validator
   enforces this.
5. **Reactive properties use `declare propName: Type` + constructor
   defaults**, never class-field initializers (those clobber the
   framework's accessor under modern class-field semantics).
   See `component.js` and the `reactive-props-use-declare` rule.
6. **New interactivity surfaces must update the elision analyser.**
   webjs elides display-only component modules from the browser by
   static analysis (`packages/server/src/component-elision.js`). It is a
   conservative denylist of interactivity signals. When you add a new
   overridable lifecycle hook, reactive primitive, client-only
   directive, or event-binding syntax to core, add its marker to the
   matching exported list in `component-elision.js`
   (`CLIENT_LIFECYCLE_HOOKS`, `CLIENT_METHOD_CALLS`, or
   `REACTIVE_IMPORTS`). Skipping this lets the analyser wrongly elide a
   component that now does client work. The guard test
   (`packages/server/test/elision/lifecycle-coverage.test.js`) fails on
   any new prototype method until it is classified.

7. **`<slot>` works identically in light and shadow DOM.** Light-DOM
   slots get the same `assignedNodes` / `assignedElements` /
   `assignedSlot` / `slotchange` surface, named slots, fallback content,
   and first-wins resolution as shadow-DOM slots. The light-DOM runtime
   in `slot.js` gates every polyfill on a `data-webjs-light` attribute,
   so real shadow-DOM slots elsewhere on the page are never touched.
   SSR (`injectDSD`) projects light-DOM children into the rendered
   template before the response goes out, so progressive enhancement
   and JS-disabled clients both see the projected content.

## Tests

Tests for this package live in **`packages/core/test/`**,
organised by feature: `signals/`, `rendering/`, `directives/`,
`slots/`, `lifecycle/`, `context/`, `task/`, `suspense/`,
`routing/`, `serializer/`, `styling/`, `registry/`, `nav/`,
`websocket-client/`, `rich-fetch/`. Each feature folder has a
`browser/` subfolder when there are real-Chromium tests for it.

Cross-package tests that exercise core through the SSR pipeline
or scaffolds live at the repo root in `test/ssr/`,
`test/scaffolds/`, etc. See [`../../agent-docs/testing.md`](../../agent-docs/testing.md).

Run `npm test` from the repo root for node tests, `npm run test:browser`
for the browser tests.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
