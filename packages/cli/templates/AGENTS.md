# AGENTS.md for {{APP_NAME}}

Read this before editing any file. This is a webjs app: AI-first, web-
components-first, no build step. The framework's own full API reference
lives at https://github.com/webjsdev/webjs/blob/main/AGENTS.md and the
full hosted documentation (every API, recipe, and example) lives at
**https://docs.webjs.com**. Treat this file as the app-scoped
companion and reach for docs.webjs.com whenever you need more detail.

## If you just scaffolded this app (AI agents, read first)

This project was created with `webjs create`. The files you see right
now (`app/page.ts` printing "Hello from {{APP_NAME}}", the example `User`
model in `db/schema.server.ts`, the `theme-toggle` component, the
example users module in api/saas templates) are **starting-point
references, not the final product**. Your job is to replace them with
the app the user actually asked for. That includes adapting
`app/layout.ts`, not just the page. Set the real brand, replace the
example `Home` nav, and pick a content-width container that fits. The
default `<main class="max-w-[760px]">` is a reading column for prose and
forms, so for a full-bleed app, dashboard, or board, widen the cap or
remove it (keep the theme tokens). A wide layout left in the 760px
reading column overflows into a horizontal scrollbar. This is ENFORCED:
the example `app/page.ts` and `app/layout.ts` carry a
`webjs-scaffold-placeholder` marker comment, and `webjs check` fails
while any marker remains, so this freshly scaffolded app fails the check
until you replace the example content (or deliberately keep it) and
delete the marker line. The delivered app must contain only what the
user asked for, never leftover scaffold code.

**Non-negotiables for every webjs app:**

1. **Use Drizzle + SQLite for persistence.** It's already wired up
   (`db/schema.server.ts`, `db/connection.server.ts`, `npm run db:generate`
   + `npm run db:migrate`). For any data the app stores (todos, posts,
   messages, products, comments, anything), define a Drizzle table and
   persist there.
   - **NEVER** store app data in JSON files (`data/todos.json`,
     `db.json`, …). It resets on reload and cannot scale. This is a project convention,
     and the user's prompt explicitly forbids it.
   - **NEVER** use in-memory arrays or `Map`s as a substitute for the
     database. They vanish on every dev-server reload and aren't
     shared across processes.
   - **NEVER** use `localStorage` to persist app data. It's per-browser
     and doesn't reach the server.
2. **One of three scaffolds only.** The CLI exposes exactly three:
   `full-stack` (default), `--template api`, `--template saas`. Don't
   reach for a `--template blog` / `--template todo` / `--template
   ecommerce`. They don't exist and the CLI will reject them.
3. **First step after scaffolding:** edit `db/schema.server.ts` to the
   app's real domain models (delete the example `User` model unless the
   app actually needs users), run `webjs db generate` then
   `webjs db migrate`, then build pages / actions / queries against them.

**Picking the right scaffold from the user's prompt** (you do this BEFORE
running `webjs create`; if you're reading this you've already scaffolded.
Verify the choice was correct, otherwise re-scaffold in a fresh dir):

| User asks for… | Scaffold |
|---|---|
| Todo app, blog, notes, dashboard, marketplace, social feed, e-commerce, any product with a UI | `webjs create <name>` (default full-stack) |
| HTTP/JSON API only, no UI | `webjs create <name> --template api` |
| Anything with login / signup / accounts / protected pages / SaaS | `webjs create <name> --template saas` |

When in doubt, **full-stack is the default**. Pick `api` only if the user
is explicit about wanting a backend-only API. Pick `saas` only if the user
is explicit about auth / accounts / SaaS.

## Framework source is in `node_modules/`

No build step, no bundler, no minification. What you read is what
runs. When in doubt, grep the framework:

```
node_modules/@webjsdev/
  core/            renderer, WebComponent, directives, client router,
                    Task, context, testing helpers
    src/component.js          ← lifecycle, properties, light vs shadow DOM
    src/render-client.js      ← client-side DOM patching + hydration
    src/render-server.js      ← renderToString / renderToStream
    src/router-client.js      ← Turbo-Drive-style client navigation
    src/directives.js         ← unsafeHTML, live
    src/context.js            ← Context Protocol
    src/task.js               ← async data with states
  server/          dev + prod server, SSR, file router, actions,
                    auth, sessions, cache, rate-limit, WebSocket
    src/ssr.js                ← how metadata becomes <head> tags
    src/router.js             ← file convention → route table
    src/actions.js            ← .server.ts scanner, RPC stubs, action endpoint
    src/action-route.js       ← route() adapter (action over REST via route.ts)
    src/auth.js, session.js, cache.js, rate-limit.js, csrf.js
  cli/             webjs CLI (dev / start / build / test / check / create / db)
  intellisense/    tsserver plugin: go-to-definition + diagnostic suppression
                   + attribute auto-complete for Class.register('tag') elements
```

Reaching straight for the source is the fastest way to resolve "why
doesn't X work?" with no documentation guesswork and no stale blog posts.

## Use the webjs MCP server (introspection + framework knowledge)

This project ships a **read-only Model Context Protocol server** that gives
you (the AI agent) live, version-accurate facts about THIS app and the
framework. Prefer it over guessing or recalling webjs from training data,
which drifts. It mutates nothing.

**It is already available, no install needed:** the webjs CLI (a project
dependency) has it built in as `webjs mcp`. It is an MCP STDIO server (JSON-RPC
over stdout), so you do not run it in a terminal and read its output. Your MCP
host (Claude Code, Cursor, etc.) launches it and surfaces its tools, then you
invoke those tools through the MCP protocol.

Claude Code is pre-wired (see `.claude.json`). For another host, register the
server by pointing it at the CLI (or the equivalent standalone package):

```jsonc
// Cursor: .cursor/mcp.json   (or your host's MCP config)
{ "mcpServers": { "webjs": {
  "command": "npx", "args": ["@webjsdev/cli", "mcp"]   // the built-in CLI route
  // equivalent: "command": "npx", "args": ["@webjsdev/mcp"]
} } }
```

What it serves:

- **Introspection of this app** (read-only, no module load, no DB side
  effects): `list_routes` (the route table), `list_actions` (server actions
  with their `/__webjs/action/<hash>/<fn>` RPC endpoints), `list_components`
  (registered custom-element tags), `check` (the structured `webjs check`
  violations). Use these to learn the real route/action/component surface
  before editing, instead of grepping or assuming.
- **Framework knowledge**: an `init` primer (the read-first mental model +
  invariants), a `docs` tool (retrieve a topic or search the `agent-docs`
  corpus), MCP `resources` (the docs corpus + this AGENTS.md), recipe
  `prompts` (guided page/route/action/component workflows), and a `source`
  tool that reads the framework's OWN no-build source from
  `node_modules/@webjsdev/*/src` (what actually runs).

You have TWO complementary ways to understand the framework, use whichever
helps (or both): (1) **grep the full framework source** under
`node_modules/@webjsdev/*/src`, which is the real no-build code that runs (no
sourcemaps, no guessing), and (2) **the MCP** for live app introspection plus
the curated `init` / `docs` / `source` knowledge tools. Reach for either before
guessing from training data or asking the user.

## Editor TS plugin: `@webjsdev/intellisense`

This scaffold's `tsconfig.json` lists a single tsserver plugin. It is
editor-only, not required for the framework to run.

