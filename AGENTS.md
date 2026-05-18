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

---

## AI-driven development: guardrails for all agents

**webjs is an AI-first framework. These rules apply to ALL AI agents
(Claude, Cursor, Copilot, Windsurf, Aider, etc.) and are enforced via
config files that each agent reads automatically.**

### Agent config files (scaffolded by `webjs create`)

| File | Agent | Purpose |
|---|---|---|
| `AGENTS.md` | All agents | Framework API, conventions, recipes (this file) |
| `CONVENTIONS.md` | All agents | Project-specific overridable conventions |
| `CLAUDE.md` | Claude Code | Points to AGENTS.md + CONVENTIONS.md, no duplication |
| `.claude/settings.json` | Claude Code | PreToolUse hook guarding git merge/push to main |
| `.cursorrules` | Cursor | Workflow rules, git rules, framework patterns |
| `.windsurfrules` | Windsurf | Same rules in Windsurf format |
| `.github/copilot-instructions.md` | GitHub Copilot | Same rules in Copilot format |
| `.github/pull_request_template.md` | All (via GitHub) | PR checklist: tests, docs, convention check |
| `.editorconfig` | All editors | Consistent indent/encoding/line endings |

### Before starting ANY work: verify and sync the branch

**FIRST thing before writing any code, every time:**

1. Run `git branch --show-current` to check what branch you're on.
2. If on `main` or `master`, **STOP. Do not edit files.** Ask the user
   which branch to work on, or create one: `git checkout -b feature/<name>`.
3. If on a feature branch, verify it matches the task. If the user asks
   to "add a contact page" but you're on `fix/login-redirect`, ask before
   proceeding. Don't mix unrelated work on the wrong branch.
4. **Sync with parent branch.** Before making any changes, check if the
   parent branch (usually `main`) has new commits that this branch doesn't:
   ```
   git fetch origin
   git log HEAD..origin/main --oneline
   ```
   If there are upstream changes, rebase or merge before starting work:
   ```
   git rebase origin/main    # preferred: clean linear history
   ```
   If the rebase has conflicts, resolve them before proceeding.

The Claude Code hook (`.claude/hooks/guard-branch-context.sh`) enforces
step 2 programmatically by intercepting Edit/Write calls when on main.
Other agents must check manually as their first action.

### Autonomous mode (sandbox / bypass permissions)

When the user runs the agent in sandbox mode, bypass-permissions mode,
or any mode where interactive approval is disabled, the agent MUST NOT
ask questions or wait for permission. Instead, it should **auto-decide
using these defaults:**

