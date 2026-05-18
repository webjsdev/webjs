# AGENTS.md for @webjskit/core

The webjs **core runtime**: `html` / `css` tagged templates, the
`WebComponent` base class, isomorphic renderers, directives, the
client router, the `Task` controller, the Context Protocol, and
testing helpers.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules)
live in the **framework root [`../../AGENTS.md`](../../AGENTS.md)**
and apply here. Read that first.

This file only covers what's specific to `@webjskit/core`.

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
| `component.js` | `WebComponent` base class: lifecycle, properties, reactive accessors, light-vs-shadow DOM, scheduling |
| `render-server.js` | `renderToString`, `renderToStream` (async, with Suspense streaming) |
| `render-client.js` | Client-side patcher + hydration; the only file that touches `document` |
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
`@webjskit/core/client`, `/server`, `/component`, `/registry`,
`/client-router`. Everything else is exposed via the main `index.js`
re-exports. Keep this list in sync if you add or remove a barrel
export.

## Package-specific invariants

1. **No build step.** `.js` only, plain JSDoc types. The source you
   read in `node_modules/@webjskit/core/src/` is what runs.
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

## Tests

Unit tests for this package live in the **repo root `test/`**
(workspace-linked, single Node test runner). Filenames:
`html.test.js`, `css.test.js`, `component.test.js`, `render-server.test.js`,
`render-client.test.js`, `router-client.test.js`, `task.test.js`,
`context.test.js`, `directives.test.js`, `repeat.test.js`,
`suspense.test.js`, `testing.test.js`, `lazy-loader.test.js`,
`websocket-client.test.js`, etc.

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
