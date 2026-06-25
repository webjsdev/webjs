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
`node_modules`. `bun create` does NOT run an install on Bun (#682): the scaffold skips it
(zero-install by default), so `bun run dev` starts immediately. `bun install` is
optional. Run it when you want pinned, reproducible versions (it materializes
`node_modules` from the lockfile) or editor type intelligence (no `node_modules`
means no local type files). Pass `--install` to `bun create` to opt into the
create-time install.

**Spawned tooling under zero-install (#704).** `webjs db` and `webjs typecheck`
ALSO run with no install: instead of resolving a bin from a `node_modules` that
does not exist, they spawn the tool via Bun auto-install at the app-declared
version (`bun --preload <pin> <runner> drizzle-kit@<v>/bin.cjs ...`), and the
spawn pin preload rewrites the user schema's transitive bare imports to the
app's versions (app files only, so a cached CommonJS dep is untouched). The
exception is `webjs test`: Bun's `test` runner does NOT auto-install (unlike
`bun run`, which powers db / typecheck), so a zero-install `webjs test` cannot
resolve its deps and prints actionable guidance to run `bun install` once. The
gate is `node_modules` absence on Bun, so an installed app or Node is unchanged.
`webjs check` is webjs's own analysis (no spawned tool), so it has no such gate.

**Version resolution under zero-install (#684, #690, #697).** With no
`node_modules`, Bun's runtime auto-install resolves each BARE import to the
dependency's **absolute latest** version. It IGNORES the `package.json` semver
range AND any committed `bun.lock` (both apply only to `bun install`, not the
on-the-fly runtime path). webjs closes that gap with the #685 `onLoad` transform,
which rewrites a declared dep's bare specifier to an inline-versioned one that
Bun's auto-install DOES honor. The pinned version is chosen in order: the
`bun.lock` exact when present (precise and reproducible), else the `package.json`
declared value forwarded as-is when it is an inline-safe semver. Bun resolves an
inline range the standard way (`zod@^3.20.0` picks the highest matching `3.x`,
verified on Bun 1.3.14), so a caret, tilde, or comparator range now resolves
correctly under zero-install, NOT to the latest major. Left BARE (so still
latest) are a protocol range (`workspace:`, `file:`, `link:`, git / URL), a bare
wildcard (`*`, `x`, empty), a multi-token range (a space or a `||` union), a
range over a prerelease (`^1.0.0-rc.3`, which bun cannot resolve inline, #703),
and a dist-tag (`latest`, `next`, which auto-install resolves unreliably). For fully
reproducible installs across machines, commit a `bun.lock` (its exact pin wins
over a floating range) or run `bun install` (materialized `node_modules`), which
is what the production Docker image does.

The scaffold ships idiomatic ranges (#700): `webjs create` writes `@webjsdev/*`
and `pg` as caret ranges (`^<version>`), since #698 makes a normal caret resolve
correctly under bun zero-install (the highest match, not absolute latest), so a
fresh app picks up patch updates the way an npm user expects. `drizzle-orm` /
`drizzle-kit` stay EXACT at the `1.0.0-rc.3` relations-v2 line: that line is a
PRERELEASE, and bun zero-install ENOENTs on a caret-prerelease inline specifier
(`drizzle-orm@^1.0.0-rc.3`, verified) while the exact prerelease resolves, so a
range would break the scaffold under bun until the 1.0 stable ships. A dep the
user adds later with a `^` range resolves to the highest match WITHIN that range
under bun zero-install (correct semver), not the latest major.
The rewrite is server-runtime only (it shapes what Bun fetches for SSR and server
actions; the browser is served bare specifiers via the importmap / jspm), only
touches declared deps, and is a no-op when `node_modules` exists (Bun uses the
installed copy). Default on. Opt out with `WEBJS_PIN=0` or
`{ "webjs": { "pin": false } }`.

The **browser importmap shares that version source under zero-install (#699).**
The jspm importmap normally reads a vendor's version off `node_modules`, which is
absent under Bun zero-install, so a non-elided component importing a vendor (a
browser-bound `import dayjs from 'dayjs'`) would otherwise get no importmap entry
and 404 in the browser. So when the on-disk read finds nothing, the importmap
falls back to the SAME `bun.lock` exact else `package.json` declared semver the
server pin uses (jspm resolves a range), so the server and the browser resolve a
vendor from one source. A committed `bun.lock` keeps the two on the exact same
version (no skew). A floating range can resolve independently on each side, the
same determinism caveat as the server pin that a `bun.lock` removes.

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
