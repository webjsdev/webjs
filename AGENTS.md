# AGENTS.md for webjs

This file is the contract for **AI agents** (and humans) editing a webjs app.
It describes file conventions, the public API, invariants to preserve, and
recipes for common tasks. Keep it in sync whenever behaviour changes.

**Detail docs**, loaded when relevant. They don't auto-load.

| File | Topic |
|---|---|
| `agent-docs/metadata.md` | Full `metadata` / `generateMetadata` field reference |
| `agent-docs/components.md` | WebComponent deep-dive (controllers, hooks, light/shadow DOM, slots) |
| `agent-docs/styling.md` | Tailwind helpers + vanilla-CSS opt-out conventions |
| `agent-docs/built-ins.md` | Auth, sessions, cache, rate-limit, broadcast, file storage |
| `agent-docs/advanced.md` | Suspense streaming, performance, bundling, client router, WebSockets |
| `agent-docs/typescript.md` | TS at runtime + full-stack type safety |
| `agent-docs/deployment.md` | Production, runtime targets, embedded use |
| `agent-docs/testing.md` | Unit, browser, convention validation, the `handle()` test harness (`@webjsdev/server/testing`) |
| `agent-docs/framework-dev.md` | Monorepo dev (only when editing webjs itself) |
| `agent-docs/recipes.md` | Page / route / action / component recipes |
| `agent-docs/lit-muscle-memory-gotchas.md` | **READ FIRST** when writing components. Lit patterns that break webjs SSR or reactivity, with the webjs-shaped fix for each |

---

## AI-driven development: guardrails for all agents

**webjs is an AI-first framework. These rules apply to ALL AI agents
(Claude, Cursor, Copilot, Antigravity, Aider, etc.) and are enforced via
config files that each agent reads automatically.**

### Agent config files (scaffolded by `webjs create`)

| File | Agent | Purpose |
|---|---|---|
| `AGENTS.md` | All agents | Framework API, conventions, recipes (this file) |
| `CONVENTIONS.md` | All agents | Project conventions (guidance, customizable in the prose) |
| `CLAUDE.md` | Claude Code | Points to AGENTS.md + CONVENTIONS.md, no duplication |
| `.claude/settings.json` | Claude Code | PreToolUse hook guarding git merge/push to main; UserPromptSubmit hook routing prompts to matching skills |
| `.cursorrules` | Cursor | Workflow rules, git rules, framework patterns |
| `.agents/rules/workflow.md` | Antigravity (Google) | Workspace rules. Google's documented convention is `.agents/rules/*.md` per the official Antigravity Codelab. Replaces the legacy `.windsurfrules` shipped pre-acquisition. |
| `.github/copilot-instructions.md` | GitHub Copilot | Same rules in Copilot format |
| `.github/pull_request_template.md` | All (via GitHub) | PR checklist: tests, docs, convention check |
| `.editorconfig` | All editors | Consistent indent/encoding/line endings |

### Before starting ANY work: verify and sync the branch

1. `git branch --show-current`. If on `main` / `master`, **STOP**. Create a feature branch: `git checkout -b feature/<task-slug>`.
2. Verify the branch matches the task. Don't mix unrelated work.
3. Sync with parent: `git fetch origin && git log HEAD..origin/main --oneline`. If there are upstream commits, `git rebase origin/main` before starting.

Claude Code enforces step 1 via `.claude/hooks/guard-branch-context.sh` (intercepts Edit/Write when on main). Other agents check manually.

### Skills are routed deterministically, never skipped

A Skill is model-invoked, so it fires only when the model judges a request to match. That judgement can be wrong (a research-framed prompt whose work a skill governs can slip past). The `.claude/hooks/route-skills.sh` `UserPromptSubmit` hook makes routing deterministic: on every prompt it keyword-matches the text against each skill's documented triggers and injects a directive to invoke the matched skill via the Skill tool before other work, plus a standing policy to check the available skills whenever a task matches one. A hook cannot force a Skill tool-call (Claude Code only lets `UserPromptSubmit` inject context, not invoke tools), so keyword cases are deterministic and genuinely-ambiguous prompts lean on the always-injected policy. Tests live in `test/hooks/route-skills.test.mjs`.

### Autonomous mode (sandbox / bypass permissions)

When interactive approval is disabled, never block on questions. Auto-decide using these defaults:

