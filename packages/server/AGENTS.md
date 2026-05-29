# AGENTS.md for @webjsdev/server

The webjs **server runtime**: dev + prod request handling, SSR,
file-based router, server actions (RPC scanner + endpoint), auth,
session, cache store, rate limiting, WebSocket upgrade, CSRF,
compression, build helper, convention validator.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjsdev/server`.

## Role

Two entry shapes:

- `startServer({ appDir, port, dev })`: owns the HTTP server, used
  by the CLI's `webjs dev` / `webjs start`.
- `createRequestHandler({ appDir })`: returns `{ handle(req): Response }`
  for embedding under Express / Fastify / Bun / Deno / edge.

Both go through the same pipeline: `dev.js` (file serving + TS
transform) → `router.js` (file → route table) → `ssr.js` (page render
with metadata, Suspense, streaming) for HTML, or `api.js` /
`actions.js` for JSON / RPC, or `websocket.js` for `WS` upgrade.

## Module map (`src/`)

| File | What it owns |
|---|---|
| `dev.js` | The request handler. File serving, TypeScript stripping (Node 24+ built-in `module.stripTypeScriptTypes`, backed by the `amaro` package; non-erasable syntax fails at strip time with a 500), **server-file guardrail**, live reload via SSE |
| `router.js` | Scans `app/` once, builds the route table, matches pages + APIs (`buildRouteTable`, `matchPage`, `matchApi`) |
| `ssr.js` | SSR pipeline: nested layouts, metadata → `<head>`, Suspense streaming, error boundaries |
| `actions.js` | `.server.js` / `.server.ts` scanner. Generates RPC stubs for browser-bound imports; exposes RPC endpoints; honours `expose()` |
| `api.js` | `route.ts` `GET` / `POST` / `PUT` / `DELETE` handler dispatch |
| `auth.js` | `createAuth()` with Credentials / Google / GitHub providers; JWT signing |
| `session.js` | `Session` class, cookie + store-backed storage (`cookieSession`, `storeSession`) |
| `cache.js` | Pluggable cache store: `memoryStore` / `redisStore`; `setStore` / `getStore` |
| `cache-fn.js` | `cache(key, fn, { ttl })` query-caching helper + `invalidate()` |
| `rate-limit.js` | `rateLimit({ window, max })` middleware factory |
| `csrf.js` | Double-submit CSRF protection (server-action endpoints) |
| `websocket.js` | WS upgrade handling: invokes `WS` export from `route.ts` |
| `broadcast.js` | `broadcast(topic, msg)` for fan-out messaging |
| `context.js` | AsyncLocalStorage per-request context (`getRequest`, `withRequest`, `headers`, `cookies`) |
| `serializer.js` | Default serializer + `setSerializer` / `getSerializer` for the RPC wire format |
| `json.js` | `json()` + `readBody()` content-negotiation helpers |
| `check.js` | Convention validator backing `webjs check`. Rules include `no-json-data-files`, `no-non-erasable-typescript` |
| `vendor.js` | Resolve bare-specifier npm deps via jspm.io. Reads `.webjs/vendor/importmap.json` if present (committed pin file), else calls `api.jspm.io/generate` at boot. Backs the `webjs vendor pin / unpin / list / audit / outdated / update` CLI surface plus the `--from <provider>` (jspm, jsdelivr, unpkg, skypack) and `--download` modes. `--download` mode also serves cached bundle files from `.webjs/vendor/`. |
| `module-graph.js` | Dependency graph for transitive preload hints |
| `importmap.js` | Browser import-map builder. `setCoreInstall(coreDir, distMode)` binds the importmap to the resolved `@webjsdev/core` install and runs `buildCoreEntries()`, which reads the package's `package.json` and derives one importmap line per exported subpath from its `exports` field, picking the `default` (`dist/webjs-core-*.js`) condition in dist mode and the `source` (`src/*.js`) condition otherwise. `dev.js` calls `setCoreInstall` at boot based on `existsSync(coreDir/dist/webjs-core.js) && existsSync(coreDir/dist/webjs-core-browser.js)`. The bare `@webjsdev/core` specifier always points at the BROWSER entry (`index-browser.js` or `dist/webjs-core-browser.js`); the slim entry drops `renderToString`, `renderToStream`, `expose`, `getExposed`, and `setCspNonceProvider` so server-only bytes do not ride the wire. Node-side consumers resolve via the package.json exports and still get the full `index.js`. |
| `component-scanner.js` | Maps every webjs component class to its browser-visible URL |
| `component-elision.js` | Static analyser deciding which display-only component modules can be elided from the browser, plus the serve-time side-effect-import stripper. Conservative denylist of interactivity signals (single source of truth) |
| `js-scan.js` | Shared lexical scanners (`redactStringsAndTemplates`, `extractWebComponentClassBodies`, `matchClosingBrace`) used by `check.js` and `component-elision.js` |
| `fs-walk.js` | Async recursive directory walker |
| `logger.js` | `defaultLogger` (JSON-shaped in prod, pretty in dev) |

## Public exports

See [`index.js`](./index.js) and [`package.json` exports](./package.json).
The `./check` subpath is exported separately so the CLI's `webjs check`
can load it without booting the full server.

## Package-specific invariants

1. **Source-file branch is gated by the browser-bound module graph.**
   `dev.js` walks the import graph from every page / layout / error /
   loading / not-found / component entry at boot (and on every
   `fs.watch` rebuild), producing `state.browserBoundFiles`. The
   source-file branch in `handle()` only serves paths whose resolved
   absolute file is in that Set; everything else 404s before any
   filesystem operation. Same model as Next.js's bundler manifest,
   derived statically at boot instead of via a build step. The
   `module-graph.js` module exports `reachableFromEntries` as the
   reusable BFS helper.
   The walk stops AT `.server.{js,ts,mjs,mts}` boundaries: the
   server file itself stays in the Set (its URL yields the stub via
   invariant 2), but its outgoing edges are not followed. Files
   imported only by a server file are never legitimately fetched by
   the browser; including them would be over-permissive. The walker
   enters `_*` directories (the `_private` / `_components` /
   `_lib` convention is a router-ignore, not a graph-ignore).
2. **Server-file source is unreachable from the browser.** `dev.js`
   re-verifies every in-graph JS/TS request against the path-level
   server-file predicate (filename suffix `.server.{js,ts,mjs,mts}`)
   before serving bytes. A server file ALWAYS responds with a
   generated stub, never its source, regardless of route-index state,
   FS race conditions, or developer error. The stub variant depends
   on whether the file declares `'use server'`: a server action (with
   the directive) returns the RPC stub; a server-only utility
   (without) returns a throw-at-load stub. The `'use server'`
   directive WITHOUT the extension is silently ignored at the runtime
   layer (a `webjs check` lint rule flags it instead) and the file
   serves as plain source. The guardrail runs INSIDE the graph gate
   as defense in depth (a file reaches the guardrail only if a client
   import names it; the graph then re-checks the extension). Regression
   tests live at `test/guardrails/server-file-guardrail.test.js`.
3. **File router has no manifest.** `buildRouteTable()` walks `app/`
   at boot; route invalidation in dev is via `fs.watch` (Node 24+ built-in, recursive) → SSE.
4. **One pluggable cache store, four built-in consumers.** `cache.js`
   is shared by `cache-fn.js`, `session.js` (store-backed), and
   `rate-limit.js`. A single `setStore(redisStore({…}))` call at
   startup switches all of them to Redis.
5. **`webjs check` is part of this package** (`src/check.js`). New
   rules go there; tests in `test/check.test.js`.
6. **No `node:*` imports in code reachable from the browser.** The
   browser bundle is built from `@webjsdev/core` only.
7. **Display-only component AND inert-route elision is conservative.**
   `analyzeElision` in `component-elision.js` computes, at boot and on
   every rebuild, (a) the set of component modules that are purely
   display-only, and (b) the set of page/layout route modules that are
   inert (do no client work even transitively). The serving branch in
   `dev.js` strips side-effect imports of display-only components from the
   browser-served source; `ssr.js` drops inert page/layout modules from
   the boot script's `moduleUrls` entirely, so a fully-static route ships
   zero application JS. Preload hints and importmap entries for elided
   modules drop too. This is progressive-enhancement-safe by construction:
   the SSR'd HTML is the baseline, swap markers are static comments, and
   navigation/forms fall back to native browser behavior, so removing
   inert JS never changes behavior.
   The analysis is a denylist that biases toward shipping: a false
   "display-only" verdict breaks the page, a false "interactive" verdict
   only misses an optimization, so anything ambiguous ships. The signal
   lists in `component-elision.js` are the single source of truth and
   must grow whenever core adds an interactivity surface (enforced by
   `test/elision/lifecycle-coverage.test.js`). Only side-effect imports
   are stripped; binding imports are always preserved. Tests live in
   `test/elision/`. The model's one blind spot is cross-module
   observation of an elided element's registration (a shipping
   `whenDefined('tag')`, an upgraded-member read off `querySelector`, an
   `instanceof`, or a CSS `tag:defined` rule), since elision skips the
   `customElements.define`. Static analysis cannot see these (dynamic tag
   strings, external CSS), so it is documented as an author-facing caveat
   in `agent-docs/components.md` rather than detected: such a component is
   interactive in practice and needs an interactivity signal.

## Tests

Tests for this package live in **`packages/server/test/`**,
organised by feature: `routing/`, `api/`, `actions/`, `auth/`,
`session/`, `cache/`, `rate-limit/`, `csrf/`, `cors/`,
`broadcast/`, `websocket/`, `check/`, `guardrails/`,
`module-graph/`, `scanner/`, `elision/`, `vendor/`, `env/`, `dev/`,
`forwarded/`.

Cross-package tests that exercise the SSR pipeline, scaffolds,
or full app boots live at the repo root in `test/ssr/`,
`test/scaffolds/`, `test/examples/blog/`, etc. See
[`../../agent-docs/testing.md`](../../agent-docs/testing.md).

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
