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
| Install | `npm install` (required) | `bun install` (required, like Node) |
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
bun-install CI, and bun-command agent docs. `--runtime` is orthogonal to
`--template`.

## Bun

A Bun app installs with `bun install` (like Node), then its `dev` / `start` /
`db` scripts force `bun --bun` so the server runs on Bun:

```sh
bun install
bun run dev      # or: bun run start
```

`bun --bun` overrides the `webjs` bin's Node shebang so the server runs on Bun
(selecting the native `Bun.serve` listener and `amaro` type stripping); the app's
deps resolve from `node_modules`, the same as Node. The `start.before` migrate
(`webjs db migrate`) runs under Bun too. Commit a `bun.lock` (the Bun analog of
`package-lock.json`) for reproducible, offline installs; the scaffold's Bun
Dockerfile runs `bun install` and serves via `CMD ["bun", "--bun", "run",
"start"]`.

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
