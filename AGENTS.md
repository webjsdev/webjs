# AGENTS.md for WebJs

This file is the contract for **AI agents** (and humans) working on the WebJs
framework monorepo: the workflow, the guardrails, and the repo invariants. For
building a WebJs app, the brief below is the whole agent-facing reference: WebJs
follows Next.js App Router routing and Lit's component APIs, so an agent's
existing habits are meant to produce correct code, and `webjs check` plus the
runtime refuse the rest with the fix in the message. The canonical human docs
are https://webjs.dev/docs (source under `website/app/(site)/docs/`).

Repo-root `framework-dev.md` covers monorepo dev (only when editing WebJs
itself): commands, repo-health git config, changelog flow, module structure,
dev error overlay.

---

## AI-driven development: guardrails for all agents

**WebJs is AI-first. These rules apply to ALL agents (Claude, Cursor, Copilot, Antigravity, Gemini, opencode) through a SINGLE cross-agent source the scaffold ships**: `AGENTS.md` (the open standard Cursor / opencode / Antigravity / the Copilot coding agent read natively, opening with the WebJs brief). Tools that do not read `AGENTS.md` natively get a THIN bridge pointing at it (`CLAUDE.md` for Claude Code), never a duplicated rule set. The scaffold shipped `GEMINI.md` and `.github/copilot-instructions.md` as further bridges until #1368 removed them, so `CLAUDE.md` is the only one today. Claude Code additionally ships the protective enforcement hooks (`.claude/`, `.hooks/pre-commit`).

### Before starting ANY work: verify and sync the branch

1. Work NEVER happens in the primary checkout. Cut the task's worktree first: `git worktree add -b <prefix>/<task-slug> ../<repo>-<task-slug> origin/main`, and do ALL work there.
2. Verify the branch matches the task. Don't mix unrelated work.
3. Sync with parent: `git fetch origin && git log HEAD..origin/main --oneline`. If there are upstream commits, `git rebase origin/main` first.

Claude Code enforces step 1 via `.claude/hooks/require-worktree-for-edits.sh` (blocks tracked-file edits in a primary checkout; test `test/hooks/require-worktree-for-edits.test.mjs`, escape hatch `WEBJS_NO_WORKTREE_GATE=1`). Other agents check manually.

### One task per git worktree, ALWAYS

WebJs is worked by MULTIPLE agents at once, and "no other agent is active right now" is unverifiable mid-task (another session can start any minute), so the worktree rule is unconditional. If more than one agent (or more than one in-flight task) shares ONE working checkout, they collide: a `git checkout` in one moves `HEAD` under the other, so the next commit lands on the WRONG branch. This has happened (a `chore: release` commit landed on an unrelated `feat/` branch, with a contaminated changelog). So give each task its own worktree:

```sh
git worktree add -b <prefix>/<slug> ../<repo>-<slug> origin/main
cd ../<repo>-<slug>          # do ALL work for the task here
# ... commit + push from this worktree; after merge: git worktree remove ../<repo>-<slug>
```

