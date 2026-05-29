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
| `agent-docs/built-ins.md` | Auth, sessions, cache, rate-limit, broadcast |
| `agent-docs/advanced.md` | Suspense streaming, performance, bundling, client router, WebSockets |
| `agent-docs/typescript.md` | TS at runtime + full-stack type safety |
| `agent-docs/deployment.md` | Production, runtime targets, embedded use |
| `agent-docs/testing.md` | Unit, browser, convention validation |
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
| `CONVENTIONS.md` | All agents | Project-specific overridable conventions |
| `CLAUDE.md` | Claude Code | Points to AGENTS.md + CONVENTIONS.md, no duplication |
| `.claude/settings.json` | Claude Code | PreToolUse hook guarding git merge/push to main |
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

1. **Tests.** Unit test for logic, E2E for user-facing behaviour. See `agent-docs/testing.md`. Run `webjs test`; never report work done with failing tests.
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
- **Built-in essentials.** Auth, sessions, caching, cache store, rate limiting, all with pluggable adapters.
- **No build step.** Source files are served as native ES modules.
- **JSDoc or erasable TypeScript.** Plain `.js` with JSDoc is default. `.ts` / `.mts` is stripped via Node 24+'s built-in `module.stripTypeScriptTypes` (position-preserving, no sourcemap). See invariant 10 + `agent-docs/typescript.md`.
- **Node 24+ required** for default strip-types behaviour.
- **SSR + CSR by default.** Pages are server-rendered (real HTML). Components render as light DOM by default; shadow DOM is opt-in via `static shadow = true` with Declarative Shadow DOM SSR.
- **Progressive enhancement is the default architecture.** Pages and every web component are SSR'd. With JS disabled: content reads, `<a>` links navigate, `<form>` server actions submit, display-only custom elements render. JS is opt-in *per interactive behaviour*: adding `@click=${…}`, a reactive property assignment, or a signal mutation requests JS for that interactivity. Never write features whose first paint depends on hydration; never use `fetch` + JS handlers for write-paths where a `<form>` + server action would do.
- **Display-only components are elided from the browser.** A component with no interactivity signal (no `@event`, no non-state reactive property, no overridden lifecycle hook, no signal or `Task` import, no `addController`) renders identical SSR'd HTML with or without its JS, so the framework statically detects it and strips its import from the served source. The module is never downloaded and vendor packages imported only by display-only components drop from the importmap. This is webjs's answer to dead-JS-on-the-wire elimination, the one RSC benefit a no-build progressive-enhancement framework would otherwise lack. Automatic, conservative (anything ambiguous ships), no opt-in keyword. See `agent-docs/components.md`.
- **Tailwind CSS is the default styling convention.** Custom CSS works; light-DOM components authoring CSS MUST prefix selectors with the component tag.
- **Server actions with rich types.** A `*.server.{js,ts}` file with `'use server'` exports functions importable from the client. The import is rewritten to a typed RPC stub. Wire round-trips `Date`, `Map`, `Set`, `BigInt`, `Error`, `TypedArray`, `Blob`, `File`, `FormData`, registered Symbols, reference cycles.
- **Server-file source is unreachable from the browser (framework invariant).** Every `.server.{js,ts}` file is source-protected by the HTTP layer: the dev server returns either a generated RPC stub (when the file has `'use server'`) or a throw-at-load stub (server-only utility), never source.
- **Only files reachable from a browser-bound entry are servable.** The dev server walks the static import graph at boot (and on every `fs.watch` rebuild) starting from every `page` / `layout` / `error` / `loading` / `not-found` / component file. The resulting Set is the authorisation gate at the source-file branch. `package.json`, `node_modules/**`, hand-rolled `scripts/`, and any other file no client code imports return 404 by construction. Same posture as Next.js's bundler-manifest model, derived statically at boot instead of via a build. The `.server.{js,ts}` stub guardrail still runs inside the gate as defense in depth.

---

## Execution model (read this to avoid the RSC mental model)

webjs has **no server/client component split**. Do not reason about it as React Server Components: there is no server-component render tree, no Flight protocol, no "use client" / "use server" component boundary, and no per-component server-versus-client identity.

**Pages, layouts, and components are isomorphic modules.** Each one runs in two places, from the same source:
1. On the **server**, to produce the SSR'd HTML of the response.
2. In the **browser**, where the module loads to add interactivity (event listeners, signal reactivity, lifecycle hooks), register custom elements so SSR'd tags upgrade, and enable client-side routing.

A component is not "a server component" or "a client component"; it is one module that renders on the server and then, if it does any client work, hydrates in the browser. `route.{js,ts}` is the one routing file that is **not** isomorphic: it is a **server-only HTTP handler** (named `GET` / `POST` / … exports), the webjs equivalent of a Next.js route handler. It never ships to the client.

