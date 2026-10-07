# Runtime: Node and Bun

## What This Covers

- Running a WebJs app on **Node 24+** or **Bun**, and why the app source you write is identical on either.
- The three things that actually differ under the hood (the listener shell, the TypeScript stripper, a handful of built-ins), and the one feature gap (103 Early Hints on Bun).
- Scaffolding a Bun-flavored app and the `bun --bun run dev` / `start` commands.
- Where Deno fits (planned, not yet supported).

Read this when you are choosing a runtime, deploying, debugging a runtime-specific difference, or a scaffold emitted `bun.lock` and you want to know what changed. For the TypeScript stripping mechanics see `typescript.md`. For SQLite, caching, and other built-ins see `built-ins.md`. For the cross-runtime test matrix see `testing.md`.

## The app source is identical

There is nothing runtime-specific in the app you write. The same `app/`, `modules/`, `components/`, and `db/` files run byte-for-byte on Node and Bun, and the bytes the browser fetches are identical either way. WebJs picks the runtime shell at boot through a runtime-neutral seam inside its server (`node:http` on Node, `Bun.serve` on Bun), so nothing in your code branches on the runtime.

Pick a runtime from the deploy target, not the code. Default to Node unless you specifically want Bun's faster listener or a Bun-native deploy image. You do not import a runtime adapter, set a flag in your pages, or handle Node and Bun differently anywhere in application code. The one place the runtime is chosen is the scaffold (`--runtime`) plus the run command (`bun --bun` versus `npm`), covered below.

### Where the difference actually lives

Three seams pick a runtime-specific implementation, all inside the framework, none in your app:

- **The listener.** `startServer` selects the `node:http` request shell on Node and a native `Bun.serve` shell on Bun. Both parse the request, run middleware, dispatch to your routes, and stream the response through the same downstream pipeline, so an SSR page, a server action RPC, and a route handler behave identically.
- **The type stripper.** WebJs serves `.ts` / `.mts` as ES modules by erasing the types in place with no bundler. Those two are the whole set: there is no JSX anywhere in the framework, so a `.tsx` file is not served. On Node that is the built-in `module.stripTypeScriptTypes`; on Bun it is `amaro` (the same engine, byte-identical and position-preserving so stack traces still point at the right line). Either way your TypeScript must be erasable (see `typescript.md`).
- **A few built-ins.** SQLite, hot reload, and WebSockets each bind to the runtime's native primitive (see the table).

## Node vs Bun at a glance