| Decision | Autonomous default | Rationale |
|---|---|---|
| On `main`, need a branch | Auto-create `feature/<task-slug>` | Never pollute main |
| Parent branch has new commits | Auto-rebase before starting | Avoid conflicts |
| Ready to merge | Auto-merge, no prompt | User opted into full autonomy |
| Delete branch after merge? | **Delete** feature/fix branches, **keep** long-lived (dev, staging, release/*) | Feature branches are disposable |
| Commit message | Auto-generate meaningful message | Never ask "what should the message be?" |
| Tests failing | Fix them, don't ask | User expects working code |
| Convention violations | Fix them, don't ask | User expects clean code |

**The principle:** in autonomous mode the agent should be MORE disciplined,
not less. It follows every rule in this file but makes decisions instead
of blocking on questions. The quality bar is the same: tests pass,
conventions valid, docs updated, commits clean.

### Code workflow (mandatory, never skip)

Every code change MUST include the following, **automatically, without the user asking:**

1. **Tests.** Unit test for logic (server actions, queries, components),
   E2E test for user-facing behaviour (pages, forms, navigation). See
   `agent-docs/testing.md` for the test matrix. Run `webjs test` after
   every change. Never report work as done with failing tests.

2. **Documentation.** Update `AGENTS.md` when adding API surface. Update
   `CONVENTIONS.md` when adding conventions. If the project has `docs/` or
   `website/` directories, update them for user-facing features.

3. **Convention validation.** Run `webjs check` and fix violations.

### Git workflow (mandatory, never skip)

**The model:** Always work on a feature branch. On a feature branch,
commit and push freely with no permissions needed. The only gate is
merging back into main, which requires user approval (unless in
bypass/autonomous mode).

1. **Create a feature branch first.** Before any code change:
   `git checkout -b feature/<task-slug>`. Never edit directly on main.
2. **On the feature branch: commit and push freely.** No prompts and
   no approval needed.
3. **Meaningful commit messages.** Describe what changed and why. Imperative
   mood, under 72 chars on the first line.
4. **No AI attribution in commits.** NEVER add `Co-Authored-By: Claude`,
   `Generated by AI`, `AI-assisted`, or any similar trailer or prefix.
5. **Pull requests via the GitHub CLI, always.** Create a PR for every
   feature branch with `gh pr create`. When the user asks to "merge to
   main" (or any equivalent phrasing), the workflow is ALWAYS:
   `gh pr create` → confirm with user → `gh pr merge`. Never run a
   local `git merge` / `git push origin main` to land work on main,
   even when the local clone has permission to push. This keeps the
   merge auditable, runs branch protections + CI, and produces a real
   PR record.
6. **Never push to main.** Always push to the feature branch and create a PR.
7. **NEVER merge without user permission.** Before merging ANY branch into
   ANY other, ask exactly:

   > Ready to merge `<branch>` into `<target>`?
   > After merging, should `<branch>` be **deleted** or **kept**?

   Wait for explicit approval AND the delete/keep preference.
8. **Run tests before committing.** `webjs test` must pass.

### What "automatically" means, a concrete example

When a user says "add a contact page", the agent delivers ALL of this
without being asked:

```
app/contact/page.ts                            ← the page
modules/contact/actions/send-message.server.ts ← the server action
modules/contact/types.ts                       ← type definitions
test/unit/contact.test.ts                      ← unit test for the action
test/e2e/contact.test.ts                       ← E2E test for the form flow
AGENTS.md                                      ← updated if new API/conventions
docs/app/docs/contact/page.ts                  ← doc page (if docs/ exists)
```

Plus: a git commit with a meaningful message, tests passing, conventions valid.

---

## Working in the webjs framework repo itself

When editing the framework monorepo (this repo, not a scaffolded app):
**`packages/` is plain `.js` with JSDoc. Never add `.ts` files there.**
The framework ships buildless: source in `node_modules/` must equal source
that runs. TypeScript is fine in `examples/`, `docs/`, `website/`.

See `agent-docs/framework-dev.md` for monorepo commands, workspace
package layout, reference codebases, and per-feature update checklists.

---

## What webjs is

An **AI-first, web-components-first** framework inspired by NextJs, Lit, and Rails.

- **Sensible defaults, overridable.** Memory store for dev, Redis when
  you configure it. HTTP caching via standard `Cache-Control` headers.
- **Built-in essentials.** Auth, sessions, caching, cache store, rate
  limiting, all with pluggable adapters.
- **No build step.** Source files are served as native ES modules.
- **JSDoc or TypeScript.** Plain `.js` with JSDoc is default. `.ts`/`.mts`
  flows through an esbuild loader hook registered at startup, so SSR and
  hydration always produce equivalent JS.
- **SSR + CSR by default.** Pages are server-rendered (real HTML).
  Interactive web components render as light DOM by default. Shadow
  DOM is opt-in via `static shadow = true` with Declarative Shadow
  DOM SSR.
- **Progressive enhancement is the default architecture.** Pages and
  every web component are SSR'd. Each component's `render()` runs on
  the server so its initial HTML is in the response. With JS disabled:
  content reads, `<a>` links navigate, `<form>` server actions submit,
  display-only custom elements render correctly. JavaScript is opt-in
  *per interactive behavior*: when you add `@click=${…}`, `setState()`,
  or any stateful logic, you're asking for JS to handle that
  interactivity. The component's *initial* paint is HTML either way.
  Never write features whose first paint depends on hydration, and
  never use `fetch` + JS handlers for write-paths where a `<form>` +
  server action would do the job.
- **Tailwind CSS is the default styling convention.** Custom CSS still
  works, but light-DOM components authoring CSS MUST prefix selectors
  with the component tag.
- **Server actions with rich types.** Any `*.server.{js,ts}` (or file
  with `'use server'`) exports functions importable from the client.
  The import is rewritten into a typed RPC stub. Wire round-trips
  `Date`, `Map`, `Set`, `BigInt`, `Error`, `TypedArray`, `Blob`,
  `File`, `FormData`, registered Symbols, and reference cycles.
- **Server-file source is unreachable from the browser (framework
  invariant).** The HTTP layer re-verifies every JS/TS request against
  the server-file predicate before serving bytes. A server file always
  responds with a generated RPC stub, never its source.

---

## Framework source: where to find it

Plain JS with JSDoc lives in `node_modules/@webjskit/`. What you read
is what runs. Reach for source when debugging:

```
node_modules/@webjskit/
  core/                 renderer, WebComponent, directives, Task, Context, router, testing
  server/               dev + prod server, SSR, router, actions, auth, sessions, cache
  cli/                  webjs binary
  ts-plugin/            tsserver plugin: go-to-definition, attribute auto-complete
  ui/                   component library + `webjs ui` CLI
```

Concrete starting points. SSR pipeline → `@webjskit/server/src/ssr.js`.
Client hydration → `@webjskit/core/src/render-client.js`. Client router
→ `@webjskit/core/src/router-client.js`. Convention rules → `@webjskit/
server/src/check.js`.

For UI debugging, use the Playwright MCP server (configured in
`.claude.json`) instead of writing one-shot Bash scripts.

---

## App layout (cannot be renamed)

```
app/                        thin route adapters (import from modules/)
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
lib/                        cross-cutting infra (prisma.js, session.js, password.js)
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

Every file is a plain ES module. No config required.

---

## Public API of `@webjskit/core`

```js
import { html, css, WebComponent, render, renderToString } from '@webjskit/core';
```

| Export            | Purpose |
| ----------------- | ------- |
| `html`            | Tagged template literal → `TemplateResult`. |
| `css`             | Tagged template literal → `CSSResult`. Use in `static styles`. |
| `WebComponent`    | Base class for interactive components. |
| `register(tag,C)` | Tag → class binding. Auto-called by `Class.register('tag')`. |
| `render(v, el)`   | Client-side render into a DOM element. |
| `renderToString`  | Server-side **async** render → HTML string with DSD. |
| `notFound()`      | Throw to return 404 rendered via `not-found.js`. |
| `redirect(url)`   | Throw to return 307 (default) or 308 redirect. |
| `expose(p, fn)`   | Tag a server action ALSO reachable at a REST path. |
| `repeat(items, k, t)` | Keyed list directive. Preserves DOM identity on reorder. |
| `Suspense({fallback, children})` | Streaming boundary. |
| `connectWS(url, handlers)` | Client WebSocket with auto-reconnect, JSON, queued sends. |
| `richFetch<T>(url, init?)` | Content-negotiated fetch with rich-type encoding. |
| `navigate(url, opts?)` | Programmatic client-router nav. Pushes history. With `{replace}`, swaps in place. |
| `revalidate(url?)` | Evict snapshot-cache for one URL or clear the whole cache. Call after server-action mutations. |
| `WebjsFrame` (`<webjs-frame id="...">`) | Escape-hatch partial-swap region for non-layout cases. |

### Directives, from `import { … } from '@webjskit/core/directives'`

**"Less is more":** only directives that solve problems with no native alternative.

| Directive | Purpose | Example |
|---|---|---|
| `repeat(items, keyFn, templateFn)` | Keyed reconciliation | `${repeat(items, i => i.id, i => html\`…\`)}` |
| `unsafeHTML(str)` | Render trusted raw HTML. **NEVER use with user input.** | `${unsafeHTML(markdownToHtml(md))}` |
| `live(value)` | Input value sync against live DOM | `.value=${live(inputVal)}` |

Everything else uses native patterns: conditional classes via filter+join,
conditional render via ternary, async data via `Task` (component) or async
page functions (server).

### Context & Task

- `createContext`, `ContextProvider`, `ContextConsumer` from
  `@webjskit/core/context` share data across deeply nested components.
- `Task`, `TaskStatus` from `@webjskit/core/task` handle async ops inside
  components with `pending`/`complete`/`error` states + AbortController.
  Page-level data uses async page functions instead.

### `html` expression prefixes

| Syntax            | Meaning |
| ----------------- | ------- |
| `<div>${x}</div>` | Text child (primitives, arrays, `TemplateResult`s). |
| `class=${x}`      | Attribute. Value stringified and HTML-escaped. |
| `@click=${fn}`    | Event listener (client-only). |
| `.value=${v}`     | DOM property (not attribute). |
| `?disabled=${b}`  | Boolean attribute. Present iff value is truthy. |

Event/property/boolean-prefixed attributes **must be unquoted**.

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
  state = { /* any */ };

  connectedCallback() { super.connectedCallback(); /* seed state from props */ }
  render() { return html`…`; }
}
MyThing.register('my-thing');
```

Mutate state with `this.setState({...})`. Updates are batched via microtask.
Declared attribute changes auto-trigger re-render.

### Typed props in TypeScript via the `declare` pattern

The framework installs reactive getter/setter on `this` via
`Object.defineProperty`. A `student: Student = { … }` class-field
initializer compiles to `[[Define]]` semantics that overwrite the
accessor AFTER `super()`, silently breaking reactivity. Use `declare`:

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

### Lifecycle (less-is-more)

| Hook | When | Use for |
|---|---|---|
| controllers' `beforeRender()` | Before render | Pre-render logic |
| `render()` | Render phase | Return `TemplateResult` |
| controllers' `afterRender()` | After render | Post-render logic |
| `firstUpdated()` | After first render only | One-time DOM setup |

No `shouldUpdate`/`willUpdate`/`updated`/`changedProperties`. Compute
inputs at top of `render()`. Use `queueMicrotask()` after `setState()`
for post-render side effects.

**ReactiveControllers** are composable lifecycle logic via `host.addController(this)`.
Built-in `Task`, `ContextProvider`, `ContextConsumer` are all controllers.
See `agent-docs/components.md` for the full pattern.

### SSR-safe state defaults (progressive enhancement)

The SSR pipeline does this for every web component on a page (see
`packages/core/src/render-server.js:229-293` `injectDSD`):

1. `new Cls()` runs the constructor
2. applies the element's attributes to the instance
3. calls `instance.render()`, synchronously or by `await`ing the Promise
4. inlines the rendered HTML as the element's children (light DOM) or
   wraps it in `<template shadowrootmode="open">…</template>` (shadow DOM)

**It does NOT call `connectedCallback`, `firstUpdated`, or any other
browser-only lifecycle hook.** Those run only after the script loads
in the browser.

The rule for AI agents writing components:

- **Defaults that should appear in the first paint go in the
  constructor.** Set `this.state = { … }` and `this.someProp = default`
  in `constructor()` after `super()`. The SSR pipeline uses these
  exact values for the first render.
- **Browser-only data** (a user's `localStorage`, viewport size,
  online status, timezone, current scroll position, `navigator.userAgent`,
  `matchMedia(...)`) goes in `connectedCallback`. Read the value, then
  call `setState({ … })` to refine the render. The SSR'd HTML shows the
  sensible default. The browser refines it after hydration.
- **Server-known data** (session, accept-language, theme cookie, the
  request URL) goes through the page function. Pass it down as a
  prop or attribute on the component. SSR applies attributes BEFORE
  calling `render()`, so the first paint has the right value with zero
  flash.
- **For values where flicker is unacceptable** (theme color, RTL
  direction), use a synchronous inline `<script>` in the root layout's
  `<head>` to set the final value on `document.documentElement` before
  custom elements upgrade. CSS reads from that attribute and paints
  once. See the bootstrap script in scaffolded `app/layout.ts`.

**Anti-pattern (never write this):** a component whose first paint is
empty / placeholder because the real data is fetched in
`connectedCallback` or `firstUpdated`. That defeats SSR and breaks
progressive enhancement. Fetch on the server in the page function
instead, and pass the data down.

### Light DOM (default) vs Shadow DOM (opt-in)

Light DOM is default because global CSS and Tailwind classes apply directly.

| Use case | Mode |
|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) |
| `static styles = css\`\`` scoped styles | Shadow DOM (`static shadow = true`) |
| `<slot>` content projection | **Either.** Same `<slot>` / `<slot name="x">` / fallback / `assignedNodes` / `slotchange` API in both modes. Light DOM uses framework projection; shadow DOM uses native. |
| Third-party isolation | Shadow DOM |