| Decision | Autonomous default |
|---|---|
| On `main`, need a branch | Auto-create `feature/<task-slug>` |
| Parent has new commits | Auto-rebase before starting |
| Ready to merge | Auto-merge, no prompt |
| Delete branch after merge | **Delete** feature/fix branches, **keep** long-lived (dev, staging, release/*) |
| Commit message | Auto-generate meaningful message |
| Tests failing / conventions violated | Fix them, don't ask |

The principle: autonomous mode is MORE disciplined, not less. Same quality bar (tests pass, conventions valid, docs updated, commits clean).

### Code workflow (mandatory)

Every code change MUST include, automatically:

1. **Tests, every applicable layer (not just unit).** A change ships with the tests that prove it, across EVERY layer it can affect. Walk them explicitly and add coverage where the change reaches:
   - **unit** (`packages/*/test/**`, `test/**`): logic, helpers, analysers, including the counterfactual (the negative case that fails when the change is reverted).
   - **browser** (`*/test/**/browser/*`, run via `npm run test:browser`): anything touching hydration, client render, DOM, slots, the client router, custom-element upgrade.
   - **e2e** (`test/e2e/*.test.mjs`, run via `WEBJS_E2E=1`): full-stack behaviour observable only in a real browser, including **network probes** (was a request issued or not), navigation, streaming.
   - **smoke** (`test/examples/*/smoke/*`): the example apps still boot and serve.
   A unit test is NECESSARY BUT NOT SUFFICIENT for any client-router / component / browser-facing change: the headline behaviour ("a prefetch fired on hover", "the click avoided a second fetch", "the component hydrated") is a browser/e2e assertion, and shipping unit-only there is the exact gap this rule closes. `npm test` does NOT run the browser or e2e layers; run them yourself and report the result. Never report work done with failing or missing tests. See `agent-docs/testing.md`. Enforced for Claude Code by `.claude/hooks/require-tests-with-src.sh` (blocks a commit that stages `packages/*/src/**` with no test, and a commit that net-removes test lines); the same gate ships to scaffolded apps via `webjs create`.
2. **Documentation.** Update `AGENTS.md` for new API surface, `CONVENTIONS.md` for new conventions, `docs/` or `website/` for user-facing features.
3. **Convention validation.** Run `webjs check` and fix violations.

### Git workflow (mandatory)

The model: always work on a feature branch. Commit + push freely there. The only gate is merging back into main (requires user approval unless in bypass mode).

1. **Feature branch first.** `git checkout -b feature/<task-slug>`. Never edit on main.
2. **Commit per logical unit.** One feature, one fix, one rename, one doc rewrite. As soon as a unit is complete and tests pass, commit it. If you have 5+ unstaged files spanning different concerns, you waited too long. Push after each commit. Scaffolded apps ship hook coverage for Claude Code (`PostToolUse`), Gemini CLI (`AfterTool`), Cursor 1.7+ (`afterFileEdit`), and OpenCode (`tool.execute.after` TS plugin), all firing at threshold 4. Antigravity / Copilot fall back to the text rules in this file plus `.cursorrules` / `.agents/rules/workflow.md` / `copilot-instructions.md`. The framework repo itself uses the Claude Code hook only.
3. **Meaningful commit messages.** Imperative mood, under 72 chars; body explains *why*, not the diff.
4. **No AI attribution in commits.** Never add `Co-Authored-By: Claude`, `Generated by AI`, or similar.
5. **PRs via `gh`, always.** When the user says "merge to main", the workflow is ALWAYS `gh pr create` → confirm → `gh pr merge`. Never run a local `git merge` + `git push origin main`, even when permitted.
6. **Never push to main.** Always push to the feature branch.
7. **Never merge without permission.** Ask exactly:
   > Ready to merge `<branch>` into `<target>`?
   > After merging, should `<branch>` be **deleted** or **kept**?
   Wait for explicit approval AND the delete/keep preference.
8. **Run tests before committing.** `webjs test` must pass.

---

## Working in the webjs framework repo itself

When editing the framework monorepo (this repo, not a scaffolded app): **`packages/` is plain `.js` with JSDoc. Never add `.ts` files there.** The framework ships buildless. TypeScript is fine in `examples/`, `docs/`, `website/`.

See `agent-docs/framework-dev.md` for monorepo commands, workspace layout, reference codebases, and per-feature update checklists.

### Repo health: worktree-safe git config (core.bare / hooksPath)

This repo uses git worktrees (the review subagents spawn throwaway ones under `.claude/worktrees/`). Git's worktree machinery can leave `core.bare=true` in the shared `.git/config`, which is lethal to the main checkout: every git operation that needs a work tree then fails with `fatal: this operation must be run in a work tree`. The shared value is harmless only while the main worktree carries a per-worktree override (`extensions.worktreeConfig=true` plus a `.git/config.worktree` pinning `core.bare=false`).

`scripts/git-worktree-safe.mjs` establishes that override and pins an absolute `core.hooksPath` to `.hooks` on the main worktree, where both survive a shared-config reset (which is what otherwise silently disables the framework `.hooks/pre-commit`). It runs from the root `prepare` script, so every `npm install` self-heals. Two manual entry points:

- `npm run fix:git` heals the config on demand (run it if a git command reports the work-tree error).
- `npm run check:git` asserts the invariant (`core.bare` resolves false, the framework hook is active) and exits non-zero otherwise. The regression test is `test/repo-health/git-worktree-safe.test.mjs`.

Because the pin lives in the main worktree's `config.worktree`, `git worktree add` copies it into each linked worktree, so a commit made inside a throwaway review worktree also runs the framework `.hooks/pre-commit`. That is harmless (the hook only blocks main and auto-generates a changelog on a version bump), and review subagents are read-only so they do not commit; the inheritance is noted here only so the behavior is not surprising.

The fix only repairs the LOCAL checkout. Commits and branches are always safe on GitHub regardless.

### Changelog: per-package, per-version, auto-generated

webjs ships per-package per-version changelogs under `changelog/<pkg>/<version>.md`. The model: **a version bump is the trigger**. When any commit on `main` changes the `version` field in `packages/<pkg>/package.json`, the scripts/backfill-changelog.js generator emits a new `changelog/<pkg>/<version>.md` summarising every conventional-commit (`feat:` / `fix:` / `breaking:` / `perf:`) that landed in that package since the prior bump. The website renders the union of all packages' files at `/changelog`.

**How it works for AI agents and humans:**

1. Bump the `version` field in a `packages/<pkg>/package.json` and stage the change.
2. Run `git commit` as usual. The `.hooks/pre-commit` hook detects the staged bump, runs `node scripts/backfill-changelog.js` automatically, stages the resulting `changelog/<pkg>/<version>.md`, and lets the commit proceed. The bump and its release notes land in the same commit.
3. Optionally review and edit the generated file before pushing. The script's body excerpts are the first lines of each commit message; for `breaking` entries especially, add migration notes by hand. Re-runs are idempotent (existing files are never overwritten), so hand-edits survive.
4. Never edit `changelog/<pkg>/<version>.md` for a version that has already been published. Bump the version and edit `changelog/<pkg>/<next>.md` instead.

If the package has zero `feat:` / `fix:` / `breaking:` / `perf:` commits in the range (a release-only bump with no user-facing changes), the script writes nothing and the hook fails the commit. Either add a hand-written entry, downgrade the bump if it was unintentional, or `git commit --no-verify` to bypass.

The whole flow is tool-agnostic: the universal pre-commit hook fires for every `git commit`, regardless of who or what is running it. AI agents using Claude Code, Cursor, Copilot, Aider, etc. all get the same behavior, as do human contributors.

**npm publishes AND GitHub Releases are auto-created from the same files.** The `.github/workflows/release.yml` workflow watches for new `changelog/**.md` files added in a push to `main`. For each new file:

1. `scripts/publish-npm.js` parses the frontmatter, checks `npm view @webjsdev/<pkg>@<version>`; if the version is not yet on the registry, it runs `npm publish --workspace=@webjsdev/<pkg> --access=public`. Idempotent: already-published versions are skipped.
2. `scripts/publish-release.js` composes a tag `<pkg>@<version>` (e.g. `core@0.6.0`), title `@webjsdev/<pkg> <version>`, body (the markdown after frontmatter), then runs `gh release create`. Idempotent: existing release tags are skipped.

npm runs first; if it fails (auth, network, transient registry error), the GitHub Release step is skipped and the workflow fails. After fixing, a re-run picks up where it left off: the npm-side check makes the completed package a no-op and only the missing release lands.

The workflow uses `NPM_TOKEN` (repo secret) and the auto-provisioned `GITHUB_TOKEN`. Free for public repos.

---

## What webjs is

An **AI-first, web-components-first** framework inspired by NextJs, Lit, and Rails.

**Why lit-style web components specifically?** AI coding agents have substantial training data on lit. Aligning webjs's component runtime API (reactive properties via `static properties`, lifecycle hooks like `shouldUpdate` / `willUpdate` / `updated` / `firstUpdated` / `updateComplete`, ReactiveController hooks `hostConnected` / `hostDisconnected` / `hostUpdate` / `hostUpdated`, the full `lit-html` directive set, `html` / `css` tagged templates) lets agents emit idiomatic webjs code without framework-specific translation. Webjs ships its own implementation under `packages/core/src/` (clean JSDoc-typed JS, no-build), but the public API surface matches lit so the ecosystem's collective lit knowledge transfers directly. Decorators are the one exception (banned by invariant 10, non-erasable TS); the `declare` + `static properties` pattern replaces them.

- **Sensible defaults, overridable.** Memory store in dev, Redis when configured. HTTP caching via standard `Cache-Control`.
- **Built-in essentials.** Auth, sessions, caching, cache store, rate limiting, file storage, all with pluggable adapters.
- **No build step.** Source files are served as native ES modules.
- **JSDoc or erasable TypeScript.** Plain `.js` with JSDoc is default. `.ts` / `.mts` is stripped via Node 24+'s built-in `module.stripTypeScriptTypes` (position-preserving, no sourcemap). See invariant 10 + `agent-docs/typescript.md`.
- **Node 24+ required** for default strip-types behaviour. Enforced by an early preflight: the CLI and the server entry call `assertNodeVersion()` (from `@webjsdev/server`, sourced from `engines.node`), so an older Node fails fast with a clear "you need Node 24+" message naming the found + required version, instead of a cryptic late strip / `fs.watch` failure.
- **SSR + CSR by default.** Pages are server-rendered (real HTML). Components render as light DOM by default; shadow DOM is opt-in via `static shadow = true` with Declarative Shadow DOM SSR.
- **Progressive enhancement is the default architecture.** Pages and every web component are SSR'd. With JS disabled: content reads, `<a>` links navigate, `<form>` server actions submit, display-only custom elements render. JS is opt-in *per interactive behaviour*: adding `@click=${…}`, a reactive property assignment, or a signal mutation requests JS for that interactivity. Never write features whose first paint depends on hydration; never use `fetch` + JS handlers for write-paths where a `<form>` + server action would do.
- **Display-only components are elided from the browser.** A component with no interactivity signal (no `@event`, no non-state reactive property, no overridden lifecycle hook, no signal or `Task` import, no `addController`) renders identical SSR'd HTML with or without its JS, so the framework statically detects it and strips its import from the served source. The module is never downloaded, and a vendor package used only by display-only components is never fetched either (the component's import is stripped and its preload dropped, so nothing pulls the package in; its importmap entry is also pruned, whether the map is resolved live or applied from a committed vendor pin file, so a pinned app and an unpinned app serve the same map). This is webjs's answer to dead-JS-on-the-wire elimination, the one RSC benefit a no-build progressive-enhancement framework would otherwise lack. Automatic, conservative (anything ambiguous ships), no opt-in keyword. Disable app-wide with `"webjs": { "elide": false }` in package.json (everything ships, like before the feature), or with the `WEBJS_ELIDE=0` env override (which wins over package.json, the deploy-time escape hatch). The invariant that elision never changes observable output is verified differentially (the same routes rendered on vs off must produce identical SSR HTML and identical post-hydration DOM/behaviour). See `agent-docs/components.md`.
- **Tailwind CSS is the default styling convention.** Custom CSS works; light-DOM components authoring CSS MUST prefix selectors with the component tag.
- **Server actions with rich types.** A `*.server.{js,ts}` file with `'use server'` exports functions importable from the client. The import is rewritten to a typed RPC stub. Wire round-trips `Date`, `Map`, `Set`, `BigInt`, `Error`, `TypedArray`, `Blob`, `File`, `FormData`, registered Symbols, reference cycles.
- **Server-file source is unreachable from the browser (framework invariant).** Every `.server.{js,ts}` file is source-protected by the HTTP layer: the dev server returns either a generated RPC stub (when the file has `'use server'`) or a throw-at-load stub (server-only utility), never source.
- **Only files reachable from a browser-bound entry are servable.** The dev server walks the static import graph starting from every `page` / `layout` / `error` / `loading` / `not-found` / component file. This is computed **lazily on the first request** (memoized in `ensureReady()`, re-derived after each `fs.watch` rebuild), not at boot, so the server starts without reading app source. The resulting Set is the authorisation gate at the source-file branch. `package.json`, `node_modules/**`, hand-rolled `scripts/`, and any other file no client code imports return 404 by construction. Same posture as Next.js's bundler-manifest model, derived statically (on the first request, not at boot) instead of via a build. The `.server.{js,ts}` stub guardrail still runs inside the gate as defense in depth.

---

## Execution model (read this to avoid the RSC mental model)

webjs has **no server/client component split**. Do not reason about it as React Server Components: there is no server-component render tree, no Flight protocol, no "use client" / "use server" component boundary, and no per-component server-versus-client identity.

**Pages, layouts, and components are isomorphic modules** (same source on server and client), but they hydrate differently, and this distinction matters:

- **Components hydrate.** A component's module loads in the browser, registers the custom element, the browser upgrades the SSR'd tag, and its `render()` / lifecycle / `@event` / signals run on the client. Per-element, islands-style. **This is where all interactivity lives.**
- **Pages and layouts do NOT hydrate.** Their function runs **only on the server** to produce HTML; it is never re-invoked in the browser (the boot script `import`s the module but never calls its default export, and client navigation swaps server-rendered HTML rather than re-running the page function). So **a page/layout cannot be interactive in its own markup**. An `@click` in a page template is dropped at SSR and never wired up, and a signal read in a page body never re-renders. To make something interactive, put it in a component and render that component's tag.

A page/layout module still **loads** in the browser, but only for its **top-level side effects**: registering the components it imports (so their SSR'd tags upgrade) and, for a layout, enabling the client router via `import '@webjsdev/core/client-router'`. That module load is also **how its imports reach the client**. Evaluating `import dayjs from 'dayjs'` at the top of a page fetches dayjs when the page module loads, *not* via hydration. So if a page/layout has no components to register and no client behavior, loading it is dead weight, which is exactly when elision drops it (and its imports never reach the client).

`route.{js,ts}` is the one routing file that is **not** isomorphic: a **server-only HTTP handler** (named `GET` / `POST` / … exports), the webjs equivalent of a Next.js route handler. It never ships to the client.

**`.server.{js,ts}` is the one server boundary, and it is an RPC + source-protection mechanism, NOT an RSC server component.** The file's source never reaches the browser:
- With `'use server'`: its exports are **RPC-callable** from client code. The browser import is rewritten to a typed stub that POSTs to `/__webjs/action/<hash>/<fn>`. This is a server *action* (Rails/Next-style RPC), not a server-rendered component.
- Without `'use server'`: it is a **server-only utility** (Prisma client, secrets, `node:*`, password hashing). The browser import resolves to a stub whose body is `throw new Error(...)` at module top level, so it **throws when loaded, not when called**.

That throw-at-load behavior has a practical consequence: **do not import a no-`'use server'` server-only util directly into a page, layout, or component.** It works during SSR (the real module runs server-side), but a component hydrating, or a page/layout module loading, will evaluate the stub and crash. Server-only utils are meant to be used *inside* server actions (`'use server'` files), `route.{js,ts}` handlers, or `middleware`, all of which run only on the server. A page reaches server logic by importing a `'use server'` **action**, whose RPC stub loads safely on the client (and isn't even called there). This is why the recipes say a page should call a server action and never import the DB directly.

So the way to keep a dependency off the client is the `.server.{js,ts}` boundary, not a component-level annotation. A server-only npm package (e.g. a date library used only to format during SSR) belongs inside a `.server.{js,ts}` file (`lib/format.server.ts` exporting `formatDate`), because pages/layouts are isomorphic and their top-level imports otherwise reach the browser.

**Elision is a no-build dead-JS optimization layered on top of this model, not a boundary.** When an isomorphic module (a display-only component, or an inert page/layout) would do no client work, the framework statically detects that and skips shipping its JS, the SSR'd HTML being the complete output. The module stays isomorphic; only its dead client download is removed, along with any vendor package reachable only through it (never imported, so never fetched; its importmap entry is also pruned, whether resolved live or from a committed pin). This never changes behaviour: progressive enhancement is the no-JS baseline, and elision only removes JS that would have done nothing. It is webjs's answer to the *outcome* RSC delivers (no dead JS on the wire), achieved by static analysis of isomorphic modules rather than a server/client split. See `agent-docs/components.md`.

---

## Framework source: where to find it

Plain JS with JSDoc lives in `node_modules/@webjsdev/`. What you read is what runs.

```
node_modules/@webjsdev/
  core/        renderer, WebComponent, directives, Task, Context, router, testing
  server/      dev + prod server, SSR, router, actions, auth, sessions, cache
  cli/         webjs binary
  ts-plugin/   tsserver plugin: go-to-definition, attribute autocomplete
  ui/          component library + `webjs ui` CLI
```

Starting points: SSR pipeline → `@webjsdev/server/src/ssr.js`. Client hydration → `@webjsdev/core/src/render-client.js`. Client router → `@webjsdev/core/src/router-client.js`. Convention rules → `@webjsdev/server/src/check.js`.

For UI debugging, use the Playwright MCP server (configured in `.claude.json`) instead of one-shot Bash scripts. For live app introspection, the scaffold also wires a read-only **`webjs` MCP server** (`webjs mcp`, in `.claude.json` next to Playwright) exposing four tools (`list_routes`, `list_actions`, `list_components`, `check`) over the same data functions documented here. It mutates nothing, so it is the safe way to ask "what routes / actions / components does this app expose, and does it pass `webjs check`?" without grepping.

---

## App layout (cannot be renamed)

```
app/                        ROUTING ONLY. Thin route adapters (import from modules/).
                            Do not put helpers, constants, or shared
                            code here, not even under a private _utils/
                            folder. App-wide helpers live in lib/.
  layout.js                 root layout, wraps every page
  page.js                   /
  error.js                  nested error boundary
  not-found.js              404 page (only at app/ root)
  <segment>/page.js         /<segment>
  [param]/page.js           dynamic route (`params.param` in handler)
  [...rest]/page.js         catch-all
  [[...rest]]/page.js       optional catch-all
  (group)/…                 route group (folder NOT in URL, still scopes layout/error)
  _private/…                private folder (fully ignored by the router)
  <path>/route.js           HTTP handler at /<path>
  <segment>/middleware.js   per-segment middleware
  <segment>/not-found.js    nested 404 (nearest wins)
  <segment>/loading.js      auto Suspense boundary
middleware.js               root-level middleware (runs on every request)
readiness.js                optional readiness check; default-exports an async
                            fn that /__webjs/ready runs once warm (return false
                            or throw = 503, to gate on live DB/dependency health)
env.js                      optional boot-time env-var validation; default-exports
                            a typed schema (or a validator function) that webjs
                            runs against process.env at boot, failing fast with a
                            clear message listing every missing/invalid var
sitemap.js                  metadata route → /sitemap.xml
robots.js                   metadata route → /robots.txt
manifest.js                 metadata route → /manifest.json
icon.js / opengraph-image.js / twitter-image.js / apple-icon.js
lib/                        app-wide code (not module-specific)
  prisma.js, session.js     cross-cutting infra at the root
  utils/                    browser-safe helpers grouped by concern (cn.ts, ui.ts, format.ts)
modules/                    feature-scoped (actions + queries + UI)
  <feature>/
    actions/                mutations (one file per action, `'use server'`)
    queries/                reads (one file per query, `'use server'`)
    components/             feature-owned web components
    utils/                  internal helpers
    types.js                JSDoc typedefs
components/*.js             SHARED presentational primitives
public/*                    static assets, served at /<name>
prisma/schema.prisma        data models
```

Every file is a plain ES module.

---

## Public API of `@webjsdev/core`

```js
import { html, css, WebComponent, render } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
```

The bare `@webjsdev/core` specifier resolves to a BROWSER bundle that drops server-only modules (the 1.1k-line `render-server.js`, `expose.js`, `setCspNonceProvider`). `renderToString` / `renderToStream` live at `@webjsdev/core/server`; Node-side consumers (SSR pipeline, unit tests) import them from there. The framework's own `packages/server/` keeps using the bare specifier where it only needs the isomorphic surface.

| Export | Purpose |
|---|---|
| `html` | Tagged template literal → `TemplateResult`. |
| `css` | Tagged template literal → `CSSResult`. Use in `static styles`. |
| `WebComponent` | Base class for interactive components. |
| `register(tag, C)` | Tag → class binding. Auto-called by `Class.register('tag')`. |
| `render(v, el)` | Client-side render into a DOM element. |
| `renderToString` | Server-side **async** render → HTML string with DSD. |
| `notFound()` | Throw to return 404 rendered via `not-found.js`. |
| `redirect(url)` | Throw to return 307 (default) or 308 redirect. |
| `expose(p, fn)` | Tag a server action ALSO reachable at a REST path. **Server-side only**; import inside `.server.{js,ts}` files. The bare `@webjsdev/core` specifier resolves to the browser entry, which excludes `expose`; an import from a client-bound file silently reads `undefined`. |
| `validateInput(fn, validate)` | Attach an input validator to a server action that runs on BOTH the RPC path and the `expose()` REST path, returning a structured `{ success: false, fieldErrors, status: 422 }` on failure (#245). **Server-side only**; excluded from the browser entry like `expose`. See the server-actions section. |
| `repeat(items, k, t)` | Keyed list directive. Preserves DOM identity on reorder. |
| `Suspense({fallback, children})` | Streaming boundary. |
| `connectWS(url, handlers)` | Client WebSocket: auto-reconnect, JSON, queued sends. |
| `richFetch<T>(url, init?)` | Content-negotiated fetch with rich-type encoding. |
| `navigate(url, opts?)` | Programmatic client-router nav. `{replace}` swaps in place. |
| `revalidate(url?)` | Evict snapshot-cache for one URL or all. Call after mutations. |
| `WebjsFrame` (`<webjs-frame id="...">`) | Escape-hatch partial-swap region. A frame nav whose response lacks the frame fires a cancelable, bubbling `webjs:frame-missing` event (detail `{ frameId, url, document }`) and leaves the frame unchanged instead of full-swapping; `preventDefault()` hands the outcome to the listener. |
| `Metadata` / `MetadataContext` / `JsonLd` (type-only) | Types the `metadata` / `generateMetadata(ctx)` return + context. `metadata.jsonLd` (a `JsonLd` object or array) emits schema.org structured data as `<script type="application/ld+json">` (escaped automatically). `metadata.preconnect` / `metadata.dnsPrefetch` (#243) emit `<link rel="preconnect">` / `<link rel="dns-prefetch">` connection-warming hints (a URL string, `{ url, crossorigin? }`, or an array); the framework also auto-emits one preconnect to the resolved cross-origin vendor CDN origin for an unpinned app. `import type { Metadata } from '@webjsdev/core'`. |
| `PageProps<R>` / `LayoutProps<R>` / `RouteHandlerContext<R>` (type-only) | Types the page / layout / route-handler args (`{ params, searchParams, url, actionData }`; layouts add `children`). `R` is an optional route literal that narrows `params` against the generated route union. `Route` / `RouteParams<R>` are the href + params helpers. Run `webjs types` to generate the union (see CLI reference). `import type { PageProps } from '@webjsdev/core'`. |
| `WebjsConfig` (type-only) | Types the `webjs` package.json config block (`elide`, `headers`, `redirects`, `trailingSlash`, `basePath`, `csp`, the ingress body-size + timeout caps), with `WebjsHeaderRule` / `WebjsRedirectRule` / `WebjsCspConfig` / `WebjsTrailingSlash` for the nested shapes. A companion JSON Schema (`@webjsdev/server/webjs-config.schema.json`, associated in the scaffold's `.vscode/settings.json`) flags an unknown key in the editor. `import type { WebjsConfig } from '@webjsdev/core'`. |

### Directives, from `import { … } from '@webjsdev/core/directives'`

lit-html parity. AI agents writing lit-shaped directive code land on familiar names.

| Directive | Purpose | Example |
|---|---|---|
| `repeat(items, keyFn, templateFn)` | Keyed list reconciliation | `${repeat(items, i => i.id, i => html\`…\`)}` |
| `unsafeHTML(str)` | Render trusted raw HTML. **NEVER use with user input.** | `${unsafeHTML(markdownToHtml(md))}` |
| `live(value)` | Input value sync against live DOM | `.value=${live(inputVal)}` |
| `keyed(key, template)` | Force remount on key change | `${keyed(this.userId, html\`<form>…</form>\`)}` |
| `guard(deps, fn)` | Memoize sub-template; client skips re-eval when deps unchanged | `${guard([this.title], () => html\`<h1>\${this.title}</h1>\`)}` |
| `templateContent(tpl)` | Render content of a `<template>` element | `${templateContent(this.shadowRoot.getElementById('tpl'))}` |
| `ref(refOrCallback)` + `createRef()` | Bind a Ref or callback to the element | `<input ${ref(this._inputRef)}>` |
| `cache(value)` | Retain detached DOM when toggling sub-templates (preserves input state, scroll, focus) | `${cache(this.active ? viewA : viewB)}` |
| `until(...args)` | Render highest-priority resolved candidate; higher-priority Promises that later resolve replace lower-priority output | `${until(this.dataPromise, html\`<p>Loading…</p>\`)}` |
| `asyncAppend(iter, mapper?)`, `asyncReplace(iter, mapper?)` | Stream values from an AsyncIterable. Iteration aborts on teardown. | `${asyncAppend(stream, (v, i) => html\`<li>\${v}</li>\`)}` |

For component-scoped async data with full pending/error states, `Task` is usually a better fit than `until`. For page-level streaming, `Suspense` is the structural primitive. Everything else (`classMap`, `styleMap`, `ifDefined`, `when`, `choose`, `map`, `join`, `range`) uses native patterns: conditional classes via filter+join, conditional render via ternary, etc.

### Context & Task

- `createContext`, `ContextProvider`, `ContextConsumer` from
  `@webjsdev/core/context` share data across deeply nested components.
- `Task`, `TaskStatus` from `@webjsdev/core/task` handle async ops inside
  components with `pending`/`complete`/`error` states + AbortController.
  Page-level data uses async page functions instead.

### `html` expression prefixes

| Syntax | Meaning |
|---|---|
| `<div>${x}</div>` | Text child (primitives, arrays, `TemplateResult`s). |
| `class=${x}` | Attribute. Stringified and HTML-escaped. SSR-safe. |
| `@click=${fn}` | Event listener. Client-only (no server event loop). Drops at SSR. |
| `.value=${v}` | DOM property. On custom elements, round-trips through SSR via `data-webjs-prop-*` (wire serializer handles Array/Object/Date/Map/Set/BigInt). On native elements, drops at SSR (use the attribute form for SSR-visible initial values). |
| `?disabled=${b}` | Boolean attribute. Present iff truthy. SSR-safe. |

Event/property/boolean-prefixed attributes **must be unquoted**.

**SSR coverage matrix.** Every `html` hole produces the same output server and client, with two exceptions: `@event` listeners (no server event loop) and `.prop` on native elements (no SSR walker for native tags). For custom elements, the SSR walker reads `data-webjs-prop-*` before `instance.render()`; the client renderer applies and strips the same attribute on `connectedCallback`. Net result: `<my-comp .data=${richObject}>` works end-to-end.

---

## `WebComponent` essentials

```ts
class MyThing extends WebComponent {
  static shadow = false;             // default: light DOM. true for scoped shadow DOM
  static lazy = false;               // true = load module on viewport entry
  static properties = {
    count: { type: Number, reflect: true },
    mode:  { type: String, state: true },
    data:  { type: Object, converter: { fromAttribute: JSON.parse } },
    size:  { type: Number, hasChanged: (n, o) => Math.abs(n - o) > 1 },
  };
  declare count: number;             // TS only, typed accessor (see below)
  declare mode: string;
  static styles = css`…`;

  connectedCallback() { super.connectedCallback(); /* seed properties from attrs */ }
  render() { return html`…`; }
}
MyThing.register('my-thing');
```

Signals are the default state primitive. Import `signal` / `computed`
from `@webjsdev/core`, read with `signal.get()` inside `render()`, and
every WebComponent's built-in `SignalWatcher` will re-render on change.
Module-scope signals share state across components and survive
navigations; instance signals (created in the constructor) carry
component-local state. Updates are batched via microtask. The
`static properties` declaration is reserved for values that ride an
HTML attribute (declared attributes auto-trigger re-render too). For
fine-grained DOM swap without a full re-render, use the
`watch(signal)` directive from `@webjsdev/core/directives`.

### Typed props in TypeScript via the `declare` pattern

The framework installs reactive getter/setter on `this` via `Object.defineProperty`. A `student: Student = { … }` class-field initializer compiles to `[[Define]]` semantics that overwrite the accessor AFTER `super()`, silently breaking reactivity. Use `declare`:

```ts
class StudentCard extends WebComponent {
  static properties = { student: { type: Object } };   // runtime: tracked
  declare student: Student;                             // compile-time: typed

