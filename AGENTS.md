# AGENTS.md for webjs

This file is the contract for **AI agents** (and humans) editing a webjs app.
It describes file conventions, the public API, invariants to preserve, and
recipes for common tasks. Keep it in sync whenever behaviour changes.

**Detail docs**, loaded when relevant. They don't auto-load. This file stays
lean on purpose; anything marked "see `agent-docs/<x>.md`" has the full
reference there.

| File | Topic |
|---|---|
| `agent-docs/metadata.md` | Full `metadata` / `generateMetadata` field reference |
| `agent-docs/components.md` | WebComponent deep-dive (controllers, hooks, light/shadow DOM, slots) |
| `agent-docs/styling.md` | Tailwind helpers + vanilla-CSS opt-out conventions |
| `agent-docs/built-ins.md` | Auth, sessions, env vars, caching (cache(), HTTP cache, asset-hash, conditional GET), rate-limit, broadcast, file storage |
| `agent-docs/configuration.md` | The `package.json` `"webjs"` block (security headers, CSP, redirects, trailing-slash, basePath, ingress caps, dev/start task orchestration) + observability |
| `agent-docs/advanced.md` | Suspense streaming, performance, bundling, client router (prefetch, frames, view transitions, stream actions), WebSockets |
| `agent-docs/typescript.md` | TS at runtime + full-stack type safety |
| `agent-docs/service-worker.md` | The opt-in progressive-enhancement service worker (`public/sw.js`) |
| `agent-docs/testing.md` | Unit, browser, convention validation, the `handle()` test harness (`@webjsdev/server/testing`) |
| `agent-docs/framework-dev.md` | Monorepo dev (only when editing webjs itself): commands, repo-health git config, changelog flow, dev error overlay |
| `agent-docs/recipes.md` | Page / route / action / component recipes |
| `agent-docs/lit-muscle-memory-gotchas.md` | **READ FIRST** when writing components. Lit patterns that break webjs SSR or reactivity, with the webjs-shaped fix for each |

---

## AI-driven development: guardrails for all agents

**webjs is AI-first. These rules apply to ALL agents (Claude, Cursor, Copilot, Antigravity, Aider), enforced via per-agent config the scaffold ships** (`AGENTS.md` + `CONVENTIONS.md` + `CLAUDE.md`, `.claude/settings.json` hooks, `.cursorrules`, `.agents/rules/workflow.md`, `.github/copilot-instructions.md`, a PR template, `.editorconfig`), all carrying the same rules in each agent's format.

### Before starting ANY work: verify and sync the branch

1. `git branch --show-current`. If on `main` / `master`, **STOP** and `git checkout -b feature/<task-slug>`.
2. Verify the branch matches the task. Don't mix unrelated work.
3. Sync with parent: `git fetch origin && git log HEAD..origin/main --oneline`. If there are upstream commits, `git rebase origin/main` first.

Claude Code enforces step 1 via `.claude/hooks/guard-branch-context.sh`. Other agents check manually.

### Skills are routed deterministically, never skipped

A Skill is model-invoked, so it fires only when the model judges a match. The `.claude/hooks/route-skills.sh` `UserPromptSubmit` hook makes routing deterministic: it keyword-matches each prompt against every skill's documented triggers and injects a directive to invoke the matched skill before other work. Check the available skills and invoke a matching one before starting. The skills themselves are committed under `.claude/skills/` (alongside the hooks), so a fresh clone has both the router and the skills it routes to (no machine-local dependency). Tests in `test/hooks/route-skills.test.mjs`, which also asserts every skill the hook references is committed in-repo.

### Autonomous mode (sandbox / bypass permissions)

