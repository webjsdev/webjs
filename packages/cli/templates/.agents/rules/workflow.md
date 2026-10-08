# Workspace workflow rules: WebJs app

You are working on a WebJs app (AI-first, no-build, web-components-first). This
file is the WORKFLOW contract (git, tests, review). For HOW to build (routing,
components, actions, styling, the framework API), read
`.agents/skills/webjs/SKILL.md`, which routes to focused references on demand.
Read `AGENTS.md` first. Full hosted docs are at https://webjs.dev/docs.

## Grow the app in place (non-negotiable)

Study the shipped showcase (a full-stack app's UI gallery under
`app/features/` and `app/examples/todo`, the api template's
`app/api/features/`), run `npm run gallery:clear`, then grow the app in place
under `app/`, `components/`, and `modules/<feature>/`. `AGENTS.md` carries the
build order, the data rule (the wired-up Drizzle database, never JSON files),
and the browser check for a UI app.

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
4. `npm run ci` must pass before you push. It runs the step list declared in
   `package.json` under `webjs.ci`, one result line per step: `webjs check`
   (correctness), `webjs doctor` (project health), `webjs typecheck`, a
   dependency audit, then the server, browser, and e2e test layers. The GitHub
   workflow runs the same list on every PR and push, so the two cannot drift;
   `npm run ci -- --only Tests` runs one layer while you iterate, and
   `npm run ci -- --signoff` posts a green commit status (basecamp/gh-signoff)
   a branch-protection rule can require. Doctor fails on whatever your
   `package.json` `webjs.doctor.gate` marks `error`, which starts as the
   un-versioned stylesheet link check, plus the two hard toolchain checks that
   default to `error` with no gate entry at all: `NODE_VERSION` (the Node
   floor) and `TSCONFIG_ERASABLE` (`erasableSyntaxOnly` missing from an
   existing tsconfig), either of which would 500 the app at runtime. Everything
   else it reports is a warning that cannot fail the build. Widen or narrow the
   gate, and the step list, in `package.json` rather than in the workflow.

How a PR gets REVIEWED is deliberately not specified here. Use whatever your
team already does. WebJs has opinions about the code (the conventions above,
`webjs check`, the test layers) and none about your review process.

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
