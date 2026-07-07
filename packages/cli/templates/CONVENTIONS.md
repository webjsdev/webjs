# CONVENTIONS.md for {{APP_NAME}}

This file defines the conventions for this webjs app. **AI agents MUST read
this file before writing any code.** It is the single source of truth for
how code should be structured, tested, and organized.

Sections marked `<!-- OVERRIDE -->` contain defaults you can customize.
Edit the content below the marker to change the convention for your project.

---

## `CONVENTIONS.md` vs `webjs check`: two different things

This file is the source of truth for **project conventions**: how code
is organized, named, and tested. They are preferences a reasonable
project could do differently, so they are guidance (for humans and AI
agents), not a hard gate. Customize any of them; sections marked
`<!-- OVERRIDE -->` are explicit customization points.

`webjs check` is a separate, narrower tool: **correctness checks** that
catch objectively broken code (a crash, a security leak, a build or
type-strip failure). Those always run, there is no per-project
disabling, and they are not listed here (run `webjs check --rules` to
see them). The line between the two: *could a sensible app legitimately
want this to pass?* If yes, it is a convention (this file); if no, it is
a check (the tool).

### Project conventions (follow these)

These are the architectural conventions for this app. They are not
enforced by `webjs check`; follow them by judgment.

- **Server actions and queries live in `modules/<feature>/actions/` and
  `modules/<feature>/queries/`** (`*.server.{js,ts}`), not loose in the
  app root. The DB connection lives in `db/connection.server.ts`; other
  cross-cutting server infrastructure (session helpers, auth config) lives in `lib/`.
- **One exported function per action/query file.** Name the file after
  the function (`create-post.server.ts` exports `createPost`). It keeps
  the action surface greppable.
- **Every feature has tests.** A `modules/<feature>/` directory should
  have matching test files under `test/<feature>/`. A unit test for
  logic, a browser/e2e test for user-facing behaviour.
- **Persist data with Drizzle + SQLite, never JSON files.** The scaffold
  wires up `db/schema.server.ts` and `db/connection.server.ts`. A
  `data/todos.json` or `db.json` used as a database resets on reload and
  cannot scale; define a Drizzle table instead.

---

## AI agent workflow (non-negotiable)

**These rules apply to ALL AI agents (Claude, Cursor, Copilot, etc.)
working on this codebase. They are not optional and must not be skipped
even if the user doesn't explicitly ask.**

### Before starting ANY work: verify and sync the branch

1. Check `git branch --show-current`
2. If on `main`/`master` → create a feature branch first
3. If on a feature branch → verify it matches the current task
4. Sync with parent: `git fetch origin && git rebase origin/main` if behind
5. Don't mix unrelated work on the wrong branch
6. **If more than one agent may work this repo at once, use a dedicated git
   worktree per task, never a shared checkout.** Two agents in one working
   directory collide: a `git checkout` in one moves `HEAD` under the other, so
   the next commit lands on the wrong branch. Isolate each task:
   `git worktree add -b <branch> ../<repo>-<slug> origin/main`, `cd` in, work
   there, and `git worktree remove` after the PR merges. Git enforces
   one-branch-per-worktree, so this makes the collision impossible. A lone agent
   in a clean checkout may use a plain branch.

### After cloning: verify the toolchain

Run `npm run doctor` (which runs `webjs doctor`) once after cloning to assert
the project is set up correctly: the Node major (the strip-types floor), the
tsconfig `erasableSyntaxOnly` flag, `.env` drift vs `.env.example`, vendor-pin
freshness, the `.gitignore` keeping `.webjs/vendor/` committable
(`vendor-gitignore`), importmap-coherence (the resolved client deps agree on a
shared transitive version), `@webjsdev/*` version coherence, and the git
pre-commit hook. It
prints `[pass]` / `[warn]` / `[fail]` per check with an actionable fix line and
exits non-zero only on a hard fail (a broken toolchain), so a green run means
`npm run dev` will boot. It is a local onboarding/setup-verify tool, not a CI
gate (its env-drift + network pin-freshness checks would make CI flaky).

### Every code change must include:

1. **Commit and push per logical unit, not at the end.** A logical unit is
   one feature, one fix, one rename, one doc rewrite. Small, focused commits
   with meaningful messages. Always `git push` after committing. Do not
   accumulate uncommitted or unpushed changes. If you have 5+ unstaged files
   spanning different concerns, commit before continuing. The
   `.claude/hooks/nudge-uncommitted.sh` hook fires at threshold 4 to remind
   you, and ignoring it means you are batching. The user should never have
   to ask for a commit.

2. **Tests.** Unit test for logic, E2E test for user-facing behavior.
   See the "Testing" section below for what type of test each change needs.
   Run `webjs test` after every change. Never mark work as done with
   failing tests.

3. **Documentation updates.** See the **Definition of done** section
   below for the per-surface checklist. The short version: docs land on
   the same PR as the code, never as a follow-up. Drift is how a
   codebase rots; the user should never have to ask "did you update the
   docs?"

4. **Convention check.** Run `webjs check` after changes and fix
   any violations before reporting the task as done.

5. **Type check.** Run `npm run typecheck` (which runs `webjs typecheck`,
   a `tsc --noEmit` over the app) and fix any type errors. `webjs check` is
   correctness-only and does NOT type-check, so this is the separate
   is-my-TypeScript-valid gate. It exits non-zero on a type error, so add it
   to CI once the app type-checks cleanly.

### Definition of done (MUST be addressed BEFORE opening the PR)

This is the per-PR contract. Before running `gh pr create`, walk through
every surface below and either update it OR write `N/A because <reason>`
in the PR body so the omission is visible. The
[`.github/pull_request_template.md`](./.github/pull_request_template.md)
checklist mirrors this list.

**Surfaces to consider on EVERY PR:**

1. **Tests.** Unit coverage for new logic. Real-browser coverage for
   user-facing behaviour. `webjs test` must pass; `webjs test --browser`
   for any DOM-touching change. See the "Testing" section below for the
   per-change matrix.
2. **Every markdown file in the project.** Walk the whole tree, not a
   closed list. Run `git ls-files '*.md'` (or `git ls-files '*.md'
   '*.mdx'` if the project ships MDX) and for each path ask: does this
   file describe behaviour, surface, or invariants that this PR changed?
   If yes, update it on this PR. Common surfaces (non-exhaustive):
   - `AGENTS.md` (root and every nested one) for API surface, invariants,
     file-routing rules, project-wide agent workflow.
   - `CONVENTIONS.md` (this file) for project conventions (layout,
     naming, testing). The `webjs check` correctness rules are a separate
     tool surface, not documented here (run `webjs check --rules`).
   - `README.md` (root and any nested ones) for install / use / public
     surface descriptions.
   - `CHANGELOG.md` for any user-visible change, including the SHA / PR
     reference. Keep it in chronological order; don't backdate.
   - `docs/` (if the project has one). Every user-visible change. Add a
     new page if the surface is new and there's no obvious home.
   - Any `*.md` under `agent-docs/`, `docs-internal/`, `decisions/`, or
     similar reference trees.
   - `.github/*.md` (issue templates, PR templates, contributing) when
     a workflow rule shifts.
3. **`website/`** (if the project has one). Marketing copy on the
   landing page or pricing page when the change touches a claim made
   there.
4. **Scaffold or codegen scripts** (if the project has any). Update
   when the change affects what new instances generate.