**`.server.{js,ts}` is the one server boundary, and it is an RPC + source-protection mechanism, NOT an RSC server component.** The file's source never reaches the browser:
- With `'use server'`: its exports are **RPC-callable** from client code. The browser import is rewritten to a typed stub that POSTs to `/__webjs/action/<hash>/<fn>`. This is a server *action* (Rails/Next-style RPC), not a server-rendered component.
- Without `'use server'`: it is a **server-only utility** (Prisma client, secrets, `node:*`, password hashing). The browser import resolves to a throw-at-load stub.

So the way to keep a dependency off the client is the `.server.{js,ts}` boundary, not a component-level annotation. A server-only npm package (e.g. a date library used only to format during SSR) belongs inside a `.server.{js,ts}` file (`lib/format.server.ts` exporting `formatDate`), because pages/layouts are isomorphic and their top-level imports otherwise reach the browser.

**Elision is a no-build dead-JS optimization layered on top of this model, not a boundary.** When an isomorphic module (a display-only component, or an inert page/layout) would do no client work, the framework statically detects that and skips shipping its JS, the SSR'd HTML being the complete output. The module stays isomorphic; only its dead client download is removed, and the importmap drops vendor packages reachable only through it. This never changes behaviour: progressive enhancement is the no-JS baseline, and elision only removes JS that would have done nothing. It is webjs's answer to the *outcome* RSC delivers (no dead JS on the wire), achieved by static analysis of isomorphic modules rather than a server/client split. See `agent-docs/components.md`.

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

For UI debugging, use the Playwright MCP server (configured in `.claude.json`) instead of one-shot Bash scripts.

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
| `repeat(items, k, t)` | Keyed list directive. Preserves DOM identity on reorder. |
| `Suspense({fallback, children})` | Streaming boundary. |
| `connectWS(url, handlers)` | Client WebSocket: auto-reconnect, JSON, queued sends. |
| `richFetch<T>(url, init?)` | Content-negotiated fetch with rich-type encoding. |
| `navigate(url, opts?)` | Programmatic client-router nav. `{replace}` swaps in place. |
| `revalidate(url?)` | Evict snapshot-cache for one URL or all. Call after mutations. |
| `WebjsFrame` (`<webjs-frame id="...">`) | Escape-hatch partial-swap region. |

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

The `update()` body has an error boundary that calls `renderError(error)` if `render()` throws. All hooks are **client-only**; SSR doesn't call them (SSR walker calls `instance.render()` directly).

**ReactiveControllers** are composable lifecycle logic via `host.addController(this)`. Built-in `Task`, `ContextProvider`, `ContextConsumer` are all controllers. See `agent-docs/components.md`.

### SSR-safe state (progressive enhancement)

The SSR pipeline runs the constructor, applies attributes, calls `instance.render()`, and inlines the result. **It does NOT call `connectedCallback`, `firstUpdated`, or any browser-only hook.** Those run after script load.

Rules:

- **Defaults for first paint go in the constructor** (after `super()`).
- **Browser-only data** (localStorage, viewport, `navigator.*`, `matchMedia`) goes in `connectedCallback`. Write the value to a signal (instance-scoped in the constructor, or module-scope if shared) to refine the first paint.
- **Server-known data** (session, accept-language, theme cookie, URL) goes through the page function and is passed as a prop/attribute.
- **For unacceptable flicker** (theme color, RTL), use a synchronous inline `<script>` in the root layout's `<head>` to set `document.documentElement` before custom elements upgrade.

**Anti-pattern:** a component whose first paint is empty/placeholder because real data is fetched in `connectedCallback`/`firstUpdated`. Fetch on the server in the page function instead. See `agent-docs/components.md` for SSR mechanics in depth, and `agent-docs/lit-muscle-memory-gotchas.md` for the full catalog of lit patterns that produce broken SSR or silent reactivity failures in webjs.

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

- Default export is a possibly-async function receiving `{ params, searchParams, url }`.
- Runs **only on the server**. Throw `notFound()` or `redirect(url)` to short-circuit.
- Named exports: `metadata` (static), `generateMetadata(ctx)` (async, takes precedence). See `agent-docs/metadata.md`.
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

### Route handlers (`app/**/route.{js,ts}`)

- Export named async functions per method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Each receives `(Request, { params })` and returns a `Response` or any value (auto-JSON).
- A folder cannot have both `page.js` and `route.js`.
- **WebSocket support:** export `WS(ws, req, { params })` from the same `route.js` to turn the URL into a WS endpoint. In dev the module is re-imported per connection; store shared state on `globalThis`. See `agent-docs/advanced.md`.

### Middleware (`middleware.{js,ts}`)

- Optional top-level + per-segment files. Default export `async (req, next) => Response`.
- Return a Response to short-circuit (redirect, 401). Call `next()` then post-process to add headers, log, etc.
- Per-segment middleware applies to its subtree, outermost → innermost.

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
- **Expose as REST:** `expose('METHOD /path', fn, { validate?: parse })`. Same function powers both callers. `validate` runs only on the HTTP path (direct RPC bypasses it).

### RPC security model