**Light-DOM CSS-prefix rule (invariant):** if a light-DOM component
authors custom CSS, every class selector MUST be prefixed with the
component's tag name (`.my-card__body` or `my-card .body`). Prefer
Tailwind utilities first. They're unique by construction.

See `agent-docs/components.md` for the prefix patterns and
`agent-docs/styling.md` for vanilla-CSS-only opt-out.

### Editor intelligence

Add `@webjskit/ts-plugin` to `tsconfig.json` `plugins`. It ships with
`ts-lit-plugin` bundled. Gets you: attribute autocomplete, type-checked
attribute values, go-to-definition from `<my-counter>` to the class,
suppression of "Unknown tag" warnings.

---

## File conventions: the essentials

### Pages (`app/**/page.{js,ts}`)

- Default export is a possibly-async function receiving `{ params, searchParams, url }`.
- Runs **only on the server**. Throw `notFound()` or `redirect(url)` to short-circuit.
- Named exports: `metadata` (static object), `generateMetadata(ctx)` (async function, takes precedence).
- See `agent-docs/metadata.md` for the full metadata field reference.
- Page modules also load on the client (so transitively imported components register). Keep top-level imports browser-safe. Do NOT import `@prisma/client`, `node:fs` etc. directly. Go through a server action.

### Layouts (`app/**/layout.{js,ts}`)