```jsonc
// tsconfig.json (already wired by the scaffold)
"plugins": [
  { "name": "@webjsdev/intellisense" }
]
```

`@webjsdev/intellisense` is **standalone** (no Lit dependency): one plugin
entry, its own template parser. Inside `` html`…` `` templates you get:

- Go-to-definition on custom-element tags, attribute / property / event
  names, and CSS classes in `class="…"`.
- Binding-aware completions: reachable tag names after `<`, and
  prefix-keyed attributes (`.prop` property names, `?bool` / plain
  hyphenated attribute names).
- Diagnostics: value type-checks against `declare propName: T`, unquoted
  `@`/`.`/`?` bindings, and expressionless `.prop` bindings.
- Hover showing the component class / declared member type.

In VS Code / Cursor / Windsurf, the **`webjs` extension** bundles this
automatically (no `tsconfig.json` edit, no separate Lit extension).

See [docs.webjs.com → Editor setup](https://docs.webjs.com/docs/editor-setup)
for the full walkthrough.

**Config validation in `package.json`.** The scaffold ships
`.vscode/settings.json`, which associates the published webjs-config JSON
Schema (`@webjsdev/server/webjs-config.schema.json`) with the `webjs` block
of `package.json`. In VS Code an unknown / typo'd `webjs.*` key (`redirect`
for `redirects`, say) is then flagged inline instead of silently dropped to
the default. The same shape is typed by the `WebjsConfig` type from
`@webjsdev/core` (`import type { WebjsConfig } from '@webjsdev/core'`) for a
typed reference.

## UI components: Webjs UI (preinstalled)

This scaffold ships with the standard Webjs UI component kit
**already installed at `components/ui/`**. The kit is **AI-first** and
splits into two tiers. Internalise the split. Picking the wrong tier
produces broken markup.

### Tier 1: class-helper functions (the majority)

Pure functions that return Tailwind class strings. You apply them to
**raw native HTML elements** that you write yourself. Examples:
`button`, `card`, `input`, `label`, `alert`, `badge`, `separator`,
`skeleton`, `kbd`, `table`, `breadcrumb`, `pagination`, `native-select`,
`avatar`, `checkbox`, `switch`, `radio-group`, `textarea`, `toggle`,
`aspect-ratio`.

```ts
import {
  cardClass, cardHeaderClass, cardTitleClass,
  cardContentClass, cardFooterClass,
} from '#components/ui/card.ts';
import { inputClass } from '#components/ui/input.ts';
import { labelClass } from '#components/ui/label.ts';
import { buttonClass } from '#components/ui/button.ts';

return html`
  <div class=${cardClass()}>
    <div class=${cardHeaderClass()}>
      <h3 class=${cardTitleClass()}>Profile</h3>
    </div>
    <div class=${cardContentClass()}>
      <label class=${labelClass()} for="name">Name</label>
      <input class=${inputClass()} id="name" name="name">
    </div>
    <div class=${cardFooterClass()}>
      <button class=${buttonClass()}>Save</button>
    </div>
  </div>
`;
```

Helpers with variants take an options object:
`buttonClass({ variant: 'outline', size: 'sm' })`.

### Tier 2: stateful custom elements

For things the browser doesn't provide natively (focus traps, portaled
overlays, keyboard-navigated lists): `dialog`, `alert-dialog`, `popover`,
`tooltip`, `hover-card`, `tabs`, `accordion`, `collapsible`,
`dropdown-menu`, `progress`, `sonner`, `toggle-group`. These ARE custom
elements. Import them once (typically in `app/layout.ts`) and use
`<ui-X>` tags:

```ts
// app/layout.ts (registers the custom elements for every page)
import '#components/ui/dialog.ts';
import '#components/ui/tabs.ts';
```

```ts
// app/some-page/page.ts (uses the registered elements)
import { buttonClass } from '#components/ui/button.ts';

return html`
  <ui-dialog>
    <ui-dialog-trigger>
      <button class=${buttonClass({ variant: 'outline' })}>Edit</button>
    </ui-dialog-trigger>
    <ui-dialog-content>
      <h2>Edit profile</h2>
      ...
    </ui-dialog-content>
  </ui-dialog>
`;
```

### Adding more components

```sh
webjs ui add dialog dropdown-menu tabs progress
```

