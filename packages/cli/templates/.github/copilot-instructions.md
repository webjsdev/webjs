# GitHub Copilot Instructions: webjs app

You are working on a webjs app, an AI-first, no-build, web-components-first
framework. Read AGENTS.md for the full API reference and CONVENTIONS.md for
project-specific conventions. When AGENTS.md doesn't cover what you need,
the full hosted docs are at **https://docs.webjs.com**.

## Persistence + scaffold rules (non-negotiable)

- **Use Prisma + SQLite for data, never JSON files.** It's already wired up
  (`prisma/schema.prisma`, `lib/prisma.server.ts`, `npm run db:migrate`). For ANY
  data the app stores (todos, posts, messages, products, comments…),
  define a Prisma model. NEVER create `data/*.json`, `db.json`, or any
  JSON file as a fake database. NEVER use module-scope arrays / Maps as
  a substitute. NEVER use localStorage for app data. `webjs check`'s
  `no-json-data-files` rule will fail the build if you do.
- **The scaffold is reference, not the final product.** Replace
  `app/page.ts`, the example `User` model, the example users module, etc.
  with the app the user actually asked for. Don't ship "Hello from
  <app-name>" as the deliverable.
- **Only three templates exist:** `webjs create <name>` (default
  full-stack), `--template api`, `--template saas`. The CLI rejects any
  other `--template` value. Pick:
  - Any product UI (todo, blog, dashboard, marketplace, social…) → default
  - HTTP/JSON API only, no UI → `--template api`
  - Auth / login / signup / SaaS → `--template saas`

## Before starting ANY work

FIRST, before writing any code:
1. Check `git branch --show-current`.
   - If on main/master: create a feature branch before editing.
   - If on a feature branch: verify it matches the task at hand.
2. Sync: `git fetch origin && git rebase origin/main` if behind.

## Autonomous mode

If running without interactive approval (sandbox, auto-approve, etc.):
- On main? Auto-create feature/<task-slug> branch
- Parent behind? Auto-rebase. Merge? Auto-merge + delete feature branches.
- Auto-generate meaningful commit messages. Fix tests and violations.

## Mandatory workflow

Every code change must include:
1. Commit and push PER LOGICAL UNIT, not at the end. One feature, one fix,
   one rename, one doc rewrite per commit. Always `git push` after
   committing. Don't accumulate changes. If you have 5+ unstaged files
   spanning different concerns, commit before continuing. The Claude Code
   hook at `.claude/hooks/nudge-uncommitted.sh` enforces threshold 4 for
   Claude users; Copilot users should self-enforce the same rule. Automatic.
2. Server tests in test/unit/*.test.ts (node:test for actions, queries, utilities)
3. Browser tests in test/browser/*.test.js (WTR + Playwright, real Chromium)
4. Documentation updates (AGENTS.md for API, docs/ for user guides)
5. Convention validation: `webjs check` must pass

## Git rules

- Commit after each logical unit of work
- Meaningful commit messages: what changed and why
- NEVER add Co-Authored-By or AI attribution trailers to commits
- Work on feature branches, create PRs, never push directly to main
- NEVER merge any branch without explicit user permission. Always ask:
  "Ready to merge <branch> into <target>? Delete or keep <branch> after?"
  Wait for approval AND the delete/keep preference. Applies to ALL merges.
- Run `webjs test` before every commit

## Code patterns

- **Erasable TypeScript only.** Node 24+ strips types via `module.stripTypeScriptTypes` (whitespace replacement, byte-exact position preservation, no sourcemap). The scaffold's tsconfig.json sets `erasableSyntaxOnly: true`, so the TS compiler rejects `enum`, `namespace` with values, constructor parameter properties, legacy decorators with `emitDecoratorMetadata`, and `import = require`. Use erasable equivalents: `const X = { ... } as const` plus a derived union type instead of `enum`; explicit fields plus constructor body assignments instead of parameter properties. If `erasableSyntaxOnly` is disabled and non-erasable syntax is used, the dev server falls back to esbuild + inline sourcemap for those files (~3x wire bytes per request).
- Tagged template: html`<div>${value}</div>` with css`...` for styles
- Components: extend WebComponent, declare `static properties` (and `static styles` for shadow-DOM components), call `Class.register('tag-name')` at the bottom of the file. The tag name is the argument to `.register()`, not a static field.
- Server actions: *.server.ts files with one exported async function each
- Directives: webjs ships only `unsafeHTML`, `live`, and `repeat`. Lit's `classMap` / `styleMap` / `ref` / `when` / `choose` / `guard` are NOT exported - use plain template-literal expressions and lifecycle hooks instead.
- Context: import { createContext, ContextProvider, ContextConsumer } from '@webjskit/core/context'
- Task: import { Task, TaskStatus } from '@webjskit/core/task'
- Routing: file-based under app/ (page.ts, layout.ts, route.ts, middleware.ts)

## What NOT to do

- Don't introduce build tools or bundlers in the critical path
- Server-only code (@prisma/client, node:*, anything needing Node APIs) goes only in .server.{js,ts} files, route.ts handlers, or middleware.ts. Never in pages, layouts, or components. Wrap in a .server.{js,ts} file; the framework rewrites that import to an RPC stub for the browser. lib/ holds both server-only infra (lib/prisma.server.ts) and browser-safe utilities (lib/utils/cn.ts with cn); apply the same rule per file.
- Don't use inline style="..." on components (use static styles = css`...`)
- Don't mutate this.state directly (use this.setState())
- Don't skip tests or documentation updates
