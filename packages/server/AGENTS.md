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
| `ssr.js` | SSR pipeline: nested layouts, metadata → `<head>`, Suspense streaming, error boundaries. `ssrPage` accepts `actionData` (put on `ctx.actionData` for the page + layouts) and `status` (default 200; the page-action re-render passes 422) |
| `page-action.js` | Page server actions (#244): `loadPageAction` reads a page module's optional `action` export, `runPageAction` parses the form body, runs the action, and maps the `ActionResult` to a response (303 PRG on success, 422 re-render with `actionData` on failure, honoring thrown `redirect()`/`notFound()`). `dev.js` routes a non-GET/HEAD page request here only when the page exports `action`, wrapped in the page's segment middleware |
| `actions.js` | `.server.js` / `.server.ts` scanner. Generates RPC stubs for browser-bound imports; exposes RPC endpoints; honours `expose()` |
| `api.js` | `route.ts` `GET` / `POST` / `PUT` / `DELETE` handler dispatch |
| `auth.js` | `createAuth()` with Credentials / Google / GitHub providers; JWT signing |
| `session.js` | `Session` class, cookie + store-backed storage (`cookieSession`, `storeSession`) |
| `cache.js` | Pluggable cache store: `memoryStore` / `redisStore`; `setStore` / `getStore` |
| `cache-fn.js` | `cache(key, fn, { ttl })` query-caching helper + `invalidate()` |
| `rate-limit.js` | `rateLimit({ window, max })` middleware factory |
| `cors.js` | `cors({ origin, credentials, methods, allowedHeaders, exposedHeaders, maxAge })` middleware factory for route handlers / `middleware.js`. Shared origin-resolution + header-building core (`resolveOrigin` / `applyCorsHeaders`) reused by the `expose()` REST path in `actions.js`. Enforces the CORS-spec rule that `credentials: true` forbids a wildcard ACAO (narrows `*` to the reflected origin). |
| `csrf.js` | Double-submit CSRF protection (server-action endpoints) |
| `websocket.js` | WS upgrade handling: invokes `WS` export from `route.ts` |
| `broadcast.js` | `broadcast(topic, msg)` for fan-out messaging |
| `context.js` | AsyncLocalStorage per-request context (`getRequest`, `withRequest`, `headers`, `cookies`). Also wires the server-side `cspNonce()` provider: returns the per-request nonce `setCspNonce` stored (minted when CSP is on, #233), else falls back to parsing an inbound `Content-Security-Policy` request header |
| `csp.js` | CSP nonce minting + `Content-Security-Policy` header building (#233). `readCspConfig` normalizes the `webjs.csp` package.json key (off by default; `true` = strict default policy, object = custom directives + `reportOnly`); `mintNonce` is the per-request CSPRNG nonce; `buildCspHeader` substitutes the nonce into the policy. Plugs into the #232 `applySecurityHeaders` seam in `dev.js`'s `handle()` |
| `serializer.js` | Default serializer + `setSerializer` / `getSerializer` for the RPC wire format |
| `json.js` | `json()` + `readBody()` content-negotiation helpers |
| `check.js` | Convention validator backing `webjs check`. Correctness-only; rules include `no-browser-globals-in-render`, `no-non-erasable-typescript` |
| `vendor.js` | Resolve bare-specifier npm deps. `resolveVendorImports(appDir, getBareImports)` reads `.webjs/vendor/importmap.json` if present (committed pin file) and short-circuits BEFORE running the bare-import scan; only when there is no pin file does it invoke the `getBareImports` thunk (the whole-app `scanBareImports` walk) and call `api.jspm.io/generate`. So a pinned app does no vendor static analysis at boot (runtime-first); the elision-aware prune of a pinned map (`prunePinToReachable`) runs lazily in `ensureReady`, not at boot. Backs the `webjs vendor pin / unpin / list / audit / outdated / update` CLI surface plus the `--from <provider>` (jspm, jsdelivr, unpkg, skypack) and `--download` modes. `--download` mode also serves cached bundle files from `.webjs/vendor/`. |
| `module-graph.js` | Dependency graph for transitive preload hints. Both walks (`transitiveDeps` for preloads, `reachableFromEntries` for the auth gate) stop at `.server.*` boundaries, so a preload set is always a subset of the servable set. The import scanner masks string / template-literal content (`redactStringsAndTemplates`) so an `import`/`export … from` shown as example code inside an `html\`\`` template is not counted as a real edge. |
| `importmap.js` | Browser import-map builder. `setCoreInstall(coreDir, distMode)` binds the importmap to the resolved `@webjsdev/core` install and runs `buildCoreEntries()`, which reads the package's `package.json` and derives one importmap line per exported subpath from its `exports` field, picking the `default` condition in dist mode and the `source` (`src/*.js`) condition otherwise. In dist mode the browser surface is ONE self-contained bundle: the `exports` `default` for the always-load browser subpaths (`/directives`, `/context`, `/task`, `/client-router`) all point at `dist/webjs-core-browser.js`, so those entries plus the bare specifier collapse onto that single file (each import picks its named exports from it) instead of a fan of per-subpath bundles + code-split chunks. `/lazy-loader` keeps its own file (on-demand). In src/dev mode each subpath stays granular (`src/*.js`) since there is no bundle to collapse into. `dev.js` calls `setCoreInstall` at boot based on `existsSync(coreDir/dist/webjs-core.js) && existsSync(coreDir/dist/webjs-core-browser.js)`. The bare `@webjsdev/core` specifier always points at the BROWSER entry (`index-browser.js` or `dist/webjs-core-browser.js`); the slim entry drops `renderToString`, `renderToStream`, `expose`, `getExposed`, and `setCspNonceProvider` so server-only bytes do not ride the wire. Node-side consumers resolve via the package.json exports and still get the full `index.js`. |
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
   loading / not-found / component entry to produce
   `state.browserBoundFiles`. This is computed **lazily on the first
   request** (in `ensureReady()`, memoized) rather than at boot, and
   re-derived after each `fs.watch` rebuild; `handle()` awaits
   `ensureReady()` before the source-file branch runs, so the Set is
   always populated by the time it is read. The source-file branch only
   serves paths whose resolved absolute file is in that Set; everything
   else 404s before any filesystem operation. Same model as Next.js's
   bundler manifest, derived statically (now on first request, not at
   boot). The `module-graph.js` module exports `reachableFromEntries`
   as the reusable BFS helper.
   The walk stops AT `.server.{js,ts,mjs,mts}` boundaries: the
   server file itself stays in the Set (its URL yields the stub via
   invariant 2), but its outgoing edges are not followed. Files
   imported only by a server file are never legitimately fetched by
   the browser; including them would be over-permissive. The walker
   enters `_*` directories (the `_private` / `_components` /
   `_lib` convention is a router-ignore, not a graph-ignore).
   The preload-hint walk (`transitiveDeps`) applies the SAME
   `.server.*` stop, so the framework never emits a `modulepreload`
   for a file the gate then 404s (the preload set is a subset of the
   servable set). Edges themselves are scanned off a string/template
   redaction mask, so an `import`/`export … from` printed as example
   code inside an `html\`\`` template (the docs site does this) is not
   mistaken for a real dependency.
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
   The route table is the only eager ANALYSIS artifact (a cheap directory
   scan, no code reads). Boot does two other trivial loads, plus a third
   only when the app commits a vendor pin, none of which read app source or
   make a network call. The two unconditional ones are `setCoreInstall`
   (one read of `@webjsdev/core`'s OWN `package.json` to seed the browser
   import map, in `importmap.js`) and the `.env` auto-load (Node's
   `process.loadEnvFile` into `process.env`, before any server-only module is
   imported). The conditional fourth item is the **pinned vendor read**: when
   `.webjs/vendor/importmap.json` exists (`hasVendorPin`), boot reads that
   committed, deterministic config file (a local read, no jspm call),
   `setVendorEntries`, and `publishBuildId()`, so a pinned process advertises
   a stable `data-webjs-build` from its first response and a freshly-deployed
   pinned instance is detected as a new deploy by old-deploy clients with zero
   warmup window. So the complete list of eager boot work is: the route-table
   scan, the core `package.json` read, the `.env` load, and (pinned apps only)
   the committed vendor importmap read. Everything else (module graph,
   browser-bound gate, action index, middleware, elision, and the UNPINNED
   vendor resolve, which needs the bare-import scan plus a jspm call) is built
   lazily on the first request via `ensureReady()` in `dev.js`, so boot reads
   no app source, executes no server module, walks no graph, and makes no
   network call.
   `ensureReady()` is single-flighted and memoized; the handler exposes
   `warmup()` (which calls it), and `startServer` fires `warmup()`
   fire-and-forget once the HTTP server is listening, so the analysis runs
   in the background ahead of a real first request without delaying
   readiness. `warmup()` is a single best-effort kick: a failure is caught and
   logged, not thrown, and whatever failed simply re-runs on the next request
   or readiness probe. There is NO internal retry timer or backoff; the
   platform's traffic and probes are the retry loop. Analysis runs in two
   stages: a deterministic stage (graph, scan, gate, action index, middleware,
   elision) and a vendor stage (a pinned app reads the committed importmap and
   prunes it to the elision-reachable specifiers via `prunePinToReachable`, so it
   serves the same map an unpinned app would; an unpinned app auto-fetches jspm
   with the elision-excluded scan). **Readiness gates on a FULLY warm instance:
   the deterministic stage AND the first vendor attempt both completed (note:
   completed, not necessarily succeeded).** A readiness-gated platform (Railway
   `healthcheckPath`, a k8s readinessProbe) therefore admits traffic only after
   the importmap build id is published (vendor resolved) or definitively empty
   (a bounded vendor failure), never DURING the vendor-resolution window. This
   is what makes `warmup()` actually protect users: the prior instance keeps
   serving until the new one is fully warm, so a real request lands on a warm
   instance with a stable build id instead of racing the resolve. The first
   vendor attempt is bounded (the jspm fetch timeout in `vendor.js`), so an
   offline or CDN-degraded app still becomes ready shortly after that timeout
   (degraded but reload-safe, see the build-id note below), preserving the boot
   resilience. Readiness gates on the FIRST attempt only: a TRANSIENT vendor
   failure (network / timeout / jspm 5xx) still flips readiness, then is
   re-attempted on the next `ensureReady` call, non-blocking, with a `vendorGen`
   guard so a rebuild cannot let a stale resolve win. A permanent unresolvable
   (jspm 401 for a private / workspace / server-only dep) reports ok and is
   tolerated. `ensureReady()` logs a one-line per-pass timing breakdown so a
   slow first request is diagnosable.
   **Build-id stability (post-deploy reload safety).** The client router reads
   `data-webjs-build` / the `X-Webjs-Build` header to detect a real deploy and
   hard-reload (so a partial swap never resolves modules against a stale
   importmap). That id is the PUBLISHED build id (`publishedBuildId`), promoted
   only when the importmap is authoritatively final: at boot for a pinned app,
   or after the first successful vendor resolve for an unpinned one. While the
   map is still warming it stays empty, and the router treats an empty id on
   either side as "version unknown" and never hard-reloads against it. So the
   warmup window can never flip the id from empty to a value mid-session and
   trigger a destructive reload that wipes a half-filled form. A real
   cross-deploy still reloads, because both sides then carry non-empty,
   differing ids. Concurrent early requests await the in-flight first resolve
   (no bypass), so the first served response already carries the final map.
   **Probes:** `/__webjs/health` is liveness (always 200 once listening);
   `/__webjs/ready` is readiness (503 until fully warm, i.e. analysis plus the
   first vendor attempt, then 200). An optional `readiness.{js,ts}` at the app
   root default-exports an async check that `/ready` runs once warm (returning
   `false` or throwing yields 503), so readiness can gate on live dependency
   health (e.g. a DB ping) that the static analysis cannot see. Both are
   answered in `handle()` BEFORE `ensureReady`, so a probe never blocks on the
   analysis.
   **Framework-internal static assets are also served before `ensureReady`.**
   `tryServeFrameworkStatic` (called in `handle()` right after the probes)
   serves `/__webjs/core/*` (the `@webjsdev/core` runtime, resolved from the
   boot-set `coreDir`), `/__webjs/reload.js`, and downloaded `/__webjs/vendor/*`
   bundles without awaiting the analysis or the vendor importmap, because they
   depend on neither. Otherwise a cold instance gated the core runtime (on every
   page's boot path) behind the first vendor resolve, stalling first
   interactivity site-wide for up to the jspm timeout (#190). Like the probes,
   these bypass app middleware (`state.middleware` is not even loaded until
   `ensureReady` completes); that is correct, since they are framework
   infrastructure the app needs to function, not app routes. `handleCore` keeps
   a fallback call so it stays correct if entered directly.
4. **One pluggable cache store, four built-in consumers.** `cache.js`
   is shared by `cache-fn.js`, `session.js` (store-backed), and
   `rate-limit.js`. A single `setStore(redisStore({…}))` call at
   startup switches all of them to Redis.
5. **`webjs check` is part of this package** (`src/check.js`). New
   rules go there; tests in `test/check.test.js`.
6. **No `node:*` imports in code reachable from the browser.** The
   browser bundle is built from `@webjsdev/core` only.
7. **Display-only component AND inert-route elision is conservative.**
   `analyzeElision` in `component-elision.js` computes, lazily on the
   first request (inside `ensureReady()`) and again after each rebuild,
   (a) the set of component modules that are purely
   display-only, and (b) the set of page/layout route modules that are
   inert (do no client work even transitively). The serving branch in
   `dev.js` strips side-effect imports of display-only components from the
   browser-served source; `ssr.js` drops inert page/layout modules from
   the boot script's `moduleUrls` entirely, so a fully-static route ships
   zero application JS. Preload hints for elided modules drop too, and their
   importmap entries drop too, for a live-resolved AND a pinned app alike. The
   live path excludes elided components from the bare-import scan; a committed
   `.webjs/vendor/importmap.json` is applied verbatim at boot (for a stable
   build id) and then, once elision is known, pruned to the specifiers still
   reachable from non-elided modules via `prunePinToReachable` in `ensureReady`
   (issue #197). So a pinned app and an unpinned app serve the SAME map. The
   advertised build id stays the boot-published hash of the committed pin (a
   deploy fingerprint) and is not re-published, so only the served map shrinks
   and the warmup window cannot drift the id.
   This is progressive-enhancement-safe by construction:
   the SSR'd HTML is the baseline, swap markers are static comments, and
   navigation/forms fall back to native browser behavior, so removing
   inert JS never changes behavior.
   The whole pass is gated by the project-level `webjs.elide` switch in
   `package.json` (`readElideEnabled` in `dev.js`, re-read on every
   rebuild). `{ "webjs": { "elide": false } }` skips `analyzeElision`
   entirely, leaving both sets empty so nothing is stripped and the
   importmap keeps every vendor dep. The switch is pure opt-out (default
   enabled); any value other than the literal `false` keeps elision on.
   A `WEBJS_ELIDE` env override wins over the `package.json` switch
   (`0`/`false`/`off`/`no` force off, `1`/`true`/`on`/`yes` force on, any
   other value falls through), the deploy-time escape hatch and the seam
   the differential elision test uses to render one app on and off in a
   single process. The invariant that elision never changes observable
   output is verified differentially by
   `test/elision/differential-elision.test.js` (SSR layer) plus the
   `differential elision` e2e cases: the same corpus routes rendered on vs
   off must yield identical SSR HTML (modulo the boot-script + modulepreload
   JS set) and identical post-hydration DOM and behaviour, so any wrong-strip
   fails the diff regardless of its cause (this is the continuous guard for
   the #169 / #179 bug classes).
   The analysis is a denylist that biases toward shipping: a false
   "display-only" verdict breaks the page, a false "interactive" verdict
   only misses an optimization, so anything ambiguous ships. The signal
   lists in `component-elision.js` are the single source of truth and
   must grow whenever core adds an interactivity surface (enforced by
   `test/elision/lifecycle-coverage.test.js`). Only side-effect imports
   are stripped; binding imports are always preserved. Tests live in
   `test/elision/`. Cross-module observation of an elided element's
   registration (a shipping `whenDefined('tag')`, a CSS `tag:defined`
   rule, or an `instanceof TheClass`) would break if the component were
   elided, since elision skips the `customElements.define`. The three
   statically visible forms ARE detected (`WHEN_DEFINED_RE`,
   `TAG_DEFINED_RE`, `INSTANCEOF_RE` in `component-elision.js`, the last
   mapped to a tag via the component class name): any graph-reachable
   module observing a tag forces that component to ship. Verdict-safe (it
   only ever ships more). The residual caveat is the part static analysis
   cannot see (a dynamic tag string, a `:defined` rule in an external
   stylesheet outside the module graph), documented in
   `agent-docs/components.md`; for those, add an interactivity signal.

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