- Default export receives `{ children, params, searchParams, url }`.
- Must embed `children` in returned template.
- Nest by folder.

**Document shell ownership:**

- By default the framework auto-emits `<!doctype><html lang="en"><head></head><body>` around every composition.
- The **root layout** (`app/layout.{js,ts}` exactly) MAY optionally write its own `<!doctype><html><head></head><body>` to override `<html>`/`<body>` attributes (lang, dir, theme, classes). The framework splices required tags (importmap, modulepreload, title, meta) into the user's `<head>` alongside what's there.
- **Non-root layouts and pages MUST NOT** write `<!doctype>` / `<html>` / `<head>` / `<body>`. Enforced by `webjs check`'s `shell-in-non-root-layout` rule.
- `metadata` exports merge across nested layouts (deepest wins).

### Error boundaries (`app/**/error.{js,ts}`)

- Default export receives `{ error, ...ctx }`. Returns a `TemplateResult`.
- Catches errors thrown during sibling-page / deeper-segment render (not notFound/redirect, which are sentinels).
- Innermost boundary wins. If it throws, next-outer catches.
- In prod, only `error.message` is sent. Never the stack.

### Loading states (`app/**/loading.{js,ts}`)

Framework wraps the sibling page in `Suspense({ fallback: <your loading>, children: <async page> })`. The fallback flushes immediately while the page function resolves.

