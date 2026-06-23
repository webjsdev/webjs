# GitHub Copilot Instructions: webjs app

You are working on a webjs app, an AI-first, no-build, web-components-first
framework. Read AGENTS.md for the full API reference and CONVENTIONS.md for
project-specific conventions. When AGENTS.md doesn't cover what you need,
the full hosted docs are at **https://docs.webjs.com**.

## Persistence + scaffold rules (non-negotiable)

- **Use Drizzle + SQLite for data, never JSON files.** It's already wired up
  (`db/schema.server.ts`, `db/connection.server.ts`, `npm run db:generate` + `npm run db:migrate`). For ANY
  data the app stores (todos, posts, messages, products, comments…),
  define a Drizzle table. NEVER create `data/*.json`, `db.json`, or any
  JSON file as a fake database. NEVER use module-scope arrays / Maps as
  a substitute. NEVER use localStorage for app data. It resets on reload and cannot scale. This is a project convention
  (CONVENTIONS.md).
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
3. If more than one agent may work this repo at once, use a DEDICATED git
   worktree per task (`git worktree add -b <branch> ../<repo>-<slug> origin/main`,
   `cd` in, work there, `git worktree remove` after merge), never a shared
   checkout. Two agents in one directory collide: a `git checkout` in one moves
   HEAD under the other, so commits land on the wrong branch. A lone agent in a
   clean checkout may use a plain branch.

## Autonomous mode (sandbox / no-prompt)

If running without interactive approval (sandbox, auto-approve, etc.):
- On main? Auto-create feature/<task-slug> branch
- Parent behind? Auto-rebase. Merge? Auto-merge + delete feature branches.
- Auto-generate meaningful commit messages. Fix tests and violations.

Quality bar stays the same, no blocking on questions.

## Mandatory workflow (never skip)

Every code change must include:
1. Server tests in `test/<feature>/*.test.ts` (node:test).
2. Browser tests in `test/<feature>/browser/*.test.js` (WTR + Playwright, real Chromium).
3. Documentation updates. Walk every surface in the **Definition of done**
   section of CONVENTIONS.md (AGENTS.md, CONVENTIONS.md, README.md, docs/,
   website/, scaffold scripts) and either update or write
   "N/A because <reason>" in the PR body. Docs land on the same PR as the
   code, never as a follow-up.
4. Convention check: `webjs check` must pass.
5. Pre-merge self-review loop. Before saying the PR is ready for merge,
   run fresh-context review rounds until one round finds zero issues.
   Copilot primitive: open a NEW chat session (reset the side panel) for
   each round so the reviewer has no prior context on the implementation
   decisions. Minimum two rounds; rotate focus each round. Skip the loop
   only for one-line trivial changes; skipping on a change that touches
   logic, public surface, build, security, or multiple files is the exact
   failure mode the loop exists to prevent. The full rule, prompt
   template, and reporting contract live in the **Pre-merge self-review
   loop** section of CONVENTIONS.md.

The user should never have to ask for tests, documentation, or the
self-review loop. The commit-per-logical-unit rule lives under "Git rules"
below, not here, since it governs how work is grouped rather than what
each change must include.

## Git rules

- COMMIT AND PUSH PER LOGICAL UNIT, NOT AT THE END. One feature, one fix,
  one rename, one doc rewrite per commit. Always `git push` after
  committing. The user should never have to ask for a commit.
- HARD LIMIT: if you have 5+ unstaged files spanning different concerns,
  commit before continuing. The Claude Code hook at
  `.claude/hooks/nudge-uncommitted.sh` enforces threshold 4 for Claude
  users. Copilot has no equivalent hook surface today; self-enforce the
  same rule. Batching multiple logical units into one commit is the
  failure mode this rule exists to prevent.
- Meaningful commit messages: what changed and why
- NEVER add Co-Authored-By or AI attribution trailers to commits
- NEVER use em-dashes (U+2014), a hyphen-as-pause (` - `), or a
  semicolon-as-pause (` ; `) in commit messages or anywhere else.
  Rewrite the sentence so no pause-punctuation crutch is needed. Use a
  period, comma, colon, parentheses, or a restructured phrasing. Plain
  hyphens stay fine in compound words, CLI flags, filenames, and ranges.
  Semicolons stay fine inside code.
- Work on feature branches, create PRs, never push directly to main
- NEVER merge any branch without explicit user permission. Always ask:
  "Ready to merge <branch> into <target>? Delete or keep <branch> after?"
  Wait for approval AND the delete/keep preference. Applies to ALL merges.
- Run `webjs test` before every commit

## Framework rules

- No build step: source files are served as ES modules. Don't introduce
  build tools or bundlers in the critical path.