When interactive approval is disabled, never block on questions. Auto-decide: on `main`, auto-create `feature/<task-slug>`; auto-rebase if the parent moved; auto-merge when ready; **delete** feature/fix branches after merge but **keep** long-lived ones (dev, staging, release/*); auto-generate meaningful commit messages; fix failing tests / convention violations rather than asking. Autonomous mode is MORE disciplined, not less, with the same quality bar.

### Code workflow (mandatory)

Every code change MUST include, automatically:

1. **Tests, every applicable layer (not just unit).** Ship the tests that prove the change across EVERY layer it touches: **unit** (`packages/*/test/**`, `test/**`, including the counterfactual that fails when reverted), **browser** (`*/test/**/browser/*` via `npm run test:browser`, for hydration / DOM / slots / client router / custom-element upgrade), **e2e** (`test/e2e/*.test.mjs` via `WEBJS_E2E=1`, including network probes / navigation / streaming), and **smoke** (`test/examples/*/smoke/*`). A unit test is NECESSARY BUT NOT SUFFICIENT for any client-router / component / browser-facing change (the headline behaviour is a browser/e2e assertion). `npm test` does NOT run browser or e2e; run them yourself and report the result. Never report work done with failing or missing tests. See `agent-docs/testing.md`. Enforced by `.claude/hooks/require-tests-with-src.sh` (the scaffold variant WARNS unless `WEBJS_TEST_GATE=block`).
2. **Documentation.** Update `AGENTS.md` for new API surface, `CONVENTIONS.md` for new conventions, `docs/` or `website/` for user-facing features.
3. **Convention validation.** Run `webjs check` and fix violations.

### Git workflow (mandatory)

Always work on a feature branch; commit + push freely there. The only gate is merging into main (needs user approval unless in bypass mode).

1. **Feature branch first;** never edit on main; never push to main.
2. **Commit per logical unit** (one feature, fix, rename, doc rewrite) as soon as it is complete and tests pass (`webjs test`); 5+ unstaged files across concerns means you waited too long. Push after each commit.
3. **Meaningful commit messages** (imperative, under 72 chars, body explains *why*). **No AI attribution** (no `Co-Authored-By: Claude`, `Generated by AI`).
4. **PRs via `gh`, always.** "merge to main" is ALWAYS `gh pr create`, confirm, `gh pr merge`, never a local `git merge` + push.
5. **Never merge without permission.** Ask exactly "Ready to merge `<branch>` into `<target>`? After merging, should `<branch>` be deleted or kept?" and wait for both answers.

---

## Working in the webjs framework repo itself

When editing the framework monorepo (this repo, not a scaffolded app): **`packages/` is plain `.js` with JSDoc. Never add `.ts` files there** (the framework ships buildless). TypeScript is fine in `examples/`, `docs/`, `website/`.

See `agent-docs/framework-dev.md` for monorepo commands, workspace layout, per-feature update checklists, the worktree-safe git config, the per-package auto-generated changelog flow, and the dev error overlay.

---

## What webjs is

An **AI-first, web-components-first** framework inspired by NextJs, Lit, and Rails. The component runtime API matches lit (reactive `static properties`, the lit lifecycle hooks, ReactiveControllers, the `lit-html` directive set, `html` / `css` templates) so lit training data transfers directly, but webjs ships its own no-build implementation under `packages/core/src/`. Decorators are the one lit exception (invariant 10); use `declare` + `static properties`.

- **No build step.** Source files are served as native ES modules. JSDoc `.js` is default; `.ts` / `.mts` is stripped through a pluggable stripper (#508): Node 24+'s built-in `module.stripTypeScriptTypes`, or `amaro` on Bun (byte-identical, position-preserving) (invariant 10 + `agent-docs/typescript.md`). **Runs on Node 24+ or Bun** (run a Bun app with `bun --bun run dev` / `start`); the early `assertNodeVersion()` preflight enforces the Node floor and admits Bun. On Bun, `startServer` selects a native `Bun.serve` listener shell instead of the node:http one (skipping the compat bridge for ~1.9x more req/s on the listening path, at near-complete feature parity, the one node-only gap being 103 Early Hints since `Bun.serve` has no informational-response API), via a runtime-neutral seam that also sets up future `Deno.serve` / embedded adapters. Edge runtimes (no filesystem) are a separate, later target.
- **SSR + CSR by default.** Pages are server-rendered HTML; components render light DOM by default, shadow DOM opt-in via `static shadow = true` with DSD SSR.
- **Progressive enhancement is the default architecture.** Pages and components are SSR'd; with JS off, content reads, `<a>` navigates, `<form>` server actions submit, display-only elements render. JS is opt-in *per interactive behaviour* (`@click`, a reactive property assignment, a signal mutation). Never write a first paint that depends on hydration; never use `fetch` + JS where a `<form>` + server action would do.
- **Display-only components are elided from the browser.** A component with no interactivity signal renders identical HTML with or without its JS, so the framework strips its import (and any vendor reachable only through it, importmap entry included) from the served source. Automatic, conservative, verified differentially. Disable with `"webjs": { "elide": false }` or `WEBJS_ELIDE=0`. See `agent-docs/components.md`.
- **Server actions with rich types.** A `*.server.{js,ts}` file with `'use server'` exports functions importable from the client (the import is rewritten to a typed RPC stub); the wire round-trips `Date` / `Map` / `Set` / `BigInt` / `Error` / typed arrays / `Blob` / `File` / `FormData` / Symbols / cycles. The source is never served to the browser (invariant 1).
- **Only files reachable from a browser-bound entry are servable.** The dev server walks the static import graph from every page / layout / error / loading / not-found / component file (lazily on first request, re-derived after each `fs.watch` rebuild); that Set is the authorisation gate, so anything no client code imports returns 404.
- **Sensible defaults, overridable.** Memory store in dev, Redis when configured. Built-in auth, sessions, caching, rate limiting, file storage (all pluggable). Tailwind is the default styling. See `agent-docs/built-ins.md`.

---

## Execution model (read this to avoid the RSC mental model)

webjs has **no server/client component split.** There is no RSC render tree, no Flight protocol, no "use client" / "use server" component boundary.

**Pages, layouts, and components are isomorphic modules** (same source both sides), but hydrate differently:

- **Components hydrate.** The module loads in the browser, registers the custom element, the browser upgrades the SSR'd tag, and `render()` / lifecycle / `@event` / signals run client-side. Per-element, islands-style. **All interactivity lives here.**
- **Pages and layouts do NOT hydrate.** Their function runs only on the server to produce HTML and is never re-invoked in the browser. So a page/layout cannot be interactive in its own markup (an `@click` in a page template is dropped at SSR; a signal read in a page body never re-renders). For interactivity, render a component's tag.

A page/layout module still **loads** in the browser for its top-level side effects: registering imported components (so their tags upgrade) and, for a layout, enabling the client router via `import '@webjsdev/core/client-router'`. That load is also how its imports reach the client (`import dayjs` at the top of a page fetches dayjs when the module loads, not via hydration). An inert page/layout is dead weight, which is exactly when elision drops it.

`route.{js,ts}` is the one routing file that is NOT isomorphic: a server-only HTTP handler (named `GET` / `POST` exports), the webjs equivalent of a Next route handler. It never ships to the client.

**`.server.{js,ts}` is the one server boundary, an RPC + source-protection mechanism, NOT an RSC component.** With `'use server'` exports are RPC-callable (the browser import becomes a stub POSTing to `/__webjs/action/<hash>/<fn>`); without it the file is a server-only utility whose browser import **throws at module load** (the DB driver, secrets, `node:*`, hashing). Consequence: **never import a no-`'use server'` util directly into a page, layout, or component** (it works at SSR but the client stub crashes on load); use it inside `'use server'` actions, `route.{js,ts}`, or `middleware`, and reach it from a page by importing a `'use server'` action (whose RPC stub loads safely client-side). This boundary, not a component annotation, is how a dependency is kept off the client (a date library used only during SSR belongs in `lib/format.server.ts`). See `agent-docs/components.md`.

---

## Framework source: where to find it

Plain JS with JSDoc lives in `node_modules/@webjsdev/` (`core/`, `server/`, `cli/`, `mcp/`, `intellisense/`, `ui/`); what you read is what runs. Starting points: SSR `@webjsdev/server/src/ssr.js`, client hydration `@webjsdev/core/src/render-client.js`, client router `@webjsdev/core/src/router-client.js`, convention rules `@webjsdev/server/src/check.js`. For UI debugging use the Playwright MCP server; for live introspection the scaffold wires the read-only `@webjsdev/mcp` server (`npx @webjsdev/mcp`, also reachable as `webjs mcp`): `list_routes`, `list_actions`, `list_components`, `check`, plus a knowledge layer (docs / recipes / framework source).

---

## App layout (cannot be renamed)

```
app/                        ROUTING ONLY (thin adapters importing from modules/; no helpers/constants here)
  layout.js                 root layout, wraps every page
  page.js                   /
  error.js                  nested error boundary
  not-found.js              404 page (only at app/ root; nested <segment>/not-found.js, nearest wins)
  <segment>/page.js         /<segment>
  [param]/page.js           dynamic route (`params.param`)
  [...rest]/ [[...rest]]/   catch-all / optional catch-all
  (group)/…                 route group (folder NOT in URL, still scopes layout/error)
  _private/…                private folder (ignored by the router)
  <path>/route.js           HTTP handler at /<path>
  <segment>/middleware.js   per-segment middleware
  <segment>/loading.js      auto Suspense boundary
middleware.js               root middleware (every request)
readiness.js                optional /__webjs/ready check (return false/throw = 503)
env.js                      optional boot-time env validation (schema or validator fn; fails fast)
sitemap.js robots.js manifest.js icon.js opengraph-image.js twitter-image.js apple-icon.js   metadata routes
lib/                        app-wide code (lib/*.server.js infra, lib/utils/ browser-safe helpers)
modules/<feature>/          feature-scoped: actions/ (mutations), queries/ (reads), components/, utils/, types.js
components/*.js             SHARED presentational primitives
public/*                    static assets, served at /<name>
db/*.server.{js,ts}         data layer (Drizzle: schema, columns, connection)
```

Every file is a plain ES module.

### Imports: prefer the `#` root alias over deep relatives (#555)

App-internal imports use the **`#` path alias** instead of deep `../../../`
relatives: `import { db } from '#db/connection.server.ts'`, `import { Button }
from '#components/ui/button.ts'`, `#lib/...`, `#modules/...`. It is Node's native
`package.json "imports"` field (the scaffold ships the single catch-all `"#*":
"./*"`, so any top-level folder is aliased with no config change), resolved at
runtime by Node 24+ AND Bun with **no build step and no tsconfig `paths`**. The
sigil is `#` (not `@`) and there is **no slash after it** (`#lib/...`, not
`#/lib/...`): a `#/`-prefixed key does not resolve on Bun. The webjs server
expands the same map for the import graph / auth gate / elision / browser
importmap, so a `#`-aliased `.server.ts` still trips the server-only boundary.
A same-directory import stays relative (`./sibling.ts`); only deep relatives
become `#`. The alias addresses a top-level SUBDIRECTORY (`#lib/...`,
`#components/...`); a bare root-level file (`./env.ts`) is imported relatively
(the browser importmap scope is per-directory, so a `#`-imported root file has
no browser mapping in dev). Opt out anywhere by writing a plain relative import.

---

## Public API of `@webjsdev/core`

```js
import { html, css, WebComponent, render } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
```

The bare `@webjsdev/core` specifier resolves to a BROWSER bundle dropping server-only modules (`render-server.js`, `setCspNonceProvider`); `renderToString` / `renderToStream` live at `@webjsdev/core/server` for Node-side consumers.

| Export | Purpose |
|---|---|
| `html` / `css` | Tagged template literals. `css` goes in `static styles`. |
| `WebComponent` | Base class for interactive components. |
| `register(tag, C)` | Tag binding. Auto-called by `Class.register('tag')`. |
| `render(v, el)` | Client-side render into a DOM element. |
| `renderToString` | Server-side async render to HTML with DSD (from `/server`). |
| `notFound()` / `redirect(url[, status])` | Throw to return 404, or a redirect. No-status default is convention-picked at the catching site: 302 for a GET page-render gate, 307 (method-preserving) for a server-action redirect. Override with `redirect(url, 308)` or `redirect(url, { status })`. |
| `Suspense({fallback, children})` | Page/region-level streaming boundary (a value in a hole). `repeat` keyed-list directive is also re-exported. |
| `<webjs-suspense .fallback=${html\`…\`}>` | Component-level streaming boundary element (#471): wraps one or more components, flushes `.fallback` on the first byte, streams the resolved content in (concurrently across boundaries, progressively on soft nav). The renderer-recognized opt-in for SLOW async-render data. |
| `connectWS(url, handlers)` / `richFetch<T>` | Client WebSocket (auto-reconnect, queued sends); content-negotiated rich-type fetch. |
| `navigate(url, opts?)` / `revalidate(url?)` | Programmatic client-router nav; evict the BROWSER snapshot cache. |
| `optimistic(signal, value, action)` | Set `signal` immediately, run `action`, roll back on error or `{ success: false }`. |
| `renderStream(payload)` / `WebjsFrame` | `<webjs-stream>` element-level updates (#248); `<webjs-frame>` partial-swap regions (#253). See `agent-docs/advanced.md`. |
| `Metadata` / `PageProps<R>` / `LayoutProps<R>` / `RouteHandlerContext<R>` / `WebjsConfig` (type-only) | Types for metadata, page/layout/route args (`R` narrows `params` against the `webjs types` route union), and the `webjs` config block. See `agent-docs/metadata.md` + `agent-docs/configuration.md`. |

### Directives, from `@webjsdev/core/directives`

lit-html parity: `repeat` (keyed lists), `unsafeHTML(str)` (trusted raw HTML, **NEVER with user input**), `live`, `keyed`, `guard`, `templateContent`, `ref` + `createRef`, `cache`, `until`, `asyncAppend` / `asyncReplace`, and `watch(signal)` (fine-grained DOM swap). Prefer `Task` over `until` for component async data; `Suspense` for page-level streaming. Everything else (`classMap`, `styleMap`, `ifDefined`, `when`, `choose`, `map`, `join`, `range`) uses native JS. Context lives in `@webjsdev/core/context`, `Task` / `TaskStatus` in `@webjsdev/core/task`.

### `html` expression prefixes

`<div>${x}</div>` text child; `class=${x}` attribute (escaped); `@click=${fn}` event listener (client-only, drops at SSR); `.value=${v}` DOM property (round-trips through SSR on custom elements via `data-webjs-prop-*`, drops on native elements); `?disabled=${b}` boolean attribute. Event/property/boolean holes **must be unquoted** (invariant 4). Every hole is identical server and client except `@event` and `.prop` on native elements.

---

## `WebComponent` essentials

```ts
class MyThing extends WebComponent {
  static shadow = false;     // default light DOM; true = scoped shadow DOM
  static lazy = false;       // true = load module on viewport entry
  static properties = { count: { type: Number, reflect: true } };
  declare count: number;     // TS only, typed accessor
  static styles = css`…`;
  render() { return html`…`; }
}
MyThing.register('my-thing');
```

**Signals are the default state primitive.** Import `signal` / `computed` from `@webjsdev/core`, read with `signal.get()` inside `render()`, and the built-in `SignalWatcher` re-renders on change. Module-scope signals share state across components and survive navigations; instance signals (constructor) are component-local. `static properties` is reserved for values that ride an HTML attribute, reflect to one, or arrive via `.prop=${value}` SSR hydration. **Typed props in TS use the `declare` pattern** (a `student: Student = {…}` class-field initializer overwrites the reactive accessor after `super()` and breaks reactivity; instead declare the runtime in `static properties`, the type via `declare student: Student`, and set defaults in the constructor, enforced by `reactive-props-use-declare`). Property options: `type` (default `String`), `reflect`, `state`, `hasChanged`, `converter`.

**Lifecycle (lit-aligned), in order:** `shouldUpdate`, `willUpdate`, controllers' `hostUpdate()`, `update` (calls `render()` + commits), controllers' `hostUpdated()`, `firstUpdated`, `updated`, `updateComplete`, each receiving a `changedProperties` Map. **SSR runs only the constructor, attribute application, the pre-render hooks (`willUpdate` / `hostUpdate`), `reflect: true` reflection, and `render()`; it does NOT call `connectedCallback`, `firstUpdated`, `updated`, or any browser-only hook.** So defaults for first paint go in the constructor; browser-only data (localStorage, viewport, `navigator.*`) goes in `connectedCallback` writing a signal; server-known data arrives via the page function. Never ship a placeholder first paint that fetches in `connectedCallback`. A browser-only global in the constructor/`render()` throws at SSR (flagged by `no-browser-globals-in-render`; attribute methods and `closest()` are shimmed).

**Async render (`async render()`), bare-await data fetch (#469).** A component may write `async render() { const u = await getUser(this.id); return html\`<h3>${u.name}</h3>\`; }`. Writing `await` makes the function async by JS rule, and every render path awaits a promise-returning `render()` automatically (no flag). This co-locates the fetch in the leaf component (no prop-drilling). The model is decoupled into three separate concerns. (1) **SSR always blocks**, so the resolved DATA is in the first paint with no fallback markup (PE-safe, JS-off reads it). (2) **The client re-fetch default is stale-while-revalidate**: when a prop / dependency change re-runs `async render()`, the current content stays until the new render resolves (no blank, no flash). (3) **`renderFallback()` is the OPTIONAL re-fetch loading UI**, a prop-aware method shown ONLY during a client re-fetch, NEVER on the first paint, and it does NOT trigger SSR streaming. **Errors are isolated per component by default** (no user code): a thrown `await getData()` renders a component-scoped error state while siblings render, and `renderError()` optionally customizes it (dev surfaces the message, prod stays silent). `getData()` is already isomorphic (a `'use server'` action is the real function during SSR and an RPC stub on the client), so the same line works both sides. Use `async render()` for request-time-known SERVER data that should be in the first paint; keep `Task` / signals for genuinely client-only data (a `Task` shows its pending state at SSR, losing first-paint data). A **bare** async-render component (an `async render()` with no other client signal, light DOM) is **elided** like any display-only component (#474): its SSR'd HTML is the complete output, so the framework drops the module AND the redundant on-hydration re-fetch. It SHIPS only when it also carries an independent signal (an `@event`, a non-`state` reactive prop, a signal / reactive import, a lifecycle hook including `renderFallback()`, a `<slot>`, `static shadow = true`, `static refresh = true`, cross-module observation, or a transitively-reachable interactive child). Two carve-outs always ship: `static shadow = true` (Declarative Shadow DOM attaches only during HTML parsing, so a streamed or soft-navigated shadow component needs its module to re-run `attachShadow`) and `static refresh = true` (the explicit opt-in keeping the stale-while-revalidate on-load re-fetch that eliding drops, moot for request-stable data). **For SLOW data where blocking the first byte hurts, wrap the region in `<webjs-suspense .fallback=${html\`…\`}>` to STREAM it** (the fallback flushes on the first byte, the data streams in; multiple boundaries fetch concurrently). This is the only way to show a first-paint fallback, a deliberate choice for slow regions, and it streams progressively on soft navigation too. A throwing component inside a boundary is isolated (renders its error state, siblings stream). **The on-hydration re-fetch is itself eliminated by SSR action seeding (#472):** each `'use server'` action result invoked during a (non-streamed) SSR render is serialized into the page, and the generated RPC stub reads that seed on its first client call, so a shipping async component does NOT re-issue the RPC on hydration (a later refetch / arg-change still goes to the network). Keyed by action-hash + fn + serialized args, consume-once, fail-open (a miss degrades to a normal RPC, never wrong data). Captured via a transparent server-side `'use server'` facade (no source transform, no build step; the browser source tab and on-disk files are unchanged), default on, opt out with `"webjs": { "seed": false }` or `WEBJS_SEED=0`.

**Light DOM (default) vs Shadow DOM.** Light DOM applies global CSS and Tailwind directly (default; for Tailwind/global CSS + simple composition). Shadow DOM (`static shadow = true`) is for `static styles` scoped CSS and third-party isolation; `<slot>` works in either. A light-DOM component authoring custom CSS MUST prefix every class selector with its tag name (invariant 7); prefer Tailwind. Install the `webjs` VSCode extension (`packages/editors/vscode`, VS Marketplace + Open VSX; also covers Cursor / Antigravity / Windsurf) or `webjs.nvim` (`packages/editors/nvim`, via lazy.nvim) for template highlighting + editor intelligence with no Lit plugin, or add the standalone `@webjsdev/intellisense` to `tsconfig.json` `plugins` manually (JetBrains). Full deep-dive in `agent-docs/components.md` + `agent-docs/lit-muscle-memory-gotchas.md`.

---

## File conventions: the essentials

### Pages (`app/**/page.{js,ts}`)

- Default export is a possibly-async function receiving `{ params, searchParams, url, actionData }`. Runs **only on the server**. Throw `notFound()` / `redirect(url)` to short-circuit.
- Named exports: `metadata` (static), `generateMetadata(ctx)` (async, takes precedence). Type both with `Metadata`. See `agent-docs/metadata.md`.
- Optional `export const revalidate` (seconds) opts into the server HTML response cache (#241). SAFETY: only on a page identical for every visitor (no `cookies()` / session / per-user data); keyed by URL only. See `agent-docs/built-ins.md`.
- Optional `export const action`: a fn `({ request, params, searchParams, url, formData })` handling a non-GET submission to the page's own URL (the no-JS write-path, #244), returning an `ActionResult`. Success is a `303` (PRG); failure re-renders the SAME page at `422` with the result on `ctx.actionData`. See `agent-docs/recipes.md`.
- Page modules also load on the client so imported components register; keep top-level imports browser-safe. **Server-only code goes only in `.server.{js,ts}`, `route.ts`, or `middleware.ts`. Never in pages, layouts, or components.**

### Layouts (`app/**/layout.{js,ts}`)

Default export receives `{ children, params, searchParams, url }`, must embed `children`, nests by folder, and `metadata` merges (deepest wins). The framework auto-emits `<!doctype><html lang="en"><head></head><body>`; only the **root layout** (`app/layout.{js,ts}` exactly) MAY write its own shell (the framework splices in importmap, modulepreload, title, meta). Non-root layouts and pages MUST NOT (the `shell-in-non-root-layout` rule).

### Error / loading / metadata routes

`error.{js,ts}` default-exports `({ error, ...ctx }) => TemplateResult` (catches sibling-page / deeper render errors, innermost wins, prod sends only `error.message`). `loading.{js,ts}` wraps the sibling page in `Suspense` with an immediately-flushed fallback. Metadata routes (`sitemap`, `robots`, `manifest`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`) live at app root or static segments only and default-export a possibly-async function; `sitemap(entries)` / `sitemapIndex(sitemaps)` from `@webjsdev/server` serialize spec-valid XML.