- Client → action RPC: POST with `x-webjs-csrf` matching cookie issued on first SSR response. Mismatch → 403.
- Production error responses are sanitized to only `message`, never stack.
- `expose()`d REST endpoints are NOT CSRF-protected. Apply auth via middleware or per-route checks.

### `expose()` security checklist

1. Authenticate every mutating endpoint (bearer/API key, explicit CSRF, or origin allow-list).
2. Use `validate`. Never trust merged `{...query, ...params, ...body}`.
3. Log responsibly. No user input or secrets in errors.
4. Configure CORS narrowly.
5. Rate-limit at the edge (`rateLimit()` middleware, see `agent-docs/advanced.md`).

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
  | { success: true, data: T }
  | { success: false, error: string, status: number };
```

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

## Styling: Tailwind + `lib/utils/ui.ts` helpers (default)

Tailwind CSS browser runtime + `@theme` tokens declared in the root layout. Repeated class bundles → JS helpers in `lib/utils/ui.ts` returning `` html`...` `` fragments (SSR-time, no client runtime).

```ts
// lib/utils/ui.ts
import { html } from '@webjsdev/core';
export function rubric(label: string) {
  return html`<span class="block font-mono text-xs uppercase text-accent">● ${label}</span>`;
}
```

Extraction rule: 1× inline. 2-3× identical → helper. 1-2 prop variation → parameterised helper. Radically different → keep inline. (No `@apply`: hides utilities from the reader.)

Custom CSS is fully supported. Light-DOM components MUST follow the class-prefix rule. See `agent-docs/styling.md` for vanilla-CSS-only opt-out.

---

## Client navigation: automatic, nothing to opt into

Nested layouts auto-emit `<!--wj:children:<segment-path>-->` markers around each `${children}` interpolation. The client router walks both DOMs for these markers and replaces only the inside of the deepest shared layout's children slot. **Outer-layout DOM identity is preserved** (sidenav scroll, input values, `<details>` state survive).

Form submissions (`<form action method>`) ride the same pipeline. GET forms promote `FormData` to the query string. Non-GET forms send `FormData` as body and clear the snapshot cache on success. Forms that already `e.preventDefault()` in `@submit` are untouched. `data-no-router` opts out.

Wire-byte optimization is automatic: the router sends `X-Webjs-Have` listing marker paths it has; the server short-circuits at the deepest match and returns only the divergent fragment. Rapid clicks are safe (prior fetches abort, nav-tokens prevent stale reverts). Scroll position is captured + restored on back/forward.

**Production benefits from HTTP/2 at the edge.** Per-file ESM rides HTTP/2 multiplex to be competitive with bundling. PaaS edges (Railway, Fly, Render, Vercel, Cloudflare, Heroku) serve HTTP/2 automatically. Bare-VM self-hosters put nginx / Caddy / Traefik in front. The production server (`npm run start`) speaks plain HTTP/1.1.

For partial-swap NOT tied to a folder layout, wrap in `<webjs-frame id="...">`. See `agent-docs/advanced.md` for the full mechanism.

---

## Invariants (for both humans and agents)

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

3. **Default to a real database (Prisma + SQLite). NEVER use JSON files, in-memory arrays, or localStorage as a substitute for persistence.** Every scaffold ships `prisma/schema.prisma`, `lib/prisma.server.ts`, and `npm run db:*` scripts. The `no-json-data-files` check flags JSON-as-database.
4. **Treat the scaffold as REFERENCE, not the final product.** Replace the example `app/page.ts`, `User` model, and components.
5. **Update `prisma/schema.prisma` to real models FIRST.** Run `webjs db migrate <name>`, then build pages/actions/queries.
6. Full docs at **https://docs.webjs.com**.

---

## CLI reference

```sh
webjs dev    [--port N]                               # dev server with live reload
webjs start  [--port N]                               # prod server. No build step, source IS the runtime. Speaks plain HTTP/1.1 (put a reverse proxy in front for TLS + HTTP/2)
webjs test   [--server] [--browser] [--watch]         # unit + browser tests
webjs check  [--fix]                                  # convention validator
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

## CONVENTIONS.md and the lint config: complementary, not redundant

Every webjs app ships a `CONVENTIONS.md` at root. AI agents MUST read it before writing code. Sections marked `<!-- OVERRIDE -->` are customization points. **`CONVENTIONS.md` is markdown prose for architectural conventions** (modules layout, styling, testing, git workflow) the linter can't enforce programmatically.

**`webjs check` rules are a separate, narrower surface.** Source of truth at the project level is the `"webjs": { "conventions": { … } }` key in `package.json`. No override present → every default rule is enabled.

**Do NOT maintain a list of rules in prose.** Run `webjs check --rules` to enumerate them.

### Disabling a rule

```jsonc
// package.json
{ "webjs": { "conventions": { "tests-exist": false } } }
```

### What AI agents must do

1. Read `CONVENTIONS.md` for architectural conventions.
2. Run `webjs check --rules` to learn active lint rules.
3. Treat every rule not explicitly disabled as binding.
4. To change rules, edit the `webjs.conventions` block in `package.json` (never the prose).

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
