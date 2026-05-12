# AGENTS.md — @webjskit/cli

The webjs **command-line interface** — `webjs dev` / `start` / `build`
/ `test` / `check` / `create` / `db` — plus the scaffold templates
shipped into every new app.

Framework-wide rules (workflow, JSDoc-in-`packages/`, no-build,
commit conventions, autonomous-mode behaviour, scaffold rules) live
in the **framework root [`../../AGENTS.md`](../../AGENTS.md)** and
apply here. Read that first.

This file only covers what's specific to `@webjskit/cli`.

## Module map

```
bin/
  webjs.js               CLI entry — argv dispatch for every command.
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
| `webjs start` | `startServer({ dev: false })` (HTTP/2 + TLS optional via `--http2 --cert --key`) |
| `webjs build` | `buildBundle()` from `@webjskit/server` |
| `webjs test [--server\|--browser]` | `node --test` for server tests, `wtr` for browser tests |
| `webjs check [--rules\|--fix]` | `checkConventions()` from `@webjskit/server/check` |
| `webjs create <name> [--template …]` | `scaffoldApp()` from `lib/create.js` |
| `webjs db <generate\|migrate\|studio>` | Passthrough to `prisma` |
| `webjs ui <init\|add\|list\|view\|diff\|info>` | Proxies to `@webjskit/ui` (see "UI subcommand" below) |

## UI subcommand — proxies to `@webjskit/ui`

`@webjskit/ui` is a **hard dependency** of `@webjskit/cli` (listed in
`package.json` `dependencies`), so a global `webjs` install always ships
with the shadcn-style component CLI out of the box — no separate install.

`webjs ui <subcmd> [args...]` is a thin dispatch into `@webjskit/ui`'s
`run({ argv })` entry. The implementation lives in
[`bin/webjs.js`](./bin/webjs.js) under `case 'ui':` — it resolves
`@webjskit/ui` via `createRequire` rooted at the CLI's own location first
(the hard-dep path), with a fallback to the user's `cwd` for the rare case
where the user installed `@webjskit/ui` directly without going through
`@webjskit/cli`.

The subcommands (`init`, `add`, `list`, `view`, `diff`, `info`) are owned
and documented by `@webjskit/ui` — see
[`../ui/AGENTS.md`](../ui/AGENTS.md) for the surface. The CLI does not
wrap or transform args; everything after `webjs ui` is forwarded
verbatim.

## Package-specific invariants

1. **Exactly three templates.** `full-stack` (default), `api`, `saas`
   — the `TEMPLATES` array in `bin/webjs.js` is the single source of
   truth; `scaffoldApp()` re-validates programmatically. Hallucinated
   templates (`blog`, `todo`, `ecommerce`, …) are rejected at the CLI
   with a guidance message.
2. **Scaffold is reference, not the final product.** The scaffold
   output ships an example `app/page.ts` ("Hello from …"), an example
   `User` Prisma model, an example `theme-toggle` component. AI agents
   asked to build a real app MUST replace those with the actual app —
   the post-scaffold success message in `lib/create.js` prints this
   rule verbatim.
3. **Prisma + SQLite is wired up for ALL templates.** `prisma/schema.prisma`,
   `lib/prisma.ts`, `npm run db:migrate`, `predev` / `prestart` hooks.
   Apps must NEVER use JSON files for persistence — the
   `no-json-data-files` rule in `webjs check` enforces this.
4. **Template files are verbatim copies** with `{{APP_NAME}}` substitution.
   When editing `templates/AGENTS.md`, `templates/CLAUDE.md`,
   `templates/CONVENTIONS.md`, `.cursorrules`, etc., remember they ship
   into every scaffolded app — write for the audience of an AI agent
   working inside a freshly-scaffolded webjs project.
5. **`templates/CLAUDE.md` uses Claude Code's `@import` syntax**
   (`@AGENTS.md`, `@CONVENTIONS.md`) — see https://code.claude.com/docs/en/claude-md.md#import-additional-files

## Tests

- `test/scaffold-template-validation.test.js` — rejects unknown templates.
- `test/check.test.js` — convention checker (server package owns the
  implementation; tests live at the repo root).
- Integration testing of the actual scaffold output is currently
  manual (`webjs create demo && cd demo && npm i && webjs dev`).

Run `npm test` from the repo root.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
