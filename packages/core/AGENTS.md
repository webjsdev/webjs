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
   Published-to-npm copies ship pre-built `dist/webjs-core-*.js`
   bundles alongside `src/`; the browser fetches the bundles when
   `dist/` is present (`scripts/build-framework-dist.js` is wired
   to the `prepare` lifecycle so `npm publish` always rebuilds).
   Only `@webjsdev/core` has this dual-layout. Other framework
   packages stay source-only.
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
6. **`<slot>` works identically in light and shadow DOM.** Light-DOM
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