### Route handlers (`app/**/route.{js,ts}`)

Named async exports per method (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`), each `(Request, { params }) => Response | value` (value auto-JSONs). A folder cannot have both `page.js` and `route.js`. Export `WS(ws, req, { params })` from the same file for a WebSocket endpoint (in dev re-imported per connection; shared state on `globalThis`). See `agent-docs/advanced.md`.

### Middleware (`middleware.{js,ts}`)

Optional top-level + per-segment. Default export `async (req, next) => Response`. Return a Response to short-circuit, or call `next()` then post-process. Per-segment applies to its subtree, outermost to innermost.

### Env validation (`env.{js,ts}`)

Optional app-root file default-exporting a **schema object** (env-var names to a type `string` / `number` / `boolean` / `url` / `enum` or options object with `optional` / `default` / `minLength` / `pattern` / `values`) OR a **validator function** `(env) => void` (throw to fail boot). Runs at boot after `.env` loads, writes coerced values + defaults back to `process.env`, fails fast naming EVERY bad var. Opt-in.

### Server actions (`**/*.server.{js,ts}` + `'use server'`)

| File | `'use server'`? | What it is |
|---|---|---|
| `*.server.ts` | yes | **Server action.** Source-protected AND RPC-callable; client imports become stubs POSTing to `/__webjs/action/<hash>/<fn>`. |
| `*.server.ts` | no | **Server-only utility.** Source-protected; browser imports get a throw-at-load stub. |
| Plain `.ts` | yes | **Lint violation** (`use-server-needs-extension`). Rename to add `.server.`. |
| Plain `.ts` | no | Browser-safe; standard. |

The server-only-utility row (`.server.ts`, no `'use server'`) is a runtime trap: its browser stub throws at module load, so a page / layout / component that ends up SHIPPING to the browser and transitively imports one crashes the moment the module loads, while `webjs typecheck` and the rest of `webjs check` pass. `webjs check`'s `no-server-import-in-browser-module` rule catches this statically by reusing the build's elision verdict (it only flags modules that genuinely ship; a display-only page the framework elides is fine, because the framework strips its server import). A `'use server'` action is exempt: its browser stub is a working RPC, which is the intended way to call the server from a shipping module.

Server actions export named async functions whose args + returns round-trip through the serializer. **Importing from a client component IS the API** (rewritten to an RPC stub; never hand-write `fetch()`). **REST over HTTP is a `route.ts`** that imports and calls the action (optionally via the `route(action, opts?)` adapter from `@webjsdev/server`, which merges query + route params + JSON body into one input object and JSON-responds). **Input validation (#245)** is declared via the `export const validate` config export (read on the RPC boundary); a `route()` endpoint passes the same validator as its `{ validate }` option. The framework only CALLS the validator (ships no validation library) and reads its return (`{ success: true, data? }` runs the action, `{ success: false, fieldErrors }` returns a `422` without running the body, a THROW is a sanitized error, any other value is transformed input). The validator stays server-side and receives the action's first argument. Full reference in `agent-docs/recipes.md`.

**HTTP-verb actions via config exports (#488).** A `'use server'` action declares its HTTP semantics through RESERVED sibling exports the framework reads statically, the same way a page declares `export const revalidate`: `export const method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'` (absent = POST, so existing actions are unchanged), `export const cache = 60` (seconds, or `{ maxAge, swr, public }`, default `private`; **`public: true` SHARES the response across users keyed only by URL + args, so use it ONLY for data identical for every visitor, never for a session / per-user read, the same safety rule as a page's `export const revalidate`**), `export const tags = (id) => [\`user:${id}\`]` (a GET's cache tags), `export const invalidates = (id) => [...]` (a mutation's tags to evict), `export const validate = (input) => ...` (the boundary validator), and `export const middleware = [mw1, mw2]` (#490: per-action middleware, each `async (ctx, next) => result`, run around the action on BOTH the RPC and `route.ts` (including the `route()` adapter) boundaries; a middleware short-circuits by returning an `ActionResult` instead of calling `next()`, and accumulates context the action reads via `actionContext()` from `@webjsdev/server`, no signature change). The function stays a plain `export async function`; **one function per file** (a configured file with more than one callable function is a `webjs check` error). The call site never changes (`await getUser(7)`); the verb only changes the transport: a **GET** rides args in the URL (`?a=`, with a POST fallback over a 4KB cap), is CSRF-exempt, carries `Cache-Control` + a weak ETag (answering `If-None-Match` with a 304) and `X-Webjs-Tags`, and reads the SSR seed (#472) first; a **mutation** (POST/PUT/PATCH/DELETE) sends the rich body (DELETE rides the URL), is CSRF-protected, and on completion (the action did not throw) evicts its `invalidates` tags from the server `cache()` (`revalidateTags`) and reports them via `X-Webjs-Invalidate` so the client browser-cache coordinator revalidates a later read. A mismatched request method is a `405` + `Allow`. Why webjs needs this and Next does not: webjs has no RSC server/client split, so reads and writes both flow through the one action mechanism (Next's reads are Server Component fetches, so its actions stay POST-only). `validate` is a BOUNDARY concern (the RPC endpoint and a `route.ts`), not a direct server-to-server call. A public REST endpoint is a `route.ts` that imports and calls the action (optionally via the `route()` adapter). **Cancellation (#492):** an action reads the request's `AbortSignal` via `actionSignal()` (from `@webjsdev/server`) to stop work on a client disconnect / abort (a never-aborting signal outside an action keeps the line safe server-to-server); on the client, a superseded `async render()` automatically ABORTS the previous render's in-flight action fetch (not just drops it), via a per-render `AbortController` the stub binds each fetch to. **Streaming results (#489):** an action that RETURNS a `ReadableStream` / async iterable / async generator (any verb) streams its chunks over the single RPC response instead of buffering; the call site does `for await (const chunk of await streamTokens(8))` and each rich-serialized chunk arrives as it is yielded (back-pressure respected, the source generator cancelled on a client disconnect / superseded render). Detection is purely on the return value (no config export); a streamed result is never cached / ETagged / seeded (a mutation still emits `X-Webjs-Invalidate`). A mid-stream throw surfaces as an error from the iterable (the HTTP status is already 200), the author message in prod.

### RPC + REST endpoint security

Client to action RPC posts `x-webjs-csrf` matching the cookie issued on first SSR (mismatch 403); prod errors are sanitized to `message` only. A `route.ts` REST endpoint (hand-written or via the `route()` adapter) is NOT CSRF-protected: authenticate every mutating endpoint, use `validate`, log without secrets, rate-limit. For CORS use the `cors()` middleware from `@webjsdev/server`; **`credentials: true` REQUIRES an explicit origin allowlist, never `'*'`.** See `agent-docs/advanced.md`.

### Components (`components/*.{js,ts}`)

One custom element per file; call `Class.register('tag')` at module top level. Styling via `static styles` (shadow) or Tailwind classes, not inline `style="…"`.

---

## Modules architecture (preferred for non-trivial apps)

- **`modules/<feature>/actions/*.server.{js,ts}`** mutations, **`queries/*.server.{js,ts}`** reads (one function per file), **`components/*.{js,ts}`** feature-owned components (shared UI in top-level `components/`), **`utils/*.{js,ts}`** pure helpers (no `'use server'`, no DB), **`types.{js,ts}`** typedefs.
- **`lib/`** cross-cutting: `lib/*.server.{js,ts}` server-only infra (session, hashing; the DB connection lives in `db/connection.server.ts`), `lib/utils/*` browser-safe helpers, `lib/*.ts` app-wide values.

### The `ActionResult<T>` envelope

```ts
type ActionResult<T> =
  | { success: true, data?: T, redirect?: string }  // redirect MUST be a same-site local path
  | { success: false, error?: string, fieldErrors?: Record<string, string>,
      values?: Record<string, string>, status?: number };
```

`fieldErrors` / `values` / `redirect` are additive. **Failure detection is robust:** a result is a FAILURE when `result.success === false`, OR `result.fieldErrors` is present, OR `result.error` is present and `result.success !== true`. **`result.redirect` must be a same-site local path** (a single leading `/`); other values are ignored (open-redirect guard), so throw `redirect(absoluteUrl)` for a real external redirect.

**Rules:** routes stay thin (extract >~20 lines into a module action); client components import server modules via the normal path; server-only imports reach the client only through `.server.{js,ts}`; one module, one feature. See `agent-docs/recipes.md`.

---

## Styling: Tailwind-first

**Tailwind is the strong default for pages AND light-DOM components.** The lit reflex to scope CSS in a shadow root with `static styles` is the habit to resist in light DOM. When a class bundle repeats, extract it into a `lib/utils/ui.ts` helper returning an `` html`...` `` fragment (SSR-time), NOT a CSS class (no `@apply`). Reserve raw CSS for what utilities cannot express (design tokens / `@theme`, `@property` + `@keyframes`, scrollbar, `prefers-reduced-motion`, complex `color-mix()` / gradients); in light DOM the tag-prefix invariant (#7) still holds, and shadow-DOM components legitimately use `static styles = css\`\``. See `agent-docs/styling.md`.

---

## Client navigation: automatic, nothing to opt into

Nested layouts auto-emit `<!--wj:children:<segment-path>-->` markers; the client router walks both DOMs and replaces only the deepest shared layout's children slot, preserving outer-layout DOM identity. Form submissions ride the same pipeline (`data-no-router` opts out). Wire bytes are minimized via the `X-Webjs-Have` header (the server returns only the divergent fragment); scroll is restored on back/forward. A non-GET `<form>` whose target page exports an `action` is the no-JS write-path (with JS the router applies the response in place: a `422` swaps without reload, a `303` is followed via fetch). A failed navigation recovers in place (a cancelable `webjs:navigation-error` event, else a minimal in-place alert), never a destructive full reload.

The advanced client-router surface is in `agent-docs/advanced.md`: **link prefetch** (on by default, `intent` strategy, per-link `data-prefetch`), **`<webjs-frame>`** partial-swap regions, **View Transitions** (opt-in via `<meta name="view-transition">`, plus `data-webjs-permanent` to persist a live element), and **stream actions** (`<webjs-stream>` element-level updates, #248). Production benefits from HTTP/2 at the edge; `npm run start` speaks plain HTTP/1.1 (put a reverse proxy in front for TLS + HTTP/2).

---

## Invariants (for both humans and agents)

> Hit one of these as a runtime error? The [Troubleshooting page](https://docs.webjs.com/docs/troubleshooting) is keyed by symptom (the throw-at-load server import, the backtick-in-template 500, the TypeScript strip failure, the SSR browser-global crash, the missing-frame swap) and maps each back to the invariant and the `webjs check` rule below.

1. **Server-only code goes in `.server.{js,ts}` files, `route.ts` handlers, or `middleware.ts`. Never in pages, layouts, or components.** The `.server.{js,ts}` extension is the path-level boundary (the file router refuses to serve the source); a `'use server'` directive additionally makes exports RPC-callable, else the file is a server-only utility whose browser import is a throw-at-load stub. Importing a DB driver (`better-sqlite3` / `pg`), `node:*`, or any server-only dep from a component or an `app/**` page / layout / loading / error / not-found file crashes the browser at module load.
2. **Every `*.server.{js,ts}` file with `'use server'` exports must be `async` functions returning serializer-safe values.** Args and results round-trip via webjs's wire. Files without `'use server'` (server-only utilities) can export anything, including singletons.
3. **Custom element tag names must contain a hyphen** (HTML spec). Pass the tag to `Class.register('tag-name')`, not a static field. Any short-string quote works: `'tag-name'`, `"tag-name"`, or `` `tag-name` `` (single-line, no interpolation).
4. **Event (`@`), property (`.`), boolean (`?`) holes in `html` must be unquoted**, e.g. `@click=${fn}`, never `@click="${fn}"`.
5. **Signals are the default state primitive.** Import `signal` / `computed` from `@webjsdev/core` and read via `signal.get()` inside `render()`; the built-in SignalWatcher tracks the reads and re-renders. Module-scope signals share state across components; instance-scope signals (constructor) are component-local. `static properties` (with a sibling `declare`) is reserved for values riding an HTML attribute, reflected to one, or arriving via `.prop=${value}` SSR hydration. For fine-grained DOM swap use `${watch(signal)}` from `@webjsdev/core/directives`.
6. **Page and layout default exports must be functions.** They return a value (usually `TemplateResult`). They do not call `render()` themselves.
7. **Light-DOM components with custom CSS MUST prefix every class selector with their tag name.** Tailwind utilities are unique by construction, so prefer them.
8. **Non-root layouts and pages MUST NOT** write `<!doctype>` / `<html>` / `<head>` / `<body>`. Only the root layout may.
9. **No backtick characters inside `html\`...\`` template bodies**, even inside CSS / HTML comments. A nested backtick closes the literal at JS-parse time and 500s in prod.
10. **TypeScript must be erasable.** Set `compilerOptions.erasableSyntaxOnly: true`. No `enum`, no value `namespace`, no constructor parameter properties, no legacy decorators with `emitDecoratorMetadata`, no `import = require`. Types are stripped via Node 24+'s `module.stripTypeScriptTypes` (buildless, no bundler fallback); non-erasable syntax 500s at strip time. Enforced by `erasable-typescript-only` (tsconfig flag) and `no-non-erasable-typescript` (source scan). See `agent-docs/typescript.md`.

11. **No em-dashes (U+2014), no hyphen or semicolon used as pause-punctuation in prose, and no colon attached to a code-shaped LHS.** Banned as a pause: U+2014, a space-surrounded hyphen between words, a space-surrounded semicolon between words. Banned colon attachments: a colon-then-prose after `xyz()`, a `<my-tag>`, an `[expr]` subscript, or a `<code>foo()</code>` definition list (rephrase verb-led). Prefer a period, comma, a colon on a plain-noun LHS, parentheses, or a restructure. Plain hyphens stay fine in compound words, flags, filenames, ranges; semicolons and colons stay fine inside code / TS / JSON / CSS. Enforced via `.claude/hooks/block-prose-punctuation.sh`, which scans only NEW content (you can still edit an existing line to remove a glyph).

---

## Scaffolding

Three scaffolds exist (do not invent template names): `webjs create <name>` (full-stack: layout, page, components, modules, Drizzle+SQLite), `webjs create <name> --template api` (backend-only routes + modules + Drizzle, no SSR), `webjs create <name> --template saas` (auth + login/signup + protected dashboard + User model). The `--db sqlite|postgres` flag (default sqlite) picks the dialect; the schema/queries/actions are identical across dialects (see #563). The `--runtime node|bun` flag (default node, #541) is ORTHOGONAL to the template and re-flavors any of the three for Bun (`bun --bun` dev/start scripts so the SERVER runs on Bun, `trustedDependencies`, `bun.lock`, a Bun-serving Dockerfile (node base + copied bun binary, since `webjs db migrate` needs `npx`) + bun-install CI, bun-command agent docs; the test/db/check tooling stays on Node); `bun create webjs <name>` auto-detects it. Pick from the request: default for any product with UI (todo, blog, dashboard, marketplace, social, e-commerce), `api` for an HTTP/JSON API with no UI, `saas` for accounts/login/signup; default to full-stack when ambiguous.

Rules: **always scaffold via `webjs create`** (never hand-roll). **Default to a real database (Drizzle + SQLite); NEVER use JSON files, in-memory arrays, or localStorage for persistence.** Update `db/schema.server.ts` to real models FIRST, then `webjs db generate` + `webjs db migrate`, then build pages/actions/queries. **Treat the scaffold as REFERENCE, not the final product:** replace the example page / `User` model / components and adapt `app/layout.ts` (brand, nav, content width; the default `<main class="max-w-[760px]">` reading column needs widening for a full-bleed app). ENFORCED: examples carry a `webjs-scaffold-placeholder` comment and `no-scaffold-placeholder` fails until the content is replaced and the marker deleted. Docs at https://docs.webjs.com.

---

## CLI reference

```sh
webjs dev    [--port N] [--no-hot] # dev server with live reload (node --watch on Node, bun --hot on Bun). --no-hot runs in-process. Runs webjs.dev.before + webjs.dev.parallel (#550)
webjs start  [--port N]            # prod server; source IS the runtime, plain HTTP/1.1 (reverse-proxy for TLS + HTTP/2). Runs webjs.start.before first (#550)
webjs test   [--server] [--browser] [--watch]
webjs check  [--rules] [--json]    # correctness validator (report-only, no autofix); --json for an agent loop
webjs mcp                          # read-only MCP: routes, actions (RPC hashes), components, check
webjs doctor                       # project-health checklist; non-zero exit on a hard fail
webjs types                        # generate .webjs/routes.d.ts (typed Route union + per-route params, #258)
webjs typecheck [tsc args...]      # the project's own tsc --noEmit
webjs create <name> [--template api|saas]
webjs db <generate|migrate|push|studio|seed>   # wraps drizzle-kit (+ runs db/seed.server.ts)
webjs ui init | add <names...> | list | view <name>
webjs vendor pin|unpin|list|audit|outdated|update [--from PROVIDER]   # importmap pinning, .webjs/vendor/importmap.json
```

`--from PROVIDER` accepts `jspm` (default), `jsdelivr`, `unpkg`, `skypack` and is persisted in the pin file. `PORT` is honoured when `--port` is absent; `webjs dev` emits `routes.d.ts` automatically. Running this repo's own apps (`website/`, `docs/`, `examples/blog/`, `packages/ui/packages/website/`): `cd` in and use **its** `npm run dev` / `npm start`; as of #550 a bare `webjs dev` / `webjs start` is equivalent (the per-app orchestration moved into the `webjs.dev` / `webjs.start` tasks config, which the primitive runs), so the npm scripts are now just thin aliases.

---

## Environment, server config, caching, observability

- **Env vars.** `process.env.X` reads are server-only; `WEBJS_PUBLIC_`-prefixed names are exposed in the browser via an inline `<script>` (no build); `NODE_ENV` is defined both sides. See `agent-docs/built-ins.md`.
- **The `package.json` `"webjs"` block.** Security headers (on by default, per-path `webjs.headers` overrides), CSP (opt-in nonce, `webjs.csp`), declarative `webjs.redirects` (#254), `webjs.trailingSlash` (#255), `webjs.basePath` (#256), ingress caps (`maxBodyBytes` / `maxMultipartBytes` / server timeouts), and dev/start task orchestration (`webjs.dev.before` / `webjs.dev.parallel` / `webjs.start.before`, #550, the orchestration `webjs dev`/`start` run so they match `npm run dev`/`start`). Type it with `WebjsConfig` + the JSON Schema. See `agent-docs/configuration.md`.
- **Caching + file storage** (`agent-docs/built-ins.md`). HTTP `Cache-Control`, the `cache()` query helper + `revalidateTag`, the server HTML response cache (`export const revalidate` + `revalidatePath`, #241), content-hash asset URLs (`?v=`, #243), conditional GET (ETag, #240), and `FileStore` + `diskStore` (streaming, traversal-safe, signed URLs, S3-pluggable, #247).
- **Observability** (`agent-docs/configuration.md`). Access log, `requestId()` + `X-Request-Id`, the `onError` APM hook, `GET /__webjs/version` (#239).

---

## CONVENTIONS.md and webjs check: two surfaces, split by nature

Every app ships a root `CONVENTIONS.md`; AI agents MUST read it before writing code. It is the source of truth for **project conventions** (modules layout, action placement, one-function-per-file, testing, styling, git workflow), which are guidance a reasonable project could do differently, customizable directly in the prose (`<!-- OVERRIDE -->` sections), not tool-enforced.

**`webjs check` is a separate, narrower tool: correctness checks only.** Every rule catches code that is wrong to ship (a crash, a security leak, a build/type-strip failure), plus the sentinel `no-scaffold-placeholder` (unreplaced scaffold content). They run unconditionally with no per-project disabling. The dividing line: could a sensible app legitimately want this to pass? If yes it is a convention (prose), if no it is a check (the tool). `webjs check --rules` lists them.

So: read `CONVENTIONS.md` and follow it by judgment; run `webjs check` and fix every violation (correctness bugs, not style); change a convention by editing the prose.

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
import { eq } from 'drizzle-orm';
import { db } from '../../../db/connection.server.ts';
import { users } from '../../../db/schema.server.ts';
export async function updateProfile(input: { name: string }) {
  const name = String(input?.name || '').trim();
  if (!name) return { success: false, error: 'name required', status: 400 };
  const [row] = await db.update(users).set({ name }).where(eq(users.id, me.id)).returning();
  return { success: true, data: row };
}
```

Call it from a client component via a normal import (rewritten to an RPC stub). A component is one custom element per file (`class X extends WebComponent { render() { return html\`…\`; } }` then `X.register('x-tag')`). Full recipes, including the no-JS page-action form, are in `agent-docs/recipes.md`.

---

## Deliberately deferred

Not in v1. Do not implement as part of other tasks:

- **Bundling and per-route code splitting.** webjs is **no-build** (the Rails 7 + importmap model); prod perf comes from HTTP/2 multiplex + `<link rel="modulepreload">` hints, not concatenation. **Do not propose a bundler or `webjs build`.**
- **Vite-grade HMR with state preservation.** Custom elements only `define` once, so full reload is necessary; data reloads are near-instant via `fs.watch` to SSE.
- **React Server Components Flight.** Server actions + `Suspense` streaming cover the need.
- **Edge-runtime bundling / full portability** (deployment guidance lives in the docs site at `/docs/deployment`), **i18n, image optimization** (layer libraries on top).
