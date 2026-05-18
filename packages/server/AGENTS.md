# AGENTS.md for @webjskit/server

The webjs **server runtime**: dev + prod request handling, SSR,
file-based router, server actions (RPC scanner + endpoint), auth,
session, cache store, rate limiting, WebSocket upgrade, CSRF,
compression, build helper, convention validator.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjskit/server`.

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
| `dev.js` | The request handler. File serving, TypeScript stripping (Node 24+ built-in `module.stripTypeScriptTypes`, backed by the `amaro` package, with an esbuild fallback for non-erasable syntax), **server-file guardrail**, live reload via SSE |
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
| `check.js` | Convention validator backing `webjs check`. New rule: `no-json-data-files` |
| `vendor.js` | Auto-bundle bare-specifier npm deps for the browser |
| `module-graph.js` | Dependency graph for transitive preload hints |
| `importmap.js` | Browser import-map builder |
| `component-scanner.js` | Maps every webjs component class to its browser-visible URL |
| `fs-walk.js` | Async recursive directory walker |
| `logger.js` | `defaultLogger` (JSON-shaped in prod, pretty in dev) |

## Public exports

See [`index.js`](./index.js) and [`package.json` exports](./package.json).
The `./check` subpath is exported separately so the CLI's `webjs check`
can load it without booting the full server.

## Package-specific invariants

1. **Server-file source is unreachable from the browser.** `dev.js`
   re-verifies every JS/TS request against the server-file predicate
   (filename suffix `.server.{js,ts}` OR `'use server'` directive in
   the first 5 lines) before serving bytes. A server file ALWAYS
   responds with a generated RPC stub, never its source, regardless
   of route-index state, FS race conditions, or developer error.
   Regression tests: `test/server-file-guardrail.test.js`.
2. **File router has no manifest.** `buildRouteTable()` walks `app/`
   at boot; route invalidation in dev is via chokidar → SSE.
3. **One pluggable cache store, four built-in consumers.** `cache.js`
   is shared by `cache-fn.js`, `session.js` (store-backed), and
   `rate-limit.js`. A single `setStore(redisStore({…}))` call at
   startup switches all of them to Redis.
4. **`webjs check` is part of this package** (`src/check.js`). New
   rules go there; tests in `test/check.test.js`.
5. **No `node:*` imports in code reachable from the browser.** The
   browser bundle is built from `@webjskit/core` only.

## Tests

Unit tests live in the **repo root `test/`**. Server-flavoured ones:
`router.test.js`, `ssr.test.js`, `actions.test.js`, `auth.test.js`,
`session.test.js`, `cache.test.js`, `rate-limit.test.js`,
`csrf.test.js`, `websocket.test.js`, `check.test.js`,
`server-file-guardrail.test.js`, `serializer.test.js`, `vendor.test.js`,
etc.

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
