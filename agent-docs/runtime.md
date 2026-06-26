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

## Bun install model: zero-install fast path + transparent install (#675)

A Bun app's `dev` / `start` / `db` scripts run through a generated app-local
`webjs-bun.mjs` bootstrap under `bun --bun`:

```js
// webjs-bun.mjs
await import('@webjsdev/cli/bin/webjs.js');
```

`bun --bun` overrides the `webjs` bin's Node shebang so the server runs on Bun,
and importing the CLI by bare specifier lets Bun auto-install resolve
`@webjsdev/*` and the app's deps on demand. So a fresh app serves with **no
MANUAL `bun install`** (webjs runs one for you when a dep needs it, see below).
The CLI's `start` is in-process and `dev` re-execs via `process.execPath` (which
is `bun` here), so the server stays on Bun once the CLI does. `bunx
@webjsdev/cli` is deliberately NOT used (it runs on Node via the shebang AND
eager-installs the whole tree). `bun create` does NOT run an install on Bun
(#682). The Node-targeted tooling scripts (`test` / `check` / `typecheck`) stay
plain `webjs` on Node and still expect an install.

**Why a transparent install exists: Bun auto-install is latest-only.** With no
`node_modules`, Bun's runtime auto-install resolves a BARE import to the
dependency's **latest** version (latest-in-range for an inline range), and it
IGNORES the `package.json` range AND any committed `bun.lock` (both apply only to
`bun install`, not the runtime path). webjs's #685 `onLoad` transform rewrites a
declared dep's bare specifier to an inline-versioned one Bun DOES honor, but only
a RANGE is safe: an inline EXACT, NON-LATEST specifier (`is-odd@2.0.0` when latest
is 3.x, `drizzle-orm@1.0.0-rc.3` while latest is on the 0.4x line) **ENOENTs on a
cold cache** (Bun will not fetch a non-latest exact on the fly, verified many ways
including with a committed lock, and the cache is a closed format only `bun
install` populates). So the serve-path rewrite forwards the declared RANGE
(`zod@^3.20.0` resolves the highest matching `3.x`), NOT the `bun.lock` exact.

**Consequence: zero-install is latest-in-range, not reproducible.** A reproducible
or non-latest version cannot be served zero-install on Bun. The honest path for
those is a real `bun install` (it creates `node_modules`, which Bun then resolves
from, in "installed mode"), so webjs runs one **transparently** (never asking):

- On boot with no `node_modules`, `classifyBunDeps` (no network) splits the
  declared deps. A **prerelease**, a value that is **not inline-safe** (a protocol
  range / wildcard / multi-token range / dist-tag), or a **committed `bun.lock`**
  (a reproducibility request) means webjs BLOCKS on a one-time `bun install`
  before serving (a logged ~1s cost, strictly better than a guaranteed
  first-request ENOENT 500), then serves in installed mode. The next boot reuses
  `node_modules` and is fast.
- An app whose deps are all latest-in-range with no lock has no ENOENT hazard, so
  it serves immediately on the zero-install fast path AND fires a DETACHED
  background `bun install` that converges the box to installed mode (for editor
  types / `typecheck`) and self-heals an undetectable non-latest exact on the
  next boot.

The install is serialized by a `.webjs/.bun-install.lock` marker (concurrent
boots / `bun --hot` restarts never double-install), uses `--frozen-lockfile` when
a lock is present (reproducible), and is fail-open (offline / no `bun` degrades to
the zero-install fast path, never a crash). It NEVER uses `--lockfile-only` (that
writes no `node_modules`, so it cannot reach installed mode). Run `bun install`
yourself anytime for pinned versions + editor types; the production Docker image
does a real `bun install`.

The scaffold ships idiomatic ranges (#700): `@webjsdev/*` and `pg` as caret
ranges (`^<version>`, served zero-install at latest-in-range), and `drizzle-orm`
/ `drizzle-kit` EXACT at the `1.0.0-rc.3` relations-v2 line. That line is a
PRERELEASE, so it is the canonical transparent-install trigger: it cannot be
served zero-install at all (a caret-prerelease ENOENTs inline, #703, and so does
the exact prerelease, since it is not latest), so the scaffold's committed
`bun.lock` + the boot's blocking install serve it reproducibly in installed mode.
`webjs db` (drizzle-kit) and `webjs test --browser` likewise run the transparent
install first on a zero-install box, since `resolveBin` resolves the tool's bin
from `node_modules`.

The serve-path rewrite is server-runtime only (it shapes what Bun fetches for SSR
and server actions; the browser is served bare specifiers via the importmap /
jspm), only touches declared deps, and is a no-op when `node_modules` exists (Bun
uses the installed copy). Default on. Opt out with `WEBJS_PIN=0` or
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
