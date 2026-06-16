# Default ORM research: Drizzle vs Prisma (#532)

Status: research + recommendation. The decision to act on it (and the scaffold rewrite
it implies) is owner-gated and tracked separately. This file is the durable record of
the comparison and the reasoning, so a future reader does not have to reconstruct it.

## The question

Prisma + SQLite is the hardcoded default ORM in all three scaffolds (`webjs create`,
`--template api`, `--template saas`). Prisma carries friction that rubs against the
webjs thesis (no build step, runs on Node OR Bun, edge as a later target). Is Drizzle a
better-fit default, and if so do we switch outright or offer a `--orm` choice?

## TL;DR recommendation

**Switch the default to Drizzle.** Drop Prisma as the scaffold default rather than
carrying both behind a `--orm` flag. The deciding factors are the two that webjs is most
opinionated about and that Prisma cannot give up:

1. **No codegen.** Prisma always needs a `prisma generate` step (still true in v7's
   Rust-free client). webjs had to build `packages/cli/lib/prisma-preflight.js` purely to
   detect a missing or stale generated client. A buildless framework writing a
   stale-build detector is the tell. Drizzle has no generate step at all (schema and
   queries are plain TypeScript; drizzle-kit only emits SQL migration files, a dev-time
   artifact, not a runtime-required client).
2. **Native Bun.** `drizzle-orm/bun-sqlite` uses `bun:sqlite` directly with zero engine.
   Prisma-on-Bun in this repo is not native: per `docs/app/docs/deployment/page.ts`, the
   blog runs Prisma under Bun only by dropping the Bun binary into a Node image so
   `prisma generate` and install still happen on Node, and Bun serves the listening path.
   That is exactly the friction #523 hit and exactly what a Bun-first scaffold (#541)
   wants gone.

The cost is real but one-time: Prisma's relation ergonomics and `migrate dev` DX are
nicer, and its community is larger. Those are wiring and documentation costs we pay once,
not properties of the shipped app. Given the project has no users yet and prefers clean
breaking changes over additive shims, a clean swap beats a `--orm` matrix that doubles
the scaffold, docs, and test surface and dilutes the single opinionated default.

## Current Prisma wiring (what a swap touches)

Mapped from the codebase. Prisma is not optional infrastructure here, it is the
opinionated default, wired in nine places:

- `packages/cli/lib/create.js`: the `prisma/schema.prisma` template, the
  `lib/prisma.server.ts` singleton, the `predev: prisma generate` and
  `prestart: prisma migrate deploy` hooks, the `db:migrate` / `db:generate` / `db:studio`
  scripts, `@prisma/client` + `prisma` deps (pinned `^6.0.0`), the `DATABASE_URL` env, and
  the `prisma/dev.db` gitignore lines.
- `packages/cli/lib/saas-template.js`: a `User` model with `passwordHash`, and the auth
  signup / current-user actions that query `prisma.user`.
- `packages/cli/bin/webjs.js`: the `webjs db` passthrough mapping `generate` / `migrate` /
  `studio` to `npx prisma ...`.
- `packages/cli/lib/prisma-preflight.js`: detects a missing or stale generated client and
  prints a hint before `dev`. This whole file exists only because of the generate step.
- `packages/cli/templates/AGENTS.md` and `CONVENTIONS.md`: the "Persist data with Prisma +
  SQLite, never JSON files" rule.
- Root `AGENTS.md`: "Default to a real database (Prisma + SQLite)" and the
  `webjs db <prisma-subcommand>` CLI line.
- `docs/app/docs/database/page.ts` (the full guide) plus Prisma mentions in
  `architecture`, `authentication`, `deployment`, `getting-started`, `backend-only`,
  `troubleshooting`.
- Tests: `test/scaffolds/scaffold-integration.test.js` asserts the Prisma files are
  written; `packages/cli/test/prisma-preflight/` covers the preflight; the saas template
  ships an auth flow test.
- `examples/blog`: schema (User, Session, Post, Comment), the client singleton, and every
  query / action module.

## Axis-by-axis comparison

### No-build fit (decisive, favors Drizzle)

Prisma needs a generated client. v7 (Nov 2025) made the Rust-free client the default, so
the native query-engine binary is gone and the generated code is smaller and more
portable, but the `prisma generate` codegen step remains, and v7 now also requires a
manually installed driver adapter (for SQLite, a `better-sqlite3`-backed adapter, itself a
native node module). So v7 removes the engine binary but keeps the two things that hurt a
buildless framework: a codegen step and a native driver dependency.

Drizzle has no codegen. The schema is a TypeScript file, queries are TypeScript functions,
and there is nothing to generate before the app can run. drizzle-kit produces SQL
migration files on demand, which are committed artifacts, not a runtime prerequisite. This
is a straight match for "source files are served as native ES modules, what you read is
what runs". It also deletes the entire `prisma-preflight.js` reason-for-existing.

### Bun fit (decisive, favors Drizzle)

Drizzle ships `drizzle-orm/bun-sqlite`, a first-class `bun:sqlite` driver with sync and
async APIs. No engine, no adapter shopping, no Node fallback. On Node it uses
`better-sqlite3` or `node:sqlite`. One schema, both runtimes.

Prisma under Bun, as actually deployed in this repo, is "Bun serves, Node generates". The
deployment doc spells it out: drop the Bun binary into a Node image, run install and
generate on Node, let `Bun.serve` take the listening path. That works but it is not the
Bun-native story #541 is asking for, and it keeps the codegen dependency on the Node
toolchain in the image.

### Type stripping / erasable TS (neutral)