5. **PR body.** Summary, test plan checklist, and a per-row answer to
   the Definition-of-done checklist (`Updated <path>` or `N/A because
   <reason>`).

**How to use the checklist.** For each surface above, explicitly answer
one of:

- **Updated**, with the file path in the commit and PR body.
- **N/A because**, with a one-sentence reason.

The "every markdown file" rule is generative, not enumerative. New
markdown files appear over a project's lifetime, and this checklist
must not silently exclude them. The git query above is the source of
truth; the named files are just common cases.

If you find yourself writing `N/A` for every surface except tests, that
is a smell. Most user-visible code changes touch at least one markdown
file and either `AGENTS.md` or `CONVENTIONS.md`.

**Worked examples:**

- Add a new server action `modules/posts/actions/create-post.server.ts`.
  Updated: test (`test/posts/posts.test.ts`), `AGENTS.md` (action listed
  in the module map if the project keeps one), `CHANGELOG.md` (one-line
  entry), `docs/` (the page listing shipped actions if one exists). N/A
  on website / scaffold scripts.
- Rename a directory convention (e.g. `modules/` to `features/`).
  Updated: existing tests still pass after renames, every markdown file
  that mentions the old name (run `git grep -l 'modules/' '*.md'`),
  scaffold scripts, `CHANGELOG.md`. N/A on website unless the layout
  appears in a landing-page screenshot.
- Fix a bug in `rateLimit()` that doesn't change the surface. Updated:
  test (regression), `CHANGELOG.md` (one-line entry under fixes). N/A
  on every other markdown file because the public contract did not
  change.

### Pre-merge self-review loop (MUST run before signaling the PR is ready)

Saying "ready for merge" before a self-review loop converges is a recurring source of low-quality PRs. The pattern to avoid: agent claims ready-for-merge, user requests a code review, agent finds issues, fixes them, claims ready-for-merge again, repeat 4-5 cycles before a review comes back clean. The cure is to run that loop internally before the first "ready" signal, so the user only hears "ready to merge" after the loop has converged on a clean round.

**How the loop works:**

1. After committing the work and (if remote pushes are in use) pushing the branch, do NOT report "ready for merge" yet. Trigger a **fresh-context review pass**: an AI review with NO prior knowledge of the decisions you made during the implementation. Each AI tool exposes its own primitive for this:

   - **Cursor**: open a new composer tab.
   - **Claude Code**: spawn a `general-purpose` subagent via the Agent tool.
   - **GitHub Copilot**: open a new chat (reset the side panel).
   - **Antigravity** (Google, formerly Windsurf): open a new Cascade thread or a fresh side-panel session.
   - **Aider**: invoke a separately-started `aider` session (do NOT use `/ask` inside the same session; `/ask` only flips the mode for the next message and still sees the existing context).
   - **Gemini CLI**: invoke a separately-started `gemini` session.
   - **OpenCode**: open a new agent session (the `tool.execute.after` hook is a different surface and not a fresh-context primitive).

   The shared property is that the reviewer does not see your decision log. That independence is what makes the review catch blind spots. If your tool does not expose a true fresh-context primitive, the canonical fallback is a separately-invoked CLI process; what matters is the reviewer starts with an empty context, not the specific UI affordance.

2. Prompt the review for problems only. A working prompt template:

   > Review the changes on this branch against the project's `AGENTS.md` and `CONVENTIONS.md`. Look for bugs, regressions, security issues, missed edge cases, broken invariants, doc drift, test gaps, and style violations. Read every file the diff touches in its current state, not just the diff hunks. Specifically check: \<focus rotates per round\>. Report findings as a numbered list with file:line references. Problems only, no suggestions. If you find nothing genuinely wrong, reply exactly `CLEAN` on its own line and stop.

3. For each finding the review reports, either:

   - Fix it on the branch (commit + push), OR
   - Reject it explicitly with a one-sentence reason. False positives are real, but rejection has to be defensible (e.g. "the reviewer flagged X as a security issue but X runs server-side only and never reaches user input"). Hand-waving doesn't count.

4. If the round found any findings, run another round. The new round picks a slightly different focus: if round 1 was broad, round 2 zooms in on the file you most edited; if round 2 zoomed in, round 3 zooms out to cross-file consistency. Rotate focus to avoid the reviewer rediscovering the same surface twice.

5. If the round reports `CLEAN`, the loop is done.

The minimum is TWO rounds. A clean first round is rare and usually means the review was too shallow; if round 1 is clean, run a second one with a sharper focus before believing the result.

**When to skip the loop:**

Skip only for changes that touch a single line of trivially-correct content (a doc typo, a renamed local variable, a one-token config bump). Anything that touches logic, public surface, build, security, or multiple files goes through the loop without exception. A bias toward running the loop is correct; a bias toward skipping it is the exact failure mode this rule exists to prevent.

**Reporting after the loop:**

When the user is notified the PR is ready, the message should carry:

> Ready for merge. Self-review loop ran \<K\> rounds; last round clean. Issues found and fixed during the loop: \<one-line list, or "none" if rounds 2+ kept finding nothing\>.

If you cannot honestly say "last round clean", you cannot say "ready for merge". If a finding was rejected as a false positive, mention it so the user can second-guess the rejection.

### Autonomous mode (sandbox / bypass permissions)

