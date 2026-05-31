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
| `component.js` | `WebComponent` base class: lifecycle, properties, reactive accessors, light-vs-shadow DOM, scheduling, slot host wiring |
| `render-server.js` | `renderToString`, `renderToStream` (async, with Suspense streaming), SSR slot substitution in `injectDSD` |
| `render-client.js` | Client-side patcher + hydration; the only file that touches `document`. Also discovers and binds light-DOM slot parts |
| `slot.js` | Light-DOM `<slot>` runtime: `HTMLSlotElement` polyfills (`assignedNodes`, `assignedElements`, `slotchange`), projection scheduling, MutationObserver, first-wins resolution, fallback swap, pending-fragment recovery |
| `directives.js` | `unsafeHTML`, `live` (and `isUnsafeHTML` / `isLive`) |
| `repeat.js` | `repeat(items, keyFn, templateFn)` for keyed list reconciliation |
| `suspense.js` | `Suspense()` boundary primitive |
| `context.js` | Context Protocol: `createContext`, `ContextProvider`, `ContextConsumer`, `ContextRequestEvent` |
| `task.js` | `Task` / `TaskStatus` controller for async data in components |
| `router-client.js` | Turbo Drive–style client router; entry: `enableClientRouter` / `navigate` |
| `registry.js` | Custom-element bookkeeping (`register`, `lookup`, `allTags`, `tagOf`, `isLazy`, `primeModuleUrl`) |
| `lazy-loader.js` | IntersectionObserver-based lazy module loading for `static lazy = true` |
| `nav.js` | `notFound()`, `redirect()` sentinels for page/action handlers |
| `expose.js` | `expose('METHOD /path', fn)` REST endpoint tagging |
| `escape.js` | HTML attribute / text escaping (the only sanitiser) |
| `rich-fetch.js` | Content-negotiated fetch helper |
| `websocket-client.js` | `connectWS()` with auto-reconnect |
| `serialize.js` | Wire-format primitives (Date/Map/Set/BigInt/cycles…) used by RPC |
| `testing.js` | `fixture`, `waitForUpdate`, `click`, `shadowQuery`, `shadowQueryAll` |

## Public exports (re-exported from `index.js`)

See the [package.json `exports` field](./package.json) for subpaths:
`@webjsdev/core/client`, `/server`, `/component`, `/registry`,
`/client-router`. Everything else is exposed via the main `index.js`
re-exports. Keep this list in sync if you add or remove a barrel
export.

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
