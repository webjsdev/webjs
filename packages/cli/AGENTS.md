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
                         CONVENTIONS.md / .cursorrules / .windsurfrules
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
| `webjs check [--rules\|--fix]` | `checkConventions()` from `@webjsdev/server/check` |
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
   Apps must NEVER use JSON files for persistence. The
   `no-json-data-files` rule in `webjs check` enforces this.
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
manual (`webjs create demo && cd demo && npm i && webjs dev`).
See [`../../agent-docs/testing.md`](../../agent-docs/testing.md)
for the overall layout.

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
