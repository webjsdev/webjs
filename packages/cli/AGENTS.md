# AGENTS.md for @webjsdev/cli

The webjs **command-line interface** (`webjs dev` / `start` / `test`
/ `check` / `create` / `db`) plus the scaffold templates shipped
into every new app.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjsdev/cli`.

## Module map

```
bin/
  webjs.js               CLI entry: argv dispatch for every command.
                         The exact-three template list (full-stack/api/saas)
                         is enforced here; --template validation rejects
                         anything else with a guidance message.
lib/
  node-preflight.js      Inline, DEPENDENCY-FREE Node-version guard (#238).
                         `checkNodeInline(current, engines)` + `nodeInlineMessage`.
                         The bin runs it BEFORE any `import @webjsdev/server`,
                         because importing the server links dev.js (Node 24+
                         builtins) and would itself link-fail on old Node. So the
                         primary guard depends only on `process.versions.node`.
                         Tests: `test/node-preflight/`.
  check-json.js          Shared `webjs check` JSON projector (#262).
                         `projectCheck(violations)` wraps the raw
                         `checkConventions` `Violation[]` into
                         `{ violations, summary: { count, byRule } }`. PURE
                         (no file reads, no print). Used by BOTH `check --json`
                         (in bin/webjs.js) and the MCP `check` tool, so the two
                         return the identical shape.
  mcp.js                 `webjs mcp`: a hand-rolled, READ-ONLY MCP stdio server
                         (#262), ZERO new dependency. `runMcpServer({ stdin,
                         stdout, stderr, cwd, version, deps? })` speaks
                         newline-delimited JSON-RPC 2.0 (one object per line),
                         writing ONLY JSON-RPC frames to stdout and every
                         diagnostic to stderr (stdout is the protocol channel).
                         Handshake: `initialize` -> serverInfo + capabilities
                         (`tools` + `resources` + `prompts`);
                         `notifications/initialized` -> no reply; `tools/list`
                         -> the tools; `tools/call` -> a content array
                         whose text is the JSON result (introspection) or markdown
                         (knowledge). Unknown method -> -32601, parse error ->
                         -32700, a malformed line never crashes the loop.
                         INTROSPECTION tools (read-only, appDir-scoped), each
                         projecting an EXISTING @webjsdev/server function:
                         `list_routes` (buildRouteTable), `list_actions`
                         (buildActionIndex + hashFile for the
                         /__webjs/action/<hash>/<fn> endpoint), `list_components`
                         (scanComponents), `check` (checkConventions via the
                         shared `projectCheck`). Function names are extracted
                         LEXICALLY (extractExportNames / extractRouteMethods) so
                         no app module is loaded (no DB init side effects).
                         KNOWLEDGE layer (#376), all in `lib/mcp-docs.js`: an
                         `init` tool (the read-first mental-model primer, sourcing
                         the execution-model + invariants sections from AGENTS.md
                         so it cannot drift; it also points at the `source` tool),
                         a `docs` tool (retrieve a doc by topic / search by query
                         / index), MCP `resources/list` + `resources/read` serving
                         the `agent-docs/*.md` corpus + AGENTS.md as
                         `webjs-docs://<name>`, and `prompts/list` + `prompts/get`
                         exposing the recipes as guided workflows.
                         SOURCE tool (#378), in `lib/mcp-source.js`: `source`
                         reads the framework's OWN source (webjs is no-build, so
                         `node_modules/@webjsdev/*/src` is the real JSDoc that
                         runs). `path` reads a file (e.g. `server/src/ssr.js`),
                         `query` greps the `@webjsdev/*` src trees (bounded, cap
                         disclosed), no-args lists the resolved packages + entry
                         points. `resolveFrameworkRoots` locates each package by
                         checking the `require.resolve.paths` node_modules dirs on
                         disk (NOT `<pkg>/package.json`, which `exports` blocks for
                         server/cli/ui, NOR the main entry, which cli lacks), and
                         uses `src/` or (for cli) `lib/`. READ-ONLY +
                         traversal-guarded (cannot escape a package root), loads no
                         module.
                         The docs are bundled into the package at `prepack`
                         (`scripts/copy-mcp-resources.js` -> `resources/`, which is
                         in `files`, gitignored) so `npx @webjsdev/cli mcp` is
                         self-contained; `resolveDocsLocation` falls back to the
                         repo-root `agent-docs/` in dev so source stays single.
                         `deps` (introspection) + `docsDeps` (knowledge) are
                         injectable for in-process tests. Tests:
                         `test/cli/mcp.test.mjs`, `test/cli/mcp-docs.test.mjs`,
                         `test/cli/check-json.test.mjs`.
  doctor.js              `webjs doctor` project-health checks (#266).
                         `runDoctorChecks(appDir, opts?)` is PURE (reads files +
                         optionally the network, never exits / prints) so each
                         check is unit-testable. `opts.nodeVersion` overrides the
                         running Node, `opts.vendor` injects the pin-freshness
                         `{ hasVendorPin, findOutdated }` pair (offline tests).
                         The bin renders + owns the non-zero exit on a hard fail.
                         Tests: `test/cli/doctor.test.mjs`.
  create.js              `webjs create <name>` scaffold logic. Copies
                         `templates/` into the new app, writes
                         package.json + tsconfig + Prisma schema,
                         template-specific app/ files, prints the
                         post-scaffold guidance for AI agents.
  saas-template.js       Extra files written when --template saas:
                         auth + login/signup + protected dashboard
                         + Prisma User model.
templates/               Verbatim files copied into every new app.
                         {{APP_NAME}} placeholder is substituted at
                         copy time. The AGENTS.md / CLAUDE.md /
                         CONVENTIONS.md / .cursorrules / .agents/rules/workflow.md
                         / .github/copilot-instructions.md / .editorconfig
                         / .env.example / .claude.json / .claude/hooks/
                         all live here.
README.md                npm-facing package readme.
```

## Public commands (see USAGE in `bin/webjs.js`)

| Command | Implementation |
|---|---|
| `webjs dev` | Spawns `node --watch` re-entry, then `startServer({ dev: true })` |
| `webjs start` | `startServer({ dev: false })`, plain HTTP/1.1 (front a reverse proxy for TLS + HTTP/2) |
| `webjs test [--server\|--browser]` | `node --test` for server tests, `wtr` for browser tests |
| `webjs check [--rules] [--json]` | `checkConventions()` from `@webjsdev/server/check`. `--rules` lists the checks. `--json` emits the structured violations + a summary count as JSON (via the shared `lib/check-json.js` `projectCheck`), so an agent in a loop consumes structured data instead of regex-scraping stdout; the non-zero exit on violations is preserved. Report-only: each violation carries a prose `fix` hint, but there is no `--fix` autofix flag (the rules either rewrite code or rename files, so an automatic codemod is not safe) |
| `webjs mcp` | MCP stdio server (#262, knowledge layer #376), `runMcpServer()` from `lib/mcp.js`. Hand-rolled, ZERO new dependency, newline-delimited JSON-RPC 2.0. INTROSPECTION tools (read-only): `list_routes`, `list_actions`, `list_components`, `check`. KNOWLEDGE layer: an `init` mental-model primer + a `docs` retrieval tool, MCP `resources` (the `agent-docs` corpus + AGENTS.md as `webjs-docs://*`), and `prompts` (the recipes as guided workflows). SOURCE: a `source` tool reads the framework's own no-build source from `node_modules/@webjsdev/*/src` (read-only, traversal-guarded). Docs bundled into the package at `prepack` (self-contained `npx`), repo-root fallback in dev. Wired into the scaffold's `.claude.json` next to the Playwright MCP entry as `{ "command": "npx", "args": ["@webjsdev/cli", "mcp"] }`; mountable in any MCP host (Cursor `.cursor/mcp.json`, etc.). STDOUT is the JSON-RPC channel (diagnostics go to stderr) |
| `webjs doctor` | `runDoctorChecks()` from `lib/doctor.js`. A project-health checklist over existing signals (Node major, tsconfig `erasableSyntaxOnly`, `.env` drift vs `.env.example`, vendor-pin freshness, `@webjsdev/*` version coherence, git pre-commit hook). PURE checks render with a `[pass]` / `[warn]` / `[fail]` marker; non-zero exit iff a HARD check fails (Node below the floor, or `erasableSyntaxOnly` missing in an existing tsconfig), so CI can gate. Warns (drift / staleness) never fail the exit. The only network touch (pin freshness) is best-effort: a fetch failure is a warn, never a hard fail. An onboarding/setup-verify tool, NOT a scaffold-CI hard gate. Tests: `test/cli/doctor.test.mjs` |
| `webjs types` | `generateRouteTypes()` from `@webjsdev/server`, writes `.webjs/routes.d.ts` (typed `Route` union + per-route params, #258). Also auto-emitted at `webjs dev` startup |
| `webjs typecheck [tsc args]` | Resolves the project's own `typescript/bin/tsc` (via `createRequire` from the app cwd) and spawns it with `--noEmit`, passing extra args through. Exits non-zero on a type error (a CI gate). A clear message + non-zero exit when typescript is not installed (#265). The framework runs the standard compiler, it does not embed one |
| `webjs create <name> [--template …]` | `scaffoldApp()` from `lib/create.js` |
| `webjs db <generate\|migrate\|studio>` | Passthrough to `prisma` |
| `webjs ui <init\|add\|list\|view\|diff\|info>` | Proxies to `@webjsdev/ui` (see "UI subcommand" below) |

## UI subcommand: proxies to `@webjsdev/ui`

`@webjsdev/ui` is a **hard dependency** of `@webjsdev/cli` (listed in
`package.json` `dependencies`), so a global `webjs` install always ships
with the AI-first component CLI out of the box, no separate install.

`webjs ui <subcmd> [args...]` is a thin dispatch into `@webjsdev/ui`'s
`run({ argv })` entry. The implementation lives in
[`bin/webjs.js`](./bin/webjs.js) under `case 'ui':`. It resolves
`@webjsdev/ui` via `createRequire` rooted at the CLI's own location first
(the hard-dep path), with a fallback to the user's `cwd` for the rare case
where the user installed `@webjsdev/ui` directly without going through
`@webjsdev/cli`.

The subcommands (`init`, `add`, `list`, `view`, `diff`, `info`) are owned
and documented by `@webjsdev/ui`. See
[`../ui/AGENTS.md`](../ui/AGENTS.md) for the surface. The CLI does not
wrap or transform args; everything after `webjs ui` is forwarded
verbatim.

## Package-specific invariants

1. **Exactly three templates.** `full-stack` (default), `api`, `saas`.
   The `TEMPLATES` array in `bin/webjs.js` is the single source of
   truth, and `scaffoldApp()` re-validates programmatically. Hallucinated
   templates (`blog`, `todo`, `ecommerce`, …) are rejected at the CLI
   with a guidance message.
2. **Scaffold is reference, not the final product.** The scaffold
   output ships an example `app/page.ts` ("Hello from …"), an example
   `User` Prisma model, an example `theme-toggle` component. AI agents
   asked to build a real app MUST replace those with the actual app.
   The post-scaffold success message in `lib/create.js` prints this
   rule verbatim.
3. **Prisma + SQLite is wired up for ALL templates.** `prisma/schema.prisma`,
   `lib/prisma.ts`, `npm run db:migrate`, `predev` / `prestart` hooks.
   Apps must NEVER use JSON files for persistence. This is a project
   convention (documented in the scaffold's CONVENTIONS.md).
4. **Template files are verbatim copies** with `{{APP_NAME}}` substitution.
   When editing `templates/AGENTS.md`, `templates/CLAUDE.md`,
   `templates/CONVENTIONS.md`, `.cursorrules`, etc., remember they ship
   into every scaffolded app. Write for the audience of an AI agent
   working inside a freshly-scaffolded webjs project.
5. **`templates/CLAUDE.md` uses Claude Code's `@import` syntax**
   (`@AGENTS.md`, `@CONVENTIONS.md`). See https://code.claude.com/docs/en/claude-md.md#import-additional-files

## Tests

Scaffold-template tests for this package live in cross-package
folders under the repo root (they need to boot scaffolded apps):
`test/scaffolds/scaffold-template-validation.test.js`,
`test/scaffolds/scaffold-integration.test.js`,
`test/scaffolds/scaffold-ui-integration.test.js`.

Convention-rule tests live in
`packages/server/test/check/check.test.js` (the rules themselves
ship from `@webjsdev/server`).

End-to-end testing of the actual scaffold output is currently
manual (`webjs create demo && cd demo && webjs dev`, since `webjs create` auto-installs).
See [`../../agent-docs/testing.md`](../../agent-docs/testing.md)
for the overall layout.

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