When running without interactive approval, agents must NOT ask questions.
Instead, auto-decide using best practices:
- On `main`? → Auto-create `feature/<task-slug>` branch
- Parent branch has new commits? → Auto-rebase before starting
- Ready to merge? → Auto-merge, delete feature/fix branches, keep
  long-lived branches (dev, staging, release/*)
- Commit message? → Auto-generate: what changed and why
- Tests failing? → Fix them, don't report the failure and stop
- Convention violations? → Fix them silently

The quality bar is the same. Autonomous mode means faster, not sloppier.

### What "automatically" means:

When a user says "add a contact page" or "add a delete button to posts",
the AI agent must deliver:
- The implementation (page, component, action, etc.)
- Unit tests for any new server actions/queries/components
- E2E test if the feature involves user interaction
- Documentation updates if applicable

The user should never have to say "also write tests" or "also update the
docs". That is the agent's default behavior in a webjs project.

---

## Data persistence: Drizzle + SQLite, never JSON files

<!-- OVERRIDE -->

Every webjs app uses **Drizzle + SQLite** for persistence by default. The
scaffold ships the `db/` folder (`schema.server.ts`, `columns.server.ts`,
`connection.server.ts`), the `webjs.dev.before` + `webjs.start.before` steps
that run `webjs db migrate` inside `webjs dev` / `webjs start` (#550), and the
`npm run db:generate` / `db:migrate` / `db:push` / `db:studio` / `db:seed`
scripts (which route through `webjs db` to drizzle-kit). The loop after a
schema change is `db:generate` (authors the migration) then `webjs dev` (the
`dev.before` step applies it); `db:generate` is never auto-run on boot.

**AI agents: these rules are absolute.**

1. For ANY data the app stores (todos, posts, messages, products,
   comments, users…), define a Drizzle table in `db/schema.server.ts`
   and persist there.
2. **NEVER** create JSON files under `data/`, `db.json`, `posts.json`,
   `todos.json`, etc. as a fake database. It resets on reload and cannot
   scale; this is a project convention (see the conventions section above).
3. **NEVER** use module-scope arrays or `Map`s as a "store". They
   reset on every dev-server reload and can't scale beyond one process.
4. **NEVER** use `localStorage` / `sessionStorage` to persist app data,
   it's per-browser and never reaches the server. Use it only for UI
   preferences (theme, sidebar collapsed, etc.).
5. To add a model: edit `db/schema.server.ts`, then `npm run db:generate`
   and `npm run db:migrate`. Access via `import { db } from
   '#db/connection.server.ts'` (and the tables from
   `db/schema.server.ts`) **only inside `.server.{js,ts}` files,
   `route.ts` handlers, or `middleware.ts`**. Components, pages, and
   layouts call into the wrapped server query instead; the framework
   rewrites that import to an RPC stub on the browser side, so the DB
   driver never reaches the client.

To switch to Postgres: scaffold with `--db postgres`, or swap
`db/columns.server.ts` + `db/connection.server.ts` for the Postgres
variants and point `DATABASE_URL` at Postgres. The schema, queries, and
actions are unchanged. SQLite is the right default for dev and small
production workloads.

---

## The scaffold is reference, not the final product

<!-- OVERRIDE -->

This project was created with `webjs create`. Every file you see right
now (the `app/page.ts` homepage, the example `User` model, the
`theme-toggle` component, the gallery under `app/features/` and
`app/examples/` in the full-stack template, the example users module in
api / saas templates) is a **starting point**.

The full-stack scaffold ships a **gallery** organized by kind so features
and whole apps are not mixed. `app/features/<name>/` are single-feature
demos, one webjs concept each (routing, components, server-actions,
optimistic-ui, async-render, directives, route-handler). `app/examples/<name>/`
are whole example apps that compose several features (todo: optimistic UI
+ progressive enhancement + a11y + db + modules). Both keep their logic in
`modules/`, are small and heavily commented, and are the PRIMARY reference
for how webjs works.

**Study the whole gallery FIRST, prune SECOND.** Before writing or deleting
anything, read every feature demo and the example app end to end (code AND
comments) to absorb the idioms you will reuse. Only AFTER you have
internalised the patterns should you prune. Never delete the examples
blindly up front (that discards your context before you have read it), and
never prune the durable knowledge surfaces (`AGENTS.md`, `CONVENTIONS.md`,
the per-agent rule files), which stay as context for every future
iteration.

Then prune: the examples are REFERENCE, not the app, so keep and adapt the
ones you need and **delete the rest**. Pruning a route means deleting its
`app/features/<name>` or `app/examples/<name>` folder AND its
`modules/<name>` folder (for the todo app, also the `todos` table in
`db/schema.server.ts` and its link in `app/page.ts`). Each route page
carries a `webjs-scaffold-placeholder` marker, so `webjs check` fails until
you consciously keep-and-adapt or prune it. After pruning, delete any
now-empty directories, an empty `lib/utils/` or `modules/<name>/` is
leftover scaffolding, not structure.

**`app/` is routing-only.** Only routing files belong in `app/` (page,
layout, route, middleware, and metadata routes). CSS, helpers, and
constants do NOT: the theme lives at `styles/globals.css` (NOT
`app/globals.css`), browser-safe helpers at `lib/utils/`, and feature
logic in `modules/`. If you add a stylesheet or a helper, put it outside
`app/`.

When the user asks the agent to build their actual app:

1. **Replace the example `User` model** in `db/schema.server.ts` with
   the real domain models the app needs (e.g. `Todo`, `Post`, `Message`),
   unless the app actually has users.
2. **Replace `app/page.ts`** with the app's real homepage. Don't ship
   "Hello from …" as the deliverable.
3. **Delete or replace `components/theme-toggle.ts`** if the app doesn't
   need a theme picker.
4. **Delete the example users module** (api/saas templates) if the app
   doesn't use it.
4b. **Prune the gallery** (full-stack template). Keep and adapt the
   `app/features/` demos and the `app/examples/` app the real app uses,
   delete the rest (route + module + any table), and remove their links
   from `app/page.ts`.
5. **Adapt `app/layout.ts` to the app, not just the page.** Set the real
   brand, replace the example `Home` nav with the app's navigation, and
   pick a content-width container that fits. The default
   `<main class="max-w-[760px]">` is a reading column for prose, forms,
   and marketing. Widen it or drop the cap for a full-bleed app,
   dashboard, or board, or a wide layout overflows into an unnecessary
   horizontal scrollbar. Keep the design tokens and theme setup, those
   are infrastructure.
6. **Use a unique design (UI apps).** Give the app a look of its own that
   fits what the user asked for. Choose the palette, layout, typography,
   spacing, and chrome deliberately. Do NOT mimic the scaffold's example
   look (its warm accent, the 760px reading column, the serif display, the
   example header/nav), and do not just recolor the same layout. The
   `api` template has no UI, so this does not apply there. The design
   tokens and theme wiring in `app/layout.ts` are infrastructure to keep
   and restyle on top of, not the example look to preserve.
7. **Keep:** the Drizzle setup, the test config, the agent config files
   (`AGENTS.md`, `CONVENTIONS.md`, `CLAUDE.md`, `.cursorrules`, etc.),
   `db/connection.server.ts` + `db/columns.server.ts`, the directory
   conventions, the design tokens in `app/layout.ts`. These are the
   infrastructure, not the example app.

This is enforced, not just advised. The example `app/page.ts`,
`app/layout.ts`, and each `app/features/<name>/page.ts` +
`app/examples/<name>/page.ts` carry a
`webjs-scaffold-placeholder` marker comment, and the
`no-scaffold-placeholder` check fails while any marker remains, so a
freshly scaffolded app fails `webjs check` until you address each
placeholder. The marker is acknowledge-and-remove: replace the example
content, or deliberately keep it, and in either case delete the marker
line. So the delivered app contains only what the user asked for, never
leftover scaffold code.

The scaffold exists so the agent doesn't reinvent the directory layout,
the Drizzle wiring, the test runner config, or the convention files. It
does NOT exist so the agent ships the example homepage.

---

## Sensible defaults

<!-- OVERRIDE -->
webjs uses sensible defaults. Environment
variables control infrastructure (no config files needed):

| Environment variable | Effect |
|---|---|
| `REDIS_URL` | Connection string consumed by `redisStore({ url: process.env.REDIS_URL })`. Not auto-wired. Call `setStore(redisStore())` once at app startup to put cache / sessions / rate-limit on Redis. |
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional) |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID (optional) |
| `PORT` | Server port. Precedence: `--port` flag > `PORT` (a real exported env var or a `PORT` in `.env`) > 8080. |
| `WEBJS_PUBLIC_*` | Any env var starting with this prefix is exposed to the browser as `process.env.WEBJS_PUBLIC_X`. Components can read it directly. No build step, no transform. Use for API base URLs, Stripe publishable keys, analytics IDs, anything that is intended to be visible client-side. |

**Server-only by default.** Any env var without the `WEBJS_PUBLIC_` prefix never reaches the browser. Reading `process.env.DATABASE_URL` from a component returns `undefined`, the same as a typo. The prefix is fail-closed: secrets cannot accidentally leak.

**Development:** zero env vars needed. Everything works with memory/cookie/disk.
**Production:** set `AUTH_SECRET` + `SESSION_SECRET`. For horizontal scaling, also set `REDIS_URL` and add one line at app startup:

```js
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

---

## Architecture: Modules

<!-- OVERRIDE -->
This app uses the **modules architecture** for feature-scoped code:

```
modules/
  <feature>/
    actions/        Server mutations (one async function per file, *.server.ts)
    queries/        Server reads (one async function per file, *.server.ts)
    components/     Feature-owned web components
    utils/          Pure helper functions
    types.ts        Shared TypeScript types / JSDoc typedefs
```

**Rules:**
- **Prefer the `#` root alias over deep relatives.** Write `import { db } from '#db/connection.server.ts'`, `import { Button } from '#components/ui/button.ts'`, `#lib/...`, `#modules/...` instead of `../../../`. It is native `package.json "imports"` (the single `"#*": "./*"` key covers every top-level folder, so a new folder needs no config), resolved by Node and Bun with no build step. There is no slash after the `#` (`#lib/...`, not `#/lib/...`). A same-directory import stays relative (`./sibling.ts`).
- One exported function per server action/query file
- Server actions need BOTH the `.server.{js,ts}` extension AND a `'use server'` directive at the top. Extension alone marks a server-only utility (source-protected, not RPC-callable). Directive alone is a lint violation (`use-server-needs-extension`).
- Components must call `Class.register('tag')`
- **Server-only code goes in `.server.{js,ts}` files, `route.ts` handlers, or `middleware.ts`. Never in pages, layouts, or components.** Direct imports of a DB driver (`pg`) or `node:*` from pages, layouts, or components crash the browser at module load. Wrap in a `.server.{js,ts}` file; the framework rewrites that import to an RPC stub on the browser side. The DB lives in `db/*.server.ts`; `lib/` holds other server-only infra and browser-safe utilities (`lib/utils/cn.ts` with `cn`); the convention is "if a `lib/` file needs Node APIs, only import it from server-only files." A TYPE-ONLY `import type { Todo } from '#db/schema.server.ts'` is the exception, fine in a page or component because the stripper erases it before it reaches the browser.
- Routes (`app/**/page.ts`, `app/**/route.ts`) must be thin: import logic from modules
- **Fetch server data in the component that needs it, with an `async render()`, not by prop-drilling.** A leaf component can write `const u = await getUser(this.uid)` directly in `render()`; SSR awaits it so the data is in the first paint, and the client uses stale-while-revalidate on a re-fetch. Reach for `renderFallback()` only to show a re-fetch loading state, and `Task` / signals only for genuinely client-only data (a `Task` shows its pending state at SSR, losing first-paint data). Do not put `await getData()` in a page / layout when a leaf component can own it (page fetches run sequentially, a route-level waterfall).
- **Keep pages and layouts as pure carriers, so their modules stay out of the network tab.** A page/layout never hydrates; the framework drops its module from the browser as long as its only browser-relevant job is registering the components it imports. It starts shipping its own module (invisible in tests) the moment its closure does any OTHER client work. So do not give a page/layout module-scope client work (a top-level call, a `window` / `document` / `customElements` access, a bare side-effect import, or a `@webjsdev/core/client-router` import: routing is automatic), and do not import a client-global-touching non-component util into it. Put client behaviour in a component, server-only code in `.server.{js,ts}`. Self-check: `page.ts` / `layout.ts` should not appear in the browser's network tab.

---

## Architecture: Routes

<!-- OVERRIDE -->
Routes live under `app/` and follow NextJs App Router conventions:

- `app/page.ts`: Homepage
- `app/<segment>/page.ts`: Static route
- `app/[param]/page.ts`: Dynamic route
- `app/[...rest]/page.ts`: Catch-all
- `app/(group)/...`: Route group (folder not in URL)
- `app/**/route.ts`: API endpoint
- `app/**/layout.ts`: Layout wrapper
- `app/**/error.ts`: Error boundary
- `app/**/middleware.ts`: Per-segment middleware

**Special route files:**
- `app/**/error.ts`: Error boundary. Default export receives `{ error }`, returns `TemplateResult`. Nearest boundary catches errors from pages below it.
- `app/**/loading.ts`: Loading state. Auto-wraps the sibling page in a `Suspense` boundary. Shown while async page functions resolve.
- `app/**/not-found.ts`: 404 page. Nearest wins when `notFound()` is thrown.
- `app/sitemap.ts`: Dynamic sitemap at `/sitemap.xml`. Export a function returning an array of `{ url, lastModified }`.
- `app/robots.ts`: Dynamic robots.txt at `/robots.txt`.
- `app/manifest.ts`: Web app manifest at `/manifest.json`.

**Rules:**
- A folder cannot have both `page.ts` and `route.ts`
- Page/layout default exports must be functions (possibly async)
- Route handlers export named methods: `GET`, `POST`, `PUT`, `DELETE`, `WS`

---

## Testing

<!-- OVERRIDE -->
Tests are organised by **feature**, mirroring `modules/<feature>/`.
Each feature gets its own folder under `test/`, even when it starts
with a single file. Test KIND (browser / e2e / smoke) lives in a
subfolder inside the feature, and only appears when there is a real
test of that kind.

```
test/
  <feature>/
    <name>.test.ts             ← node test: unit + integration
    browser/<name>.test.js     ← real-browser test (web-test-runner)
    e2e/<name>.test.ts         ← full-app end-to-end (opt in: WEBJS_E2E=1)
    smoke/<name>.test.ts       ← fast post-deploy sanity check
```

Concrete example:

```
test/
  auth/
    auth.test.ts                 # signup / login / currentUser, node
    password.test.ts             # hashing / verify, node
    browser/login-form.test.js   # real-browser, only if exercising DOM
  posts/
    posts.test.ts                # CRUD via actions
    browser/post-editor.test.js
  hello/
    hello.test.ts                # the scaffold's starter test
    browser/hello.test.js
    e2e/hello.test.ts
```

### Test kinds

| Kind | Where | What it does |
|------|-------|--------------|
| node (unit + integration) | `test/<feature>/*.test.ts` | Fast, no spawned process. Import server actions/queries/utilities and call them directly. Use `renderToString` for SSR HTML assertions. |
| browser | `test/<feature>/browser/*.test.js` | Real Chromium via web-test-runner + Playwright. Shadow DOM, events, `adoptedStyleSheets`, `IntersectionObserver`. |
| e2e | `test/<feature>/e2e/*.test.ts` | Boots the app and drives it through HTTP / a real browser. Gated behind `WEBJS_E2E=1` so it doesn't run on every `webjs test`. |

For a browser component test, `ssrFixture(html\`<my-el></my-el>\`)` from
`@webjsdev/core/testing` server-renders THEN hydrates the component, awaiting
its native `updateComplete`, so the post-hydration DOM is observable and an
SSR-vs-hydrate mismatch shows up (contrast `fixture()`, which only waits two
macrotasks). `assertNoA11yViolations(el)` is the OPT-IN axe-core accessibility
assertion: axe-core is a test-only devDependency, dynamically imported, never
shipped to the app runtime, and the assertion is never an automatic gate.
Install it once with `npm install -D axe-core` (the scaffold already lists it).
The scaffold's `test/hello/browser/hello.test.js` demonstrates both.
| smoke | `test/<feature>/smoke/*.test.ts` | Fast deploy-time sanity check (single critical path; "does this surface still return 200"). |

### Running

- `webjs test` (or `node --test`) runs the node tests (unit + integration + smoke).
- `webjs test --browser` (or `npx wtr`) runs the browser tests.
- `WEBJS_E2E=1 webjs test` adds the e2e tests.

### The handle() test harness (full-pipeline node tests)

For a node test that needs the REAL request pipeline (middleware, routing,
SSR, page actions, server-action RPC, auth + CSRF), drive
`createRequestHandler({ appDir }).handle(request)` and assert on the
`Response`. `@webjsdev/server/testing` ships thin builders over it:

```ts
import { createRequestHandler } from '@webjsdev/server';
import { testRequest, invokeActionForTest, loginAndGetCookies, withSessionCookie }
  from '@webjsdev/server/testing';

const app = await createRequestHandler({ appDir: process.cwd(), dev: true });

// fire a request, assert the response
const res = await testRequest(app.handle, '/about');

// real login, reuse the captured session cookie on a protected route
const { cookies } = await loginAndGetCookies(app.handle, { email, password });
const dash = await testRequest(app.handle, '/dashboard', withSessionCookie({}, cookies));

// round-trip a server action through the REAL /__webjs/action/<hash>/<fn> path
const out = await invokeActionForTest(app, 'modules/posts/actions/create.server.ts', 'createPost', [input]);
```

Prefer `invokeActionForTest` over a direct import of the action when you want
to verify the production contract: it exercises the wire serializer (a `Date` /
`Map` arg survives), the Origin / Sec-Fetch-Site CSRF check (it models a
same-origin POST), and prod error sanitization, which a direct call bypasses.
The saas template's `test/auth/auth.test.ts` is a worked example.

This is also why the auth test lives at `test/auth/auth.test.ts` (the
feature-folder convention), NOT `test/unit/auth.test.ts`. Test KIND is a
subfolder inside a feature, never the top level.

**Every change ships with a test.** This is a convention, not a hard
gate, consistent with the convention-vs-check principle this file
states (a sensible app can legitimately want a test-less commit for a
spike, a vendored file, or a pure refactor). For Claude Code, a commit
that stages app code (`app/`, `modules/`, `components/`, `lib/`) without
staging a test WARNS via `.claude/hooks/require-tests-with-src.sh`, then
lets the commit through. A project that wants the strict floor opts into
a hard block by setting `WEBJS_TEST_GATE=block` (in
`.claude/settings.json` env, your shell, or CI). A unit test alone is
not enough for interactive or component code: add the browser test that
asserts the rendered/hydrated behaviour. The real enforcement is CI: the
test suite runs in `.github/workflows/ci.yml` on every PR and push to
main, so the gate cannot be skipped with a local `--no-verify`.

### Choosing a feature folder

Use the same name as the matching module folder when one exists:
`modules/posts/` ↔ `test/posts/`. If the test spans more than one
module (a full-stack flow), pick the most prominent one or create a
new feature folder (`test/checkout/`, `test/onboarding/`).

If you find yourself reaching for `test/utils/` or `test/misc/`,
the feature folder is missing. Name it after the user-facing concern.

### Debugging with Playwright MCP

This project includes a Playwright MCP server (`.claude.json`). When
debugging UI issues, AI agents can use the Playwright MCP tools to:
- Navigate to pages in a real browser
- Click elements, fill forms, interact with the UI
- Take screenshots to see what the user sees
- Inspect the accessibility tree for element discovery

Use `Playwright MCP` tools instead of writing one-shot Bash scripts
with puppeteer or playwright imports.

### When to write tests

| Change | Server test (node:test) | Browser test (WTR) |
|--------|------------------------|-------------------|
| New server action | Required | - |
| New component | Required (SSR output) | Required (interaction) |
| New page/route | - | Required |
| Bug fix | Required (regression) | If user-facing |
| Refactor | Existing tests must pass | Existing tests must pass |

---

## UI components: prefer the Webjs UI kit over raw Tailwind

<!-- OVERRIDE -->

This scaffold ships with the Webjs UI kit preinstalled at `components/ui/`.
The kit splits into **two tiers**. Picking the wrong tier produces
broken markup.

**Tier 1: class helpers** (button, card, input, label, alert, badge,
separator, skeleton, table, etc.): pure functions that return Tailwind
class strings. Call them and spread onto a **raw native element**.

**Tier 2: custom elements** (dialog, popover, tooltip, dropdown-menu,
tabs, accordion, collapsible, progress, etc.): real `<ui-X>` tags. Import
the module once (typically in `app/layout.ts`) and use the tag.

```ts
// Tier 1: class helpers on native elements (use this for forms,
// dashboards, cards, layouts, anywhere the value is purely visual)
import { buttonClass } from '#components/ui/button.ts';
import { inputClass } from '#components/ui/input.ts';
return html`
  <button class=${buttonClass({ size: 'lg' })}>Save</button>
  <input class=${inputClass()} placeholder="Email">
`;

// Tier 2: custom elements (modals, dropdowns, tab strips, tooltips,
// state the browser doesn't give you natively)
return html`
  <ui-dialog>
    <ui-dialog-trigger>
      <button class=${buttonClass({ variant: 'outline' })}>Edit</button>
    </ui-dialog-trigger>
    <ui-dialog-content>…</ui-dialog-content>
  </ui-dialog>
`;

// Avoid: hand-rolled Tailwind on every <button> loses visual
// consistency. Tier-1 helpers give you the same control with one import.
return html`
  <button class="px-4 py-2 rounded-md bg-accent text-accent-fg">Save</button>
`;
```

Add more components with `webjs ui add <name>` (e.g. `webjs ui add dialog
tabs popover`). The catalogue lives at
[https://ui.webjs.dev](https://ui.webjs.dev).

**Hand-rolled Tailwind is still appropriate for:**
- One-off marketing pages, hero sections, landing CTAs.
- Anywhere the visual design intentionally diverges from the kit baseline.
- Layout primitives (`<div class="grid grid-cols-3 gap-4">`).

The convention: any visual element with a Tier-1 helper uses the helper.
Any stateful behavior with a Tier-2 element uses the element.

---

## Components

<!-- OVERRIDE -->

```ts
import { WebComponent, html } from '@webjsdev/core';

// Recommended declare-free base-class factory style
export class MyWidget extends WebComponent({
  label: String,
  count: Number
}) {
  // Light DOM is the default; Tailwind utility classes apply directly.

  constructor() {
    super();
    // Defaults go here, never as class-field initializers
    // (`label = ''` would clobber the framework's reactive accessor).
    this.label = '';
    this.count = 0;
  }

  render() {
    return html`
      <div class="p-4 border border-border rounded-lg">
        <p class="font-serif text-fg">${this.label}: ${this.count}</p>
      </div>
    `;
  }
}
MyWidget.register('my-widget');
```

Reactive properties are declared one way: pass the properties shape directly to the base-class factory `WebComponent({ ... })` (e.g. `label: String`). The property types flow to `this.<prop>` with no `declare` lines needed, and the factory installs the reactive accessors so a class-field initializer can never clobber them. For per-property options use the `prop()` helper inside the shape (`count: prop(Number, { reflect: true })`, `mode: prop({ state: true })`); narrow a type with `prop<Student>(Object)`. Set defaults by assigning in the constructor after `super()`. A hand-written `static properties = { ... }` THROWS at construction (`no-static-properties`). The factory gives you full intelligence in any tsserver-backed editor. See the Editor Setup docs for the standalone `@webjsdev/intellisense` (no Lit dependency) that extends this to tag / attribute intelligence inside `html\`…\`` templates (go-to-definition, binding-aware completions, value/binding diagnostics, hover); in VS Code / Cursor / Windsurf the `webjs` extension bundles it automatically.

**Rules:**
- One component per file
- **Light DOM by default.** Opt in to shadow DOM with `static shadow = true` when you need scoped styles (via `static styles = css\`...\``) or third-party-embed isolation. `<slot>` projection works identically in both modes (named slots, fallback content, `assignedNodes` / `slotchange`, first-wins resolution), so slot usage alone is never a reason to opt into shadow DOM.
- Prefer Tailwind utility classes for styling. They're unique by construction (`p-4`, `font-semibold`) so they can't collide across components.
- **If a light-DOM component authors its own custom CSS (a `<style>` block in `render()` or an imported stylesheet), every class selector MUST be prefixed with the component's tag name.** Either pattern works. Pick one and stay consistent:
  - `.my-widget__body`, `.my-widget__title` (BEM-ish)
  - `my-widget .body`, `my-widget .title` (descendant selector)
- **Never extend raw HTMLElement directly for app components.** Always subclass `WebComponent` (or the factory form `WebComponent({...})`) to hook into SSR, lifecycle, elision, and the reactive property system. Extend raw HTMLElement only for rare native-API edge cases (like form-associated `ElementInternals` or customized built-in elements), and add a `webjs-allow-htmlelement: <reason>` comment to acknowledge the exception.
- Tag name must contain a hyphen (HTML spec)
- Always call `Class.register('tag')`. That's the standard DOM API.
- **Reactive props are declared via the base-class factory `WebComponent({ ... })`.** A hand-written `static properties = { ... }` throws at construction (`webjs check` flags it via `no-static-properties`). Never write `propName = value` or `propName: Type = value` as a class-field initializer on a reactive prop. It compiles to `Object.defineProperty(this, …)` after `super()` and clobbers the framework's reactive accessor, silently breaking re-renders (`webjs check` flags this via `reactive-props-no-class-field`). Set defaults in the constructor. Declare an array-typed prop with the `Array` constructor, not `Object` (`items: prop<Tag[]>(Array)`): the two share one JSON converter so neither crashes, but `Array` states the shape and `webjs check` flags the `Object` form via `array-prop-uses-array-type`.
- Component state lives in signals. Import `signal` from `@webjsdev/core`, read via `signal.get()` inside `render()`, write via `signal.set(value)`. Module-scope signals share state across components; instance signals (created in the constructor) carry component-local state. Reactive properties (declared via the factory) wrap HTML attributes, attribute reflection, and `.prop=${value}` SSR hydration.
- Use lifecycle hooks (`firstUpdated`, `updated`) only when needed

---

## Components: Light DOM (default) vs Shadow DOM (opt-in)

<!-- OVERRIDE -->

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Write `class="..."` in your template. Plain children, global styles apply. |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` scopes bare selectors. |
| `<slot>` content projection | **Either** | Same `<slot>` / `<slot name="x">` / fallback / `assignedNodes` / `slotchange` API in both modes. Light DOM uses framework projection; shadow DOM uses native browser projection. |
| Third-party embed isolation | Shadow DOM | CSS can't leak in or out. |

**Light DOM** = the component renders as plain HTML. Global CSS and
Tailwind utility classes apply directly. Use `document.querySelector`
to find elements. No `:host`, no `::part`, no CSS-variable plumbing.

**Shadow DOM** = opt-in style encapsulation. Declare `static shadow = true`
and author styles via `static styles = css\`...\`` (adopted via
`adoptedStyleSheets`). The browser enforces the boundary, and nothing
leaks in or out.

Both modes are fully SSR'd. Light DOM emits content as direct children
with a `<!--webjs-hydrate-->` marker. Shadow DOM emits a
`<template shadowrootmode="open">` that the browser attaches automatically.
Both hydrate without flash on the client.

---

## Styling: Tailwind-first + JS helpers

<!-- OVERRIDE -->

The scaffold ships with the **Tailwind CSS browser runtime** + `@theme`
design tokens defined in the root layout. Every colour, font family,
fluid type scale value, and motion duration is declared once in `@theme`
and available everywhere via utility classes (`text-fg`, `bg-bg-elev`,
`font-serif`, `duration-fast`, `text-display`).

**Tailwind-first is the strong default for pages AND light-DOM
components (the default DOM mode).** Use utilities for layout, spacing,
color (via the `@theme` tokens), typography, borders, radius, shadows,
and interaction states (hover/focus/active/disabled, dark mode). Light
DOM does not scope styles, so utilities apply directly.

**Pin a header with `position: fixed`, never `position: sticky`.** A
sticky header flickers its background for one frame on iOS WebKit (every
iOS browser) during a client-router navigation, because the preserved
header plus the scroll-to-top trips a WebKit sticky-repaint bug that the
usual GPU-promotion hacks (`translateZ`, `will-change`) do NOT fix. Use
`position: fixed` and reserve the header height on the content with a
`--header-height` variable (the scaffolded `app/layout.ts` does exactly
this, kept exact by a `ResizeObserver`). It is iOS-only, invisible on
desktop, Android, and in DevTools emulation, so it shows only on a real
device.

**The lit muscle-memory trap.** If you have written lit, the habit is to
scope CSS in a shadow root (`static styles = css\`\``) or write an inline
`<style>` with semantic class names (`.hero`, `.feature`, `.card`) for
every component. In a webjs light-DOM component the scoped block does
nothing without `static shadow = true`, and the inline class names leak
into the global namespace. Prefer Tailwind utilities. When the same
bundle repeats, extract a `lib/utils/ui.ts` helper (below), not a CSS
class.

**Custom-CSS allowlist (the only things raw CSS is for).** Reserve raw
CSS for what utilities cannot express: design-token `:root` / `@theme`
definitions, `@property` animated custom properties with `@keyframes`,
`::-webkit-scrollbar` / `scrollbar-color`, `prefers-reduced-motion`
blocks, and complex `color-mix()` or gradient effects. When custom CSS is
unavoidable in a light-DOM component, the class-prefix rule (see the
Components section above) still applies. Shadow-DOM components
(`static shadow = true`) legitimately author `static styles = css\`\``;
that is the right home for scoped CSS.

**Dedup repeated Tailwind class bundles with JS helpers, not `@apply`.**
When the same string of classes appears in 2+ places, extract it into a
small function in `lib/utils/ui.ts`:

```ts
// lib/utils/ui.ts
import { html } from '@webjsdev/core';

export function rubric(label: string) {
  return html`
    <span class="block font-mono text-[11px] leading-none font-semibold tracking-[0.2em] uppercase text-accent mb-4">● ${label}</span>
  `;
}
```

Consume:

```ts
// app/page.ts
import { rubric } from '#lib/utils/ui.ts';

export default function Home() {
  return html`
    ${rubric('welcome')}
    <h1 class="font-serif text-display">Hello</h1>
  `;
}
```

Helpers run at SSR time inside `html\`\``, so the output is identical
to writing the classes inline. No client-side runtime.

**Why not `@apply`?** `@apply` hides which utilities back a class and
creates a second source of truth. JS helpers keep the class bundle
visible at the definition site and compose naturally with conditional
classes and active states.

**Custom CSS is still supported.** Plain `<style>` blocks, CSS modules,
or a build-step pipeline. The framework has no hard dependency on Tailwind.
If you mix custom CSS into a light-DOM component, apply the class-prefix
rule (see Components section above).

**Dark mode uses two signals; a theme switch must set both.** The editorial
chrome tokens (`--fg`, `--bg`, `--accent`) follow a `data-theme` attribute on
`<html>`; the Webjs UI kit under `components/ui/` follows a `.dark` class
(`@custom-variant dark (&:is(.dark *))`). The scaffold's head init script and
`theme-toggle` set **both** (`data-theme` AND
`classList.toggle('dark', isDark)`). If you replace the toggle or build your
own theme switch, set both, or the `components/ui/*` render light tokens on a
dark page (white buttons and cards, invisible text) while the chrome looks
correct. Light mode hides this (both systems default to light), so **verify
dark mode in a browser, not just light.**

---

## Styling alternative: vanilla CSS end-to-end

<!-- OVERRIDE -->

If you'd rather skip Tailwind, webjs works with plain CSS as long as you
wrap pages, layouts, and components so class names don't collide in the
global light-DOM namespace.

**Convention: three scopes**

| Scope | Wrapper | Derivation |
|---|---|---|
| **Component** | Custom-element tag | Tag is already unique |
| **Page** | `.page-<route>` | `app/dashboard/page.ts` → `.page-dashboard`; `app/blog/[slug]/page.ts` → `.page-blog-slug`; root `app/page.ts` → `.page-home` |
| **Layout** | `.layout-<name>` | `app/layout.ts` → `.layout-root`; `app/admin/layout.ts` → `.layout-admin` |

Every page wraps its output in `<div class="page-<route>">`. Every
layout wraps in `<div class="layout-<name>">`. Components scope via
their tag. Styles colocate as `const STYLES = css\`…\`` + `<style>${'$'}{STYLES.text}</style>`.

```ts
// app/dashboard/page.ts
import { html, css } from '@webjsdev/core';

const STYLES = css\`
  .page-dashboard {
    .actions     { display: flex; gap: 12px; }
    .btn         { padding: 12px 24px; border-radius: 999px; }
    .btn-primary { background: var(--accent); color: var(--accent-fg); }
  }
\`;

export default function Dashboard() {
  return html\`
    <style>${'$'}{STYLES.text}</style>
    <div class="page-dashboard">
      <div class="actions">
        <a class="btn btn-primary" href="/new">+ New</a>
      </div>
    </div>
  \`;
}
```

Inside each scope, `.btn` / `.input` / `.form` / `.item` are free
names. CSS descendant combinators stop them at the scope boundary.
A small curated set of **primitives** (`rubric`, `banner`,
`accent-link`, `display-h1`, …) can live global in the root layout
as your design system.

**When you'd pick this over Tailwind:**
- You want zero runtime scripts and zero build step.
- You prefer idiomatic CSS and plain-cascade debugging.
- You already have a design system in CSS custom properties.

**Costs:**
- Write more per-file CSS (no utility ecosystem).
- Discipline: every page/layout remembers to wrap.
- Renaming a route folder = 2 textual edits in one file (the wrapper class + the matching `class=` attribute).

Pick one convention per project and stay consistent.

---

## Rate limiting & middleware

<!-- OVERRIDE -->
Use `rateLimit()` as per-segment middleware to protect routes:

```ts
// app/api/auth/middleware.ts: protect auth endpoints
import { rateLimit } from '@webjsdev/server';

// Direct deploy (default). Keys on the socket-stamped IP, ignoring
// forwarded-IP headers.
export default rateLimit({ window: '10s', max: 5 });

// Behind a reverse proxy or CDN (Cloudflare, Railway, Fly, Vercel,
// nginx, Caddy). Set trustProxy to honour X-Forwarded-For. The proxy
// MUST strip inbound X-Forwarded-For before adding its own.
export default rateLimit({ window: '10s', max: 5, trustProxy: true });
```

Place `middleware.ts` at any route level. It applies to that subtree only.
Chain runs outermost → innermost.

---

## Lazy loading

<!-- OVERRIDE -->
For below-the-fold components with heavy JS, defer loading until visible:

```ts
class HeavyChart extends WebComponent {
  static lazy = true;  // module loaded on scroll, not on page load
  // ...
}
```

SSR content is visible immediately. Only the JS download is deferred.
**Do NOT use** for above-the-fold or critical UI (navigation, forms).

---

## REST endpoints from server actions (route.ts)

<!-- OVERRIDE -->
A server action is RPC-callable from components. To ALSO reach the same
function over plain HTTP (mobile apps, webhooks, third parties), put it behind
a `route.ts` handler. The action stays a normal `'use server'` function; the
route imports and calls it.

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';
export async function createPost({ title, body }) {
  const [post] = await db.insert(posts).values({ title, body }).returning();
  return post;
}
```

```ts
// app/api/posts/route.ts
import { route } from '@webjsdev/server';
import { createPost } from '#modules/posts/actions/create-post.server.ts';
// The route() adapter merges query + route params + JSON body into one input
// object and JSON-responds the result. Pass { validate } to guard the input.
export const POST = route(createPost);
```

A hand-written `route.ts` (a `POST(req)` that reads the body and calls the
action) is always available for full control (custom headers, streaming).

**Security:** a `route.ts` REST endpoint is NOT CSRF-protected (only the RPC
path is). Authenticate every mutating endpoint via bearer tokens, API keys, or
auth middleware.

---

## Progressive enhancement (write HTML-first)

<!-- OVERRIDE -->

webjs pages work without JavaScript by design. Read-paths render to
real HTML on the server. Write-paths run through plain `<form>` plus
server actions, and navigation is a real `<a href>`. Every web component
is SSR'd too. Its `render()` runs on the server, so the component's
initial markup is in the response before any script loads. With JS
disabled, a display-only custom element looks correct, and an
interactive one (counter, dropdown, tabs) still paints its initial
state. Only the *interactivity itself* (the +/- click, the open/close
toggle, the tab switch) requires JS.

**Default rules:**
- **Forms must work as plain HTML POSTs.** Use `<form action=…>` bound
  to a server action. Never `fetch` + a JS click handler for the
  happy path. The framework upgrades the form to a partial-swap
  submission automatically when the client router is active, and with
  JS disabled the same form does a full-page POST and works identically
  end-to-end.
- **Links must be real `<a href="…">`.** Don't roll a JS-only click
  handler for navigation. The client router intercepts `<a>` clicks and
  enhances them into SPA transitions. Without JS, the browser navigates
  the old-fashioned way.
- **Custom elements are the only place JS is allowed to be required.**
  If a feature works without state (a styled card, a layout, a list,
  a marketing section), it should not be a custom element with
  lifecycle. Use a plain function returning `html\`…\`` or a Tier-1
  Webjs-UI class helper (`buttonClass`, `cardClass`).
- **Test JS-off explicitly before marking a feature done.** Open the
  page in a browser with JS disabled (DevTools → Settings → Debugger
  → "Disable JavaScript") and exercise the user's read + write paths.
  If a write fails without JS, you've reached for `fetch` where a
  server action would have done the job.
- **Don't gate read-paths on hydration.** Never write components whose
  SSR'd HTML is empty or wrong on purpose with the expectation that
  JS will fill it in. The first paint must be the right content.

**SSR-meaningful component state.** The SSR pipeline constructs the
component, applies its attributes, runs `willUpdate` and controllers'
`hostUpdate`, and calls `render()`. It does NOT call `connectedCallback`,
`firstUpdated`, `updated`, or any other browser-only lifecycle hook.
Whatever state should appear on first paint MUST be set in the
constructor (after `super()`), derived in `willUpdate`, or derivable
from the factory-declared reactive props + attributes on the rendered
tag. Reading
`this.getAttribute` / `hasAttribute` in `render()` works server-side (a
server attribute shim backs the attribute methods), but a `Task`'s
fetch still runs only on the client.

```ts
import { WebComponent, html, signal } from '@webjsdev/core';

class Cart extends WebComponent {
  items = signal<Item[]>([]);          // instance signal, SSR uses this for first paint

  connectedCallback() {
    super.connectedCallback();
    // Browser-only refinement, read localStorage and write the
    // signal. The component re-renders automatically.
    const stored = readFromLocalStorage();
    if (stored) this.items.set(stored);
  }

  render() {
    return html`<ul>${this.items.get().map(/* … */)}</ul>`;
  }
}
```