**A fresh worktree has NO `node_modules`** (git worktrees do not copy it), so running an app from one (`webjs dev` / `webjs start`, the test runner, a scaffolded app) fails to resolve `@webjsdev/*` until you install or link it. `webjs doctor` warns for this exact case (#954) and `webjs dev` / `webjs start` print the cause + remedy instead of a raw `ERR_MODULE_NOT_FOUND`.

Fix it with **`npm run worktree:link`** from the worktree root (or `node scripts/link-worktree-deps.mjs` from any directory in it, since the script acts on the git toplevel). A full `npm install` there is NOT an alternative once the link is standing, and the reason is below. **Do NOT hand-symlink only the root `node_modules`.** That is the obvious move and it produces a worktree that looks set up and then fails dozens of tests for reasons that point nowhere near the real cause. Three things beyond the root tree are needed, and the script handles all three:

- **Every NESTED `node_modules`, not just the root.** npm hoists what it can, but a workspace whose range conflicts with the hoisted copy keeps its own nested tree. `packages/server` is the live example: the root carries `ws@7` (hoisted for another dependent) while `packages/server` declares `^8.20.0` and keeps `ws@8` nested. Link only the root and `WebSocketServer`, a ws@8-only named export, resolves up to ws@7 and throws at module load. That single miss failed hundreds of assertions across the server, integration, and smoke suites, none of them naming ws.
- **`packages/core/dist`**, which is built rather than committed, so a fresh worktree has none and every test importing the built bundle fails to resolve it. The script BUILDS it in the worktree from the worktree's own sources, after the links are in place (esbuild resolves through the linked `node_modules`), and rebuilds it on every run so it never lags the branch. It is never linked from the primary (#1671): a link there served the primary's bundle, built at another commit, and any build in the worktree, core's `prepare` during `npm ci` included, wrote this branch's bundle THROUGH it into the primary. A build failure WARNS and never fails the link. Skip it with `WEBJS_NO_WORKTREE_BUILD=1`.
- **`examples/blog`'s seeded SQLite database.** `db/dev.db` is gitignored, so a worktree has none, and an empty `posts` table fails three blog tests plus their enclosing progressive-enhancement suite with nothing in the output naming the database (#1323). The script runs the blog's `db:migrate` then `db:seed` when the `posts` table is missing or empty, which takes about two and a half seconds and is a no-op once there are rows. A file-existence check would not do, because `webjs dev` and `webjs start` both run `webjs db migrate` as a before-step and leave the file there with no rows. Seeding failures WARN and never fail the link. Skip it with `WEBJS_NO_WORKTREE_SEED=1`.

The script discovers the `node_modules` set from the primary checkout rather than hardcoding a list (it changes whenever a package gains a nested tree), never overwrites an existing path other than the dist it builds, and never creates a dangling link, so it is safe to re-run and safe in a worktree where you already ran a real `npm install`. The seed step keeps the same contract: it only ever applies pending migrations and inserts demo rows that are not there, so a database with rows in it is left untouched.

**Know what this does NOT give you.** The worktree then runs the PRIMARY checkout's framework source through every bare `@webjsdev/*` specifier, because `<primary>/node_modules/@webjsdev/core` is a relative symlink into `<primary>/packages/core` and resolving through the linked root lands there. Relative imports (`../../../src/x.js`) and the browser suite, which web-test-runner serves from the worktree, do use the worktree's own files. So linking makes the suite RUNNABLE, not self-testing: if you are editing `packages/core/src` or `packages/server/src` and need a bare-specifier consumer to exercise YOUR copy, run **`npm run worktree:unlink`** first and then install, or repoint the individual `@webjsdev/<pkg>` entries at it. The unlink script removes EVERY `node_modules` link the link script planted, which is more than the root one, because it plants one per workspace that carries its own tree. It acts on the worktree root from any subdirectory, removes only links that point into the primary, and leaves real directories and links you made yourself alone (they are only links and nothing else is lost). A worktree linked before #1671 may still carry `packages/core/dist` as a link at the primary's dist. That is harmless: the core build swaps a symlinked out dir for a real directory once it succeeds and never writes into the link's target, and the next `npm run worktree:link` replaces it the same way. CI always builds from the branch, so it is unaffected either way.

**NEVER install while the `node_modules` symlink is standing (#1442).** This is the trap the two paragraphs above used to walk you into, and the damage lands on a checkout you are not working in, so the failure surfaces in someone else's session with nothing naming the cause. Measured on npm 11.19.0 and bun 1.3.14: `npm ci` DELETES the primary's whole `node_modules` through the link before any lifecycle script runs, `bun install` writes packages and `.bin` entries straight into the primary through it, and `npm install` silently replaces the link with a real tree, detaching the worktree from the shared source. No `preinstall` script can prevent any of it, because npm removes the symlink before `preinstall` runs, `npm ci` has already emptied the primary by then, and Bun runs it in time but ignores a non-zero exit. So the layers are: Claude Code BLOCKS the command through `.claude/hooks/block-install-in-linked-worktree.sh`, which covers every manager's install aliases plus the REMOVE verbs (`npm rm` in a linked worktree deletes from the owning checkout), judges a COMMAND rather than a token so `git commit -m "fix: npm install ..."` and `grep -rn "npm ci"` are unaffected, and never blocks a GLOBAL `-g` install such as the post-release `npm update -g webjsdev` (escape hatch `WEBJS_NO_WORKTREE_INSTALL_GATE=1`), the root `preinstall` REPORTS it for every other tool without ever blocking, `npm run worktree:link` REPAIRS an already-damaged primary, `npm run worktree:unlink` removes every `node_modules` link the link script planted before a deliberate real install, and `npm run check:worktree-links` reports what it would repair without changing anything, exiting non-zero when there is work. `WEBJS_NO_WORKTREE_REPAIR=1` suppresses the repair WRITE, so it has no effect on `--check`, which never writes and always inspects. Tests: `test/hooks/block-install-in-linked-worktree.test.mjs`, `test/repo-health/warn-worktree-install.test.mjs`, `test/repo-health/link-worktree-deps.test.mjs`.

Note the `webjs doctor` / `webjs dev` remedy message suggests the root-only symlink. That advice is correct for a scaffolded APP worktree, which has no nested trees and no built `dist/`, and wrong only for this monorepo. It stays app-generic on purpose, because it ships in the published CLI and `webjs dev` prints it verbatim to someone whose app has none of this repo's scripts. It names `worktree:link`, and `worktree:unlink` in place of the `find` recipe, only when the app's own package.json or its checkout root's declares the script, and spells the command so it works from where doctor ran: `npm run <script>` for the app's own, `npm --prefix <root> run <script>` for the root's (a plain `npm run` in `website/` resolves the app's package.json and fails with Missing script). So in this repo you get the monorepo path and in a scaffolded app you do not.

Git enforces one-branch-per-worktree, so separate worktrees make the collision impossible. There is NO lone-agent exception: every task cuts a worktree, and the primary checkout stays an untouched mirror of main (tracked-file edits there are hook-blocked). The repo's `.hooks/pre-commit` additionally BLOCKS a published-library (`core`/`server`/`cli`/`mcp`/`ui`/`intellisense`) version bump on any non-`chore/release-*` branch, the canonical wrong-branch-release symptom.

**Cleanup is automatic after a merge.** The `.claude/hooks/cleanup-merged-worktree.sh` PostToolUse hook fires after any `gh pr merge` and removes each linked worktree whose branch is merged AND whose tree is clean, so a merged branch's worktree never leaks (accumulated stale worktrees are exactly what it prevents). It is conservative: it KEEPS anything with uncommitted changes, an unmerged branch, or the worktree you ran the merge from (you cannot remove your current directory, so `cd` out and `git worktree remove` it yourself), and never touches the primary checkout. Before removing one it repoints any `<primary>/node_modules/@webjsdev/*` link that targets that worktree back at the primary's own packages and drops an npm staging entry that would be left dangling (#1442), so a removal can never leave the primary resolving into a directory that is gone; a link it cannot correct is kept and reported rather than repointed at a missing path. Disable with `WEBJS_NO_WORKTREE_CLEANUP=1`, which disables the repoint along with everything else. Test: `test/hooks/cleanup-merged-worktree.test.mjs`.

### Skills are routed deterministically, never skipped

A Skill is model-invoked, so it fires only when the model judges a match. The `.claude/hooks/route-skills.sh` `UserPromptSubmit` hook makes routing deterministic: it keyword-matches each prompt against every skill's documented triggers and injects a directive to invoke the matched skill before other work. Check the available skills and invoke a matching one before starting. The skills themselves are committed under `.claude/skills/` (alongside the hooks), so a fresh clone has both the router and the skills it routes to (no machine-local dependency). When the same script is wired as a user-level hook it runs in every repo, so it stays silent in a checkout that has a different `.claude/hooks/route-skills.sh` of its own: that repo's router and skills apply there instead. Tests in `test/hooks/route-skills.test.mjs`, which also asserts every skill the hook references is committed in-repo.

### Talking to GitHub: `gh api` over REST, never the porcelain

GitHub scores two independent budgets, and `gh` routes to them in a way the command names hide. **Most `gh` porcelain commands issue `POST /graphql`**, whose 5000/hour budget is scored in **points** rather than requests, so one query walking a large connection can cost hundreds. Sessions here exhaust it routinely, and when it is gone the project board becomes unreachable and two PostToolUse hooks fail silently. The REST budget (`gh api <path>`, 5000 requests/hour) sits idle meanwhile.

Convert these, which is the whole high-volume surface. Reads: `gh issue view` / `gh issue list` / `gh pr view` / `gh pr list` / `gh pr diff` / `gh pr status` / `gh search issues` / `gh label list`. Writes: `gh issue create` / `gh issue edit` / `gh issue close` / `gh issue comment`. The writes are lower volume, but a task whose whole deliverable is a write is blocked outright once the budget is gone.

So: **go through `gh api` over REST, and reserve GraphQL for the two things only it can do**, Projects V2 (which has no REST API) and `resolveReviewThread`.

**Leave these on the porcelain**, even though they do route to GraphQL. `gh pr merge`, because two PostToolUse hooks detect a merge by matching that literal string (or `ci-merge.sh`, which merges through it, #1593). `gh pr create`, which resolves base and head from local git state. And `gh pr checks`, which reads the PR's required CI check-runs and any commit statuses as one verdict: it folds check-runs and legacy commit statuses together, and the obvious REST replacement reports a green PR as pending, so a miss there lets a red build onto `main`. All three run once per PR, so converting them buys nothing and risks a lot.

Do NOT extend either list by assuming a command family routes one way. `gh label create` looks like it belongs beside `gh label list` and does not, since it issues a plain `POST /repos/{owner}/{repo}/labels`, so it needs no conversion. Measure with `GH_DEBUG=api` first.

The full substitution table, the traps in each replacement, and the reasoning behind every exception live in **`.claude/gh-budget.md`**. That file is the single source; skills and hooks link to it rather than restating it, because an earlier copy inside one skill drifted from the rule it stated.

### Autonomous mode (sandbox / bypass permissions)

When interactive approval is disabled, never block on questions. Auto-decide: cut the task's worktree from `origin/main` (auto-create `<prefix>/<task-slug>` per the label scheme); auto-rebase if the parent moved; auto-merge when ready; **delete** feature/fix branches after merge but **keep** long-lived ones (dev, staging, release/*); auto-generate meaningful commit messages; fix failing tests / convention violations rather than asking. Autonomous mode is MORE disciplined, not less, with the same quality bar.

### Module structure and file size

Design by judgment, not by a line counter. SOLID, DRY, and KISS apply here as
prose guidance, deliberately outside `webjs check`, which carries correctness
rules only. Single responsibility is about what a module OWNS (statable in one
sentence with no "and"), DRY is about knowledge rather than text, and KISS
matters more in a framework than in an app because the source ships unbundled
and IS the documentation surface an agent reads.

**A source module targets 800 lines and should stay around 1000 at the most.**
The ceiling is approximate: 1040 is fine, 1900 is a signal that a second
responsibility crept in. A barrel is exempt. No CI guard enforces this, because
a line-count gate is a proxy metric that fights cohesion and needs an exemption
list that rots. The number came from measuring the frameworks WebJs takes its
cues from, where `lit-html.ts` is 2303 lines, `reactive-element.ts` is 1754, and
Vite's `server/index.ts` is 1447. All of them draw seams by responsibility and
let the orchestration entry stay large.

**When you do split a module, it is a MOVE, not a rewrite.** Retyping a function
while relocating it is how a refactor with an unchanged export surface ships
behaviour changes. The original file keeps its path and becomes a barrel over a
sibling directory named after it. Mutable module-scope state goes with its
WRITERS, since an ESM import binding cannot be assigned; when two modules write
it, the owner exposes a one-statement accessor. Never swap `Symbol('x')` for
`Symbol.for('x')`. Re-point any drift guard that reads the barrelled file by
path, because an `assert.doesNotMatch` in one starts passing VACUOUSLY. Rebuild
`packages/core/dist` before e2e or Bun, and run the browser suite: a split's
characteristic defects are post-hydration, so the export surface and the SSR
bytes are both unchanged and node tests stay green. Full procedure and the
verification commands in the "Module structure" section of `framework-dev.md`.

### Code workflow (mandatory)

Every code change MUST include, automatically:

1. **Tests, every applicable layer (not just unit).** Ship the tests that prove the change across EVERY layer it touches: **unit** (`packages/*/test/**`, `test/**`, including the counterfactual that fails when reverted), **browser** (`*/test/**/browser/*` via `npm run test:browser`, for hydration / DOM / slots / client router / custom-element upgrade), **e2e** (`test/e2e/*.test.mjs` via `WEBJS_E2E=1`, including network probes / navigation / streaming), and **smoke** (`test/examples/*/smoke/*`). A unit test is NECESSARY BUT NOT SUFFICIENT for any client-router / component / browser-facing change (the headline behaviour is a browser/e2e assertion). **Bun parity is part of the task, not an afterthought:** WebJs runs on Node 24+ AND Bun (#508), so a change to a runtime-sensitive surface (the serializer, the node:http vs `Bun.serve` listener + request path, SSR / action / CSRF dispatch, streams, `node:crypto`, the TS stripper, auth / session / cors) MUST be proven on Bun (`node scripts/run-bun-tests.js` + the touched `test/bun/*.mjs` under `bun`) AND ship an added/updated `test/bun/<feature>.mjs` cross-runtime assertion. `npm test` does NOT run browser, e2e, or Bun; run the layers you touched yourself and report the result (GitHub Actions runs every layer on the PR). Never report work done with failing or missing tests. See https://webjs.dev/docs/testing. Enforced by `.claude/hooks/require-tests-with-src.sh` (the scaffold variant WARNS unless `WEBJS_TEST_GATE=block`) and `.claude/hooks/require-bun-parity-with-runtime-src.sh` (BLOCKS a commit that stages runtime-sensitive source with no `test/bun/**` test; escape hatch `WEBJS_BUN_VERIFIED=1`).
2. **Documentation, part of the definition of done (not optional).** A task is NOT done until EVERY doc surface its change touches is in sync: the docs site (`website/app/(site)/docs/<topic>`, the canonical documentation), per-package `AGENTS.md` for contributor-facing changes, the marketing `website/`, the scaffold templates (`packages/cli/templates/`), `README.md` for a headline capability, and the brief (`packages/mcp/src/brief.js`, pasted verbatim into this file and `packages/cli/templates/AGENTS.md`) only when a Lit or Next.js habit can no longer produce correct code. Updating `AGENTS.md` alone reproduces the #488 gap (docs site left stale). Invoke the `webjs-doc-sync` skill to sync every applicable surface. Enforced by `.claude/hooks/require-docs-with-src.sh`, which BLOCKS a commit that stages public `packages/*/src` source with no doc surface alongside it (a genuinely internal refactor / CI / release / perf change with no behaviour change bypasses with `WEBJS_NO_DOC_GATE=1`). Every commit gate's escape hatch works either in the environment or written in front of the commit it applies to (`WEBJS_NO_DOC_GATE=1 git commit ...`), since a hook cannot see an environment an agent sets for one command.
3. **Scaffold sync (when a feature changes what apps should do).** The scaffold `webjs create` emits is minimal: a root layout, a starting home page, a theme toggle, db wiring and a starter test, one example module (`modules/users/`) the agent reads and then deletes, plus `AGENTS.md`: the brief, a few scaffold rules, and a "This app" section the agent fills in as it builds (`CLAUDE.md` imports it). The feature gallery (`gallery/`, deployed at gallery.webjs.dev) is a standalone app and ships in no scaffold. So when a WebJs feature is added or changed, ask: does the generator (`packages/cli/lib/create.js`), a gallery demo (`gallery/`), or the brief need to move? Verify by generating an app and running `generate + boot + webjs check` (the generators emit strings, so an escaping bug only shows in a freshly generated app). See `framework-dev.md`.
4. **Convention validation.** Run `webjs check` and fix violations. Run it from INSIDE an app, never from the repo root: the root is a workspace, not an app, so the command refuses there with exit 1 rather than reporting the cross-app collisions no single runtime ever sees (#1301). In this repo that means `( cd gallery && npx webjs check )`, `( cd examples/blog && npx webjs check )` and `( cd website && npx webjs check )`. Run `webjs doctor` too when you touched an in-repo app (`gallery`, `examples/blog`, `website`): the required `conventions` CI job runs it over all three, and it fails on a hard toolchain check or on whatever that app's `webjs.doctor.gate` marks `error` (today `UNMARKED_ASSET_LINKS` in `website` and `examples/blog`), so a clean `webjs check` alone is not enough to predict that job (#1257). The repo root has no local CI battery (#1630): GitHub Actions runs the whole list on the PR. Inside `gallery` / `examples/blog` / `website`, `npm run ci` runs that app's own `webjs.ci` list (#1471); in a linked worktree invoke the branch's CLI by path (`node ../packages/cli/bin/webjs.js ci` inside an app) because the hoisted bin resolves into the primary checkout.

### Git workflow (mandatory)

Always work on a feature branch; commit + push freely there. The only gate is merging into main (needs user approval unless in bypass mode).

1. **Feature branch first;** never edit on main; never push to main.
2. **Commit per logical unit** (one feature, fix, rename, doc rewrite) as soon as it is complete and tests pass (`webjs test`); 5+ unstaged files across concerns means you waited too long. Push after each commit.
3. **Meaningful commit messages** (imperative, under 72 chars, body explains *why*). **No AI attribution** (no `Co-Authored-By: Claude`, `Generated by AI`).
4. **PRs via `gh`, always.** "merge to main" is ALWAYS `gh pr create`, confirm, `scripts/ci-merge.sh <N>`, never a local `git merge` + push.
5. **GitHub Actions is the only CI.** `ci.yml` runs on every PR into `main` and every push to `main`; `main` requires its six job checks and no review. There is no local CI battery and no pre-push hook: run the layer you touched by hand while you work, and let Actions run the whole list on the PR. Merge with `scripts/ci-merge.sh <N>`: it waits for the required checks on the PR head and squash-merges with `--delete-branch` only when they are green. A release additionally needs `node scripts/release-gate.mjs` passing on the release PR's head before it merges; once CI passes on the merge commit, `release.yml` publishes it on its own (#1650). Never merge with a bare `gh pr merge`.
6. **Never merge without permission.** Ask exactly "Ready to merge `<branch>` into `<target>`? After merging, should `<branch>` be deleted or kept?" and wait for both answers.
7. **A PR merges only with green CI, never over a red check.** `scripts/ci-merge.sh` merges only when the required GitHub CI checks pass on the PR head. This holds however fast the surrounding work is moving, and overrides any "skip the CI wait" speed preference an agent carries from another project. Never `gh pr merge --admin` to route around a failing job: that is how `main` went red with several broken checks at once, and every later PR then inherits the failure. If `main` itself is red, fix `main` first. If a test is wrong, fix the test in its own commit and say why; never skip or weaken it. Claude Code enforces the `--admin` half via `.claude/hooks/block-admin-merge.sh` (test `test/hooks/block-admin-merge.test.mjs`, owner-approved emergency escape hatch `WEBJS_ALLOW_ADMIN_MERGE=1`).

---

## Working in the WebJs framework repo itself

When editing the framework monorepo (this repo, not a scaffolded app): **`packages/` is plain `.js` with JSDoc. Never add `.ts` files there** (the framework ships buildless). TypeScript is fine in `examples/`, `docs/`, `website/`.

See `framework-dev.md` for monorepo commands, workspace layout, per-feature update checklists, the worktree-safe git config, the per-package auto-generated changelog flow, and the dev error overlay.

---

## The WebJs brief

WebJs is a no-build full-stack framework. Write it the way you write Next.js
routing and Lit components, with the differences below.

- Routing follows the Next.js App Router: `app/page.ts`, `layout.ts`,
  `route.ts`, `middleware.ts`, `[param]`, `[...slug]`, `(group)`,
  `loading.ts`, `error.ts`, `not-found.ts`, `metadata` and
  `generateMetadata`, and server actions.
- Components use Lit's APIs (`html`, `css`, reactive properties through
  `static properties` plus `declare` or the `WebComponent({ ... })` factory,
  the lifecycle, directives, context, task), imported from `@webjsdev/core`
  and its `/directives`, `/context`, `/task` and `/signals` subpaths. The base
  class is `WebComponent`. Register with `Class.register('my-tag')` or
  `customElements.define`.
- Components render light DOM by default and `<slot>` works there too. Keep
  them light: page styles such as Tailwind and the UI kit do not reach into a
  shadow root. Use `static shadow = true` only when light DOM cannot work.
- TypeScript must be erasable, so no decorators and no enums.
- Server-only code and server actions live in `*.server.ts` files. With
  `'use server'` at the top, their exports are callable from components and
  bindable as `<form action=${fn}>`. A failed form action re-renders the page
  with its result on `actionData`.
- `cookies()`, `headers()` and `revalidatePath()` come from `@webjsdev/server`,
  and so does `createAuth()`, which is Auth.js's API. Files in `public/` are
  served from the site root.
- Never import `lit`, `next` or `react`.

Before hand-writing auth, sessions, caching, rate limits, uploads, realtime or
SEO, run `npx webjs source`, which lists what WebJs provides for each need.
`npx webjs source <Export>` then prints one export's signature and example.
After each edit run `npx webjs check` and `npx webjs status`. The framework
source is in `node_modules/@webjsdev/*` (no build, so it is the code that
runs) and the human docs are at https://webjs.dev/docs.

---

## Framework source: where to find it

Plain JS with JSDoc lives in `packages/` (installed as `node_modules/@webjsdev/`: `core/`, `server/`, `cli/`, `mcp/`, `intellisense/`, `ui/`); what you read is what runs. Each package's own `AGENTS.md` carries its module map and invariants. Several large modules are BARRELS over a same-named sibling directory (#1365): `server/src/ssr.js`, `server/src/check.js`, `server/src/dev.js`, `server/src/vendor.js`, `core/src/render-client.js`, `core/src/router-client.js`, `core/src/render-server.js`, `core/src/component.js`, `core/src/slot.js`, and `cli/lib/doctor.js`, so read the directory, not the barrel. For UI debugging use the Playwright MCP server; for live introspection the scaffold wires the read-only `@webjsdev/mcp` server (`npx @webjsdev/mcp`, also `webjs mcp`): `init` (the brief), `list_routes`, `list_actions`, `list_components`, `check`, `source`, and `ui`.

---

## Invariants

These hold for the framework and every app built on it. Hit one as a runtime error? The [Troubleshooting page](https://webjs.dev/docs/troubleshooting) is keyed by symptom and maps each back to its invariant and `webjs check` rule. The numbers are cited by check-rule messages and tests, so keep them stable.

1. **Server-only code never runs in a component or in anything a component imports.** Pages, layouts and boundaries run only on the server and never load in the browser, so they may import it directly, the way a Next.js server component does. Shared server code lives in `.server.{js,ts}` files, `route.ts` handlers, or `middleware.ts`. Without `'use server'` a `.server` file is a server-only utility whose browser import throws at load.
2. **`'use server'` exports are `async` functions returning serializer-safe values.**
3. **Custom element tag names contain a hyphen**, passed as a literal to `Class.register('tag-name')` (or `customElements.define`).
4. **Event (`@`), property (`.`), and boolean (`?`) bindings take one expression**, quoted or unquoted.
5. **State works as in Lit, alongside signals.** Reactive properties (the `WebComponent({ ... })` factory or `static properties`) and `signal()` / `computed()` read with `.get()` and written with `.set()`.
6. **Page and layout default exports are functions** returning a value; they never call `render()`.
7. **Light-DOM components with custom CSS prefix every class selector with their tag name.** Prefer Tailwind.
8. **Only the root layout writes `<!doctype>` / `<html>` / `<head>` / `<body>`.**
9. **No backtick characters inside `html` template bodies**, even in comments.
10. **TypeScript must be erasable** (`erasableSyntaxOnly: true`): no `enum`, value `namespace`, parameter properties, decorators, or `import = require`. And **`packages/` is plain `.js` with JSDoc, never `.ts`.**
11. **No em-dashes (U+2014), no hyphen or semicolon used as pause-punctuation in prose, and no colon attached to a code-shaped LHS.** Banned as a pause: U+2014, a space-surrounded hyphen between words, a space-surrounded semicolon between words. Banned colon attachments: a colon-then-prose after `xyz()`, a `<my-tag>`, an `[expr]` subscript, or a `<code>foo()</code>` definition list (rephrase verb-led). Prefer a period, comma, a colon on a plain-noun LHS, parentheses, or a restructure. Plain hyphens stay fine in compound words, flags, filenames, ranges, and semicolons and colons stay fine inside code / TS / CSS and inside JSON SYNTAX. A JSON or front-matter `description`, `title`, or `displayName` VALUE is prose, not code, and is scanned like any other prose. The same hook also enforces brand casing: `WebJs` is a proper noun, so write it capitalized wherever it NAMES the project in prose, at a sentence start AND mid-sentence (`WebJs ships`, `Most WebJs apps`). It stays lowercase `webjs` ONLY as a literal code token: a `webjs <subcommand>` CLI command (`webjs dev`, `webjs db migrate`), a `webjs.dev` domain, an `@webjsdev` package, a `"webjs"` config key, a `WEBJS_*` env var, the `webjsdev/webjs` org path, or anything inside a `` `code` `` span or fenced block. Enforced via `.claude/hooks/block-prose-punctuation.sh`, which scans only NEW content.
12. **A form that writes binds its action: `<form action=${importedAction}>`, or per button `<button formaction=${importedAction}>`.** Every near-miss (a quoted hole, a non-form tag, `method="get"`, a `.method` property binding, a non-`'use server'` function) throws rather than producing a form that posts nowhere. The full refusal list is in `packages/core/src/form-action.js` and on the docs site.

---

## CLI and scaffolding

`webjs create <name> [--template api] [--db sqlite|postgres] [--runtime node|bun] [--skip-ci]` scaffolds an app (full-stack by default, `api` for a backend with no UI); always scaffold rather than hand-roll, and keep app data in the wired-up database, never JSON files. The other commands: `webjs dev`, `start`, `test`, `check [--rules] [--json]`, `ci`, `routes`, `mcp`, `status`, `source <Export>`, `doctor`, `audit`, `types`, `regenerate`, `typecheck`, `db`, `ui`, `vendor`, `version`, `help [command]`. `webjs help <command>` prints each one's options; the docs site has the full reference. Run this repo's own apps (`website/`, `gallery/`, `examples/blog/`) from inside them with their `npm run dev` / `npm start`.

`webjs check` carries correctness rules only (code that is wrong to ship), run unconditionally; anything a sensible app could do differently is a convention in prose, not a check. Run it from INSIDE an app, never from the repo root.

---

## Deliberately deferred

Not in v1. Do not implement as part of other tasks:

- **Bundling and per-route code splitting.** WebJs is **no-build** (the Rails 7 + importmap model); prod perf comes from HTTP/2 multiplex + `<link rel="modulepreload">` hints, not concatenation. **Do not propose a bundler or `webjs build`.**
- **An app-facing HMR API (`import.meta.hot`, accept / dispose handlers).** Dev already hot-swaps without one (#1689): a component edit re-imports the edited module at a versioned URL and patches the class the browser REGISTERED in place (`customElements.define` stays once-per-tag), then re-renders every live instance, so reactive property values, instance signals and the DOM of every unchanged template part survive; a page / layout edit refreshes in place (#1398) and a CSS edit swaps the stylesheets. What a patched class cannot carry still reloads, by design rather than as a gap: a changed `constructor` or instance field initializer, any `#private` member, a changed reactive property shape or `observedAttributes`, a changed native lifecycle callback (`connectedCallback` and the rest), a changed `static shadow` or `formAssociated`, a module-scope side effect on the edited path, and a component module exporting non-class values. The reloaded page logs `[webjs] full reload: <reason> (<file>)`. Do not add a per-module accept API or a bundler-style HMR runtime.
- **React Server Components Flight.** Server actions + `Suspense` streaming cover the need.
- **Edge-runtime bundling / full portability** (deployment guidance lives in the docs site at `/docs/deployment`), **i18n, image optimization** (layer libraries on top).
