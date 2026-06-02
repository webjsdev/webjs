# webjs

**AI-first. Web components first.**

Full-stack web framework built on top of Web Components. `cache()` for
queries, HTTP Cache-Control for pages, Session class with SessionStorage,
NextAuth-style auth with providers, WebSocket broadcast, rate limiting.
Swap the in-memory cache store for Redis with a single `setStore()` call
(no config files, no build step in between). Web components first,
TypeScript with zero build step, real SSR with Declarative Shadow DOM.

## Why webjs

- **AI-first.** Predictable file conventions, one function per file, an explicit `.server.ts` boundary, and an `AGENTS.md` contract. The whole design lets LLMs modify code without loading the entire codebase into context.
- **No build step you run.** `.ts` files served directly. Node 24+ is the minimum runtime, and the dev server strips types via Node's built-in `module.stripTypeScriptTypes` (position-preserving, no sourcemap, near-zero overhead). TypeScript must be erasable. Non-erasable constructs (enums, value-carrying namespaces, constructor parameter properties, legacy decorators with `emitDecoratorMetadata`) fail at strip time with a 500 pointing at the `no-non-erasable-typescript` lint rule, since webjs is buildless end-to-end with no bundler fallback. Edit, refresh, done.
- **Web components, light DOM by default.** Pages and components render as light DOM so global CSS and Tailwind utilities apply directly: no `::part`, no `:host`, no CSS-var plumbing. Shadow DOM is opt-in (`static shadow = true`) when you need scoped styles or third-party-embed isolation. `<slot>` projection (named slots, fallback content, `assignedNodes` / `slotchange`) works identically in both modes. Both modes SSR fully, no hydration runtime.
- **Progressive enhancement, built in.** Pages *and* components are SSR'd to real HTML. Every web component's `render()` runs on the server, so its initial markup is in the response before any script loads. Content reads, links navigate, forms submit (server actions are plain HTML POSTs), and display-only custom elements look right, all without JavaScript. JS is opt-in *per interactive behavior*, not per component: a counter renders as "0" without JS, and only the +/- click handling needs scripts. The HTML is the floor, and the client router and `@click` / signal interactivity are layered on top.
- **Tailwind CSS by default.** The scaffold ships with the Tailwind browser runtime + `@theme` design tokens. Prefer hand-written CSS? Opt out entirely, and the framework works just as well with vanilla CSS when you follow the wrapper-scoping convention (`.page-<route>`, `.layout-<name>`, component-tag scoped). Full recipe in the [Styling docs](./docs/app/docs/styling/page.ts).
- **Full-stack type safety.** Import a `.server.ts` function from a component, and TypeScript sees the real signature. webjs's built-in ESM serializer on the wire preserves `Date`, `Map`, `Set`, `BigInt`, `TypedArray`, `Blob`, `File`, `FormData`, and reference cycles.
- **Server-file source is unreachable from the browser.** Framework invariant: any file ending `.server.{js,ts}` is source-protected. With `'use server'` it serves an RPC stub (server action); without, a throw-at-load stub (server-only utility). Either way the real source never reaches the browser. Enforced in the HTTP layer with regression tests.
- **NextJs-style routing.** `page.ts`, `layout.ts`, `route.ts`, `error.ts`, `middleware.ts`, `[params]`, `(groups)`, `_private`. Layouts persist across navigations.
- **Client router.** Turbo-Drive-style link interception. Shadow-DOM-aware via `composedPath()`. Layouts stay mounted, only page content swaps. No white flash.
- **WebSockets built in.** Export `WS` from `route.ts` → WebSocket endpoint. `connectWS()` on the client auto-reconnects.
- **Backend-only mode.** Skip pages entirely and use webjs as a lightweight API framework with file routing, middleware, rate limiting, and TypeScript.
- **Built-in essentials.** Auth, sessions, caching, WebSocket broadcast, and rate limiting are all built in, sharing one pluggable cache store. In-memory by default. Call `setStore(redisStore({ url: process.env.REDIS_URL }))` once at startup to put all four on Redis for horizontal scaling.
- **Lazy loading.** `static lazy = true` defers module download until the component scrolls into the viewport. SSR content stays visible. Only the JS is lazy.
- **Error boundaries & loading states.** `error.ts` catches render failures at any route level. `loading.ts` auto-wraps pages in Suspense boundaries.
- **Metadata routes.** `sitemap.ts`, `robots.ts`, `manifest.ts`, `icon.ts`, `opengraph-image.ts`: dynamic SEO/PWA metadata from functions, not static files.
- **`expose()` for REST.** Tag a server action with `expose('POST /api/posts', fn)` to make it reachable over HTTP and via RPC. Optional input validation.
- **Production ready.** CSRF, gzip/brotli, HTTP/2, 103 Early Hints, CSP nonces, modulepreload, rate limiting, health probes, graceful shutdown, streaming Suspense.
- **AI-first component library: Webjs UI.** 32 primitives at [ui.webjs.dev](https://ui.webjs.dev), written for AI agents. Two-tier composition: pure class-helper functions (`buttonClass`, `cardClass`, `inputClass`) for visual primitives, plus a small set of stateful custom elements (`<ui-dialog>`, `<ui-tabs>`, `<ui-popover>`) where state matters. `webjs ui add button card dialog` copies source into your project, and you own it and edit it. Auto-installed with `@webjsdev/cli`. Non-webjs users: `npx webjsui add button card dialog`.

## Quickstart

> **AI agents, read this before scaffolding.** Only three templates exist
> (`full-stack` default, `--template api`, `--template saas`), and the CLI
> rejects anything else. Always start from one of them. Never hand-roll
> the directory structure. Default to **full-stack with Prisma + SQLite**.
> Never store app data in JSON files, in-memory arrays, or localStorage
> as a substitute for the database. The scaffold is **reference only**.
> Replace the example layout, page, components, and `User` model with
> the app the user actually asked for. Picker:
>
> - Any product UI (todo, blog, notes, dashboard, marketplace, social, e-commerce…) → **default** (`webjs create <name>`)
> - Backend-only HTTP/JSON API, no UI → **`--template api`**
> - Auth, login/signup, protected dashboard, SaaS → **`--template saas`**
>
> Full rules: [`AGENTS.md` → How AI agents must scaffold](./AGENTS.md#how-ai-agents-must-scaffold).
> Full framework docs (every API, every recipe): **https://docs.webjs.com**.

```sh
# Get started in one command (no global install required)
npm create webjs@latest my-app   # full-stack (pages + API + components + Prisma/SQLite)
cd my-app && npm run dev
# → http://localhost:8080

# Backend-only API
npm create webjs@latest my-api  -- --template api

# SaaS starter (auth + dashboard + Prisma)
npm create webjs@latest my-saas -- --template saas

# Or with the CLI installed globally for repeated use.
# `webjsdev` is the unscoped npm name for @webjsdev/cli; both install the `webjs` command.
npm i -g webjsdev && webjs create my-app
cd my-app && npm run dev

# or run everything in the monorepo (website + docs + blog + UI registry together)
git clone https://github.com/webjsdev/webjs
cd webjs && npm install
cd examples/blog && npx prisma migrate dev --name init && cd ..
npm run dev
# → Website     → http://localhost:5001
# → Docs        → http://localhost:5002
# → UI registry → http://localhost:5003
# → Blog        → http://localhost:5004
```

See [Local development](#local-development) for running one app at a time and overriding ports.

## Repo layout

```
packages/
  # Framework (the things webjs ships at runtime)
  core/             # @webjsdev/core: html, css, WebComponent, renderers, client router
  server/           # @webjsdev/server: dev/prod server, router, SSR, actions, WS
  cli/              # @webjsdev/cli: webjs dev/start/create/db/test/check/ui
  ts-plugin/        # @webjsdev/ts-plugin: editor intelligence (ts-lit-plugin + webjs-aware bits)
  ui/               # @webjsdev/ui: AI-first component library + CLI

  # Scaffold entry points (peer wrappers around @webjsdev/cli)
  create-webjs/ # `npx create-webjs@latest my-app` (mirrors create-next-app)
  webjsdev/         # unscoped npm name for @webjsdev/cli (so `npm i -g webjsdev` works without a scope)
examples/
  blog/             # full-featured reference app (auth, posts, comments, chat)
docs/               # documentation site (built on webjs itself)
website/            # landing site (built on webjs itself)
AGENTS.md           # AI-agent contract for the framework
CLAUDE.md           # Claude Code quick-reference
```

## Local development

Contributing to the framework itself? Run the monorepo's apps with
`npm run dev` (never `webjs dev` directly: each app's `npm run dev`
also spawns its Tailwind watcher, and the blog and UI site run extra
prep steps via `predev` hooks).

```sh
npm install                          # once, from the repo root (installs every workspace)
npm run dev                          # all four apps at once
```

Default ports (a contiguous 5001-5004 block; port 5000 is skipped
because macOS reserves it for the AirPlay Receiver / Control Center):

| App | Dir | Port | Env override |
|---|---|---|---|
| Landing site | `website/` | 5001 | `WEBSITE_PORT` |
| Docs | `docs/` | 5002 | `DOCS_PORT` |
| UI registry site | `packages/ui/packages/website/` | 5003 | `UI_PORT` |
| Example blog | `examples/blog/` | 5004 | `BLOG_PORT` |

**Run a single app** (from its directory). Each honors a `PORT` env var:

```sh
cd docs && npm run dev               # docs on 5002
PORT=8080 npm run dev                # ...or on 8080
```

**Override ports when running all four** via the per-app env vars:

```sh
WEBSITE_PORT=8001 DOCS_PORT=8002 UI_PORT=8003 BLOG_PORT=8004 npm run dev
```

> Use the `PORT` / `*_PORT` env vars, **not** a `--port` flag. `npm run dev
> --port 5678` does not work: npm parses `--port` as its own (deprecated)
> config, and the `dev` script runs each app through `concurrently`, which
> would intercept any passthrough args before they reached `webjs dev`. The
> env var is the supported interface (and the conventional one: Railway,
> Heroku, Fly, etc. all drive port via `PORT`).

The apps cross-link by URL (the landing site links to docs/blog/UI,
the UI site links back). Those default to the localhost ports above and
are overridable via `DOCS_URL` / `BLOG_URL` / `UI_URL` / `WEBSITE_URL`
(this is also how deploys point them at real domains).

## Example

```ts
// app/page.ts: server-rendered, async data fetching
import { html, repeat } from '@webjsdev/core';
import '../components/counter.ts';
import { listPosts } from '../modules/posts/queries/list-posts.server.ts';

export const metadata = { title: 'home' };

export default async function Home() {
  const posts = await listPosts();
  return html`
    <h1>posts</h1>
    <ul>
      ${repeat(posts, p => p.id, p => html`<li>${p.title}</li>`)}
    </ul>
    <my-counter count="3"></my-counter>
  `;
}
```

```ts
// components/counter.ts: interactive web component, light DOM + Tailwind
import { WebComponent, html, signal } from '@webjsdev/core';

export class Counter extends WebComponent {
  // Light DOM is the default, so Tailwind utility classes apply directly.
  // Instance signal carries component-local state; the built-in
  // SignalWatcher re-renders when .get() reads change.
  count = signal(0);

  render() {
    return html`
      <div class="inline-flex items-center gap-2 font-mono">
        <button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=${() => this.count.set(this.count.get() - 1)}>−</button>
        <output class="min-w-[2ch] text-center">${this.count.get()}</output>
        <button class="px-3 py-1 rounded border border-border hover:bg-bg-elev" @click=${() => this.count.set(this.count.get() + 1)}>+</button>
      </div>
    `;
  }
}
Counter.register('my-counter');
```

Need scoped styles or embed-ready isolation? Opt in to shadow DOM with
`static shadow = true` and author styles via `static styles = css\`…\``.
`<slot>` projection works in both modes (light DOM uses framework
projection, same API).

```ts
// modules/posts/queries/list-posts.server.ts: one function per file
'use server';
import { prisma } from '../../../lib/prisma.server.ts';

export async function listPosts() {
  return prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
}
```

## Production

No build step. The same source files that ran in `webjs dev` also run in
production, served as native ES modules via importmap, with
`<link rel="modulepreload">` hints emitted at SSR time so the browser
fetches the page's modules in parallel over a single HTTP/2 connection.
Same model as Rails 7+ with `importmap-rails`.

```sh
npm run start --port 8080                          # JSON logs, gzip/brotli, ETag, streaming
```

The production server speaks plain HTTP/1.1. The expected production topology
is a reverse proxy in front that terminates TLS and speaks HTTP/2 to
the browser. **PaaS edges already do this for free.** Railway, Fly,
Render, Vercel, Cloudflare Pages, and Heroku all serve HTTP/2
to clients while proxying HTTP/1.1 to your container. For bare-VM or
self-hosted deploys, put nginx, Caddy, or Traefik in front. HTTP/2 at
the edge matters because webjs's per-file ESM model benefits from
HTTP/2 multiplex. HTTP/1.1-only deployments still work, just slower
on cold cache.

Health: `GET /__webjs/health`. Graceful shutdown on `SIGTERM`.

Embed in Express/Fastify/Bun/Deno:

```ts
import { createRequestHandler } from '@webjsdev/server';
const app = await createRequestHandler({ appDir: process.cwd() });
const resp = await app.handle(new Request('http://x/api/hello'));
```

## Documentation

The docs site is built on webjs itself:

```sh
cd docs && npm run dev    # runs webjs dev + tailwind --watch together (see AGENTS.md)
```

37 pages covering: getting started, AI-first development, routing,
components, SSR, styling, Suspense, loading states, error handling,
client router, server actions, expose() REST endpoints, API routes,
WebSockets, database, authentication, TypeScript, middleware,
rate limiting, lazy loading, metadata routes, caching, sessions,
controllers, context protocol, task, deployment, backend-only mode,
testing, conventions, configuration, editor setup.

## Status

Pre-1.0. Current packages: `@webjsdev/core` 0.7.1, `@webjsdev/server` 0.7.2, `@webjsdev/cli` 0.8.1, `@webjsdev/ui` 0.3.1. 1151 unit tests, 271 browser tests (web-test-runner), 61 puppeteer e2e tests (56 framework + 5 example-blog smoke). Key features:

- **Core:** Signals (`signal`, `computed`, `effect`, `batch`, TC39 Stage 1 shape) as the default state primitive, with WebComponent's built-in SignalWatcher auto-tracking `.get()` reads inside `render()`. Reactive properties via `static properties` reserved for HTML attribute round-trip (`declare`-pattern enforced via the `reactive-props-use-declare` rule). Full lit-API parity: ReactiveController hooks (`hostConnected`, `hostDisconnected`, `hostUpdate`, `hostUpdated`) and lifecycle (`shouldUpdate`, `willUpdate`, `update`, `updated`, `firstUpdated`, `updateComplete`), 12 directives (`repeat`, `unsafeHTML`, `live`, `keyed`, `guard`, `templateContent`, `ref` + `createRef`, `cache`, `until`, `asyncAppend`, `asyncReplace`, `watch`). SSR with DSD (opt-in) + light-DOM hydration (default), light-DOM `<slot>` projection (framework-driven, same API as shadow DOM), fine-grained client renderer, `Suspense()`, client router with `composedPath()` for shadow DOM, mixed-attribute interpolation, MutationObserver upgrade safety net.
- **Data:** Server actions with webjs's built-in serializer (`Date`, `Map`, `Set`, `BigInt`, `TypedArray`, `Blob`, `File`, `FormData`, reference cycles all survive the wire). Two-marker server-file convention: `.server.{js,ts}` for path-level source-protection (browser imports get a throw-at-load stub), `'use server'` for RPC registration (file is also browser-callable). `expose()` for REST with optional `validate` hook. `json()` + `richFetch()` for content-negotiated APIs. `cache()` for server-side query caching with TTL + `invalidate()`. `WEBJS_PUBLIC_*` env vars injected into `window.process.env` at SSR (no build step, no transform).
- **Server:** File router with `page.ts`, `layout.ts`, `route.ts`, `error.ts`, `loading.ts`, `not-found.ts`, `middleware.ts`, metadata routes (`sitemap`, `robots`, `manifest`, `icon`, `opengraph-image`), per-segment middleware, `rateLimit()`, WebSockets (`WS` export + `connectWS()` + `broadcast()`), CSRF, gzip / brotli compression, HTTP/2, 103 Early Hints, modulepreload hints, health probes, graceful shutdown on `SIGTERM`, `Session` class with `SessionStorage` (cookie or store-backed), NextAuth-style `createAuth()` (Credentials, Google, GitHub), single pluggable cache store (in-memory by default, swap to Redis with one `setStore()` call shared by auth, sessions, caching, and rate limiting).
- **DX:** Node 24+ minimum runtime, with the dev server stripping TypeScript via Node's built-in `module.stripTypeScriptTypes` (zero build, position-preserving, no sourcemap). Non-erasable TS (enums, value-carrying namespaces, constructor parameter properties, legacy decorators) fails with a 500 pointing at the `no-non-erasable-typescript` lint rule. webjs is buildless end-to-end and has no bundler fallback. Vendor (`node_modules`) packages resolve through importmap to jspm.io URLs at runtime; the webjs server doesn't bundle them. `webjs vendor pin` writes resolved URLs to `.webjs/vendor/importmap.json` for deterministic deploys; `webjs vendor pin --download` additionally vendors bundle bytes for offline-capable production. `webjs check` lint covers `use-server-needs-extension`, `no-server-env-in-components`, `reactive-props-use-declare`, `erasable-typescript-only`, `no-non-erasable-typescript`, `shell-in-non-root-layout`, and more (run `webjs check --rules` to enumerate). `AGENTS.md` contract + `CLAUDE.md` + per-tool agent configs (`.cursorrules`, `.agents/rules/workflow.md` for Antigravity, `.github/copilot-instructions.md`, `.claude/settings.json` PreToolUse hook guarding edits on `main`). Live reload in dev (chokidar + SSE). `@webjsdev/ts-plugin` editor-only piece bundles `ts-lit-plugin` and layers webjs-aware intelligence on top: type-checked `` html`…` `` templates, custom-element go-to-definition, attribute auto-complete from `static properties`, silenced "Unknown tag" diagnostics for `Class.register('tag-name')` elements, all gated by the file's import graph. Not required for the framework to run.
- **Release:** Per-package per-version changelog under `changelog/<pkg>/<version>.md`, auto-generated on the same commit that bumps a `package.json` `version` field (universal pre-commit hook). The `.github/workflows/release.yml` workflow watches for new changelog files on `main` and dual-publishes to npm (`npm publish --workspace=@webjsdev/<pkg>`) and GitHub Releases (`gh release create <pkg>@<version>`), both idempotent so re-runs pick up where they left off. Free for public repos via `NPM_TOKEN` + the auto-provisioned `GITHUB_TOKEN`.

## License

MIT