Each `webjs ui add` call fetches the component source from
`https://ui.webjs.dev/registry/<name>.json`, copies it into
`components/ui/`, and installs any required npm deps. Run
`webjs ui list` to browse the catalogue or visit
[https://ui.webjs.dev](https://ui.webjs.dev).

### AI agents, picking the right tier

For forms, dashboards, settings pages, marketing layouts: **call the
Tier-1 class helpers on raw native elements**. You get accessibility,
visual consistency, and form submission semantics for free.
`<input class=${inputClass()}>` is a real `<input>` with native
autofill, browser validation, and `<form>` submission unchanged.

Because Tier-1 helpers wrap *real* HTML elements, a `buttonClass()`
button inside a `<form action="/posts" method="post">` participates
in the client router's partial-swap submission automatically. No JS
handler, no `fetch`. See *Client navigation patterns* below for the
full form-submission + 4xx-HTML-render-in-place pattern.

For modals, dropdowns, tooltips, tab strips, accordions: use the
Tier-2 `<ui-X>` custom element tags after importing the corresponding
module.

The composition style is deliberately **not** shadcn's
component-everything React API. We use native elements + class helpers
for the visual stuff because hiding a `<button>` inside a `<Button>`
wrapper adds zero value and obscures the real element from inspection,
form submission, and screen readers. Custom elements are reserved for
behavior the browser can't deliver natively.

## File conventions

```
app/                     thin route adapters (import from modules/)
  page.ts                → /
  layout.ts              root layout, wraps every page
  error.ts               error boundary (render failures → user-friendly)
  loading.ts             Suspense fallback for sibling page
  not-found.ts           custom 404 page
  middleware.ts          global request middleware
  [slug]/page.ts         dynamic route segment
  [...rest]/page.ts      catch-all
  (group)/               route group (parens not in URL)
  _private/              underscore = not routable
  api/
    <path>/route.ts      GET / POST / PUT / DELETE / WS handlers
  sitemap.ts             metadata route → /sitemap.xml
  robots.ts              metadata route → /robots.txt
  opengraph-image.ts     metadata route → /opengraph-image
components/              web components (extend WebComponent, call .register())
modules/<feature>/
  actions/*.server.ts    server actions (one function per file)
  queries/*.server.ts    data reads (one function per file)
  components/*.ts        feature-scoped components
  utils/*.ts             feature-scoped helpers
  types.ts               feature types
lib/
  ...                    cross-cutting infra (session, auth config, etc.)
db/
  schema.server.ts       Drizzle models + relations (your data layer)
  columns.server.ts      column helpers (dialect-specific; the only file to swap for Postgres)
  connection.server.ts   opens the driver, exports the \`db\` singleton (import \`db\` from here)
  seed.server.ts         optional seed (run via \`webjs db seed\`)
  dev.db                 SQLite file (gitignored); run \`npm run db:migrate\` to create
  migrations/            generated migration SQL (committed)
drizzle.config.ts        drizzle-kit config (root; SQLite by default, --db postgres to switch)
public/                  static assets, served at /public/*
test/<feature>/                feature-scoped tests, one folder per concern
  <name>.test.ts                node unit / integration test (node --test)
  browser/<name>.test.js        real-browser test (web-test-runner)
  e2e/<name>.test.ts            end-to-end test (full app boot, opt in via WEBJS_E2E=1)
  smoke/<name>.test.ts          fast post-deploy sanity check
middleware.ts            root middleware (optional, outermost)
```

### Typed page / layout / route-handler props

Type page / layout / route-handler arguments with the exported helpers so a
param typo is a compile-time error:

```ts
import type { PageProps, LayoutProps, RouteHandlerContext } from '@webjsdev/core';

export default function Post({ params }: PageProps<'/blog/[slug]'>) {
  return html`<h1>${params.slug}</h1>`;   // params typed { slug: string }
}
export default function RootLayout({ children }: LayoutProps) { /* ... */ }
export async function GET(req: Request, ctx: RouteHandlerContext) { /* ctx.params */ }
```

Run `webjs types` once (and ensure `tsconfig.json` `include` lists
`.webjs/routes.d.ts`, the scaffold already does) to generate the route union:
`PageProps<'/blog/[slug]'>['params']` then narrows to `{ slug: string }` and
`navigate()` only accepts real app routes. `webjs dev` regenerates the file on
startup, so it stays current. Without it, `params` is `Record<string, string>`
and `navigate()` accepts any string (non-breaking).

## Database (Drizzle + SQLite by default)

Every scaffold includes a Drizzle setup pointed at a local SQLite file,
under a `db/` folder (`schema.server.ts`, `columns.server.ts`,
`connection.server.ts`). Drizzle has no codegen and no engine binary.
First-run workflow:

```sh
cp .env.example .env          # DATABASE_URL is pre-filled for SQLite
npm run db:generate           # schema -> SQL migration (drizzle-kit)
npm run db:migrate            # apply it (creates db/dev.db)
npm run dev                   # webjs dev, then serves
```

### `npm run dev` / `npm start` and `webjs dev` / `webjs start` behave identically

`npm run dev` and `npm start` are the documented entrypoints, and they
are thin aliases for `webjs dev` / `webjs start`. The start orchestration
(applying migrations, and any parallel watcher like the Tailwind CLI)
lives in the `webjs` block of `package.json` and runs INSIDE
`webjs dev` / `webjs start`:

```jsonc
"webjs": {
  "start": { "before": ["webjs db migrate"] }
}
```

Drizzle has no codegen, so there is no dev `before` step. An app that
adds the Tailwind CLI puts its `--watch` command under
`webjs.dev.parallel` and it runs alongside the server, torn down on exit.
`before` steps run to completion first; a failed `webjs db migrate`
aborts the boot with a clear message rather than serving a stale schema.

In Docker / Railway, `CMD ["npm", "start"]` and `CMD ["webjs", "start"]`
are equivalent: `webjs start` runs `webjs.start.before` (`webjs db
migrate`) in-process before serving, so the migrate no longer depends on
an npm `prestart` hook.

### Running on Bun instead of Node

webjs runs on **Node 24+ or Bun**. The same `package.json` scripts work on
either; to run under Bun, force it with `--bun` so the server executes on Bun
rather than the `webjs` bin's Node shebang:

```sh
bun install
bun --bun run dev      # or: bun --bun run start
```

On Node the `.ts` type-stripping is the built-in `module.stripTypeScriptTypes`;
on Bun (which has no built-in) it comes from `amaro` automatically, so the same
source serves identically. SSR action-result seeding (an internal hydration
optimization) works on both runtimes: Node installs it via `module.registerHooks`,
Bun via a `Bun.plugin` `onLoad`, so an async-render component does not re-fetch
on hydration on either runtime.

**Containerized deploy ships with the scaffold.** `Dockerfile`,
`compose.yaml`, and `.dockerignore` are scaffolded at the app root. The
Dockerfile pins `node:24-alpine` (the same Node major CI uses), installs
deps (no build step, since Drizzle has no codegen), and starts via
`npm start` (`webjs start` runs `webjs.start.before` = `webjs db migrate`
before serving). Run it locally with `docker compose up --build` (the
app comes up on http://localhost:8080 against a SQLite file on a named
volume). For production, point `DATABASE_URL` at managed Postgres and set
`AUTH_SECRET`. The `.dockerignore` keeps the `.webjs/vendor/` importmap in
the image while excluding `node_modules`, tests, and local state.

**Health and readiness probes.** Every webjs server answers two endpoints:
`/__webjs/health` (liveness, 200 once the process is listening) and
`/__webjs/ready` (readiness, 503 until the instance is fully warm, then 200).
Fully warm means the deterministic analysis AND the first vendor attempt have
both completed, so the importmap and its build id are settled. Point your
platform's readiness check at `/__webjs/ready` so it holds traffic off a
not-yet-warmed instance instead of routing the first user request into the cold
analysis or the brief window where the importmap is still resolving. The
scaffolded `Dockerfile` and `compose.yaml` already wire this up with a
`HEALTHCHECK` that probes `/__webjs/ready`, so any Docker-based deploy gets the
gate with no extra config. On a platform that reads its own config instead,
point its equivalent knob at the same path: Railway `"healthcheckPath":
"/__webjs/ready"`, Render `healthCheckPath: /__webjs/ready`, Fly a
`[[http_service.checks]]` on `/__webjs/ready`, or a Kubernetes `readinessProbe`
with `httpGet.path: /__webjs/ready`. For dependency-aware readiness (gate on a
live DB ping), add an optional `readiness.{js,ts}` at the app root that
default-exports an async check; `/__webjs/ready` runs it once warm and reports
503 if it returns `false` or throws.

Scripts (all wrap `drizzle-kit`):

- `npm run db:generate`: `webjs db generate` (schema -> SQL migration)
- `npm run db:migrate`: `webjs db migrate` (apply pending migrations)
- `npm run db:push`: `webjs db push` (push the schema straight to the dev DB)
- `npm run db:studio`: `webjs db studio` (visual DB browser)
- `npm run db:seed`: `webjs db seed` (run `db/seed.server.ts`)
- `webjs.start.before` runs `webjs db migrate` inside `webjs start` (idempotent; replaces the old `prestart` hook). No dev `before` step (no codegen).

Always import `db` from `db/connection.server.ts` (the globalThis-cached
singleton avoids opening a new connection on every dev-server reload), and
the tables from `db/schema.server.ts`:

```ts
import { db } from '#db/connection.server.ts';
const users = await db.query.users.findMany();
```

To switch to Postgres: scaffold with `--db postgres`, or swap
`db/columns.server.ts` + `db/connection.server.ts` for the Postgres
variants and point `DATABASE_URL` at Postgres. The schema, queries, and
actions are unchanged.

## NPM packages (vendor pipeline)

Adding a third-party npm package follows the same `npm install` flow
as any Node project, with one webjs-specific concern: how the BROWSER
fetches that package.

```sh
npm install dayjs                 # standard npm install
```

Now write `import dayjs from 'dayjs'` in any component or page. The
import works in dev immediately. webjs's scanner discovers bare
imports on the first request (memoized for the process) and asks
`api.jspm.io` to resolve them to CDN URLs (jspm.io serves pre-bundled
ESM for every npm package). The browser fetches the bundle directly
from `https://ga.jspm.io`.

**For production deploys**, run `webjs vendor pin` once and commit
the result:

```sh
webjs vendor pin                  # writes .webjs/vendor/importmap.json
git add .webjs/vendor/
git commit -m "vendor dayjs"
```

The pin file holds the resolved jspm.io URLs. Server reads it from
disk on the first request (memoized); no `api.jspm.io` call needed in
production. Deterministic across deploys.

**For offline-capable / strict-CSP production**, use `--download`:

```sh
webjs vendor pin --download       # also vendors bundle bytes locally
git add .webjs/vendor/
git commit -m "vendor + download dayjs"
```

Bundle files land in `.webjs/vendor/<pkg>@<version>.js`. importmap
points at local `/__webjs/vendor/` paths. Browser fetches from your
own origin. Suitable for `script-src 'self'` CSP, air-gapped deploys,
or compliance environments. See [docs.webjs.com Deployment → CSP](https://docs.webjs.com/docs/deployment#csp).

**Other CLI commands:**

```sh
webjs vendor list                 # show pinned packages with versions
webjs vendor unpin <pkg>          # remove one entry from pin file
webjs vendor audit                # npm security advisories against pinned versions
webjs vendor outdated             # list pinned packages with newer versions on npm
webjs vendor update               # re-pin every outdated package to its latest

# Switch CDN at pin time (default: jspm.io). Resolver options:
# jspm, jsdelivr, unpkg, skypack. Useful for jspm.io incident response.
webjs vendor pin --from jsdelivr
webjs vendor update --from jsdelivr
```

Same posture as Rails 7 + importmap-rails: explicit pin command,
committed manifest, optional `--download` for full offline capability,
and a `--from` knob to swap the resolver CDN if jspm.io has an
incident.

**Don't auto-run `webjs vendor pin` in a `webjs.dev.before` / `webjs.start.before`
step.** Auto-pin would silently churn the committed importmap.json as jspm.io
resolves URLs or transitive deps drift. Pin is a deliberate developer action,
like `npm install` itself.

**Do NOT modify the `.webjs/` lines in `.gitignore` / `.dockerignore`.**
The scaffolded `.gitignore` pattern is three lines (`**/.webjs/*` +
`!**/.webjs/vendor/` + `!**/.webjs/vendor/**`) and is structurally
load-bearing. Collapsing it to a single `.webjs/` excludes the parent
directory; once the parent is excluded, git cannot re-include
`.webjs/vendor/` via a child negation (gitignore semantics: parent
exclusion blocks child negations). The breakage is invisible: `webjs
vendor pin` runs, writes files, and git silently ignores them.
Production then has no importmap.json and the server falls back to
calling api.jspm.io on every cold start. The `**/` prefix matters too:
it ignores `.webjs/` at any depth, so an app nested below its repo root
(a monorepo package) does not leak its generated `.webjs/routes.d.ts`
into `git status`. The `vendor-gitignore` check (`webjs doctor`)
verifies the pattern with `git check-ignore` and warns if it regresses
(it is a project-config / setup concern, not a source-code-correctness
CI gate).

## Imports

```ts
import { html, css, WebComponent } from '@webjsdev/core';
import '@webjsdev/core/client-router';              // enable SPA nav
import { unsafeHTML, live } from '@webjsdev/core/directives';
import { createContext } from '@webjsdev/core/context';
import { Task } from '@webjsdev/core/task';
import { fixture, ssrFixture, waitForUpdate, assertNoA11yViolations } from '@webjsdev/core/testing';

import { rateLimit, cors, cache, createAuth, Credentials, Session } from '@webjsdev/server';
```

## Environment variables (server vs browser)

Server-only is the default. Any `process.env.X` read on the server stays on the server. Names that start with `WEBJS_PUBLIC_` are also exposed in the browser as `process.env.X`, via an inline script injected at SSR time. No build step.

```sh
# .env
DATABASE_URL=postgres://...            # server-only
AUTH_SECRET=...                        # server-only
WEBJS_PUBLIC_API_URL=https://x.com     # browser too
```

```ts
// Server-side (page function, action, middleware, route handler):
const dburl = process.env.DATABASE_URL;             // works

// Browser-side (component render method, client-only utilities):
const url = process.env.WEBJS_PUBLIC_API_URL;       // works
const secret = process.env.AUTH_SECRET;             // undefined (fail-closed)
```

`process.env.NODE_ENV` is also defined in the browser (`'development'` in `webjs dev`, `'production'` in `webjs start`), so vendor bundles that probe it work without setup. Full docs: [Configuration](https://docs.webjs.com/docs/configuration).

## Component pattern

```ts
import { WebComponent, html, css } from '@webjsdev/core';

// Recommended declare-free base-class factory style
export class Counter extends WebComponent({
  count: Number
}) {
  static styles = css`button { padding: 8px 12px; }`;   // shadow-DOM only
  // static shadow = true;          // opt into shadow DOM (default: light DOM)
  // static lazy = true;             // download JS only when scrolled into view

  constructor() {
    super();
    this.count = 0;                  // SSR-meaningful default, see below
  }

  render() {
    return html`
      <button @click=${() => { this.count = this.count + 1; }}>
        ${this.count}
      </button>
    `;
  }
}
Counter.register('my-counter');
```

**Progressive-enhancement rule for components.** Every webjs component
is SSR'd. The server constructs the component, applies attributes,
and runs `render()`. With JS disabled, the component's initial HTML
still paints (an unstyled counter still shows the number, and only
the click handler is inert). Two consequences for how you write code:

1. **Defaults for the first paint go in `constructor()`** (after
   `super()`), never as class-field initializers (which break
   reactivity) and never in `connectedCallback` (which the server
   doesn't run). For Web Component properties with `declare`, set the
   default in the constructor.
2. **`connectedCallback` is browser-only.** Use it for
   `localStorage`, viewport size, online status, or anything that
   genuinely can't be known on the server. Read the value, then
   assign it to a reactive property (`this.items = stored`) or write
   to a signal to refine the render. The SSR'd first paint shows the
   constructor default. The browser refines after hydration.
3. **Server-known data goes through the page function**, not into
   `connectedCallback`. Fetch in the page (which runs on the server),
   pass the result down via `.prop=${value}` (custom elements) or
   `attr=${string}` (native elements). For custom elements, the wire
   serializer round-trips Array / Object / Date / Map / Set / BigInt
   through the SSR `data-webjs-prop-*` side-channel, so the
   component's first paint already has the rich-typed value with no
   flash. The framework owns the attribute, applies it on
   `connectedCallback`, then strips it from the live DOM. For native
   elements use `value=${v}` / `checked=${b}` etc.; `.value` on a
   native element drops at SSR (the property form is for client-only
   re-render scenarios like controlled inputs via `.value=${live(v)}`).
4. **For write-paths, prefer `<form>` + server action over `fetch`.**
   Plain forms POST without JS; the client router upgrades them to
   partial-swaps automatically when scripts are active. One
   implementation covers both.

See [Progressive Enhancement](https://docs.webjs.dev/docs/progressive-enhancement) for the full design rationale.

## Lit muscle-memory gotchas (read if you have written lit before)

Webjs's runtime API matches lit. The `WebComponent` base class,
`static properties`, the lifecycle hooks, ReactiveControllers, the
directive set, `html` / `css` tagged templates. The **rendering
model**, however, is different. Pure-lit patterns that work fine in a
client-only lit app break in webjs's SSR pipeline or its reactivity
system. Read this section before reaching for lit idioms.

### Mental model. JS opt-in per behavior, not per component

Lit hydrates per component. You decide at the component boundary
whether JS ships and runs for that island.

Webjs ships JS per **interactive behavior**, not per component. Every
component is server-rendered. JavaScript is requested by the specific
holes you write in the template.

- `@click=${...}`, `@input=${...}`, any event binding requests JS.
- A reactive property assignment (`this.count = …`) or a signal
  `set()` that the component reads requests JS for reactive updates.
- `.prop=${richObject}` requests JS for property hydration.
- A controller like `Task` requests JS for that async behavior.
- A plain `<a href>`, a `<form action method>` submission, or a
  purely display-time component (no event listeners, no property
  mutations, no signal subscriptions, no property bindings) does
  **not** request JS.

A single component can mix both. A product card with server-rendered
title, price, image, plus a "View" link (no JS) and an "Add to cart"
button with a `@click` (JS for that one behavior) is correct webjs
style. The framework loads JS for the component because of the
`@click` and runs it, while the rest of the card stays exactly as the
server painted it.

Practical consequences for agents writing webjs code.

1. Never reach for `fetch()` plus a `@click` handler when a `<form>`
   plus a server action would do. The form is free (no JS), the
   server action is typed and CSRF-protected, the result reaches the
   page through normal navigation.
2. Never make first paint depend on hydration. A blank skeleton until
   JS runs means the feature was written wrong.
3. Don't think binary about "static vs interactive components." Pick
   interactive primitives per behavior. A page with ten components
   can ship zero JS for eight of them and handlers only for the two
   that need it.

### Gotchas at a glance

| Lit pattern | What breaks in webjs | Webjs equivalent |
|---|---|---|
| Fetch in `connectedCallback` / `firstUpdated` | Empty first paint (neither hook runs in SSR) | Fetch in the page function, pass as props |
| `Task` for initial-paint data | SSR ships the pending state, flashes to resolved on hydration | Page function fetch, pass as props, OR an `async render()` in the component (`Task` is fine for client-time async) |
| Expecting a sync `render()` only | webjs allows `async render() { const d = await getData(); ... }`; SSR bakes the data into the first paint | Use it for request-time server data; `renderFallback()` is the re-fetch loading UI (never first paint); error isolation is automatic |
| Assuming an `async render()` always ships its module | A bare one (no other client signal) is ELIDED, so it costs zero JS and skips the on-hydration re-fetch, first paint unchanged | Rely on it for a fetch-and-display leaf. `static refresh = true` keeps the on-load refresh, `static shadow = true` always ships |
| `window.X` / `document.X` in constructor or `render()` | SSR crash | Move to `connectedCallback` |
| Top-level `import` of a browser-only library | SSR crash | Dynamic `import()` inside `connectedCallback` |
| Class-field initializer for a reactive property (`student: Student = {...}`) | Silently breaks reactivity (overwrites the framework accessor) | Use base-class factory `WebComponent({ student: Student })` with constructor default (no `declare` needed), or `declare student: Student` plus constructor default |
| `@property()` decorator | Banned by invariant 10 (erasable TS) | Use base-class factory `WebComponent({ ... })` (recommended), or `static properties = { ... }` plus `declare` |
| Scoped `static styles = css` or an inline `<style>` with semantic class names (`.hero`, `.card`) in a light-DOM component | Scoped block does nothing without `static shadow = true`; inline `<style>` class names leak globally | Tailwind utilities (the light-DOM default); or `static shadow = true` for genuinely scoped CSS |
| `willUpdate` computing SSR-visible derived state | Works (runs at SSR), but overriding it opts the component out of elision | Fine for interactive components; for display-only, derive inline in `render()` |
| `this.hasAttribute` / `getAttribute` in `render()` | Works (server attribute shim backs the attribute methods at SSR) | Read attributes directly, or via base-class factory `WebComponent({ ... })` / `static properties` reactive prop |
| `ContextProvider` for server-known data | Default value during SSR, content shift on hydration | Pass via props from the page function |

The full annotated catalog with code examples lives in the framework
repo at
[`agent-docs/lit-muscle-memory-gotchas.md`](https://github.com/webjsdev/webjs/blob/main/agent-docs/lit-muscle-memory-gotchas.md).

### Styling: Tailwind-first (the most common lit reflex to unlearn)

**Tailwind utilities are the strong default for pages AND light-DOM
components (the default DOM mode).** Use them for layout, spacing, color
(via the `@theme` tokens), typography, borders, radius, shadows, and
interaction states (hover/focus/active/disabled, dark mode). Light DOM
does not scope styles, so utilities apply directly.

The lit habit is to scope CSS in a shadow root (`static styles =
css\`\``) or write an inline `<style>` with semantic class names
(`.hero`, `.card`). In a light-DOM webjs component the scoped block does
nothing without `static shadow = true`, and the inline class names leak
globally. Prefer Tailwind. When a utility bundle repeats, extract it into
a `lib/utils/ui.ts` helper returning an `` html`...` `` fragment, not a
CSS class.

Reserve raw CSS for what utilities cannot express: design-token `:root` /
`@theme` definitions, `@property` + `@keyframes` animations,
`::-webkit-scrollbar`, `prefers-reduced-motion` blocks, and complex
`color-mix()` / gradient effects. When custom CSS is unavoidable in a
light-DOM component, prefix every class selector with the component tag
(invariant below). Shadow-DOM components (`static shadow = true`)
legitimately use `static styles = css\`\`` for scoped CSS.

## Server action pattern

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';

export async function createPost(input: { title: string; body: string }) {
  if (!input.title) return { success: false, error: 'title required', status: 400 };
  const [post] = await db.insert(posts).values(input).returning();
  return { success: true, data: post };
}
```

Import it from a client component. The framework rewrites it into a
type-safe RPC stub automatically.

A server action is a POST by default, but reserved sibling exports change its
HTTP semantics without changing the call site (`await getUser(7)` stays the
same): `export const method = 'GET'` (a read; rides args in the URL, CSRF-exempt,
cacheable), `export const cache = 60` + `export const tags` (GET response
caching), `export const invalidates` (a mutation's tags to evict), `export const
middleware` (a per-action chain, `actionContext()`), and `export const validate`
(the boundary validator). One callable function per configured file. An action
that RETURNS a `ReadableStream` / async generator streams its chunks (consume
with `for await`); read the request `AbortSignal` via `actionSignal()` to cancel
on disconnect. **SAFETY:** a `cache` with `public: true` shares one response
across all users, so use it only for data identical for every visitor. Full
reference: https://docs.webjs.com/docs/server-actions

## Client navigation patterns (auto-magic)

The client router enables itself when the scaffolded root layout imports
`@webjsdev/core/client-router`. After that, **every `<a href>` and
`<form action>` on the page is enhanced into a partial-swap navigation
or submission automatically**. You don't call a router API. Write
standard HTML; the swap happens.

What this changes for how you write apps:

### 1. Put shared chrome in `layout.ts`, not in every page

When you navigate from `/posts` to `/posts/123`, the framework swaps
only the deepest layout's `${'${children}'}` slot. Outer layouts stay
mounted. The sidenav's scroll position, an open `<details>`, a focused
input, and an inflight `<video>` are all preserved across the navigation
without you writing any code.

The rule: anything that should persist across navigations within a
section lives in that section's `layout.ts`. Page-specific content
lives in `page.ts`. Don't duplicate a sidenav into every page.

### 2. Forms POST through `<form action>` (no `fetch` for write-paths)

A `<form action=${'${createPost}'} method="post">` works as a plain
HTML form when JS is disabled and as a partial-swap submission when JS
is active. **The same form covers both paths.** Don't reach for
`fetch` + a click handler unless you genuinely need to.

### 3. Server-side validation: re-render the form with errors

The router applies any `text/html` response to the DOM regardless of
status code (4xx, 422, etc.). This is the Rails / Django / Phoenix
server-side validation pattern. Pair a `<form action="/posts" method="post">`
with a `route.ts` POST handler:

```ts
// app/posts/route.ts
import { redirect, html } from '@webjsdev/core';
import { createPost } from '#modules/posts/actions/create-post.server.ts';

export async function POST(req: Request) {
  const form = await req.formData();
  const result = await createPost({
    title: String(form.get('title') ?? ''),
    body:  String(form.get('body')  ?? ''),
  });
  if (!result.success) {
    // Re-render the form page with the user's input + inline errors.
    // The client router applies this HTML in place, no full reload.
    return new Response(renderNewPostForm(result.errors, form), {
      status: 422,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  // Success → PRG redirect; fetch follows, history records /posts/<id>
  redirect(`/posts/${result.data.id}`);
}
```

```html
<!-- The form: standard HTML, no JS handler needed -->
<form action="/posts" method="post">
  <input name="title" required />
  <textarea name="body" required></textarea>
  <button>Publish</button>
</form>
```

With JS active: router intercepts the submit, sends the POST, applies
the response in place (2xx + redirect for success, 4xx HTML for
errors). With JS disabled: browser performs the same POST as a normal
form submission and renders the response page. Same code, both paths.

(For RPC-style server actions that return typed values to client
components. See *Server action pattern* above. The HTML-form pattern
here is for the "submit → server processes → render new page" flow.)

### 4. `<webjs-frame id="...">` for non-layout swap regions

`<webjs-frame>` is webjs's take on **Turbo Frames** (Hotwire Turbo), so
`<turbo-frame>` muscle memory transfers directly: a lazy, URL-addressable
region that swaps on its own, driven by a link/form targeting its id. Use it
for a region that loads or refreshes INDEPENDENTLY of a full navigation
(a self-refreshing widget, a `loading="lazy"` below-the-fold region, a
URL-addressable panel); it ships zero component JS. Its route can itself use
`<webjs-suspense>` so a lazy frame's slow data streams in behind a fallback.

For a widget that should swap on click but isn't a route boundary
(e.g. a tab strip inside a page), wrap it:

```ts
return html`
  <nav>
    <a href=${'${path + "?tab=overview"}'}>Overview</a>
    <a href=${'${path + "?tab=stats"}'}>Stats</a>
  </nav>
  <webjs-frame id="tab-content">
    ${'${tab === "stats" ? renderStats() : renderOverview()}'}
  </webjs-frame>
`;
```

The router's `closest('webjs-frame')` detection takes precedence over
layout markers. Only the frame's content swaps. Use this sparingly,
folder-based layouts handle 99% of cases.

**External targeting + `_top` (Turbo-style).** A trigger does not have to be
nested in the frame it drives. An `<a>` or `<form>` (or any ancestor)
carrying `data-webjs-frame="<id>"` drives the frame with that id from
anywhere (an external sidebar/nav link, a filter form), resolved via
`getElementById`. The reserved token `data-webjs-frame="_top"` on a trigger
INSIDE a frame breaks OUT to a full-page navigation. An id that does not
resolve to a live `<webjs-frame>` warns once and falls back to a normal nav
(never throws). With JS disabled a `data-webjs-frame` link is an inert
attribute on a plain `<a href>`, so the click is a normal full navigation.

**Busy state.** While a frame nav is in flight the router sets the native
`aria-busy="true"` on the frame (cleared to `"false"` on any exit: success,
error, abort, or a missing frame), so AT announces it and CSS can style
`webjs-frame[aria-busy="true"]`. It also dispatches a bubbling
`webjs:frame-busy` event on the frame at start and finish (detail
`{ frameId, busy }`).

**Self-loading (`src` + `loading`).** A frame can fetch its OWN content:
`<webjs-frame id="comments" src="/posts/42/comments" loading="lazy">` self-fetches
that URL as a frame nav and applies the matching `<webjs-frame id>` subtree into
itself, through the same frame-swap path (so the busy lifecycle + navigation-error
recovery + frame-missing fallback all apply). `loading="eager"` (or absent)
fetches on connect; `loading="lazy"` fetches on viewport entry. The request sends
the `x-webjs-frame` header, so the SERVER returns ONLY the matched subtree (not
the full page), falling back to the full page when the frame is absent. A `src` is
JS-DEPENDENT (the browser does not natively fetch a `<webjs-frame src>`), so with
JS off the frame shows only the children rendered into it; use it for DEFERRED
content (comments, a recommendations rail) where a no-JS placeholder is fine, and
render content server-side into the frame when it must exist without JS.

**View Transitions + persistent elements (opt-in).** Add
`<meta name="view-transition" content="same-origin">` to the page head and the
router wraps every swap (the layout-marker swap, the `<webjs-frame>` swap, and
the full-body fallback) in `document.startViewTransition` for an animated
crossfade. OFF by default (no animation surprise); a browser without the API
falls back to the identical synchronous swap. To keep a live element running
across a navigation (a playing `<audio>` / `<video>`, a map, a stateful
widget), mark it `data-webjs-permanent` AND give it an `id`: the router keeps
the SAME DOM node by identity across the swap instead of recreating it (Turbo's
permanent-element behaviour). Inert with JS off.

When a frame nav's response lacks the matching `<webjs-frame id>` (e.g. an
auth redirect), the router fires a cancelable, bubbling `webjs:frame-missing`
event (detail `{ frameId, url, document }`) and leaves the frame unchanged
rather than silently swapping the whole page; call `preventDefault()` to take
over the outcome (e.g. `location.assign(e.detail.url)`).

### 5. Stream actions for surgical element-level updates

`<webjs-stream>` is webjs's take on **Turbo Streams** (Hotwire Turbo); the
action set (`append` / `prepend` / `before` / `after` / `replace` / `update` /
`remove`) mirrors `<turbo-stream>`, so that muscle memory transfers directly.
It is the ONLY surgical single-element update primitive AND the live-channel
applier (`connectWS` / `broadcast` -> `renderStream`); a region swap or a
`<webjs-frame>` reload redraws a whole region, so reach for `<webjs-stream>`
when only one element changes.

When a region swap is too coarse (append ONE comment, remove ONE row, bump a
count, insert a toast), a server response can declare per-element actions as
plain HTML, a `<webjs-stream action target>` wrapping one `<template>`:

```html
<webjs-stream action="append" target="comments">
  <template><li>Nice post!</li></template>
</webjs-stream>
```

Actions (Turbo's set): `append` / `prepend` (last / first child of the target
id), `before` / `after` (sibling), `replace` (the target element), `update`
(its children), `remove` (delete it). The `<webjs-stream>` element self-applies
on connect and removes itself. ONE applier serves two paths:

- **A content-negotiated `<form>`.** The router adds `Accept:
  text/vnd.webjs-stream.html` on a JS-driven submission, so the server returns a
  stream only then (apply it surgically) and a JS-OFF form gets a normal
  render/redirect. Additive and progressive-enhancement-safe.
- **A live channel.** `renderStream(message)` from a `connectWS` handler applies
  a `broadcast()`ed payload, so chat / notifications reuse the same applier.

Build the payload server-side and apply it client-side:

```ts
// app/posts/[id]/route.ts
import { stream, streamResponse, acceptsStream, broadcast } from '@webjsdev/server';
export async function POST(req: Request, { params }) {
  const c = await addComment(params.id, await req.formData());
  const html = stream.append('comments', `<li>${escapeHtml(c.text)}</li>`);
  broadcast(`post:${params.id}`, html);              // fan out to other viewers
  if (acceptsStream(req)) return streamResponse(html); // JS client: surgical
  return Response.redirect(`/posts/${params.id}`, 303); // no-JS: normal render
}
```

```ts
// a component, for the live channel
import { connectWS, renderStream } from '@webjsdev/core';
connectWS(`/posts/${id}/feed`, { onMessage: (m) => renderStream(m) });
```

`stream.*` escapes the target id but NOT the content (server-authored HTML, like
an `html` hole, so escape any user substring yourself). `renderStream` is
auto-registered by the client router.

**Failed navigations recover in place, never a destructive full reload.** A
successful swap and an HTML error body of any status (e.g. a `422` re-rendered
form) both apply in place. For the remaining failure cases (a non-HTML error
response like a `500` with a JSON body, or a transport/parse failure) the
router fires a cancelable, bubbling `webjs:navigation-error` event on
`document` (detail `{ url, status, error }`, where `status` is the HTTP status
or `null`, and `error` is the `Error` or `null`). `preventDefault()` hands
recovery to you and leaves the page exactly as it is (shell, scroll, focus,
client state preserved); otherwise the router renders a minimal in-place
`<div role="alert">` into the deepest layout children slot (outer chrome
preserved), only hard-loading as a last resort when there is no shared layout
marker. An AbortError (a superseding nav) is a normal supersede and never fires
the event.

### 5. `loading.ts` for per-segment skeletons

Drop a `loading.ts` in any route segment. The framework auto-wraps the
sibling `page.ts` in a Suspense boundary with `loading.ts`'s default
export as the fallback. On navigation, the client router clones the
deepest matching loading template into the swap slot immediately -
the user sees a skeleton during the fetch, then the real content.

### 6. `error.ts` for per-segment error boundaries

Drop an `error.ts` in any route segment. Render-time exceptions in
that segment's tree are caught and rendered through `error.ts`'s
default export, scoped to that boundary (outer layouts stay alive).

### What you do NOT need to write

- Manual fetch / DOM-swap code for SPA-style navigation
- An "active link" highlight handler. Use `aria-current="page"`
  derived from the request URL on the server.
- Loading spinners on `<a>` clicks. `loading.ts` handles it.
- Cancellation when the user clicks faster than the network. The
  router's nav-token + AbortController combo guarantees stale
  responses never overwrite a newer settled page.
- Scroll-position save/restore for back/forward. The snapshot cache
  handles window scroll. Inner scrollables persist via DOM identity.

Full reference: see the [Client Router docs](https://docs.webjs.dev/docs/client-router) and the framework AGENTS.md "Client navigation" section.

## Offline support (opt-in service worker)

The UI scaffolds (full-stack and saas) ship a progressive-enhancement service
worker at `public/sw.js` plus a `public/offline.html` fallback (the api template
has no UI, so it omits them). They are **dormant until you register them**, so
the JS-disabled baseline is unchanged. To enable offline support, add the opt-in
registration snippet to the root layout `<head>`:

```html
<script>
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      const tag = document.querySelector('script[type="importmap"]');
      const build = (tag && tag.dataset.webjsBuild) || '';
      navigator.serviceWorker.register('/sw.js' + (build ? '?v=' + build : ''));
    });
  }
</script>
```

Navigations become network-first (fresh server HTML, with an offline fallback to
a cached page or `/offline.html`); same-origin assets are stale-while-revalidate.
The cache version ties to the deploy via the `?v=<build>` id, so a new deploy
evicts the old cache automatically. `sw.js` is YOUR file, so edit the strategy as
needed. Full reference: `agent-docs/service-worker.md`.

## Metadata (per-page)

The `metadata` export is Next.js-compatible. Common fields shown below;
the full surface includes `title.template / .default / .absolute`,
`metadataBase`, `alternates: { canonical, languages, media, types }`,
`robots`, `keywords`, `authors`, `creator`, `publisher`, `verification`,
`icons`, `manifest`, `appleWebApp`, `formatDetection`, `itunes`, and
the typed `other: { '<meta-name>': value }` escape hatch.

```ts
export const metadata = {
  title: 'My page',
  // OR: title: { template: '%s | {{APP_NAME}}', default: '{{APP_NAME}}' }
  description: 'A page in {{APP_NAME}}',
  metadataBase: 'https://example.com',           // base for relative URLs below
  openGraph: { type: 'website', image: '/og.png' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.svg', apple: '/apple.png' },
  alternates: { canonical: '/post' },            // → <link rel="canonical">
  robots: { index: true, follow: true },
  cacheControl: 'public, max-age=60',            // opt into caching (default: no-store)
};
```

Use `generateMetadata(ctx)` when you need request-scoped values (e.g.
absolute URLs from `ctx.url`):

```ts
export function generateMetadata(ctx: { url: string }) {
  return { metadataBase: new URL(ctx.url).origin, title: 'Hello' };
}
```

Viewport may be split into its own export (Next.js 14+ pattern):

```ts
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1613',
  colorScheme: 'light dark',
};
```

## Document shell (`<html>` / `<head>` / `<body>`)

The framework owns the shell by default. The SSR pipeline auto-emits
`<!doctype html><html lang="en"><head>…</head><body>` around every
composition, and auto-hoists `<link>` / `<style>` / `<meta>` / `<script>`
tags returned anywhere in a layout/page into the real `<head>`. The
`metadata` export drives `<title>` and `<meta>` tags.

**Only `app/layout.ts` (the root layout)** may optionally write its
own `<!doctype><html><head>…</head><body>` shell to override `<html lang>`,
`<html dir>`, `<html data-*>`, `<body class>`, or add a custom
`<link rel="preconnect">` etc. When the root layout supplies a shell,
the framework respects it and splices its required tags into the
user's `<head>`.

```ts
// app/layout.ts (root, optionally owning the shell)
export default function RootLayout({ children }) {
  return html`
    <!doctype html>
    <html lang="es" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://cdn.example.com">
      </head>
      <body class="min-h-screen bg-bg">
        <main>${children}</main>
      </body>
    </html>
  `;
}
```

**Non-root layouts** (`app/<segment>/layout.ts`) and **pages**
(`app/**/page.ts`) **must NOT** write `<!doctype>` / `<html>` / `<head>`
/ `<body>`. The framework auto-emits the wrapper around the whole
composition, so a nested shell ends up dropped by the HTML parser.
`webjs check` enforces this via the `shell-in-non-root-layout` rule.

## Invariants (do not violate)

1. Custom element tags must contain a hyphen. Pass the tag to `.register('tag-name')` at the bottom of the file. The tag is not a static field.
2. **Server-only code goes in `.server.{js,ts}` files, `route.ts`
   handlers, or `middleware.ts`. Never in pages, layouts, or
   components.** Direct imports of a DB driver (`better-sqlite3` / `pg`),
   `node:*`, or any server-only dependency from a page, layout, loading.ts,
   error.ts, not-found.ts, or component will crash the browser at module load.
   Wrap the access in a `.server.{js,ts}` file; the framework
   rewrites that import into an RPC stub for the browser. Server-only
   infra lives in `db/*.server.ts` (the DB) and `lib/*.server.ts`
   (`lib/session.server.ts`); browser-safe utilities live in
   `lib/utils/cn.ts` with `cn`, design-
   system helpers). Server-only `lib/*` files must only be imported
   from `.server.ts`/`route.ts`/`middleware.ts`; browser-safe `lib/*`
   files (like `lib/utils/cn.ts`) can be imported anywhere.
3. Event / property / boolean holes in `` html`` `` are unquoted:
   `@click=${fn}`, not `@click="${fn}"`.
4. Component state lives in signals. Import `signal` from
   `@webjsdev/core`, read with `signal.get()` inside `render()`, and
   write with `signal.set(value)`. Module-scope signals share state
   across components; instance signals (created in the constructor)
   carry component-local state. Reactive properties (`static
   properties = { ... }` with a sibling `declare`) are for values
   that ride an HTML attribute or `.prop=${...}` SSR hydration.
5. Pages / layouts / metadata routes default-export a server-only function.
6. One exported function per action / query file. Name the file after it.
7. **Components must render meaningful HTML on first paint** (SSR
   uses constructor defaults + attributes, while `connectedCallback` is
   browser-only). Never fetch initial data in `connectedCallback` /
   `firstUpdated`. Fetch in the page function (server) and pass it as
   a prop. See *Component pattern* above.
8. **Erasable TypeScript only.** The runtime strips types at the runtime
   layer (Node 24+'s built-in `module.stripTypeScriptTypes`, or `amaro`
   on Bun, which is byte-identical), with whitespace replacement so
   line and column positions are byte-exact and no sourcemap ships to
   the browser. Your `tsconfig.json` sets `erasableSyntaxOnly: true`, so
   the TS compiler rejects: `enum`, `namespace` with values,
   constructor parameter properties, legacy decorators with
   `emitDecoratorMetadata`, and `import = require`. Use the erasable
   equivalents:

   ```ts
   // ❌ enum
   enum Color { Red, Green, Blue }

   // ✅ const object + union type
   const Color = { Red: 'Red', Green: 'Green', Blue: 'Blue' } as const;
   type Color = typeof Color[keyof typeof Color];

   // ❌ parameter property
   class Foo { constructor(public x: number) {} }

   // ✅ explicit field + assignment
   class Foo {
     x: number;
     constructor(x: number) { this.x = x; }
   }
   ```

   If you turn `erasableSyntaxOnly` off and use non-erasable syntax,
   the dev server fails at strip time and returns a 500 naming the
   file and pointing at the `no-non-erasable-typescript` lint rule.
   webjs is buildless end-to-end and has no bundler fallback. The
   `erasable-typescript-only` convention check warns when the flag
   is missing or set to false.
9. **No em-dashes (U+2014) anywhere, and no hyphen or semicolon used
   as a pause-punctuation substitute.** Prose, comments, code, JSON
   descriptions, commit messages. Rewrite the sentence so no
   pause-punctuation crutch is needed. Banned as pause punctuation:
   the em-dash (`-`), a plain hyphen used in place of one (` - `), and
   a semicolon used in place of one (` ; `). Use a period, comma,
   colon, parentheses, or a restructured phrasing. Plain hyphens stay
   fine in compound words (`AI-first`), CLI flags (`--http2`),
   filenames, and ranges. Semicolons stay fine inside code.

## Workflow expectations for AI agents

1. Branch before editing. Never push to `main` directly. **If more than one
   agent may work this repo at once, give each task its own git worktree, not a
   shared checkout** (`git worktree add -b <branch> ../<repo>-<slug> origin/main`,
   `cd` in, work there, `git worktree remove` after merge). Two agents in one
   working directory collide: a `git checkout` in one moves `HEAD` under the
   other, so the next commit lands on the wrong branch. Git enforces
   one-branch-per-worktree, so worktrees prevent it; a lone agent in a clean
   checkout may use a plain branch.
2. Every code change comes with a test, AGENTS.md / docs updates if the
   feature surface changed, `webjs check` passing. A unit test is not
   always enough: a component, hydration, the client router, or a server
   action called from the client needs a browser test
   (`webjs test --browser`) asserting the behaviour in a real browser. For
   Claude Code, a commit that stages app code (`app/`, `modules/`,
   `components/`, `lib/`) with no test WARNS via
   `.claude/hooks/require-tests-with-src.sh` (every change should still ship
   with a test, but that is a convention, not a hard gate). A project that
   wants the strict floor opts into a hard block by setting
   `WEBJS_TEST_GATE=block` (in `.claude/settings.json` env, your shell, or
   CI). The real enforcement is CI: the test suite runs in
   `.github/workflows/ci.yml`, not in the pre-commit hook, so `git commit`
   stays fast and the gate cannot be skipped with a local `--no-verify`.
3. Commit and push **per logical unit**, not at the end. A logical unit is one
   feature, one fix, one rename, one doc rewrite. If you have 5+ unstaged files
   spanning different concerns, commit the current group before continuing.
   The framework ships a `nudge-uncommitted` hook for several agents that
   fires at threshold 4:

   | Agent | Hook path | Doc |
   |---|---|---|
   | Claude Code | `.claude/hooks/nudge-uncommitted.sh` (`PostToolUse`) | `.claude/settings.json` |
   | Gemini CLI | `.gemini/hooks/nudge-uncommitted.sh` (`AfterTool`) | `.gemini/settings.json` |
   | Cursor 1.7+ | `.cursor/hooks/nudge-uncommitted.sh` (`afterFileEdit`) | `.cursor/hooks.json` |
   | OpenCode | `.opencode/plugins/nudge-uncommitted.ts` (`tool.execute.after`) | `.opencode/plugins/` |
   | Antigravity (Google) | text rule only (post-write hooks not yet exposed) | `.agents/rules/workflow.md` |
   | GitHub Copilot | text rule only (no hooks API) | `.github/copilot-instructions.md` |

   The `.hooks/pre-commit` hook blocks commits to main and nothing else;
   `webjs test` + `webjs check` run in CI (`.github/workflows/ci.yml`) on
   every PR and push to main, regardless of which agent (or human) made
   the commit. No AI attribution trailers in commit messages.
4. Run the **pre-merge self-review loop** before signaling the PR is
   ready. After committing the work, trigger a fresh-context review
   pass (a new chat / composer tab / subagent / Cascade thread
   depending on your tool) and iterate fix-then-review rounds until
   one round finds zero issues. Minimum two rounds; rotate focus each
   round so the reviewer does not rediscover the same surface twice.
   Skip the loop only for one-line trivial changes; skipping on a
   change that touches logic, public surface, build, security, or
   multiple files is the exact failure mode the loop exists to
   prevent. The full rule, prompt template, and reporting contract
   live in the **Pre-merge self-review loop** section of
   `CONVENTIONS.md`.
5. When unsure how a framework feature works, `grep` or `cat` the
   relevant `node_modules/@webjsdev/*/src/` file before asking the user.

Project conventions live in [CONVENTIONS.md](./CONVENTIONS.md) (guidance
you follow by judgment). `webjs check` is separate: correctness checks
only, always on, no per-project disabling.