  constructor() {
    super();
    this.student = { name: '', email: '' };             // defaults go HERE
  }
}
```

`webjs check` enforces this via the `reactive-props-use-declare` rule.

### Property options

| Option | Default | Meaning |
|---|---|---|
| `type` | `String` | Default attribute coercion |
| `reflect` | `false` | Property changes write back to the attribute |
| `state` | `false` | Internal. No attribute, no `observedAttributes` |
| `hasChanged` | strict `!==` | Custom change detection |
| `converter` | type-based | Custom attribute ↔ property serialization |

### Lifecycle (lit-aligned)

Every update cycle runs these hooks in order. All receive a `changedProperties` Map: keys are property names, values are the previous value before the change.

| # | Hook | When | Use for |
|---|---|---|---|
| 1 | `shouldUpdate(changedProperties)` | Update queued | Return `false` to skip this update. Default `true`. |
| 2 | `willUpdate(changedProperties)` | Pre-render | Compute derived values. Property assignments fold into THIS cycle without re-triggering. |
| 3 | controllers' `hostUpdate()` | Pre-render | Controller pre-render logic |
| 4 | `update(changedProperties)` | Render phase | Default calls `render()` + commits. Override to wrap or short-circuit (rare). |
| 5 | controllers' `hostUpdated()` | Post-render | Controller post-render logic |
| 6 | `firstUpdated(changedProperties)` | After first render only | One-time DOM setup |
| 7 | `updated(changedProperties)` | After every render | Post-render DOM work conditional on what changed |
| 8 | `updateComplete` Promise | Resolves last | `await el.updateComplete` after triggering an update |

The `update()` body has an error boundary that calls `renderError(error)` if `render()` throws. At SSR the walker runs the pre-render value-deriving hooks (`willUpdate`, then controllers' `hostUpdate`) before `render()` and reflects `reflect: true` properties, so derived state and reflected attributes land in the first paint. The remaining hooks stay **client-only**: `shouldUpdate`, the `update` DOM commit, `firstUpdated`, `updated`, and the connection callbacks run only in the browser.

**ReactiveControllers** are composable lifecycle logic via `host.addController(this)`. Built-in `Task`, `ContextProvider`, `ContextConsumer` are all controllers. See `agent-docs/components.md`.

### SSR-safe state (progressive enhancement)

The SSR pipeline runs the constructor, applies attributes, runs `willUpdate` and controllers' `hostUpdate`, calls `instance.render()`, and inlines the result. **It does NOT call `connectedCallback`, `firstUpdated`, `updated`, or any browser-only hook.** Those run after script load. So a value derived in `willUpdate` is in the SSR'd HTML, but browser-only data (localStorage, viewport) still belongs in `connectedCallback`.

Rules:

- **Defaults for first paint go in the constructor** (after `super()`).
- **Browser-only data** (localStorage, viewport, `navigator.*`, `matchMedia`) goes in `connectedCallback`. Write the value to a signal (instance-scoped in the constructor, or module-scope if shared) to refine the first paint.
- **Server-known data** (session, accept-language, theme cookie, URL) goes through the page function and is passed as a prop/attribute.
- **For unacceptable flicker** (theme color, RTL), use a synchronous inline `<script>` in the root layout's `<head>` to set `document.documentElement` before custom elements upgrade.

**Anti-pattern:** a component whose first paint is empty/placeholder because real data is fetched in `connectedCallback`/`firstUpdated`. Fetch on the server in the page function instead. See `agent-docs/components.md` for SSR mechanics in depth, and `agent-docs/lit-muscle-memory-gotchas.md` for the full catalog of lit patterns that produce broken SSR or silent reactivity failures in webjs. A genuinely browser-only global or `HTMLElement` member (`document`, `window`, `localStorage`, `this.querySelector`, `this.classList`, `this.attachShadow`, ...) touched in the constructor or `render()` throws during SSR, and `webjs check`'s `no-browser-globals-in-render` rule flags it, with the SSR crash naming the member and the fix. The attribute methods (`getAttribute` / `setAttribute` / `hasAttribute` / `toggleAttribute`), the event methods, `attachInternals`, `closest()` (tag-name selectors, resolved against the SSR ancestor chain so a compound child can read its parent's state), and the host IDL reflections (`dataset`, `className`, `hidden`, `id`, `title`, `slot`, `role`, `tabIndex`, the `aria*` mixin) are backed by a server element shim, so reading attributes in `render()`, resolving a parent via `closest()`, and reflecting properties (including host attributes set inside `render()`) during the SSR update cycle are supported (not flagged). Only the genuinely layout / live-DOM surface (`querySelector`, `classList`, `attachShadow`, `focus`, geometry reads) stays absent and throws.

### Light DOM (default) vs Shadow DOM (opt-in)

Light DOM is default because global CSS and Tailwind classes apply directly.

| Use case | Mode |
|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) |
| `static styles = css\`\`` scoped styles | Shadow DOM (`static shadow = true`) |
| `<slot>` projection | **Either.** Same API; light DOM uses framework projection. |
| Third-party isolation | Shadow DOM |

**Light-DOM CSS-prefix rule (invariant):** if a light-DOM component authors custom CSS, every class selector MUST be prefixed with the tag name (`.my-card__body` or `my-card .body`). Prefer Tailwind utilities first; they're unique by construction.

See `agent-docs/components.md` for prefix patterns and `agent-docs/styling.md` for vanilla-CSS-only opt-out.

### Editor intelligence

Add `@webjsdev/ts-plugin` to `tsconfig.json` `plugins`. It bundles `ts-lit-plugin`: attribute autocomplete, type-checked attribute values, go-to-definition from `<my-counter>` to the class, no "Unknown tag" noise.

---

## File conventions: the essentials

### Pages (`app/**/page.{js,ts}`)

