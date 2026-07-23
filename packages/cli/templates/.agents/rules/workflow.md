# Workspace workflow rules: WebJs app

You are working on a WebJs app (AI-first, no-build, web-components-first). This
file is the WORKFLOW contract (git, tests, review). For HOW to build (routing,
components, actions, styling, the framework API), read
`.agents/skills/webjs/SKILL.md`, which routes to focused references on demand.
Read `AGENTS.md` first. Full hosted docs are at https://docs.webjs.dev.

## Grow the app in place (non-negotiable)

- **The scaffold is a starting point with a browsable feature gallery.** It ships
  a gallery index home, a root layout, a database wired up, and single-concept
  demos under `app/features/` plus the `app/examples/todo` app (logic in
  `modules/`). The gallery is reference, not part of your product. **Building a
  real app? Learn from the gallery FIRST, then clear it, then build:** (1) skim
  the demos relevant to your task under `app/features/<x>` for the runnable idiom
  (the skill teaches the same and SURVIVES the clear, so you never lose it);
  (2) run `npm run gallery:clear` to shed the whole gallery in one step (it keeps
  the agent skill and the database wiring, and resets the home AND the root
  layout to a token-free blank slate, no gallery palette or navbar survives; a
  layout you already customised is kept, only its theme-toggle wiring stripped);
  (3) regenerate the database and grow the app in place under `app/`,
  `components/`, and `modules/<feature>/`. Keep the gallery only while exploring,
  never ship it.
- **Use the wired-up database (Drizzle), never JSON files.** For any data the app
  stores, define a Drizzle table in `db/schema.server.ts`, then
  `npm run db:generate` and `npm run db:migrate`. Never use a JSON file, a
  module-scope array or Map, or localStorage as a database.
- **`app/` is routing-only.** Only routing files live in `app/` (page, layout,
  route, middleware, metadata routes). Browser-safe helpers go in `lib/utils/`,
  feature logic in `modules/`, server-only code behind `.server.ts`.
- **Give a UI app its own design.** Define design tokens in `app/layout.ts` with
  a palette that fits the app (after `gallery:clear` the layout is a token-free
  blank slate; `.agents/skills/webjs/references/styling.md` is the guide).
  Render the app and LOOK before calling UI work
  done: `webjs check` and `webjs typecheck` pass even when a layout collapses, so
  open every route you changed in a real browser and play through its states.

## Before starting ANY work

1. Check `git branch --show-current`. If on main or master, create a feature
   branch before editing. If on a feature branch, verify it matches the task.
2. Sync: `git fetch origin` and `git rebase origin/main` if behind.
3. If more than one agent may work this repo at once, use a DEDICATED git worktree
   per task (`git worktree add -b <branch> ../<repo>-<slug> origin/main`, work
   there, `git worktree remove` after merge), never a shared checkout. Two agents
   in one directory collide: a `git checkout` in one moves HEAD under the other,
   so commits land on the wrong branch.

## Every code change

1. Server tests in `test/<feature>/*.test.ts` (node:test).
2. Browser tests in `test/<feature>/browser/*.test.js` for hydration, DOM, slots,
   and the client router.
3. Documentation stays in sync on the SAME PR as the code, never a follow-up.
4. `webjs check` must pass.
5. Pre-merge self-review: before saying a PR is ready, run fresh-context review
   rounds until one round finds zero issues (minimum two rounds, rotate focus).
   Skip only for a one-line trivial change.

## Git rules

- Commit and push per logical unit (one feature, one fix, one rename, one doc
  rewrite), not at the end. Push after every commit.
- If you have 5 or more unstaged files spanning different concerns, commit before
  continuing.
- Meaningful commit messages: what changed and why.
- Never add Co-Authored-By or AI-attribution trailers.
- Never use an em-dash (U+2014), a space-surrounded hyphen as a pause, or a
  space-surrounded semicolon as a pause, in commit messages or anywhere. Use a
  period, comma, colon, parentheses, or a restructured phrasing.
- Work on feature branches, never push directly to main. Open pull requests for
  review. Never merge without explicit user permission (ask which target, and
  whether to delete or keep the branch, then wait for both answers).

## Autonomous mode (sandbox / no-prompt)

If running without interactive approval, auto-decide: on main, auto-create a
`feature/<task-slug>` branch; auto-rebase if the parent moved; auto-generate
commit messages; fix failing tests and check violations rather than asking. The
quality bar stays the same. Only merging into main is gated on user permission.