Neither has an erasability problem. Prisma's schema is a separate `.prisma` DSL (not TS, so
not stripped) and its generated client is `.js` + `.d.ts`. Drizzle's schema is plain TS
using column-builder functions and object literals, with no enums, decorators, or value
namespaces, so it strips cleanly under Node's `module.stripTypeScriptTypes` and amaro.
Slight conceptual win for Drizzle (the schema lives in the same TS the rest of the app
uses, no second language), but no correctness gap either way.

### Migrations + DX (favors Prisma)

This is Prisma's strongest axis. `prisma migrate dev` is a single declarative command that
diffs the schema, writes the migration, applies it, and regenerates the client. Prisma
Studio is a mature data GUI. The mental model is "edit schema, run one command".

Drizzle splits it: `drizzle-kit generate` writes the SQL migration from the schema diff,
`drizzle-kit migrate` applies it (or `drizzle-kit push` for fast dev iteration), and
Drizzle Studio covers the GUI. It is a little more manual and a little more SQL-forward,
but it is a well-trodden path and the `webjs db` passthrough can wrap it the same way it
wraps Prisma today (`webjs db generate` to `drizzle-kit generate`, `webjs db migrate` to
`drizzle-kit migrate`, `webjs db studio` to `drizzle-kit studio`).

### Relations and ecosystem (favors Prisma)

Prisma's `include` relations are more ergonomic, and its community is larger, with more
starter content and more developers who already know it. Drizzle's relational query API was
historically more verbose; the 1.0 line rewrote it and it now fetches nested relational
data in a single SQL query, closing most of the gap, but the community is smaller, so an
obscure edge case has fewer existing answers.

### Edge readiness (favors Drizzle, later-target)

webjs lists edge runtimes (no filesystem) as a later target. A no-engine, small, plain-TS
ORM with proven Cloudflare Workers / Vercel Edge adoption is the better foundation there.
Prisma v7's Rust-free client narrows this, but Drizzle remains the lighter, more
edge-proven option.

## Scorecard

| Axis | Winner | Weight for webjs |
|---|---|---|
| No build / no codegen | Drizzle | high (core thesis) |
| Native Bun | Drizzle | high (Node-or-Bun thesis, #541) |
| Erasable TS | tie | low |
| Migration DX | Prisma | medium |
| Relations + community | Prisma | medium |
| Edge readiness | Drizzle | low now, high later |

The two high-weight axes both go to Drizzle, and they are precisely the axes webjs is built
around. Prisma wins on DX and ecosystem, which are one-time wiring and documentation costs,
not runtime properties.

## Why not a `--orm` flag

It is the safe-looking middle option, and it is the wrong one here:

- It doubles the scaffold generator, the docs surface (every database / auth / deployment
  page forks), the `webjs db` passthrough, and the scaffold test matrix.
- It dilutes the single opinionated default, which is the thing the framework sells.
  "Sensible defaults, overridable" means one default with an escape hatch, not two co-equal
  defaults the user must choose between on first run.
- The project has no users and explicitly prefers clean breaking changes over additive
  shims (no backward-compat burden yet). A clean swap is cheaper to own than a permanent
  fork.

If, after dogfooding Drizzle, relation ergonomics or community pull turn out to matter more
than buildless purity, revisit `--orm` then. Do not pay for the matrix preemptively.

## What switching costs (implementation sketch, for the follow-up)

A clean swap, scoped for the implementation issue:

1. `create.js`: replace the schema template with a `db/schema.ts` (sqliteTable), the client
   singleton with a `lib/db.server.ts` exporting a `drizzle(new Database(...))` instance,
   the deps with `drizzle-orm` + `drizzle-kit` + a SQLite driver (`bun:sqlite` on Bun,
   `better-sqlite3` or `node:sqlite` on Node), a `drizzle.config.ts`, and the scripts with
   the drizzle-kit equivalents. Drop the `predev: prisma generate` hook entirely (no
   codegen), keep a `prestart` migrate-apply.
2. `saas-template.js`: port the User model and the two auth modules to Drizzle queries.
3. `webjs.js`: repoint the `webjs db` passthrough to drizzle-kit.
4. Delete `prisma-preflight.js` and its tests (no generated client to detect).
5. Docs: rewrite `database/page.ts`, update the Prisma mentions in architecture /
   authentication / deployment / getting-started / backend-only / troubleshooting.
6. `AGENTS.md` + templates' AGENTS.md / CONVENTIONS.md: change "Prisma + SQLite" to
   "Drizzle + SQLite" in the default-database rule.
7. `examples/blog`: port the schema and every query / action module, then re-run the blog
   e2e on both Node and Bun.
8. Tests: update `scaffold-integration.test.js` to assert the Drizzle files; add a Bun
   cross-runtime assert that the scaffolded DB round-trips on `bun:sqlite`.
9. Coordinate with #541 (Bun-first scaffold): a Drizzle default makes a `--runtime bun`
   scaffold genuinely engine-free, so the two should land together or in sequence.

## Decision needed from the owner

The recommendation is to switch. Acting on it is a framework-wide breaking change to the
default scaffold and a product-positioning call, so it is owner-gated before any rip-out.
Once ratified, the implementation lands as its own tracked PR (or folded into #541).

## Sources

Current ORM state (June 2026):

- [Prisma ORM v7: Rust-free client becomes the default](https://www.prisma.io/changelog/2025-11-19)
- [Use Prisma ORM without Rust engines](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/no-rust-engine)
- [Use Drizzle ORM with Bun](https://bun.com/docs/guides/ecosystem/drizzle)
- [Drizzle ORM: Bun SQLite](https://orm.drizzle.team/docs/connect-bun-sqlite)
- [Prisma ORM vs Drizzle (Prisma docs)](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle)
- [Drizzle vs Prisma in 2026 (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/)
