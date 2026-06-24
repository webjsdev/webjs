# Runtime: Node and Bun (and future Deno)

webjs runs on **Node 24+** or **Bun**. The app source is identical on either; only
the listener shell, the type stripper, and a few built-ins differ. The selection
is a runtime-neutral seam in `startServer` (it picks the `node:http` shell on
Node and the `Bun.serve` shell on Bun), designed to also host a future
`Deno.serve` / embedded adapter. Deno is planned, not yet supported. The
user-facing reference is the docs-site page `/docs/runtime`; keep the two in sync.

## Node vs Bun

| Area | Node 24+ | Bun |
|---|---|---|
| Install | `npm install` (required) | optional (zero-install via Bun auto-install) |
| Run | `npm run dev` / `npm run start` | `bun run dev` / `bun run start` |
| Listener | `node:http` shell | native `Bun.serve` (about 1.9x req/s on the listening path) |
| TS strip | built-in `module.stripTypeScriptTypes` | `amaro` (byte-identical, position-preserving) |
| SQLite | built-in `node:sqlite` + `drizzle-orm/node-sqlite` | built-in `bun:sqlite` + `drizzle-orm/bun-sqlite` |
| Hot reload | `node --watch` | `bun --hot` |
| WebSocket | the `ws` library | native `Bun.serve` + the `BunWsAdapter` bridge |
| 103 Early Hints | yes | no (`Bun.serve` has no informational-response API) |

The bytes the browser fetches are identical across runtimes. The 103 Early Hints
gap costs only a small first-load latency edge where an edge forwards 103, never
correctness (the modulepreload hints still ship in the document head).

## Scaffolding the runtime

`webjs create <name>` defaults to Node. `webjs create <name> --runtime bun` (or
`bun create webjs <name>`, auto-detected from the invoking package manager,
#541) emits a Bun-flavored app: `bun.lock`, a pure `oven/bun:1` Dockerfile +
bun-install CI, bun-command agent docs, and the zero-install bootstrap below.
`--runtime` is orthogonal to `--template`.

## Bun zero-install (#675)

A Bun app's `dev` / `start` / `db` scripts run through a generated app-local
`webjs-bun.mjs` bootstrap under `bun --bun`:

```js
// webjs-bun.mjs
await import('@webjsdev/cli/bin/webjs.js');
```

`bun --bun` overrides the `webjs` bin's Node shebang so the server runs on Bun;
importing the CLI by bare specifier lets Bun auto-install resolve `@webjsdev/*`
and the app's deps on demand, so a fresh app serves with **no `bun install`**.
The CLI's `start` is in-process and `dev` re-execs via `process.execPath` (which
is `bun` here), so the server stays on Bun once the CLI does. `bunx
@webjsdev/cli` is deliberately NOT used (it runs on Node via the shebang AND
eager-installs the whole tree). The `start.before` migrate also routes through
the bootstrap, so the boot-time `webjs db migrate` needs no `webjs` bin in
`node_modules`. `bun install` stays optional: run it for editor type
intelligence (no `node_modules` means no local type files) or a pinned offline
install. The Node-targeted tooling scripts (`test` / `check` / `typecheck`)
stay plain `webjs` on Node and still expect an install.

**Version pinning (#685).** Bun's auto-install fetches `latest` for a bare
`import 'zod'`, ignoring package.json and `bun.lock` (it consults neither the
manifest, the lockfile, nor an `onResolve` plugin, verified in #684). webjs
closes that gap with an `onLoad` transform: it rewrites a declared dep's bare
specifier to an inline-versioned one (`zod` to `zod@<pinned>`, the exact version
from `bun.lock` when present, else the package.json range), which Bun's
auto-install DOES honor. So zero-install runs the app's pinned versions, not
latest. The rewrite is server-runtime only (it shapes what Bun fetches for SSR
and server actions). The browser is still served bare specifiers resolved via
the importmap / jspm, unchanged. Only declared deps are rewritten (a transitive
dep follows from its pinned parent's manifest), and it is a no-op when
`node_modules` exists (Bun uses the installed copy). Default on. Opt out with
`WEBJS_PIN=0` or `{ "webjs": { "pin": false } }`.

**Reproducibility:** dev resolves on demand (now at the pinned versions), and the
scaffold's Bun Dockerfile still keeps an explicit `bun install` so a prod image
is immutable and self-contained with no registry fetch at boot.

## SQLite busy_timeout (#674)

Both `node:sqlite` and `bun:sqlite` default `busy_timeout` to 0, so a contended
write throws `database is locked` immediately (better-sqlite3, used before the
built-in drivers, defaulted to 5000ms). The generated connection sets `PRAGMA
busy_timeout = 5000` + `PRAGMA journal_mode = WAL` on the raw client before
drizzle wraps it, on both runtime branches.

## Future runtimes

The listener seam is runtime-neutral, so a `Deno.serve` shell (or an embedded
adapter) slots in at the same point when added. Edge runtimes with no filesystem
are a separate, later target. Until then, treat Deno as planned, not supported.