- Default export is a possibly-async function receiving `{ params, searchParams, url, actionData }`.
- Runs **only on the server**. Throw `notFound()` or `redirect(url)` to short-circuit.
- Named exports: `metadata` (static), `generateMetadata(ctx)` (async, takes precedence). Type both with the exported `Metadata` type (`import type { Metadata, MetadataContext } from '@webjsdev/core'`) so a typo or wrong-typed field is a compile-time error instead of a silently dropped tag. See `agent-docs/metadata.md`.
- Optional named export `revalidate` (a positive number of seconds) OPTS the page into the server HTML response cache (#241): its rendered HTML is cached and served without re-running the page for that window. SAFETY: only set it on a page that is the SAME FOR EVERYONE (it must NOT read `cookies()` / a session / per-user data), since the cache is keyed by URL only. Evict on demand with `revalidatePath(path)` from `@webjsdev/server`. See the "Server HTML response cache" section below.
- Optional named export `action`: a possibly-async function receiving `{ request, params, searchParams, url, formData }` that handles a non-GET/HEAD submission to the page's own URL (the no-JS form write-path, #244). It returns an `ActionResult`. On success the server responds `303` to a same-site `result.redirect` (a local `/path`; a cross-origin value is ignored to prevent an open redirect) or the page's own path (Post/Redirect/Get). On failure (`success: false`, or a `fieldErrors`, or an `error`) the SAME page re-renders with status `422` and the result on `ctx.actionData`, so the page reads `actionData.fieldErrors.<name>` for messages and `actionData.values.<name>` to repopulate inputs. A thrown `redirect()`/`notFound()` is honored (a thrown `redirect()` may target an external URL). A page with no `action` export 404s on a non-GET, unchanged. `actionData` is `undefined` on a plain GET. See the recipe in `agent-docs/recipes.md` and the client-router side in `agent-docs/advanced.md`.
- Page modules also load on the client so transitively imported components register. Keep top-level imports browser-safe. **Server-only code (`@prisma/client`, `node:*`, anything needing Node APIs) goes only in `.server.{js,ts}`, `route.ts`, or `middleware.ts`. Never in pages, layouts, or components.** Wrap the access in a `.server.{js,ts}` file; the framework rewrites the import into an RPC stub for the browser.

### Layouts (`app/**/layout.{js,ts}`)

- Default export receives `{ children, params, searchParams, url }`. Must embed `children`. Nest by folder.

**Document shell ownership:**

- By default the framework auto-emits `<!doctype><html lang="en"><head></head><body>` around every composition.
- The **root layout** (`app/layout.{js,ts}` exactly) MAY optionally write its own `<!doctype><html><head></head><body>` to override `<html>`/`<body>` attributes. The framework splices required tags (importmap, modulepreload, title, meta) into the user's `<head>`.
- **Non-root layouts and pages MUST NOT** write `<!doctype>` / `<html>` / `<head>` / `<body>`. Enforced by the `shell-in-non-root-layout` rule.
- `metadata` exports merge across nested layouts (deepest wins).

### Error boundaries (`app/**/error.{js,ts}`)

- Default export receives `{ error, ...ctx }`. Returns a `TemplateResult`.
- Catches errors from sibling-page / deeper-segment render (not notFound/redirect, which are sentinels).
- Innermost wins; if it throws, next-outer catches.
- In prod only `error.message` is sent, never the stack.

### Loading states (`app/**/loading.{js,ts}`)

Framework wraps the sibling page in `Suspense({ fallback: <loading>, children: <async page> })`. Fallback flushes immediately while the page function resolves.

### Metadata routes

`sitemap.{js,ts}`, `robots.{js,ts}`, `manifest.{js,ts}`, `icon.{js,ts}`, `apple-icon.{js,ts}`, `opengraph-image.{js,ts}`, `twitter-image.{js,ts}` live at app root or static segments only (not inside `[dynamic]`). Each default-exports a possibly-async function.

For `sitemap.{js,ts}`, the optional `sitemap(entries)` helper from `@webjsdev/server` serializes an array of `{ url, lastModified?, changeFrequency?, priority? }` into spec-valid `<urlset>` XML (XML-escaping each url so a `&`/`<` cannot break the document, formatting `lastModified` as a W3C datetime, validating `priority` 0..1 and the `changeFrequency` enum, skipping a urlless entry). For a site past the 50,000-URL per-file limit, `sitemapIndex(sitemaps)` builds a `<sitemapindex>`: serve each shard from a `route.{js,ts}` handler returning `sitemap(shardEntries)` and return `sitemapIndex([...])` from the root `app/sitemap.{js,ts}`. Both helpers are optional; the function can still return a raw string or `Response`.

### Route handlers (`app/**/route.{js,ts}`)

- Export named async functions per method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Each receives `(Request, { params })` and returns a `Response` or any value (auto-JSON).
- A folder cannot have both `page.js` and `route.js`.
- **WebSocket support:** export `WS(ws, req, { params })` from the same `route.js` to turn the URL into a WS endpoint. In dev the module is re-imported per connection; store shared state on `globalThis`. See `agent-docs/advanced.md`.

### Middleware (`middleware.{js,ts}`)

- Optional top-level + per-segment files. Default export `async (req, next) => Response`.
- Return a Response to short-circuit (redirect, 401). Call `next()` then post-process to add headers, log, etc.
- Per-segment middleware applies to its subtree, outermost → innermost.

### Env validation (`env.{js,ts}`)

- Optional file at the app root (sibling of `middleware.js` / `readiness.js`). Default-exports either a **schema object** or a **validator function**. The whole feature is opt-in: with no `env.{js,ts}`, nothing changes.
- **Schema object.** Keys are env-var names; each value is a type name (`'string'`) or an options object. Supported types: `string`, `number`, `boolean`, `url`, `enum`. A field is **required by default**; `optional: true` or `required: false` or a `default` makes it absent-ok. String fields support `minLength` and `pattern` (RegExp or string); `enum` fields take `values`.

  ```ts
  // env.ts
  export default {
    DATABASE_URL: 'string',
    AUTH_SECRET: { type: 'string', required: true, minLength: 16 },
    PORT: { type: 'number', optional: true, default: 3000 },
    NODE_ENV: { type: 'enum', values: ['development', 'production', 'test'] },
  };
  ```

- **Function escape hatch.** Default-export `(env) => void`; a thrown Error becomes the boot failure. Use it to validate with zod or anything else without webjs depending on it.
- **Runs at boot**, after `.env` is loaded into `process.env` and before any server-only module is imported. Coerced values (number / boolean) and applied defaults are written back to `process.env`, so the app reads the coerced value.
- **Fails fast.** A validation failure throws a clear, aggregated Error naming EVERY missing / wrong-type / failed-constraint var at once. The CLI exits non-zero; an embedded host's `createRequestHandler` rejects. The server never comes up on a bad env.

### Server actions (`**/*.server.{js,ts}` + `'use server'`)

Two markers describe server-side files. The combination determines behaviour:

| File | `'use server'`? | What it is |
|---|---|---|
| `*.server.ts` | yes | **Server action.** Source-protected AND RPC-callable: imports from client code are rewritten to RPC stubs that POST to `/__webjs/action/<hash>/<fn>`. |
| `*.server.ts` | no | **Server-only utility.** Source-protected; browser imports get a throw-at-load stub. Use for the Prisma singleton, session helpers, password hashing. |
| Plain `.ts` | yes | **Lint violation** (`use-server-needs-extension`). Directive alone is silently ignored; file serves to browser as plain source. Rename to add the `.server.` infix. |
| Plain `.ts` | no | Browser-safe; standard behaviour. |

- Server actions export named async functions. Args + return values must round-trip through webjs's serializer.
- **Importing from a client component IS the API.** The dev server rewrites the import to an RPC stub.
- **Expose as REST:** `expose('METHOD /path', fn, { validate?: parse })`. Same function powers both callers.
- **Input validation runs on BOTH call paths (#245).** A `validate` declared once runs SERVER-SIDE before the action body whether the action is invoked via the RPC path (a client component import) OR via its `expose()` REST route. Attach it two ways:
  - `validateInput(fn, validate)` from `@webjsdev/core` (a pure-RPC action, no REST route), or
  - `expose('METHOD /path', fn, { validate })` (also a REST route).
  Both write the same metadata, so both call paths see the validator. The framework only CALLS the validator (it ships no validation library) and interprets the return:
  - `{ success: true, data? }` -> valid; the action runs with `data` if present, else the original input;
  - `{ success: false, fieldErrors, message? }` (an object with a boolean `success` of `false`, OR a `fieldErrors`) -> FAILED; the framework returns a structured `ActionResult` `{ success: false, fieldErrors, error: message?, status: 422 }` WITHOUT calling the action body. Over RPC this is a normal 200 result the client reads as `result.fieldErrors`; over REST it is a 422 JSON response. This is the new structured field-error path that matches the `ActionResult` envelope (so the no-JS page-action re-render and the client both understand it);
  - a THROW -> a sanitized error (a 400 on REST keeping a schema lib's `issues`; on RPC the same sanitized error result as a thrown action body, prod-safe);
  - any OTHER returned plain value -> treated as the transformed/coerced input (back-compat with `validate: Schema.parse`).
  Disambiguation: a return is an envelope ONLY when it is an object with a boolean `success` OR a `fieldErrors`; otherwise it is a transformed input. The validator lives in the `.server` file and never ships to the client. Stay zod-free with a three-line adapter: `validate: (i) => { const r = Schema.safeParse(i); return r.success ? { success: true, data: r.data } : { success: false, fieldErrors: r.error.flatten().fieldErrors }; }`. The validator receives the action's FIRST argument (the conventional single input object).

### RPC security model

- Client → action RPC: POST with `x-webjs-csrf` matching cookie issued on first SSR response. Mismatch → 403.
- Production error responses are sanitized to only `message`, never stack.
- `expose()`d REST endpoints are NOT CSRF-protected. Apply auth via middleware or per-route checks.

### `expose()` security checklist

1. Authenticate every mutating endpoint (bearer/API key, explicit CSRF, or origin allow-list).
2. Use `validate`. Never trust merged `{...query, ...params, ...body}`.
3. Log responsibly. No user input or secrets in errors.
4. Configure CORS narrowly. For a route handler (or app-wide), use the `cors()` middleware (see below); for an `expose()`d endpoint use a tight `origin` allow-list. **A credentialed endpoint (`credentials: true`) REQUIRES an explicit `origin` allowlist; never combine it with a wildcard `'*'`.** The CORS spec forbids the pair, and reflecting under credentials grants any origin credentialed access. `cors()` narrows the wildcard to the reflected origin to keep the request working but emits a one-time `console.warn`; do not rely on that fallback for a real allowlist.
5. Rate-limit at the edge (`rateLimit()` middleware, see `agent-docs/advanced.md`).

### CORS for route handlers (`cors()` middleware)

`cors()` from `@webjsdev/server` returns a webjs middleware `(req, next) => Response`, usable in `middleware.{js,ts}` (root or per-segment) OR wrapped around a `route.{js,ts}` handler. It handles origin reflection, the `OPTIONS` preflight (`204` short-circuit), `Vary: Origin` (append, not clobber), and the credentials rule. The `--template api` scaffold ships a root `middleware.ts` demonstrating it.

```js
// middleware.js
import { cors } from '@webjsdev/server';
export default cors({ origin: ['https://app.example.com'], credentials: true });
```

`origin` accepts a string (exact), `string[]` allow-list, a `RegExp`, a function `(origin) => boolean`, or `'*'` / `true` (any). A disallowed origin gets no `Access-Control-Allow-Origin` (the browser blocks the read) but the actual request is still served, since CORS is browser-enforced.

> **`credentials: true` REQUIRES an explicit origin allowlist.** A wildcard origin (`'*'` / `true`) with `credentials: true` is invalid per the CORS spec, and combining them effectively grants credentialed access to EVERY origin (cookies, `Authorization`). `cors()` keeps the request working by narrowing the wildcard to the reflected request origin (and adds `Vary: Origin`) rather than emitting an invalid `*`, BUT it emits a one-time `console.warn` flagging the footgun. For any credentialed endpoint, pass an explicit `origin` list (string / array / RegExp / function), never `'*'`.

See `agent-docs/advanced.md` for the full option reference.

### Components (`components/*.{js,ts}`)

- One custom element per file. Call `Class.register('tag')` at module top level.
- Imported by pages (SSR) and/or other components.
- **Styling:** shadow-DOM CSS via `static styles` or Tailwind classes, not inline `style="…"`. Repeated visual chunks in pages → component whose styles live in its shadow root.

---

## Modules architecture (preferred for non-trivial apps)

### Layout

- **`modules/<feature>/actions/*.server.{js,ts}`** mutations, one file per function.
- **`modules/<feature>/queries/*.server.{js,ts}`** reads, same shape.
- **`modules/<feature>/components/*.{js,ts}`** feature-owned components. Shared UI lives in top-level `components/`.
- **`modules/<feature>/utils/*.{js,ts}`** pure helpers. No `'use server'`, no DB access. Use `*.server.ts` for module-scoped server-only utilities (no RPC).
- **`modules/<feature>/types.{js,ts}`** typedefs.
- **`lib/`** cross-cutting:
  - `lib/*.server.{js,ts}` server-only infra (Prisma singleton, session helpers, password hashing). Source-protected; no `'use server'` keeps it out of the RPC registry.
  - `lib/utils/*.{js,ts}` browser-safe helpers by concern (cn, ui, format). Files at the root of `lib/` (like `lib/constants.ts`) carry app-wide browser-safe values.

### Return shape: the `ActionResult<T>` envelope

```ts
type ActionResult<T> =
  | { success: true, data?: T, redirect?: string }  // redirect MUST be a same-site local path
  | {
      success: false,
      error?: string,
      fieldErrors?: Record<string, string>, // per-field messages, keyed by input `name`
      values?: Record<string, string>,        // submitted text fields, to repopulate inputs
      status?: number,
    };
```

The `fieldErrors` / `values` / `redirect` members are additive (the plain
`{ success, data, error, status }` form keeps working). A page `action` uses
`fieldErrors` + `values` to drive the no-JS re-render (the page reads them off
`ctx.actionData`), and `redirect` to choose the Post/Redirect/Get target on
success. Two rules a page-action author must know:

- **Failure detection is robust.** A result is a FAILURE (re-render) when
  `result.success === false`, OR `result.fieldErrors` is present, OR
  `result.error` is present and `result.success !== true`. So returning
  `{ error, status }` or `{ fieldErrors }` WITHOUT a literal `success: false`
  still surfaces the error and re-renders, it is not silently treated as success.
- **`result.redirect` must be a same-site local path** (begins with a single
  `/`). A protocol-relative `//host` or absolute `scheme://host` value is
  ignored (it falls back to the page's own path), since a user-controlled
  redirect target is an open-redirect. For a legitimate external redirect, throw
  `redirect(absoluteUrl)` instead.

See `agent-docs/recipes.md`.

Routes translate mechanically:

```ts
export async function POST(req: Request) {
  const r = await createPost(await req.json());
  if (!r.success) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r.data);
}
```

### Rules

- **Routes stay thin.** >~20 lines of business logic → extract into a module action.
- **Client components import server modules via the normal import path.** webjs rewrites it. Don't hand-write `fetch()`.
- **Server-only imports stay out of components/ and page top-level graphs** except through `.server.{js,ts}` files.
- **One module, one feature.** Prefer public actions/queries over reaching into another module's `utils/`.

---

## Styling: Tailwind-first, `lib/utils/ui.ts` helpers (strong default)

**Tailwind is the strong default for pages AND light-DOM components (the default DOM mode).** Use Tailwind utilities for layout, spacing, color (via the `@theme` tokens), typography, borders, radius, shadows, and interaction states (hover/focus/active/disabled, dark mode). Light DOM does not scope styles, so utilities apply directly and are the right tool.

**The lit muscle-memory trap.** The lit reflex is to scope CSS in a shadow root with `static styles = css\`\``. In webjs the default is light DOM, which does NOT scope, so reaching for a scoped `css` block or an inline `<style>` with semantic class names (`.hero`, `.feature`, `.card`) in a light-DOM component is the habit to resist. Prefer Tailwind utilities. When a class bundle repeats, extract it into a `lib/utils/ui.ts` helper returning an `` html`...` `` fragment (SSR-time, no client runtime), NOT a CSS class.

```ts
// lib/utils/ui.ts
import { html } from '@webjsdev/core';
export function rubric(label: string) {
  return html`<span class="block font-mono text-xs uppercase text-accent">● ${label}</span>`;
}
```

Extraction rule: 1× inline. 2-3× identical → helper. 1-2 prop variation → parameterised helper. Radically different → keep inline. (No `@apply`: hides utilities from the reader.)

**The custom-CSS allowlist (the only things raw CSS is for).** Reserve raw CSS for what utilities genuinely cannot express: design-token `:root` + `@theme` definitions, `@property` animated custom properties with `@keyframes`, `::-webkit-scrollbar` and `scrollbar-color`, `prefers-reduced-motion` blocks, and complex `color-mix()` or gradient effects. When custom CSS IS unavoidable in a light-DOM component, the tag-prefix invariant (#7) still holds: prefix every class selector with the component tag. **Shadow-DOM components (`static shadow = true`) legitimately use `static styles = css\`\``, which is the right home for scoped CSS, unchanged.**

See `agent-docs/styling.md` for the full Tailwind-first treatment and the vanilla-CSS-only opt-out.

---

## Client navigation: automatic, nothing to opt into

Nested layouts auto-emit `<!--wj:children:<segment-path>-->` markers around each `${children}` interpolation. The client router walks both DOMs for these markers and replaces only the inside of the deepest shared layout's children slot. **Outer-layout DOM identity is preserved** (sidenav scroll, input values, `<details>` state survive).

Form submissions (`<form action method>`) ride the same pipeline. GET forms promote `FormData` to the query string. Non-GET forms send `FormData` as body and clear the snapshot cache on success. Forms that already `e.preventDefault()` in `@submit` are untouched. `data-no-router` opts out.

A non-GET `<form>` whose target page exports an `action` (see Pages above) is the no-JS write-path. With JS disabled it is a native round-trip; with JS the router applies the server's response in place, an HTML body of any status (including a `422` re-render carrying field errors and the user's typed `value=` attributes) is swapped without a full reload, and a `303` See Other (the success/Post-Redirect-Get case) is followed via `fetch`, recording the final URL. The no-JS path and the enhanced path produce the same field-error UI.

Wire-byte optimization is automatic: the router sends `X-Webjs-Have` listing marker paths it has; the server short-circuits at the deepest match and returns only the divergent fragment. Rapid clicks are safe (prior fetches abort, nav-tokens prevent stale reverts). Scroll position is captured + restored on back/forward.

**Link prefetch is on by default (intent strategy).** Hovering, focusing, or touch-starting a same-origin in-app link speculatively fetches that page (with the same `X-Webjs-Have` header a real nav sends) and caches the fragment, so the click resolves with no round-trip. The per-link knob is a `data-prefetch` attribute (valid-HTML `data-*`, like SvelteKit and Astro; Next / Nuxt / Remix express the same choice as a component prop, which webjs has no equivalent for since links are plain `<a href>`), with four strategies and Next-style aliases: `intent` (default, hover/focus/touch), `render` (or `true`, eager on insert), `viewport` (or `auto`, on scroll-into-view), `none` (or `false`, never). Only internal links are prefetched: cross-origin, `download`, `target` other than `_self`, non-HTML extensions, `data-no-router`, and pure hash jumps are all skipped, exactly like the click path. Speculation is bounded (concurrency cap, in-flight de-dupe, a short hover dwell, an LRU+TTL cache) and is disabled under `Save-Data` / `prefers-reduced-data`. Opt out per link with `data-prefetch="none"`, `data-no-prefetch`, or `rel="external"`. There is no logout-style heuristic: prefetch issues a real GET, so a non-idempotent action must be a POST or a `<form>` (the same contract Next / Nuxt / Remix rely on). A native `<link rel="prefetch">` in the head is the browser's own mechanism and is never touched. When a fragment lands in the cache the router dispatches a `webjs:prefetch` event on `document` (detail `{ url, key, from: 'prefetch' }`), so app code can instrument hit rate and gate work on a warm cache. See `agent-docs/advanced.md`.

**Production benefits from HTTP/2 at the edge.** Per-file ESM rides HTTP/2 multiplex to be competitive with bundling. PaaS edges (Railway, Fly, Render, Vercel, Cloudflare, Heroku) serve HTTP/2 automatically. Bare-VM self-hosters put nginx / Caddy / Traefik in front. The production server (`npm run start`) speaks plain HTTP/1.1.

For partial-swap NOT tied to a folder layout, wrap in `<webjs-frame id="...">`. A frame nav whose response lacks the frame fires a cancelable `webjs:frame-missing` event and leaves the frame unchanged (no silent full-page swap). See `agent-docs/advanced.md` for the full mechanism.

---

## Invariants (for both humans and agents)

> Hit one of these as a runtime error? The [Troubleshooting page](https://docs.webjs.com/docs/troubleshooting) is keyed by symptom (the throw-at-load server import, the backtick-in-template 500, the TypeScript strip failure, the SSR browser-global crash, the missing-frame swap) and maps each back to the invariant and the `webjs check` rule below.

1. **Server-only code goes in `.server.{js,ts}` files, `route.ts` handlers, or `middleware.ts`. Never in pages, layouts, or components.** The `.server.{js,ts}` extension is the path-level boundary: the file router refuses to serve the source to the browser. A separate `'use server'` directive at the top of a `.server.ts` file makes its exports RPC-callable from client code; without the directive the file is a server-only utility (browser imports get a throw-at-load stub). Direct imports of `@prisma/client`, `node:*`, or any server-only dep from a file under `components/`, `app/**/page.{js,ts}`, `app/**/layout.{js,ts}`, `app/**/loading.{js,ts}`, `app/**/error.{js,ts}`, or `app/**/not-found.{js,ts}` will crash the browser at module load.
2. **Every `*.server.{js,ts}` file with `'use server'` exports must be `async` functions returning serializer-safe values.** Args and results round-trip via webjs's wire. Files without `'use server'` (server-only utilities) can export anything, including singletons.
3. **Custom element tag names must contain a hyphen** (HTML spec). Pass the tag to `Class.register('tag-name')`, not a static field. Any short-string quote works: `'tag-name'`, `"tag-name"`, or `` `tag-name` `` (single-line, no interpolation).
4. **Event (`@`), property (`.`), boolean (`?`) holes in `html` must be unquoted**, e.g. `@click=${fn}`, never `@click="${fn}"`.
5. **Signals are the default state primitive.** Import `signal` / `computed` from `@webjsdev/core` and read via `signal.get()` inside `render()`; every WebComponent's built-in SignalWatcher tracks the reads and re-renders when any of them change. Use a module-scope signal for state shared across components (or pages); create an instance-scope signal in the constructor for state local to one component. Reactive properties (`static properties = { foo: { type: ... } }` with a sibling `declare foo: T`) are reserved for values that ride an HTML attribute, get reflected back to one, or arrive through `.prop=${value}` SSR hydration. For fine-grained DOM swap without a full re-render, use `${watch(signal)}` from `@webjsdev/core/directives`.
6. **Page and layout default exports must be functions.** They return a value (usually `TemplateResult`). They do not call `render()` themselves.
7. **Light-DOM components with custom CSS MUST prefix every class selector with their tag name.** Tailwind utilities are unique by construction, so prefer them.
8. **Non-root layouts and pages MUST NOT** write `<!doctype>` / `<html>` / `<head>` / `<body>`. Only the root layout may.
9. **No backtick characters inside `html\`...\`` template bodies**, even inside CSS / HTML comments. A nested backtick closes the literal at JS-parse time and 500s in prod.
10. **TypeScript must be erasable.** Set `compilerOptions.erasableSyntaxOnly: true`. No `enum`, no `namespace` with values, no constructor parameter properties, no legacy decorators with `emitDecoratorMetadata`, no `import = require`. The framework strips types via Node 24+'s built-in `module.stripTypeScriptTypes` (position-preserving, no sourcemap). If you disable the flag and use non-erasable syntax, the dev server fails at strip time and returns a 500 pointing at the `no-non-erasable-typescript` lint rule. webjs is buildless end-to-end and has no bundler fallback. Two lint rules enforce this: `erasable-typescript-only` (checks the tsconfig flag) and `no-non-erasable-typescript` (scans source for the four offending patterns even if the flag is off). See `agent-docs/typescript.md` for erasable equivalents.

11. **No em-dashes (U+2014), no hyphen or semicolon used as pause-punctuation, and no colon attached to a code-shaped LHS.** Banned glyphs as pause punctuation: U+2014; a plain hyphen surrounded by spaces between word characters; a semicolon surrounded by spaces between word characters. Banned colon attachments (prefer verb-led rephrasings): `xyz()` followed by colon-then-prose; a custom-element tag like `<my-tag>` followed by colon-then-prose; `[expr]` subscript followed by colon-then-prose; markdown definition lists with `<code>foo()</code>` followed by colon-then-prose. Prefer a period, comma, colon on a plain-noun LHS only, parentheses, or a restructured sentence. Plain hyphens stay fine in natural roles (compound words, CLI flags, filenames, ranges). Semicolons stay fine inside code. Colons stay fine in TS / JSON / CSS syntax. Enforced for Claude Code via `.claude/hooks/block-prose-punctuation.sh` (PreToolUse on Write / Edit / MultiEdit / NotebookEdit / Bash). The hook scans only NEW content; you can still edit a line that already contains a banned glyph to remove it.

---

## Scaffolding

**Three scaffolds exist. Do not invent template names:**

```sh
webjs create <name>                  # full-stack: layout, page, components, modules, Prisma+SQLite
webjs create <name> --template api   # backend-only: routes + modules + Prisma, no SSR
webjs create <name> --template saas  # auth + login/signup + protected dashboard + User model
```

### How AI agents must scaffold

1. **Always scaffold via `webjs create`.** Never hand-roll the directory.
2. **Pick the template from the user's request:**

   | The user asks for… | Use |
   |---|---|
   | Todo, blog, dashboard, marketplace, social, e-commerce, any product with UI | **default** |
   | HTTP/JSON API with no UI | **`--template api`** |
   | Accounts, login, signup, SaaS | **`--template saas`** |

   Default to full-stack when ambiguous.

3. **Default to a real database (Prisma + SQLite). NEVER use JSON files, in-memory arrays, or localStorage as a substitute for persistence.** Every scaffold ships `prisma/schema.prisma`, `lib/prisma.server.ts`, and `npm run db:*` scripts. Persisting data as JSON is a project convention violation (it resets on reload and cannot scale).
4. **Treat the scaffold as REFERENCE, not the final product.** Replace the example `app/page.ts`, `User` model, and components.
5. **Update `prisma/schema.prisma` to real models FIRST.** Run `webjs db migrate <name>`, then build pages/actions/queries.
6. Full docs at **https://docs.webjs.com**.

---

## CLI reference

```sh
webjs dev    [--port N]                               # dev server with live reload
webjs start  [--port N]                               # prod server. No build step, source IS the runtime. Speaks plain HTTP/1.1 (put a reverse proxy in front for TLS + HTTP/2)
webjs test   [--server] [--browser] [--watch]         # unit + browser tests
webjs check  [--rules] [--json]                       # correctness validator (--rules lists the checks; report-only, no autofix). --json emits the structured violations + a summary count as JSON (non-zero exit on violations preserved), for an agent loop
webjs mcp                                             # read-only MCP server (stdio) exposing the live route table, server actions (with RPC hashes), custom-element tags, and structured check violations, all reusing existing functions. Mutates nothing
webjs doctor                                          # project-health checklist (Node, tsconfig, env drift, vendor pins, @webjsdev versions, git hook); non-zero exit on a hard fail so CI can gate
webjs types                                           # generate .webjs/routes.d.ts (typed Route union + per-route params; #258). Opt-in; webjs dev emits it automatically
webjs typecheck [tsc args...]                         # type-check the app with the project's own tsc --noEmit (non-zero on errors; needs typescript installed)
webjs create <name> [--template api|saas]             # scaffold a new app
webjs db <prisma-subcommand> [...]                    # passthrough to prisma
webjs ui init                                         # @webjsdev/ui CLI
webjs ui add <names...>                               # copy components into your project
webjs ui list / view <name>                           # browse the registry

webjs vendor pin [--from PROVIDER] [--download]       # pin npm packages to .webjs/vendor/importmap.json
webjs vendor unpin <pkg>                              # remove a package from the pin file
webjs vendor list                                     # show pinned packages
webjs vendor audit                                    # npm security advisories against pinned versions
webjs vendor outdated                                 # list pinned packages with newer versions
webjs vendor update [--from PROVIDER]                 # re-pin every outdated package to latest
```

`--from PROVIDER` accepts `jspm` (default), `jsdelivr`, `unpkg`, `skypack`. The chosen provider is persisted in `.webjs/vendor/importmap.json` so subsequent `pin` / `update` runs stay on the same CDN until you switch back with another `--from`. Same posture as Rails 7's `bin/importmap pin foo --from jsdelivr`.

`PORT` env is honoured by `dev` and `start` when `--port` is absent.

> **Running this repo's own apps locally** (`website/`, `docs/`,
> `examples/blog/`, `packages/ui/packages/website/`): always `cd` into
> the app and use **its** `npm run dev` / `npm start`, never `webjs dev`
> / `webjs start` directly. Each app composes `webjs dev` with its own
> watchers (Tailwind, Prisma, registry copy) via `concurrently` + `pre*`
> hooks; skipping the npm wrapper renders pages unstyled or with stale
> generated code. See each app's `AGENTS.md` for the specifics.

---

## Environment variables: server-only by default, `WEBJS_PUBLIC_*` reaches the browser

`process.env.X` reads on the server are server-only. Names starting with `WEBJS_PUBLIC_` are exposed in the browser as `process.env.X` via an inline `<script>` injected in the SSR head before any module code runs. No build step, no transform.

```sh
# .env
DATABASE_URL=postgres://...               # server-only
AUTH_SECRET=...                           # server-only
WEBJS_PUBLIC_API_URL=https://api.x.com    # available in browser
WEBJS_PUBLIC_STRIPE_KEY=pk_live_abc       # available in browser
```

```ts
// components/checkout.ts (browser)
const url = process.env.WEBJS_PUBLIC_API_URL;  // works
const dsn = process.env.DATABASE_URL;          // undefined (fail-closed)
```

The shim also defines `process.env.NODE_ENV` (`'development'` in `webjs dev`, `'production'` in `webjs start`) so vendor bundles probing it work. See [`/docs/configuration`](https://docs.webjs.com/docs/configuration).

---

## Secure response headers (on by default, overridable per path)

The server sets a baseline of standard security headers on every response, so a scaffolded app is not clickjackable or MIME-sniffable out of the box (no reverse proxy needed for the baseline). The defaults are literal HTTP headers, no abstraction:

| Header | Value | When |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | always |
| `X-Frame-Options` | `SAMEORIGIN` | always |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | always |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | always |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | production AND HTTPS only |

HSTS is gated to production over HTTPS, detected from `X-Forwarded-Proto` (the request the trusted edge proxy forwards). It honors the same proxy-trust posture as the rest of the framework (`WEBJS_NO_TRUST_PROXY=1` disables forwarded-header trust), so HSTS is never set on a plain-HTTP hop or in dev.

A default is only set when absent, so a header the app already set (in middleware, a `route.{js,ts}` handler, or `expose`) is never clobbered.

### Per-path overrides (`webjs.headers` in package.json)

Declare per-path header rules under `package.json` `"webjs": { "headers": [...] }`, shaped like Next's. `source` is a path pattern matched with the native URLPattern API (so `:param` and `:rest*` syntax works):

```jsonc
{
  "webjs": {
    "headers": [
      { "source": "/embed/:path*", "headers": [{ "key": "X-Frame-Options", "value": null }] },
      { "source": "/app/:path*",   "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }
    ]
  }
}
```

A rule can ADD a header, OVERRIDE a default (give a new value), or DISABLE a default on a path (a `value` of `null`, e.g. dropping `X-Frame-Options` on a public-embed route).

### Precedence (lowest to highest)

`secure defaults` < `webjs.headers` path config < `app middleware`. App middleware always wins (its headers are already on the response when the framework merges), the path config overrides defaults, and the defaults are the floor. The merge seam lives in `packages/server/src/headers.js` (`applySecurityHeaders`), which is also where the CSP layer (below) and future CORS policy plug in.

### Content-Security-Policy (nonce, opt-in)

CSP is OFF by default and opt-in via a `webjs.csp` key in `package.json`. When enabled the server MINTS a fresh per-request CSPRNG nonce, makes it the value `cspNonce()` returns during SSR (so the inline boot script, the importmap, and the `modulepreload` hints all carry it), and emits a literal `Content-Security-Policy` response header carrying that EXACT nonce. One minted value flows mint -> request store -> SSR (`cspNonce()`) -> header, so there is no drift, and it changes every request.

```jsonc
{ "webjs": { "csp": true } }                       // strict default policy
{ "webjs": { "csp": {                              // custom
  "directives": { "connect-src": "'self' https://api.example.com" },
  "reportOnly": true                               // emits *-Report-Only
} } }
```

`true` enables a strict-dynamic + nonce posture tuned for webjs's own output (`script-src 'nonce-<minted>' 'strict-dynamic' 'self' https:`, `default-src 'self'`, `object-src 'none'`, an inline-style allowance for the Tailwind runtime). An object merges `directives` over those defaults (a `null` value drops a default directive), and `reportOnly: true` emits `Content-Security-Policy-Report-Only`. A `__NONCE__` placeholder inside any directive value is substituted with the minted nonce per request. A CSP header the app already set (middleware, a route handler, or the `webjs.headers` config) is never clobbered. Mechanism: `mintNonce` / `readCspConfig` / `buildCspHeader` in `packages/server/src/csp.js`, minted in `handle()` and stored on the request scope via `setCspNonce` (`packages/server/src/context.js`); `cspNonce()` reads that store, falling back to an inbound CSP request header (the legacy consume-only path) when no nonce was minted. Read the nonce in a layout/page with `import { cspNonce } from '@webjsdev/core'` to stamp it on your own inline `<script>` tags.

---

## Declarative redirects: `webjs.redirects` in package.json (#254)

webjs already has `redirect(url)` (an imperative, request-time throw sentinel). For a MOVED URL (old-path -> new-path), SEO wants a DECLARATIVE permanent redirect so link equity transfers and search engines update their index. Declare those under `package.json` `"webjs": { "redirects": [...] }`, an array of `{ source, destination, permanent?, statusCode? }`, cohesive with the `webjs.headers` config:

```jsonc
{
  "webjs": {
    "redirects": [
      { "source": "/old", "destination": "/new" },
      { "source": "/blog/:slug", "destination": "/posts/:slug" },
      { "source": "/legacy", "destination": "/", "permanent": false },
      { "source": "/docs", "destination": "https://docs.example.com" }
    ]
  }
}
```

- **`source`** is a path PATTERN matched with the native URLPattern API (so `:param` and `:rest*` syntax works), exactly like `webjs.headers`.
- **`destination`** is the target: a path, a path referencing named groups captured by `source` (`/posts/:slug` filled from `/blog/:slug`), or an absolute URL (an external redirect; group substitution applies there too).
- **`permanent`** chooses the status: `true` (the DEFAULT) is **308 Permanent Redirect**, `false` is **307 Temporary Redirect**. 308 / 307 are the MODERN choice because they preserve the request method and body (a redirected POST stays a POST). The legacy equivalents are **301 (permanent)** and **302 (temporary)**, which do not guarantee that; set `statusCode` explicitly (e.g. `"statusCode": 301`) when a tool needs a specific legacy code. `statusCode` wins over `permanent`.

**Query string is preserved.** The incoming query string is appended to the destination by default (a destination carrying its own query is merged, the destination's keys winning), matching Next.js.

**Where it applies.** At the very START of request handling (in `dev.js`'s `produce()`, before the probes, routing, SSR, or asset serving), so a matched source returns the redirect immediately and never reaches the router. Framework-internal `/__webjs/*` paths are never redirected. The secure-header + conditional-GET funnel still wraps the redirect Response.

**Config robustness.** Patterns are compiled ONCE at boot, not per request. A malformed entry (bad pattern, missing/empty `destination`, invalid `statusCode`) is DROPPED at config-load with a one-line warning and never crashes the request pipeline (the same fail-safe posture `webjs.headers` / `webjs.csp` use), so a single typo never disables the valid rules around it. Mechanism: `compileRedirectRules` / `applyRedirects` in `packages/server/src/redirects.js`.

**Avoiding redirect loops (your responsibility).** There is no server-side loop guard, matching Next.js. A rule whose `destination` matches another rule's (or its own) `source` redirects forever (the browser eventually aborts it). Make sure a `destination` does not land on a path that another rule moves again. Captured groups are kept percent-encoded by `URLPattern`, so a user-controlled `:slug` cannot escape the origin into an open redirect; only an app-authored `destination` literal controls the target.

---

## Trailing-slash policy: `webjs.trailingSlash` in package.json (#255)

webjs's file router matches `/about` AND `/about/` against the same route (every route pattern ends with `/?$`, so both render IDENTICAL HTML). That is fine for serving but bad for SEO (search engines treat the two URLs as duplicate content that splits link equity) and for the client-router cache (two keys for one page). The trailing-slash policy picks ONE canonical form and 308-redirects the other to it. Declare it under `package.json` `"webjs": { "trailingSlash": ... }`, cohesive with `webjs.redirects` / `webjs.headers` / `webjs.csp`:

```jsonc
{ "webjs": { "trailingSlash": "never" } }    // /about/ -> /about (recommended)
{ "webjs": { "trailingSlash": "always" } }   // /about  -> /about/
{ "webjs": { "trailingSlash": "ignore" } }   // no canonicalization (the default)
```

- **Values.** `"never"` strips a trailing slash, `"always"` adds one, `"ignore"` (or absence, or any unrecognized value) does nothing.
- **Default is `"ignore"` (non-breaking).** An app that set no policy keeps serving both forms exactly as before; the feature is purely opt-in. **The recommendation for most apps is `"never"`** (the cleaner canonical form), but webjs does not impose it, so adding the feature never silently starts 308-ing an existing app.
- **Status is 308 Permanent Redirect**, so SEO link equity transfers and a redirected POST stays a POST.
- **Exemptions.** The ROOT path `/` is always left alone under either policy. Under `"always"`, a path whose last segment looks like a FILE (contains a dot, e.g. `/foo.js`, `/image.png`) is NOT given a trailing slash, since a file is a leaf, not a page directory. Framework-internal `/__webjs/*` paths are exempt. The query string and hash are preserved on the redirect.

**Order vs `webjs.redirects`.** The declarative redirects run FIRST, then the survivor is slash-canonicalized. So an explicit `webjs.redirects` rule always wins. This is NOT loop-free: a redirect whose `destination` CONTRADICTS the slash policy creates an infinite loop. For example `{ trailingSlash: 'never', redirects: [{ source: '/x', destination: '/x/' }] }` ping-pongs forever (`/x` -> 308 `/x/` -> 308 `/x` -> ...). There is no server-side loop guard (matching the `webjs.redirects` warning above); keeping a redirect destination consistent with the slash policy is the author's responsibility. Applied at the very START of request handling (in `dev.js`'s `produce()`, right after `applyRedirects`, before routing / SSR), so the canonical URL reaches the router. Mechanism: `readTrailingSlashPolicy` / `applyTrailingSlash` in `packages/server/src/redirects.js`.

---

## Sub-path deployment: `webjs.basePath` in package.json (#256)

An app served under a sub-path (`example.com/app/`) behind a proxy that does NOT strip the prefix needs every framework-emitted absolute URL to carry the prefix, or module resolution 404s and the page never hydrates. Declare it under `package.json` `"webjs": { "basePath": ... }`, cohesive with `webjs.redirects` / `webjs.trailingSlash` / `webjs.headers` / `webjs.csp`:

```jsonc
{ "webjs": { "basePath": "/app" } }    // example.com/app/ mount
{ "webjs": { "basePath": "" } }        // root mount (the default, a pure no-op)
```

- **Normalization.** `'app'`, `'/app'`, and `'/app/'` all normalize to `'/app'`; a nested `'/foo/bar'` is allowed; an empty value / absence is the root-mount default. An unsafe value (`..`, a protocol, a `//host` network-path reference, whitespace, a backslash) is rejected to the empty default, so a typo fails safe instead of poisoning every emitted URL.
- **The model is strip-at-ingress + prefix-on-emit.** At the very START of request handling the prefix is STRIPPED from the request path and the request rewritten, so all downstream logic (route matching, the `/__webjs/*` checks, the source-file gate, the redirects / trailing-slash / `webjs.headers` configs, the HTML cache key) sees a root-relative path and works UNCHANGED. A request whose path is NOT under the base path is not for this app and 404s. On emit, every framework-emitted same-origin absolute URL gets the prefix prepended: the importmap targets (`/__webjs/core/*` and same-origin `/__webjs/vendor/*`; a cross-origin `https://` CDN vendor URL is left untouched), the modulepreload hrefs, the boot script's per-route module specifiers and lazy entries, the dev reload `src`, and the 103 Early Hints preloads.
- **Empty default is byte-identical.** With no `basePath` (or `""`) both seams are pure no-ops, so an unconfigured app serves exactly the same bytes as before this feature (guarded by a differential test).
- **OUT OF SCOPE (a documented follow-up).** Author-written `<a href="/about">` links and client-router navigation are NOT auto-prefixed (the same boundary Next draws between basePath-prefixing its `<Link>` and a raw `<a href>`; webjs links are plain `<a href>`). The #256 acceptance covers framework-emitted URLs and request matching only.

Mechanism: `normalizeBasePath` / `readBasePath` / `withBasePath` / `stripBasePath` in `packages/server/src/base-path.js`; the ingress strip is in `dev.js`'s `produce()` (before `applyRedirects`), the importmap-target prefix in `importmap.js` (`setBasePath`), the boot / preload / reload prefix in `ssr.js`.

---

## Content-hash asset URLs: `?v=<digest>` immutable caching (prod) (#243)

Every served app module (`.js` / `.ts`) and `public/` asset used to ship `Cache-Control: public, max-age=3600` because its URL was un-versioned (the dev.js comment explains why `immutable` is unsafe without a per-file fingerprint, citing a real regression after a core version bump). The importmap build id does NOT change on an app-module byte change, so it cannot be the per-asset fingerprint. In PRODUCTION the framework instead appends a PER-FILE content hash, computed at serve time (no build step).

- **Emit (prod only).** `withAssetHash(url)` (in `packages/server/src/asset-hash.js`) appends `?v=<hash>` to a framework-emitted SAME-ORIGIN absolute URL: the importmap targets (`importmap.js` `buildImportMap`), the `<link rel="modulepreload">` hrefs, the boot script's module specifiers + lazy entries (`ssr.js`), AND the 103 Early Hints preloads (`dev.js` `routeFor`, so the hint warms exactly the URL the body requests). The hash is a 12-hex prefix of a sha-256 over the file BYTES, memoized in a `Map<absPath, hash>` and cleared on the fs.watch rebuild (so a changed file re-hashes). It is a NO-OP in dev (so dev output is byte-identical), a NO-OP for a CROSS-ORIGIN URL (a `https://` jspm vendor target, which jspm already versions and whose #235 SRI key is the un-hashed URL, plus already-version-named `/__webjs/vendor/*` bundles), and composes with `withBasePath` (basePath THEN `?v`, so a sub-path app emits `<basePath>/app/foo.js?v=hash`). The framework's own `/__webjs/core/*` runtime is fingerprinted too (it changes across core versions, the exact regression cited).
- **App-module body is elision-aware, so the hash folds in the elision verdict.** An app module's SERVED body is not its raw source: the elision pass (#169) strips a side-effect import to a display-only component. That strip is a property of the IMPORTED component's verdict, so a component flipping display-only to interactive changes the importer's served body while its source stays byte-identical. Hashing the source alone would keep the same `?v` and a returning client would hold the stale immutable importer (the now-interactive component never imported, so never hydrated). So a relativized digest of the elidable + inert set is folded into every APP-module hash (`setElisionFingerprint` in `asset-hash.js`, set from `ensureReady`): a verdict flip busts every app module's `?v`. The fingerprint is empty when nothing is elidable, so a no-elision app's hash stays exactly `sha256(bytes)`; core / `public/` files are never elision-transformed, so they hash over their bytes alone.
- **Serve.** A request carrying a `?v=` query is served `Cache-Control: public, max-age=31536000, immutable` (the pathname, query stripped, resolves the file as today; only the cache header changes). An un-fingerprinted request keeps the 1h fallback. Dev stays `no-cache`.
- **Deploy-busts (the safety invariant).** A deploy that changes a module's bytes changes its hash, so its emitted URL changes, so a returning client fetches the new URL instead of serving the stale immutable copy. The build id stays a stable per-deploy fingerprint (the internal `importMapHash()` computation excludes the `?v`), so #241's HTML-cache keying is unaffected.

See `agent-docs/advanced.md` (content-hash caching + the preconnect hints) and `docs/app/docs/no-build/page.ts`.

---

## Conditional GET: ETag + If-None-Match -> 304 (on by default) (#240)

Every CACHEABLE response carries a content-hash `ETag`, and a repeat request whose `If-None-Match` matches it gets a `304 Not Modified` with no body (RFC 7232). So a client holding an identical copy revalidates with a tiny 304 instead of re-transferring the whole body. Wired once at the response funnel in `dev.js`'s `handle()` (mechanism: `applyConditionalGet` in `packages/server/src/conditional-get.js`), so it covers SSR HTML pages, static assets in `public/`, app source modules, and the core / vendor runtime modules uniformly.

The ETag is WEAK (`W/"..."`). It hashes the UNCOMPRESSED body and the prod compression step reuses it across the identity / gzip / br codings, which a STRONG validator may not do (RFC 7232 2.3.3); `If-None-Match` already weak-compares, so a `304` still fires. The funnel only hashes a body the framework positively marked as buffered. A user `route.{js,ts}` handler returning a `ReadableStream` (and especially an SSE `text/event-stream`, whose stream never ends) carries no such marker, so the funnel never buffers it (no memory blow-up, no hang) and never ETags it.

**What gets an ETag + honors 304:**

| Response | ETag? | Why |
|---|---|---|
| A page with a PUBLIC `metadata.cacheControl` (e.g. `public, max-age=60`) | yes | Explicitly opted into caching; a repeat read 304s |
| Static assets (`public/*`), app `.js` / `.ts` modules, core / vendor modules | yes | Content-addressable; the ETag is the body hash |

**What is EXCLUDED (no ETag, never 304):**

| Response | Why excluded |
|---|---|
| A `no-store` page (the DEFAULT for dynamic / per-user pages) | Private content must never get a cross-session 304: a shared cache keyed on the URL could replay one user's validator to another |
| A `private` `Cache-Control` response | Same private-content reasoning |
| A streamed Suspense response (pending boundaries) | An unflushed stream cannot be hashed cheaply; the SSR pipeline flags it internally and the funnel skips it. Streaming responses are not conditional-GET cached |
| A `route.{js,ts}` handler returning a `ReadableStream` (incl. an SSE `text/event-stream`) | The body is not marked buffered, so the funnel never reads it. Buffering a stream would blow up memory, and an SSE stream never ends so the read would hang forever |
| Non-GET / non-HEAD, and any status other than 200 | A validator is only meaningful for a successful, replayable read |

**Stable-body handling.** The ETag is computed over the response's OWN body bytes, so an identical body yields an identical ETag across requests. Per-response varying bits that ride RESPONSE HEADERS (the `x-webjs-build` id, the `set-cookie` CSRF token, the CSP nonce on the header) are NOT part of the body hash, so they do not destabilise the ETag. The one body-level varying input is the CSP nonce stamped INTO the inline boot script: with CSP enabled the HTML body changes every request, so its ETag changes every request and a 304 is simply never produced for that page (correct, not a bug). CSP is off by default, so the common cacheable-page case has a stable body and a stable ETag. The 304 preserves the validators and caching headers (`ETag`, `Cache-Control`, `Vary`, plus the framework's `X-Webjs-Build` / `X-Request-Id` and any `Set-Cookie`) and drops only the body-describing headers (`Content-Length`, `Content-Type`, `Content-Encoding`), so a shared cache and the client router behave identically to a 200.

---

## Server HTML response cache: `export const revalidate` + revalidatePath (OPT-IN) (#241)

A fully-static / inert route re-runs the entire SSR pipeline (layout chain, `renderToString`, metadata merge, importmap splice) on every request even though it produces identical HTML each time. The server HTML cache stores that rendered HTML in the existing pluggable store (`memoryStore` in dev, `redisStore` when configured) and serves it on a hit WITHOUT re-running the page function. This is webjs's no-build equivalent of Next.js's Full Route Cache + ISR.

**SAFETY: caching is OPT-IN and conservative.** A wrongly-cached per-user page served to the wrong visitor is a data leak, so nothing is cached unless the page author opts in, and several defense-in-depth guards run before anything is stored.

### The author contract (read this before adding `revalidate`)

A page opts in by declaring a revalidation window on the page module:

```ts
// app/blog/page.ts
export const revalidate = 60;   // seconds: this page is the SAME FOR EVERYONE for 60s
export default async function Blog() { /* ... */ }
```

**Declaring `revalidate` is you asserting "this page renders identically for every visitor for N seconds."** A page that reads `cookies()` / a session / anything per-user MUST NOT set `revalidate`. There is no per-user keying: the cache is keyed by the FULL URL (path + search string) only. `revalidate = 0` (or a negative / non-number) means "no caching" (always dynamic, the default). The trigger is the `export const revalidate` module export only.

**Framework defense (not just the contract).** When the render reads per-user request state through a framework helper (`cookies()`, `headers()`, `getSession()`, or `auth()`), the framework auto-marks the request dynamic and REFUSES to cache it even when the page set `revalidate` (mirroring Next.js auto-marking a route dynamic on a `cookies()` / `headers()` read), and emits a one-time `console.warn` naming the page. So a wrong `revalidate` on a cookie-reading or `auth()`-gated page fails SAFE (served fresh, uncached) instead of leaking. `auth()` reaches the auth-session read, so a saas-dashboard page that does `const session = await auth()` is auto-excluded.

**LOUD failure mode to know.** This defense only fires for state read THROUGH the framework helpers. A page that varies its body by an inbound auth cookie / `Authorization` header but reads it RAW (e.g. `getRequest().headers.get('cookie')` directly, or a third-party middleware that branches on the header without going through `cookies()` / `headers()` / `getSession()` / `auth()`) AND sets no new `Set-Cookie` WILL be cached and served to a logged-out visitor. The framework helpers `cookies()` / `headers()` / `getSession()` / `auth()` all auto-exclude the page; only RAW `getRequest()` header / cookie access escapes the defense. The fix is to read per-user state through those helpers (or simply do not set `revalidate` on any per-user page).

### Guards (defense in depth, all must pass to cache)

Even with `revalidate` set, the framework refuses to cache a response unless every guard passes, re-checked against the FINAL response at the funnel (after segment middleware runs):

| Guard | Why |
|---|---|
| status 200 | An error / redirect / 404 is request-specific |
| not a streamed Suspense body | An unflushed stream has no stable bytes and cannot be buffered cheaply |
| no per-user request read | The render did not call `cookies()` / `headers()` / `getSession()` / `auth()`. If it did, the output varies per visitor and is NEVER cached (the auto-dynamic defense above), regardless of `Set-Cookie` |
| no non-framework `Set-Cookie` | A page that sets a session / per-user cookie is per-user output. The framework's own `webjs_csrf` cookie is allowed (it is re-minted per response on a cache hit) |
| CSP is OFF | With CSP enabled the inline boot script carries a fresh per-request nonce, so the body varies per request; a cached body would replay a stale nonce its CSP header rejects |
| no `X-Webjs-Have` (partial-nav) request | A partial-nav response's bytes depend on the request header, so it must not be shared under the full-URL key |

### CSRF cookie + CSP on a cache hit

The cached value is the stable per-page HTML body only. The per-response varying bits are RE-MINTED on every cache hit, so a brand-new visitor served from cache is still correct: the `webjs_csrf` cookie is freshly issued (it is a `Set-Cookie` header, never part of the cached body), and the published build id is re-read. CSP-enabled pages are simply never cached (see the guard table), so there is no stale-nonce risk. A cached page and its fresh render are observably identical within the window (differential correctness).

**Build id is folded into the cache key, so a VENDOR-changing deploy invalidates for free.** The cached HTML bakes the deploy's `data-webjs-build` importmap into its boot script. With a Redis store that survives a deploy, a v2 process serving a v1-body would resolve modules against stale vendor URLs. To prevent that, the cache key embeds the published build id (the importmap fingerprint) alongside the path + query, so a new deploy naturally writes and reads under fresh keys and never serves a stale-importmap body. The old-deploy entries expire via their TTL.

> **Caveat (app-module-only deploys, #243 interaction).** The published build id is a fingerprint of the IMPORTMAP (core + vendor) only, so a deploy that changes ONLY an app module's bytes (not a vendor) does NOT move it. A Redis-cached `revalidate` page's HTML body then survives that deploy under the same key and keeps serving the OLD `?v=<hash>` boot URLs. The page still works (the serve path returns the current bytes for any `?v`), but those URLs are now content-addressed immutably to whatever bytes the client first fetched, so a later deploy that REVERTS the module to earlier bytes (re-emitting an earlier `?v`) could let a client serve the intermediate bytes from its immutable cache. This is narrow (Redis surviving a deploy, a `revalidate` page, an app-only change, then a byte revert) and is the same vendor-only-build-id limitation that keeps the client router from hard-reloading on an app-only deploy. The mitigation today is a SHORT `revalidate` TTL (the time-based floor). The durable fix (folding an app-source fingerprint into the build id, which also fixes app-only-deploy reload detection) is tracked as a follow-up.

### On-demand revalidation: `revalidatePath` (server-side)

`import { revalidatePath, revalidateAll } from '@webjsdev/server'`. A server action that mutates the data a cached page renders calls `revalidatePath('/blog')` to evict that path's cached HTML so the next request re-renders; `revalidateAll()` clears everything. This is **distinct from** the client-side `revalidate()` from `@webjsdev/core` (which evicts the BROWSER snapshot cache for client navigation). `revalidatePath` evicts the SERVER HTML cache.

```ts
// modules/blog/actions/publish-post.server.ts
'use server';
import { revalidatePath } from '@webjsdev/server';
export async function publishPost(input) {
  // ... write to the DB ...
  await revalidatePath('/blog');   // the next /blog request re-renders fresh
  return { success: true };
}
```

Time-based eviction is handled by the store TTL (= `revalidate` seconds). This PR does a simple TTL-evict + on-demand `revalidatePath`; stale-while-revalidate (serving stale once while refreshing in the background) is NOT implemented (a documented follow-up). Mechanism: `packages/server/src/html-cache.js`, the cache lookup + opt-in read live in `ssrPage` (`packages/server/src/ssr.js`), and the cache WRITE is a response-funnel step (`commitHtmlCache`) wired in `dev.js`'s `handle()` so it sees the final post-middleware response.

**Multi-instance (Redis) limitation.** `revalidatePath(path)` deletes a store key, so it reaches every instance that shares a Redis store. But `revalidateAll()` bumps an IN-PROCESS generation counter folded into the key namespace, so on a multi-instance deploy it only flushes the instance it ran on; peers keep serving until their own TTL expires (or their own `revalidateAll()` runs). Because the generation is per process, a targeted `revalidatePath` issued AFTER a divergent `revalidateAll` on another instance computes a different namespaced key and may not reach a peer. For a multi-instance deploy, prefer a SHORT `revalidate` TTL (the time-based floor that always holds cross-instance) and treat `revalidateAll()` as a single-instance / dev convenience, or assume a single instance. Per-path `revalidatePath` after a mutation is the reliable cross-instance primitive.

---

## Server cache() data invalidation: tags + `revalidateTag` (#242)

`revalidatePath` (above) evicts cached HTML; `revalidateTag` evicts cached `cache()` DATA. They are separate functions for two distinct caches, documented together as **the server cache invalidation surface**: a mutation often wants to evict BOTH a tagged data read AND a cached HTML path. `import { revalidateTag, revalidateTags } from '@webjsdev/server'`.

The problem: `cache(fn, { key, ttl })` could only be invalidated via `wrapped.invalidate()` from the module that owns the wrapper, and even then only the no-args base key (arg-specific keys leaked until TTL). There was no way for an unrelated mutation (createComment) to invalidate a related read (postById) without importing every cached wrapper.

### The `tags` option

`cache(fn, { key, ttl, tags })` accepts `tags` as either a static `string[]` (every cached entry of this function shares them) or a **function** `(...args) => string[]` so a per-arg read tags with the entity id:

```ts
// modules/posts/queries/post-by-id.server.ts
'use server';
import { cache } from '@webjsdev/server';
import { prisma } from '../../../lib/prisma.server.ts';

export const postById = cache(
  async (id: string) => prisma.post.findUnique({ where: { id } }),
  { key: 'post', ttl: 300, tags: (id) => ['post:' + id] } // per-entity tag
);

export const listPosts = cache(
  async () => prisma.post.findMany(),
  { key: 'posts', ttl: 60, tags: ['posts'] } // static tag, all entries
);
```

When a result is stored, the framework also records a `tag -> cacheKey` mapping in a THIN key-index over the existing store (`cache:tag:<tag>` holds a JSON array of cache keys), so the per-arg entry becomes findable by tag.

### Action-driven invalidation

A `'use server'` mutation calls `revalidateTag(tag)` after writing. It works ACROSS modules: the read tagged `'posts'` in the posts module is evicted by a `revalidateTag('posts')` issued from the comments module, with no import of the wrapper.

```ts
// modules/comments/actions/create-comment.server.ts
'use server';
import { revalidateTag, revalidatePath } from '@webjsdev/server';
export async function createComment(input) {
  await prisma.comment.create({ data: input });
  await revalidateTag('post:' + input.postId); // postById(postId) recomputes
  await revalidatePath('/blog');               // also evict the cached HTML
  return { success: true };
}
```

`revalidateTag('post:5')` evicts ONLY the entry tagged `post:5` (the id-5 read), leaving other ids cached. `revalidateTags([...])` clears several tags in one call. Full automatic invalidation (inferring which tags a mutation touched) is deliberately NOT done; the explicit call is the surface.

### Arg-key-leak handling

The existing `invalidate()` (which clears only the no-args base key) is unchanged and still works. Tags are now the way to invalidate arg-specific reads: tag a per-arg read with `tags: (id) => ['post:' + id]` and evict the exact id with `revalidateTag('post:' + id)`. An untagged `cache()` is unaffected by any `revalidateTag`.

### Multi-instance (Redis) caveat

The tag index is a plain read-modify-write of a JSON array, NOT atomic across processes (mirrors the #241 limitation). With a shared Redis store, `revalidateTag` deletes the keys it can see and reaches every instance for those keys, but two instances appending to the same tag concurrently can lose an append (last write wins), so a freshly-stored key on a peer might miss eviction and live until its TTL. The tag-index entry carries the cache TTL so it self-prunes. For strict cross-instance invalidation, prefer a short `ttl` as the floor. Mechanism: `packages/server/src/cache-tags.js` (the index + `revalidateTag` / `revalidateTags`), wired from `cache-fn.js`'s store write.

---

## Request ingress hardening: body-size limit (413) + server timeouts (on by default)

The server caps inbound request bodies and bounds connection lifetimes by default, so an uncapped RPC / route / form body is not a memory-exhaustion vector and a slow / hung connection is not a slowloris vector. Both are web-standard / node:http-native, configurable, and apply with secure defaults when unset (issue #237).

### Body-size limit (413 Payload Too Large)

Every path that READS a request body enforces a size cap: the server-action RPC endpoint, `route.{js,ts}` handlers that call `readBody`, the exposed-action REST path, and the no-JS page-action form path. All route through one bounded-read helper (`packages/server/src/body-limit.js`), so the limit is uniform.

| Limit | Default | Config key | Env override | Applies to |
|---|---|---|---|---|
| JSON / RPC | 1 MiB | `webjs.maxBodyBytes` | `WEBJS_MAX_BODY_BYTES` | RPC endpoint, `readBody`, exposed-action body |
| Form / multipart | 10 MiB | `webjs.maxMultipartBytes` | `WEBJS_MAX_MULTIPART_BYTES` | page-action form submissions |

```jsonc
{ "webjs": { "maxBodyBytes": 262144, "maxMultipartBytes": 5242880 } }
```

Precedence is env override > package.json > default. A value of `0` disables that cap (the deliberate opt-out, e.g. an edge already caps bodies). An over-limit body responds **413** and is NOT buffered whole: a `Content-Length` over the limit is a fast reject (the body is never read), and a chunked / streamed body with no declared length is counted while it streams and abandoned the instant it crosses the limit (never holding more than roughly one chunk past the cap). Large file uploads are a separate concern (#247); the multipart cap stays bounded.

### Server timeouts (slowloris / hung-connection defense)

`startServer` sets three node:http built-ins on the server. Secure production defaults, overridable.

| Timeout | Default | Config key | Env override | Meaning |
|---|---|---|---|---|
| `requestTimeout` | 30s | `webjs.requestTimeoutMs` | `WEBJS_REQUEST_TIMEOUT_MS` | Max time to receive the ENTIRE request (headers + body) |
| `headersTimeout` | 20s | `webjs.headersTimeoutMs` | `WEBJS_HEADERS_TIMEOUT_MS` | Max time to receive just the headers |
| `keepAliveTimeout` | 5s | `webjs.keepAliveTimeoutMs` | `WEBJS_KEEP_ALIVE_TIMEOUT_MS` | Idle window before a kept-alive socket is closed |

node semantics: `headersTimeout` MUST be strictly less than `requestTimeout` to ever fire (node measures both deadlines from the same request start), so a config that sets them inconsistently has `headersTimeout` clamped to just under `requestTimeout`. A value of `0` disables that timeout (node's own no-limit sentinel). Mechanism: `computeServerTimeouts` / `readBodyLimits` in `packages/server/src/body-limit.js`, read once at boot in `dev.js` (`readServerTimeoutsFromApp` / `readBodyLimitsFromApp`) and, for the body limits, stamped on every request scope so `readBody` enforces them too.

---

## File storage: `FileStore` + `diskStore` (streaming, traversal-safe) (#247)

webjs round-trips a native `File` / `Blob` / `FormData` over the wire, and the file-storage primitive decides WHERE the bytes land. It mirrors the cache / session adapter shape: a documented `FileStore` interface, a default local-disk adapter, and a module singleton so an app swaps the backend in one call without touching any call site. `import { getFileStore, setFileStore, diskStore, generateKey, signedUrl, verifySignedUrl } from '@webjsdev/server'`.

- **The `FileStore` interface** operates on web-standard objects only: `put(key, file)` (a `File` / `Blob` / `ReadableStream` / `Uint8Array`) returns `{ key, size, contentType }`; `get(key)` returns `{ body, size, contentType }` (a STREAMING handle, `body` is a stream so a serving route does `new Response(handle.body, { headers })` without reading the file into memory) or `null`; `delete(key)` is idempotent; `url(key)` is the served URL.
- **`diskStore({ dir?, baseUrl? })`** is the default adapter, rooted at `<cwd>/.webjs/uploads` (gitignore the directory). The write is STREAMING (`file.stream()` -> `Readable.fromWeb` -> `createWriteStream` via `pipeline`), so a large upload uses constant memory. The upstream `maxMultipartBytes` cap (#237) bounds the size before the bytes reach the store.
- **Traversal-safe keys (security).** Every key resolves to an absolute path under `dir` and is REJECTED if it escapes, using the same `resolve` + `startsWith(dir + sep)` containment guard as the `/public/*` serve path. A key with `..`, an absolute path, a leading slash, a NUL byte, or a backslash throws (`assertSafeKey`) BEFORE any fs op. `generateKey(filename?)` mints an opaque `<uuid>.<ext>` key (whitelisted extension only), the recommended path; never trust a user-supplied filename as a key.
- **Signed URLs.** `signedUrl(key, { secret, expiresIn })` / `verifySignedUrl(input, secret)` mint + verify an expiring HMAC-SHA256 (base64url) over the exact key plus its expiry, so a serving route gates access without a session lookup. Both the key and the expiry are signed (neither can be tampered with) and the compare is constant-time.
- **S3-pluggability.** Because the interface is web-standard objects only, an S3 / R2 / GCS adapter is a drop-in (`setFileStore(s3Store(...))`) with no call-site change. webjs ships no S3 SDK. Mechanism: `packages/server/src/file-storage.js`. See `agent-docs/built-ins.md` (the interface) and the "Receive and persist an uploaded file" recipe in `agent-docs/recipes.md`.

---

## Observability: access log, request id, onError hook, build-info (on by default) (#239)

Four standards-native observability surfaces, wired at the single response funnel in `dev.js`'s `handle()` (the same seam that applies security headers), so they cover pages, route handlers, server actions, and assets uniformly.

### Per-request access log

Every handled request emits ONE structured `info` line through the pluggable `logger` after the response is produced, carrying `method`, `path`, `status`, `durationMs`, and `requestId`. Never logs request bodies or secrets. The default logger writes one JSON object per line in prod, a readable line in dev. The framework's own `/__webjs/*` probe / static traffic is suppressed so it does not spam; app routes (including app `/api/*`) are logged.

```jsonc
{"level":"info","msg":"request","requestId":"4f1c…","method":"GET","path":"/dashboard","status":200,"durationMs":12.4}
```

`durationMs` is time-to-response-headers (a TTFB-like measure), not full-stream completion, so for a streaming / Suspense response it reflects when the headers were produced, not when the last chunk flushed.

### Request id / correlation id (`X-Request-Id` + `requestId()`)

Each request gets a correlation id, the native `crypto.randomUUID()`. An inbound `X-Request-Id` from a trusted upstream proxy is honored instead (one trace id across services); a missing or malformed inbound value falls back to a minted id (the inbound value is length-capped and token-charset validated, so a hostile value is never echoed back). The id is set on the response as `X-Request-Id` (never clobbering one the app already set), included in the access log and the error log, and readable in any server-side code with `requestId()` from `@webjsdev/server` (returns `null` outside a request scope), the same context-helper ergonomics as `headers()` / `cookies()`.

```ts
import { requestId } from '@webjsdev/server';
export async function GET() {
  return Response.json({ traceId: requestId() }); // same id as the X-Request-Id header
}
```

### `onError` hook (APM / Sentry integration point)

Register an error sink via `createRequestHandler({ onError })` (and `startServer({ onError })`). It is called with `(error, { request, requestId, phase })` whenever the request pipeline catches an unhandled error: the 500 path (a thrown route handler / middleware / page render, labeled phase `handle` / `middleware` / `ssr` / `metadata`) or a server action that throws unexpectedly (phase `action`). **The contract is best-effort:** a throwing `onError` is caught and ignored so it can never crash the response, and the hook is purely additive (webjs's existing sanitized 500, with only `error.message` in prod and never the stack, is unchanged). The hook fires BEFORE the sanitized response is sent, so the sink sees the original error. The `requestId` ties the report to the access-log line.

```ts
const app = await createRequestHandler({
  appDir: process.cwd(),
  onError(error, { request, requestId, phase }) {
    Sentry.captureException(error, { tags: { requestId, phase } });
  },
});
```

### Build-info endpoint (`GET /__webjs/version`)

Returns JSON describing the live build, alongside the `/__webjs/health` and `/__webjs/ready` probes, so a deploy can curl it to confirm which build is serving. No secrets; answered before the analysis warms (like the other probes), so it responds on a cold instance. `Cache-Control: no-store`.

```jsonc
{ "version": "0.8.10", "build": "<importmap-hash>", "node": "v24.4.0", "uptime": 38.21 }
```

`version` is the `@webjsdev/server` framework version (read from its own `package.json`), `build` is the published importmap build id (the same fingerprint the client router reads from `data-webjs-build`; empty until the vendor map resolves), `node` is the running Node version, `uptime` is process uptime in seconds. Mechanism: `requestId()` / `setRequestId` in `packages/server/src/context.js`, `buildInfo` / `buildInfoResponse` in `packages/server/src/build-info.js`, all wired in `packages/server/src/dev.js`.

---

## CONVENTIONS.md and webjs check: two surfaces, split by nature

Every webjs app ships a `CONVENTIONS.md` at root. AI agents MUST read it before writing code. It is the source of truth for **project conventions**: how code is organized, named, and tested (modules layout, action placement, one-function-per-file, the testing approach, styling, git workflow). These are preferences a reasonable project could do differently, so they are guidance, customizable directly in the prose (sections marked `<!-- OVERRIDE -->`), not enforced by any tool.

**`webjs check` is a separate, narrower tool: correctness checks only.** Every rule catches objectively broken code (a crash, a security leak, a build or type-strip failure). They run unconditionally; there is no per-project disabling, and no `package.json` switch (the old `"webjs": { "conventions": { … } }` override was removed). Run `webjs check --rules` to list the checks; the rule descriptions are their own documentation.

The dividing line: *could a sensible app legitimately want this to pass?* If yes, it is a convention (CONVENTIONS.md prose); if no, it is a check (the tool). That is why checks are not overridable (they catch real breakage) and conventions are not tool-enforced (they are judgment).

### What AI agents must do

1. Read `CONVENTIONS.md` for the project conventions and follow them by judgment.
2. Run `webjs check` and fix every violation (they are correctness bugs, not style).
3. To change a convention, edit the prose in `CONVENTIONS.md`. There is nothing to toggle in `package.json`.

---

## Recipes: the essentials

The full set lives in `agent-docs/recipes.md`. The most common patterns:

### Add a page

```ts
// app/about/page.ts
import { html } from '@webjsdev/core';
export default function About() {
  return html`<h1>About</h1>`;
}
```

### Add a dynamic route

```ts
// app/users/[id]/page.ts
export default async function User({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id);  // via server action, NEVER import DB directly
  return html`<h1>${user.name}</h1>`;
}
```

### Add a server action

```ts
// modules/users/actions/update-profile.server.ts
'use server';
import { prisma } from '../../../lib/prisma.server.ts';
export async function updateProfile(input: { name: string }) {
  const name = String(input?.name || '').trim();
  if (!name) return { success: false, error: 'name required', status: 400 };
  const row = await prisma.user.update({ where: { id: me.id }, data: { name } });
  return { success: true, data: row };
}
```

Call from a client component via normal import. The dev server rewrites to an RPC stub.

### Add a component

```ts
// components/hello-world.ts
import { WebComponent, html } from '@webjsdev/core';
export class HelloWorld extends WebComponent {
  render() { return html`<p>Hello!</p>`; }
}
HelloWorld.register('hello-world');
```

---

## Deliberately deferred

Not in v1. Do not implement as part of other tasks:

- **Bundling.** webjs is a **no-build framework**. Same model as Rails 7+ (Hotwire + importmap-rails). Production perf comes from HTTP/2 multiplex + `<link rel="modulepreload">` hints at SSR time, not concatenation. **Do not propose a bundler or `webjs build` command.**
- **Per-route code splitting.** Downstream of no-build. Browser fetches each module lazily; modulepreload hints emit per-route at SSR.
- **Vite-grade HMR with state preservation.** Custom elements only `define` once, so full reload is necessary. Data reloads are near-instant via `fs.watch` → SSE.
- **React Server Components Flight.** Server actions cover "call a server function from the client". Use `Suspense` + streaming.
- **Edge-runtime bundling / full portability.** See `agent-docs/deployment.md`.
- **i18n, image optimization.** Layer libraries on top.