### Metadata routes

`sitemap.{js,ts}`, `robots.{js,ts}`, `manifest.{js,ts}`, `icon.{js,ts}`, `apple-icon.{js,ts}`, `opengraph-image.{js,ts}`, `twitter-image.{js,ts}` live at app root or static segments only (not inside `[dynamic]` folders). Each default-exports a possibly-async function.

### Route handlers (`app/**/route.{js,ts}`)

- Export named async functions per method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Each receives `(Request, { params })` and returns a `Response` or any value (auto-JSON).
- Can live anywhere under `app/`. A folder cannot have both `page.js` and `route.js`.
- **WebSocket support**: export `WS(ws, req, { params })` from the same `route.js` to turn the URL into a WebSocket endpoint. In dev mode the module is re-imported per connection, so store shared state on `globalThis`. See `agent-docs/advanced.md`.

### Middleware (`middleware.{js,ts}`)

- Optional top-level + per-segment files. Default export `async (req, next) => Response`.
- Return a Response to short-circuit (redirect, 401). Call `next()` then post-process to add headers, log, etc.
- Per-segment middleware applies to its subtree. Chain runs outermost → innermost.

### Server actions (`**/*.server.{js,ts}` or `'use server'`)

- Export named async functions. Args + return values must round-trip through webjs's serializer.
- **Importing from a client component IS the API.** The dev server rewrites the import into an RPC stub that POSTs to `/__webjs/action/<hash>/<fn>`.
- **Expose as REST**: `expose('METHOD /path', fn, { validate?: parse })`. The same function powers both callers. `validate` runs only on HTTP path (direct RPC bypasses it).

### RPC security model

- Client → action RPC: POST with `x-webjs-csrf` matching cookie issued on first SSR response. CSRF mismatch → 403.
- Production error responses are sanitized: only `message`, never stack.
- `expose()`d REST endpoints are NOT CSRF-protected. Apply auth via middleware or per-route checks.

### `expose()` security checklist

1. Authenticate every mutating endpoint (bearer/API key, explicit CSRF, or origin allow-list).
2. Use `validate`. Never trust merged `{...query, ...params, ...body}`.
3. Log responsibly. Never include user input or secrets in errors.
4. Configure CORS narrowly.
5. Rate-limit at the edge. webjs ships no built-in rate limiter for HTTP (use `rateLimit()` middleware, see `agent-docs/advanced.md`).