Where the data lives, where to read it:

| Data source | Where to read it |
|---|---|
| Database, session, cookies, request headers | Page function (server). Pass to component as attribute / property. |
| Component's own initial defaults | Component `constructor()` after `super()`. |
| Browser-only: `localStorage`, viewport, `matchMedia`, `navigator.*` | Component `connectedCallback()`, then write a signal (instance-scoped in the constructor, or module-scope if shared) to refine. |
| Theme color, RTL direction (flash-sensitive) | Synchronous inline `<script>` in root layout that sets `document.documentElement` attributes before custom elements upgrade. |

---

## Server actions

<!-- OVERRIDE -->

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';
import type { ActionResult } from '../types.ts';

export async function createPost(input: {
  title: string;
  body: string;
}): Promise<ActionResult<Post>> {
  // validate, create, return
}
```

**Rules:**
- One function per file (greppable, AI-agent friendly)
- File name matches function name: `create-post.server.ts` → `createPost`
- Return `ActionResult<T>` envelope for actions that can fail
- Never throw for expected errors. Return `{ success: false, error, status }`
- Validate input at the top of the function

---

## Code style

<!-- OVERRIDE -->
- TypeScript with explicit `.ts` extensions in imports
- **Erasable TypeScript only.** The runtime strips types at the runtime layer (Node 24+'s built-in `module.stripTypeScriptTypes`, or `amaro` on Bun, byte-identical) with whitespace replacement, so line + column positions are byte-exact and no sourcemap ships. Your `tsconfig.json` sets `erasableSyntaxOnly: true`, so the compiler rejects: `enum`, `namespace` with values, constructor parameter properties, legacy decorators with `emitDecoratorMetadata`, and `import = require`. Write the erasable equivalents:
  ```ts
  // Not allowed
  enum Color { Red, Green, Blue }
  class Foo { constructor(public x: number) {} }

  // Erasable equivalents
  const Color = { Red: 'Red', Green: 'Green', Blue: 'Blue' } as const;
  type Color = typeof Color[keyof typeof Color];

  class Foo {
    x: number;
    constructor(x: number) { this.x = x; }
  }
  ```
  If you turn `erasableSyntaxOnly` off and use non-erasable syntax, the dev server fails at strip time and returns a 500 pointing at the `no-non-erasable-typescript` lint rule. webjs is buildless end-to-end and has no bundler fallback. The `erasable-typescript-only` convention check warns when the flag is off.
- No semicolons (or with semicolons, pick one and stay consistent)
- `const` by default, `let` when needed, never `var`
- Prefer `async/await` over `.then()` chains
- Minimal comments. Code should be self-documenting
- No barrel files (`index.ts` re-exporting everything). Import from the source directly

---

## Git workflow

<!-- OVERRIDE -->

This project enforces a git workflow via agent-specific config files
(`.claude/settings.json`, `.cursorrules`, `.agents/rules/workflow.md`,
`.github/copilot-instructions.md`). These rules apply to ALL AI agents:

**Commit rules:**
- **Commit per logical unit, not at the end.** One feature, one fix, one
  rename, one doc rewrite per commit. Push after each commit.
- **Hard limit.** If you have 5+ unstaged files spanning different concerns,
  commit before continuing. The `.claude/hooks/nudge-uncommitted.sh` hook
  fires at threshold 4 to enforce this. Do not ignore the reminder.
- **Meaningful messages.** Imperative mood, what changed and why
  (`Add contact form with email validation`, not `update files`).
- **NEVER add AI attribution.** No `Co-Authored-By: Claude`, no
  `Generated by AI`, no `AI-assisted` trailers or prefixes.
- **Committing is automatic.** The user should never have to ask
  "please commit". Commit after completing each logical unit.

**Branch rules:**
- **Feature branches.** Never commit directly to main
- **Branch naming.** `feature/<name>`, `fix/<name>`, `refactor/<name>`
- **Pull requests.** Always create a PR, never push to main directly
- **NEVER merge without user permission.** Before merging ANY branch
  into ANY other branch, ask: "Ready to merge `<branch>` into `<target>`?
  Delete or keep `<branch>` after?" Wait for approval AND the preference.
- **Claude Code hook** (`.claude/hooks/guard-main-merge.sh`) enforces
  merge/push-to-main approval programmatically for Claude agents.
  Other agents enforce this via `.cursorrules`, `.agents/rules/workflow.md`,
  `.github/copilot-instructions.md`.

**Pre-commit hook (`.hooks/pre-commit`):**
- Blocks commits to `main` / `master`. Nothing else runs locally, so
  `git commit` stays fast. Keeping commits to one logical unit (no
  unrelated files) is your discipline plus the `nudge-uncommitted`
  hooks, not something this hook enforces.

**CI gate (`.github/workflows/ci.yml`), on every PR and push to main:**
- `webjs check` (conventions) must pass
- `webjs test` (unit + integration), the browser layer, and the e2e
  layer must pass
- Mark these as required status checks in the branch-protection rule for
  main so a PR can only merge when the gate is green. The gate lives in
  CI, where a local `--no-verify` cannot skip it.

---

## Customizing conventions

The conventions in this file are guidance, so customize them directly:
edit the prose under any `<!-- OVERRIDE -->` marker. There is no
`package.json` switch and nothing to toggle, because conventions are not
enforced by a tool.

`webjs check` is separate: it runs only correctness checks (a crash, a
security leak, a build/type-strip failure), always, with no per-project
disabling. Run `webjs check` to validate, and `webjs check --rules` to
list those checks.

---

## Scaffold

Create new projects with `webjs create`:

```sh
webjs create <name>                  # full-stack (default)
webjs create <name> --template api   # backend-only API
webjs create <name> --template saas  # auth + dashboard + Drizzle User model
```

**Route-wrapping pattern (especially for `--template api` apps):**
Routes are thin wrappers over typed server actions. Business logic lives in
`modules/`, routes just import and call the action/query:

```ts
// app/api/users/route.ts: thin wrapper
import { listUsers } from '#modules/users/queries/list-users.server.ts';
import { createUser } from '#modules/users/actions/create-user.server.ts';

export async function GET() { return Response.json(await listUsers()); }
export async function POST(req: Request) {
  const result = await createUser(await req.json());
  if (!result.success) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data, { status: 201 });
}
```