- **Erasable TypeScript only.** The runtime strips types via `module.stripTypeScriptTypes` (Node's built-in, or `amaro` on Bun) (whitespace replacement, byte-exact position preservation, no sourcemap). The scaffold's tsconfig.json sets `erasableSyntaxOnly: true`, so the TS compiler rejects `enum`, `namespace` with values, constructor parameter properties, legacy decorators with `emitDecoratorMetadata`, and `import = require`. Use erasable equivalents: `const X = { ... } as const` plus a derived union type instead of `enum`; explicit fields plus constructor body assignments instead of parameter properties. If `erasableSyntaxOnly` is disabled and non-erasable syntax is used, the dev server fails at strip time and returns a 500 pointing at the `no-non-erasable-typescript` lint rule. webjs is buildless end-to-end and has no bundler fallback.
- Tagged template: html`<div>${value}</div>` with css`...` for styles.
- **Tailwind-first styling.** Tailwind utilities are the strong default for pages AND light-DOM components (the default DOM mode): layout, spacing, color (via `@theme` tokens), typography, borders, radius, shadows, interaction states. Light DOM does not scope, so utilities apply directly. The lit reflex to scope CSS (`static styles = css\`...\``) or write an inline `<style>` with semantic class names (`.hero`, `.card`) in a light-DOM component is wrong: the scoped block needs `static shadow = true`, and inline class names leak globally. When a utility bundle repeats, extract a `lib/utils/ui.ts` helper returning an `html` fragment, not a CSS class. Reserve raw CSS for the allowlist (design tokens / `@theme`, `@property` + `@keyframes`, `::-webkit-scrollbar`, `prefers-reduced-motion`, complex `color-mix()` / gradients); when unavoidable in a light-DOM component, prefix every class selector with the component tag. Shadow-DOM components (`static shadow = true`) legitimately author `static styles = css\`...\`` for scoped CSS; don't use inline `style="..."` there.
- Components: extend the `WebComponent({ ... })` factory to declare reactive properties (e.g. `extends WebComponent({ count: Number })`; per-prop options via `prop(Number, { reflect: true })`), add `static styles` for shadow-DOM components, call `Class.register('tag-name')` at the bottom of the file. The tag name is the argument to `.register()`, not a static field. A hand-written `static properties` throws at construction (`no-static-properties`); set defaults in the constructor, never a class-field initializer (`reactive-props-no-class-field`). Declare an array-typed prop with the `Array` constructor, not `Object` (`items: prop<Tag[]>(Array)`), flagged by `array-prop-uses-array-type`. **Never extend raw HTMLElement directly for app components.** Always subclass `WebComponent` (or the factory form `WebComponent({...})`) to hook into SSR, lifecycle, elision, and the reactive property system. Extend raw HTMLElement only for rare native-API edge cases (like form-associated `ElementInternals` or customized built-in elements), and add a `webjs-allow-htmlelement: <reason>` comment to acknowledge the exception.
- Async data in a component: prefer an `async render()` (`const u = await getUser(this.uid)`), which SSR awaits so the data is in the first paint, over prop-drilling from the page or fetching in `connectedCallback`. `renderFallback()` is the optional re-fetch loading state (never first paint); error isolation is automatic (`renderError()` customizes it); a `Task` is for genuinely client-only data.
- Server actions: *.server.ts files with one exported async function each.
- Server-only code (a DB driver like pg, node:*, anything needing Node APIs) goes only in .server.{js,ts} files, route.ts handlers, or middleware.ts. Never in pages, layouts, or components. Wrap in a .server.{js,ts} file; the framework rewrites that import to an RPC stub for the browser. The DB lives in db/*.server.ts; lib/ holds other server-only infra and browser-safe utilities (lib/utils/cn.ts with cn); apply the same rule per file.
- Directives: webjs exports the lit directives with no clean native equivalent (`repeat`, `unsafeHTML`, `live`, `keyed`, `guard`, `cache`, `until`, `ref` / `createRef`, `templateContent`, `asyncAppend` / `asyncReplace`, `watch`). Lit's `classMap` / `styleMap` / `ifDefined` / `when` / `choose` are NOT exported; use plain template-literal expressions instead.
- Context: import { createContext, ContextProvider, ContextConsumer } from '@webjsdev/core/context'
- Task: import { Task, TaskStatus } from '@webjsdev/core/task'
- Routing: file-based under app/ (page.ts, layout.ts, route.ts, middleware.ts).
- Keep pages and layouts as pure carriers so their modules stay out of the network tab. A page/layout never hydrates; the framework drops its module from the browser as long as its only browser job is registering the components it imports. It starts shipping its own module (invisible in tests, an elision verdict) the moment its closure does any OTHER client work. Don't give a page/layout module-scope client work (a top-level call, a window/document/customElements access, a bare side-effect import, or a @webjsdev/core/client-router import: routing is automatic) or import a client-global-touching non-component util into it. Put client behaviour in a component, server-only code in .server.{js,ts}. Self-check: page.ts/layout.ts should not appear in the network tab.
- Component state lives in signals from @webjsdev/core. Module-scope signals share state across components; instance signals (created in the constructor) carry component-local state. Reactive properties (declared via the `WebComponent({ ... })` factory) are for HTML attributes and .prop=${...} hydration.
- Don't skip tests or documentation updates.