### Components (`components/*.{js,ts}`)

- One custom element per file. Call `Class.register('tag')` at module top level.
- Imported by pages (SSR) and/or other components.
- **Styling convention: shadow-DOM CSS via `static styles`, not inline `style="…"` attributes.** Repeated visual chunks in pages → component whose styles live in its shadow root.

---

## Modules architecture (preferred for non-trivial apps)

### Layout

- **`modules/<feature>/actions/*.server.{js,ts}`** for mutations, one file per function.
- **`modules/<feature>/queries/*.server.{js,ts}`** for reads, same shape. The split shows what mutates versus what doesn't.
- **`modules/<feature>/components/*.{js,ts}`** for feature-owned web components. Shared UI lives in top-level `components/`.
- **`modules/<feature>/utils/*.{js,ts}`** for pure helpers. No `'use server'`, no DB access.
- **`modules/<feature>/types.{js,ts}`** for JSDoc typedefs and TS types.
- **`lib/*.{js,ts}`** for cross-cutting infra: `prisma.{js,ts}` singleton, `password.{js,ts}`, external clients.

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
- **Client components import server modules via the normal import path.** webjs rewrites the import. Don't hand-write `fetch()`.
- **Server-only imports stay out of components/ and page top-level graphs** except through `.server.{js,ts}` files.
- **One module, one feature.** Modules can depend on `lib/*` and other modules' public actions/queries. Prefer their public surface over reaching into `utils/`.

---

## Styling convention: Tailwind + `_utils/ui.ts` helpers (default)

**Default stack:** Tailwind CSS browser runtime + `@theme` tokens declared
in the root layout. Repeated class bundles → JS helpers in `app/_utils/ui.ts`
returning `html\`...\`` fragments. They run at SSR time with no client runtime,
no diff from inline classes.

```ts
// app/_utils/ui.ts
import { html } from '@webjskit/core';
export function rubric(label: string) {
  return html`<span class="block font-mono text-xs uppercase text-accent">● ${label}</span>`;
}
```

When to extract: 1× inline. 2-3× identical → helper. 1-2 prop variation → parameterised helper. Radically different → keep inline.

**Why not `@apply`?** Hides utilities from the reader, second source of truth. JS helpers keep the bundle visible at the definition site.

Custom CSS is fully supported (no Tailwind hard dependency). Light-DOM
components MUST follow the class-prefix rule. See `agent-docs/styling.md`
for vanilla-CSS-only opt-out conventions (page/layout/component scope classes).

---

## Client navigation: auto-magic, nothing to opt into

Nested layouts auto-emit `<!--wj:children:<segment-path>-->` comment
markers around each `${children}` interpolation. The client router
walks both old + new DOMs for these markers and replaces only the
inside of the deepest shared layout's children slot. **Outer-layout
DOM identity is preserved across navigation.** Sidenav scroll, input
values, `<details>` open state all survive without authors writing
anything.

Form submissions (`<form action="..." method="...">`) ride the same
pipeline. GET forms promote `FormData` to the query string. Non-GET
forms send `FormData` as the request body and clear the snapshot cache
on success (since other URLs may now reflect stale state). Forms that
already `e.preventDefault()` in their `@submit` handler (e.g.
server-action RPC) are untouched. `data-no-router` opts out per form
or per submitter.

Wire-byte optimization is also automatic: the router sends an
`X-Webjs-Have` header listing the marker paths it has, and the server
short-circuits at the deepest match and returns only the divergent
fragment.

Rapid clicks are safe: each navigation `abort()`s the previous fetch
and bumps a monotonic nav-token, so a slow late response can never
revert a newer settled page. Window scroll position is captured on
snapshot and restored on back/forward cache hits. Inner scrollables
keep their `scrollTop` natively via outer-layout DOM identity.

**Production benefits from HTTP/2 at the edge.** The per-file ESM
model rides HTTP/2 multiplex to be competitive with bundling. PaaS
edges (Railway, Fly, Render, Vercel, Cloudflare Pages, Netlify,
Heroku) serve HTTP/2 to clients automatically, no framework
configuration. Bare-VM self-hosters should put nginx / Caddy /
Traefik in front. `webjs start` itself only speaks plain HTTP/1.1;
TLS termination is the proxy's job.