| Area | Node 24+ | Bun |
|---|---|---|
| Install | `npm install` | `bun install` |
| Run | `npm run dev` / `npm run start` | `bun run dev` / `bun run start` |
| Listener | `node:http` shell | native `Bun.serve` (faster on the listening path only, not end-to-end, because SSR render dominates a real page) |
| TS strip | built-in `module.stripTypeScriptTypes` | `amaro` (byte-identical, position-preserving) |
| SQLite | built-in `node:sqlite` + `drizzle-orm/node-sqlite` | built-in `bun:sqlite` + `drizzle-orm/bun-sqlite` |
| Hot reload | restart on change (the `webjs dev` supervisor, #1521) | in place in one long-lived process (`bun --hot` resets the module registry, #1575); only an `instrumentation.*` / `env.*` edit restarts it |
| WebSocket | the `ws` library | native `Bun.serve` + a bridge adapter |
| 103 Early Hints | yes | no (`Bun.serve` has no informational-response API) |
| Dev edit to a page / layout | full reload (the dev restart replaces the process) | refreshes IN PLACE, no reload (#1398) |
| Reverse-proxy headers | `X-Forwarded-Proto` / `X-Forwarded-Host` honored | same |

**`webjs dev` lets an idle host sleep (#1507).** The live-reload stream sends nothing between edits (no keepalive) and is held open only while a tab showing the app is visible, so a sandbox or preview host that suspends on network quiet can suspend with a backgrounded dev tab open. Showing the tab reconnects, and an edit made meanwhile reloads the page on return. A host that counts an OPEN request as activity (a sandbox that suspends on idle) also needs `"webjs": { "dev": { "reloadIdle": 20 } }` (or `WEBJS_DEV_RELOAD_IDLE=20`): after that many seconds with no edit and no interaction the stream closes, and the next interaction, a tab showing, or an embed-bridge host command (`{ source: 'webjs-embed-host', type: 'resume' }`) reopens it. Off by default. Every reconnect also compares the server's state with the state the page on screen was rendered at, so an edit whose reload signal was lost while the stream was being replaced (a host that closes a held stream when it wakes) still reloads the page.

**The in-place dev refresh (#1398) needs the server process to SURVIVE the edit,** which is the whole of the Node-versus-Bun difference in that row. A page or layout never hydrates, so a freshly rendered page is the complete truth for it and the client router can swap it in without a reload, keeping scroll and (for a page edit) the hydrated state of components outside the changed region. The server classifies the changed file and puts the verdict on the live-reload event, so this needs a process that is still alive to do the classifying.

Bun keeps ONE dev server process for the whole session (#1575), so it gets the refresh. `bun --hot` re-runs the CLI on a change; the first run's server owns the process (its listener, live-reload stream, watchers and analysis caches) and a re-run only tells it the module registry was reset, so nothing is started twice and memory stays flat over hundreds of edits (it used to grow about 25 MB an edit until `bun --hot` stopped reloading). The app's modules load through a `Bun.plugin` that reads them fresh, and its `#` imports resolve through the app's own `imports` map, because Bun keeps the old source of a file that was replaced (an atomic save) and a stale directory listing for a new file next to a `*.server.*` module. So `bun --hot` no longer sees app edits itself, and the dev server asks it for a registry reset after an edit to a module some other module imports, a new module, or a `*.server.*` module, all without a process restart. A page, layout or route handler nothing imports needs no reset: the dev re-import is keyed by the file's content, so an unchanged file reuses its loaded module (no new module instance per request) and an edited one is a new import. `instrumentation.*` and `env.*` run once per process, so an edit to one restarts the server on both runtimes. On Node the `webjs dev` supervisor (it replaced `node --watch` in #1521) RESTARTS the server process on a change under `app`, `components`, `modules`, `lib`, or `actions`, or to a root `middleware.{ts,js,mts,mjs}`, and a fresh process holds no record of what changed, so those edits are always a full reload. Two Node cases still refresh in place: an edit OUTSIDE that watched set (`db/schema.server.ts`, a `webjs.dev.watch` content dir), and running `npm run dev -- --no-hot`, which keeps the server in one process on either runtime. An in-place refresh loads the rebuilt stylesheets (a `webjs.dev.regenerate` compile runs on that request) BEFORE it swaps the new markup in, and drops the old sheets only after, so an element that gained a utility class never paints without its rule (#1535; a full reload never had the gap, since a head stylesheet is render-blocking). A component edit is a full reload everywhere by design, because `customElements.define` is once-per-tag and swapping fresh markup onto the old class would be worse than the reload.

After a reset, app code that imports `@webjsdev/server` gets a fresh copy of the package while the first run's server keeps handling requests. Everything the two copies must agree on (the request `auth()`, `cookies()` and `headers()` read, the action signal, the seed collector and action identity, the default cache store, sessions, broadcast clients) lives in process-wide state keyed by `Symbol.for`, so a signed-in page and the `'use server'` queries it calls still see the request after any number of edits (#1590). Before that fix, `auth()` without an explicit request returned `null` in app code after the first edit.

**`webjs dev` and `webjs start` serve the directory they are started in, and refuse anywhere else (#1526).** Run them in the app directory, the one holding `app/`. In a workspace (`apps/web` under a root `package.json` with `workspaces`) that is the member, even when the CLI is hoisted to the root `node_modules`: the hoisted bin and the Bun `--hot` child both keep the directory they were started in. Started where there is no `app/` (the workspace root, or a subdirectory such as `app/` itself), both exit 1 before any `before` step runs, naming the app to start (`cd apps/web && webjs dev`), instead of booting a server that answers 404 for every route.

**`webjs dev` does not stay down (#1521).** The supervisor and the server's own watcher handle every watcher error: a file in a watched dir the dev server cannot read or watch (the 0600 temp file `sed -i` creates when another user runs it, a file removed mid-scan) logs one `file watcher skipped <path> (EACCES)` warning and both keep running, where `node --watch` used to crash and leave the preview dead. Edits that REPLACE a file (`sed -i`, an editor saving through a temp file, an atomic write) are heard every time, however often the same file is replaced (#1529: on Linux under Node the watchers watch each directory, since Node 24's own recursive watcher stopped hearing a file after its first replacement). A server process that crashes is started again on the next file change, or by itself after a backoff of 0.5s growing to 10s for repeated crashes. On Bun the supervisor restarts the server only for an `instrumentation.*` / `env.*` edit (#1575), and otherwise does only the crash recovery. An agent writing files the way an AI editor does (bursts, partial writes, syntax errors then fixes, renames, deletes, atomic writes) is exercised by `scripts/dev-reload-stress.mjs` (`node scripts/dev-reload-stress.mjs <appDir> <url>` against any running app). Stopping `webjs dev` (Ctrl-C, SIGTERM) stops the server child too, and a child whose supervisor was killed outright exits on its own, so nothing is left holding the port.

The 103 Early Hints gap costs only a small first-load latency edge where an edge proxy forwards the 103, never correctness. The `modulepreload` hints still ship in the document head on both runtimes.

Behind a TLS-terminating proxy (Railway, Fly, Render, Cloudflare, nginx), both shells rewrite the request URL from `X-Forwarded-Proto` / `X-Forwarded-Host`, so `ctx.url` in a page, `req.url` in a `route.{js,ts}` handler, and every absolute URL you build from either carry the ORIGINAL scheme and host rather than the internal `http://container` hop. A comma-separated chain (a CDN in front of a load balancer) takes the value closest to the client, only `http` and `https` are accepted as a scheme, and a malformed host is ignored rather than failing the request. This was Bun-only broken before #1090, which shipped an `http://` `og:image` on an HTTPS site.

`WEBJS_NO_TRUST_PROXY=1` is the global switch for "nothing trusted sits in front of this container, stop believing these headers". It is read in ONE place and is ABSOLUTE across every forwarded-header read: the URL rewrite, the HSTS scheme check, the CSRF host resolution, and `clientIp` (`x-forwarded-for` / `cf-connecting-ip` / `x-real-ip`) alike. So `rateLimit({ trustProxy: true })` is inert while the flag is set, falling back to the framework-stamped peer address (its default with no option) and warning once per process. The two CAN be set in contradiction, and the direction rule is what resolves it: the flag only ever SUBTRACTS trust and the per-call option can only add it, so the flag wins. Setting both is a misconfiguration that buckets every visitor behind the proxy onto one key, which is what the warning is for. It used to miss the CSRF host, which read `X-Forwarded-Host` regardless; that gap closed in #1104. Setting it on a genuinely proxied deploy is a misconfiguration, and it now shows up as one, since the legacy no-`Sec-Fetch-Site` CSRF fallback compares `Origin` against the raw `Host` and rejects a legitimate cross-host request. The primary `Sec-Fetch-Site` path, which nearly every real browser request takes, never consults the host at all and is unaffected either way.

One limit worth knowing: the rewrite belongs to `startServer`. An app embedded through `createRequestHandler` gets the `Request` its host adapter built, so that adapter owns the correction, the same boundary that already applies to the trusted client IP.

**Anything SHARED that you derive from `ctx.url` must be keyed by the origin.** Neither Cloudflare nor Railway strips a client-supplied `X-Forwarded-Host`, they forward it, so a hostile value reaches the container through the proxy rather than around it. That is fine for a per-request response (the attacker only poisons their own), and a real problem the moment a response is shared. WebJs handles the cache it owns: the server HTML response cache (`export const revalidate`) folds `url.origin` into every cache key (#1097), so a poisoned body is unreachable from any origin the attacker does not already control. Apply the same rule to anything you cache yourself off `ctx.url`, and note the rule reaches caches WebJs does not own either. A page served `Cache-Control: public` is stored by a CDN under the CDN's OWN key, which does not include `X-Forwarded-Host`, so keying the server cache cannot protect that copy. Derive nothing origin-dependent into a page you make publicly cacheable, or pin the origin from config rather than from `ctx.url`.

## Scaffolding a Bun app

`webjs create <name>` defaults to Node. Add `--runtime bun` for a Bun-flavored app (or run `bun create webjs <name>`, which auto-detects Bun from the invoking package manager):

```sh
webjs create my-app --runtime bun
```

`--runtime` is orthogonal to `--template`, so it re-flavors either full-stack or api. A Bun scaffold emits a `bun.lock`, a pure `oven/bun:1-slim` Dockerfile plus a bun-install CI, and bun-command agent docs. The test, db, and check tooling still runs on Node.

## Running on Bun

A Bun app installs with `bun install` like Node, then its `dev` / `start` / `db` scripts force `bun --bun` so the server itself runs on Bun:

```sh
bun install
bun run dev      # or: bun run start
```

`bun --bun` overrides the `webjs` bin's Node shebang so the server runs on Bun, selecting the native `Bun.serve` listener and `amaro` type stripping. The app's dependencies resolve from `node_modules` exactly as on Node. The `start.before` migrate step (`webjs db migrate`) runs under Bun too. Commit the `bun.lock` for reproducible, offline installs. The scaffold's Bun Dockerfile runs `bun install --production` and serves via `CMD ["bun", "--bun", "run", "start"]`.

**What the dev watcher ignores.** On both runtimes a change to a file nothing serves never reloads the page: `*.log`, `coverage/`, `.cache/`, `test-results/`, `playwright-report/`, and anything the app's `.gitignore` ignores (except `.env*`). So `npm run dev > dev.log` in the app folder is safe.

## Deploying either runtime

Production runs `npm run start` (Node) or `bun run start` (Bun), which serves the source directly with no build step. Both speak plain HTTP/1.1, so put a reverse proxy or platform edge in front for TLS and HTTP/2 (production perf leans on HTTP/2 multiplexing plus `modulepreload` hints, not a bundle). A `start.before` migrate runs first on both runtimes.

The scaffold ships a matching Dockerfile per runtime: a Node image for the default, a pure `oven/bun:1-slim` image for `--runtime bun`. Both install production dependencies only and leave the package manager's cache out of the image. What the boot runs is a production dependency for that reason: `drizzle-kit` (the `start.before` migrate) and, on a UI app, `@tailwindcss/cli` + `tailwindcss` (the CSS compile). Keep a tool the boot runs in `dependencies`; one moved to `devDependencies` is missing from the image and the boot fails. Commit the lockfile the runtime uses (`package-lock.json` for Node, `bun.lock` for Bun) so the deploy install is reproducible and offline.

## SQLite busy_timeout

Both `node:sqlite` and `bun:sqlite` default `busy_timeout` to 0, so a contended write throws `database is locked` immediately. The generated connection sets `PRAGMA busy_timeout = 5000` plus `PRAGMA journal_mode = WAL` on the raw client before Drizzle wraps it, on both runtime branches, so you get a sane 5-second wait instead of an instant failure. This is already wired in the scaffold's `db/connection.server.ts`.

## Postgres pool (`--db postgres`)

A `--db postgres` app opens one `pg` Pool in `db/connection.server.ts`. It holds no session state between queries (no `SET`, `LISTEN`, or advisory lock kept across them), so the same code works behind a transaction pooler. Idle connections close after 10 seconds, a connection attempt gives up after 5 seconds (a database that is down fails the request instead of hanging it), `DATABASE_POOL_MAX` caps the pool (default 10), and an idle connection the server drops (a restart or failover) is logged rather than crashing the process. Keep it that way: do not add `SET` statements or session-scoped features to app code.

## Verifying a runtime-sensitive change

Most app code needs no runtime-specific testing, because it does not touch a runtime seam. If you DO change something runtime-sensitive (the serializer, a stream, `node:crypto`, low-level request handling, anything that behaves differently under `Bun.serve` versus `node:http`), prove it on both runtimes. The Node suite is the source of truth, and an additive Bun matrix re-runs the runtime-sensitive tests under Bun. See `testing.md` for the cross-runtime matrix and the `test/bun/**` assertions.

For an ordinary feature (a page, an action, a component) a single-runtime test is enough, since the source is identical on either runtime.

## Future runtimes

The listener seam is runtime-neutral, so a `Deno.serve` shell (or an embedded adapter) slots in at the same point when added. Edge runtimes with no filesystem are a separate, later target. Until then, treat Deno as planned, not supported, and build on Node or Bun.