For the 1% case where you want a partial-swap region NOT tied to a
folder layout (an in-page widget that should swap on click), wrap it
in `<webjs-frame id="...">`. The router's `closest('webjs-frame')`
detection takes precedence over the layout markers when both are
present.

See `agent-docs/advanced.md` Client router section for the full mechanism.

---

## Invariants (for both humans and agents)

1. **Never import `@prisma/client`, `node:*`, or any server-only dep from a file under `components/` or a page's top-level module graph that isn't a server action.** The browser will try to load it and fail.
2. **Every `*.server.{js,ts}` export must be an `async` function returning serializer-safe values.** Args and results round-trip via webjs's wire.
3. **Custom element tag names must contain a hyphen** (HTML spec). Pass the tag to `Class.register('tag-name')`, not a static field.
4. **Event (`@`), property (`.`), boolean (`?`) holes in `html` must be unquoted**, e.g. `@click=${fn}`, never `@click="${fn}"`.
5. **Do not mutate `this.state` directly.** Use `setState`. State reads are fine.
6. **Page and layout default exports must be functions.** They return a value (usually `TemplateResult`). They do not call `render()` themselves.
7. **Light-DOM components with custom CSS MUST prefix every class selector with their tag name.** Tailwind utilities are unique by construction, so prefer them.
8. **Non-root layouts and pages MUST NOT** write `<!doctype>` / `<html>` / `<head>` / `<body>`. Only the root layout may.
9. **No backtick characters inside `html\`...\`` template bodies**, even inside CSS / HTML comments. A nested backtick closes the literal at JS-parse time and 500s in prod.
10. **No em-dashes (U+2014) anywhere in the repo, no hyphen or semicolon used as a pause-punctuation substitute, and no colon attached to a code-shaped left-hand side.** Prose, comments, code, JSON descriptions, commit messages: rewrite the sentence so no pause-punctuation crutch is needed.

    Banned glyphs as pause punctuation:
    - The em-dash (U+2014).
    - A plain hyphen used in place of one (literally `< space hyphen space >`).
    - A semicolon used in place of one (literally `< space semicolon space >`).

    Banned colon-attachment patterns (prefer verb-led rephrasings):
    - `xyz(): description` (function call followed by colon). Rewrite as `xyz() does X` or `xyz() returns X` or `xyz() is the X`. The trailing `()` plus colon visually parses as a TypeScript return-type annotation and is ambiguous to AI agents.
    - `<my-tag>: description` (custom-element tag followed by colon). Rewrite as `<my-tag> owns / manages / decorates / is the X`.
    - `[expr]: description` (subscript followed by colon). Rewrite verb-led.
    - `<code>foo()</code>: description` in markdown definition lists. Rewrite as `<code>foo()</code> is the X` or `<code>foo()</code> creates X`.

    Prefer a period, comma, colon (on plain-noun LHS only), parentheses, or a restructured sentence. The colon stays fine when the LHS is a plain noun or label like `**Term**: description`, `Note: description`, `## Heading: subtitle`.

    Plain hyphens stay fine in their natural roles (compound words like `AI-first`, CLI flags like `--http2`, filenames, ranges). Semicolons stay fine inside code. Colons stay fine in TypeScript / JSON / CSS syntax (`name: Type`, `"key": value`, `color: red`).

    Enforced for Claude Code via `.claude/hooks/block-prose-punctuation.sh` (PreToolUse on Write / Edit / MultiEdit / NotebookEdit / Bash). The hook hard-blocks any new content containing U+2014, ` - ` between word characters, ` ; ` between word characters, or `<name-with-hyphen>:` / `name()` followed by lowercase prose. The hook scans only the NEW content of the tool call, so you can still edit a line that already contains a banned glyph to remove it.

---

## Scaffolding

**Exactly three scaffolds exist. Do not invent template names:**

```sh
webjs create <name>                  # full-stack: layout, page, components, modules, Prisma+SQLite
webjs create <name> --template api   # backend-only: routes + modules + Prisma, no SSR
webjs create <name> --template saas  # auth + login/signup + protected dashboard + User model
```

### How AI agents must scaffold

1. **Always scaffold via `webjs create`.** Never hand-roll the directory structure.
2. **Pick the template from the user's request:**

   | The user asks for… | Use |
   |---|---|
   | Todo, blog, recipe, dashboard, marketplace, social, e-commerce, any product with UI | **default** |
   | HTTP/JSON API with no UI (microservice, webhook, integration backend) | **`--template api`** |
   | Accounts, login, signup, "users can sign up", SaaS | **`--template saas`** |

   Default to full-stack when ambiguous.

3. **Default to a real database, Prisma + SQLite. NEVER use JSON files,
   in-memory arrays, or localStorage as a substitute for persistence.**
   Every scaffold ships `prisma/schema.prisma`, `lib/prisma.ts` singleton,
   and `npm run db:*` scripts. The convention check `no-json-data-files`
   flags JSON-as-database.
4. **Treat the scaffold as REFERENCE, not the final product.** Replace
   the example `app/page.ts`, example `User` model, example components.
   Don't ship "Hello from my-todo-app" as final UI.
5. **Update `prisma/schema.prisma` to the app's real models FIRST.** Run
   `webjs db migrate <name>`. Then build pages/actions/queries against
   those models.
6. **Need more detail?** Full docs at **https://docs.webjs.com**.

---

## CLI reference

```sh
webjs dev    [--port N]                               # dev server with live reload
webjs start  [--port N]                               # prod server. No build step, source IS the runtime. Speaks plain HTTP/1.1 (put a reverse proxy in front for TLS + HTTP/2)
webjs test   [--server] [--browser] [--watch]         # unit + browser tests
webjs check  [--fix]                                  # convention validator
webjs create <name> [--template api|saas]             # scaffold a new app
webjs db <prisma-subcommand> [...]                    # passthrough to prisma
webjs ui init                                         # @webjskit/ui CLI
webjs ui add <names...>                               # copy components into your project
webjs ui list / view <name>                           # browse the registry
```

`PORT` env is honoured by `dev` and `start` when `--port` is absent.

---

## CONVENTIONS.md: overridable project conventions

Every webjs app ships a `CONVENTIONS.md` at root. AI agents MUST read it
before writing code. Users can edit any section. Sections marked
`<!-- OVERRIDE -->` are the customization points. `webjs check` reads
both built-in rules and overrides.

**`CONVENTIONS.md` vs `webjs check` are separate.** Markdown is for humans
and AI. The linter is hardcoded in `@webjskit/server/src/check.js`. To turn
off a rule, set it to `false` in `package.json` `webjs.conventions` or in
`webjs.conventions.js`. Built-in rules: `actions-in-modules`,
`one-function-per-action`, `components-have-register`,
`no-server-imports-in-components`, `tests-exist`, `tag-name-has-hyphen`,
`reactive-props-use-declare`, `no-json-data-files`,
`shell-in-non-root-layout`.

---

## Recipes: the essentials

The full set lives in `agent-docs/recipes.md`. The most common patterns:

### Add a page

```ts
// app/about/page.ts
import { html } from '@webjskit/core';
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
import { prisma } from '../../../lib/prisma.ts';
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
import { WebComponent, html } from '@webjskit/core';
export class HelloWorld extends WebComponent {
  render() { return html`<p>Hello!</p>`; }
}
HelloWorld.register('hello-world');
```

---

## Deliberately deferred

Not in v1. Do not implement as part of other tasks:

- **Bundling of any kind.** webjs is a **no-build framework**. `.js` / `.ts` files are served directly to the browser via importmap + per-file ESM. Same model as Rails 7+ (Hotwire + importmap-rails). Production performance comes from HTTP/2 multiplex + `<link rel="modulepreload">` hints emitted at SSR time, not from concatenation. **Do not propose a bundler. Do not add a `webjs build` command.** If a large-app perf problem materializes, it gets solved by tightening the modulepreload graph or by adopting per-route splitting natively in the browser (importmap scopes), not by reintroducing a build step.
- **Per-route code splitting.** Downstream of the no-build invariant. The browser already fetches each module lazily as the import graph reaches it. Modulepreload hints are emitted per-route at SSR time.
- **Vite-grade HMR with state preservation.** Web components can only be `customElements.define`d once, so we do a full-page reload instead. Data reloads are near-instant via chokidar → SSE.
- **React Server Components Flight protocol.** Server actions cover "call a server function from the client". Flight duplicates years of React work. Use `Suspense` + streaming instead.
- **Edge-runtime bundling / full portability.** See `agent-docs/deployment.md`.
- **i18n, image optimization.** Layer libraries on top.
