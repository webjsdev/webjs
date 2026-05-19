# AGENTS.md for {{APP_NAME}}

Read this before editing any file. This is a webjs app: AI-first, web-
components-first, no build step. The framework's own full API reference
lives at https://github.com/vivek7405/webjs/blob/main/AGENTS.md and the
full hosted documentation (every API, recipe, and example) lives at
**https://docs.webjs.com**. Treat this file as the app-scoped
companion and reach for docs.webjs.com whenever you need more detail.

## If you just scaffolded this app (AI agents, read first)

This project was created with `webjs create`. The files you see right
now (`app/page.ts` printing "Hello from {{APP_NAME}}", the example `User`
model in `prisma/schema.prisma`, the `theme-toggle` component, the
example users module in api/saas templates) are **starting-point
references, not the final product**. Your job is to replace them with
the app the user actually asked for.

**Non-negotiables for every webjs app:**

1. **Use Prisma + SQLite for persistence.** It's already wired up
   (`prisma/schema.prisma`, `lib/server/prisma.ts`, `npm run db:migrate`,
   `predev` hook running `prisma generate`). For any data the app
   stores (todos, posts, messages, products, comments, anything),
   define a Prisma model and persist there.
   - **NEVER** store app data in JSON files (`data/todos.json`,
     `db.json`, …). The convention check `no-json-data-files` flags
     this and the user's prompt explicitly forbids it.
   - **NEVER** use in-memory arrays or `Map`s as a substitute for the
     database. They vanish on every dev-server reload and aren't
     shared across processes.
   - **NEVER** use `localStorage` to persist app data. It's per-browser
     and doesn't reach the server.
2. **One of three scaffolds only.** The CLI exposes exactly three:
   `full-stack` (default), `--template api`, `--template saas`. Don't
   reach for a `--template blog` / `--template todo` / `--template
   ecommerce`. They don't exist and the CLI will reject them.
3. **First step after scaffolding:** edit `prisma/schema.prisma` to the
   app's real domain models (delete the example `User` model unless the
   app actually needs users), run `webjs db migrate <name>`, then build
   pages / actions / queries against those models.

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
node_modules/@webjskit/
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
    src/actions.js            ← .server.ts scanner, RPC, expose()
    src/auth.js, session.js, cache.js, rate-limit.js, csrf.js
  cli/             webjs CLI (dev / start / build / test / check / create / db)
  ts-plugin/       tsserver plugin: go-to-definition + diagnostic suppression
                   + attribute auto-complete for Class.register('tag') elements
```

Reaching straight for the source is the fastest way to resolve "why
doesn't X work?" with no documentation guesswork and no stale blog posts.

## Editor TS plugin: `@webjskit/ts-plugin`

This scaffold's `tsconfig.json` lists a single tsserver plugin. It is
editor-only, not required for the framework to run.

```jsonc
// tsconfig.json (already wired by the scaffold)
"plugins": [
  { "name": "@webjskit/ts-plugin" }
]
```

`@webjskit/ts-plugin` bundles `ts-lit-plugin` internally (it's a runtime
dependency of the plugin) and loads it programmatically, so users
list one entry, not two. You get the full stack of template-literal
intelligence (type-checking, diagnostics, go-to-def inside
`` html`…` `` and `` css`…` `` templates) **plus** webjs-aware behaviour
layered on top:

- "Unknown tag/attribute" diagnostics are silenced for elements
  registered via `Class.register('tag-name')`.
- Attribute auto-complete sourced from each component's
  `static properties`.
- Attribute-value type-check against `declare propName: T` annotations.

See [docs.webjs.com → Editor setup](https://docs.webjs.com/docs/editor-setup)
for the full walkthrough.

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
} from '../../components/ui/card.ts';
import { inputClass } from '../../components/ui/input.ts';
import { labelClass } from '../../components/ui/label.ts';
import { buttonClass } from '../../components/ui/button.ts';

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
import '../components/ui/dialog.ts';
import '../components/ui/tabs.ts';
```

```ts
// app/some-page/page.ts (uses the registered elements)
import { buttonClass } from '../../components/ui/button.ts';

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
  prisma.ts              PrismaClient singleton (import from here, never `new PrismaClient()`)
  ...                    other cross-cutting infra (session, auth config, etc.)
prisma/
  schema.prisma          Prisma schema, SQLite by default, switch provider for Postgres/MySQL
  dev.db                 SQLite file (gitignored); run `npm run db:migrate` to create
  migrations/            generated migration SQL
public/                  static assets, served at /public/*
test/unit/*.test.ts      unit tests (node --test)
test/browser/*.test.ts   browser tests (web-test-runner)
middleware.ts            root middleware (optional, outermost)
```

## Database (Prisma + SQLite by default)

Every scaffold includes a Prisma setup pointed at a local SQLite file.
First-run workflow:

```sh
cp .env.example .env          # DATABASE_URL is pre-filled for SQLite
npm run db:migrate            # creates prisma/dev.db + migration
npm run dev                   # webjs dev + prisma generate via predev
```

Scripts:

- `npm run db:migrate`: `prisma migrate dev` (dev-time schema changes + migration + generate)
- `npm run db:generate`: `prisma generate` (regenerate client only)
- `npm run db:studio`: `prisma studio` (GUI)
- `predev` hook auto-runs `prisma generate` before `npm run dev`
- `prestart` hook runs `prisma migrate deploy` before `npm start` (idempotent in prod)

Always import the client from `lib/server/prisma.ts` (never `new PrismaClient()` directly,
the singleton avoids opening a new connection on every dev-server reload). The file
lives under `lib/server/` because it's server-only: import it from `.server.{js,ts}`
actions, `route.ts` handlers, or `middleware.ts`, never from pages or components.

```ts
import { prisma } from '../../../lib/server/prisma.ts';
const users = await prisma.user.findMany();
```

To switch to Postgres or MySQL: change `provider` in `prisma/schema.prisma`
and the `DATABASE_URL` in `.env`.

## Imports

```ts
import { html, css, WebComponent } from '@webjskit/core';
import '@webjskit/core/client-router';              // enable SPA nav
import { unsafeHTML, live } from '@webjskit/core/directives';
import { createContext } from '@webjskit/core/context';
import { Task } from '@webjskit/core/task';
import { fixture, waitForUpdate } from '@webjskit/core/testing';

import { rateLimit, cache, createAuth, Credentials, Session } from '@webjskit/server';
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
import { WebComponent, html, css } from '@webjskit/core';

export class Counter extends WebComponent {
  static properties = { count: { type: Number } };
  static styles = css`button { padding: 8px 12px; }`;   // shadow-DOM only
  // static shadow = true;          // opt into shadow DOM (default: light DOM)
  // static lazy = true;             // download JS only when scrolled into view
  declare count: number;             // TypeScript-only typed accessor

  constructor() {
    super();
    this.count = 0;                  // SSR-meaningful default, see below
  }

  render() {
    return html`
      <button @click=${() => this.setState({ count: this.count + 1 })}>
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
   `setState({...})` to refine the render. The SSR'd first paint
   shows the constructor default. The browser refines after
   hydration.
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

## Server action pattern

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { prisma } from '../../../lib/server/prisma.ts';

export async function createPost(input: { title: string; body: string }) {
  if (!input.title) return { success: false, error: 'title required', status: 400 };
  const post = await prisma.post.create({ data: input });
  return { success: true, data: post };
}
```

Import it from a client component. The framework rewrites it into a
type-safe RPC stub automatically.

## Client navigation patterns (auto-magic)

The client router enables itself when the scaffolded root layout imports
`@webjskit/core/client-router`. After that, **every `<a href>` and
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
import { redirect, html } from '@webjskit/core';
import { createPost } from '../../modules/posts/actions/create-post.server.ts';

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
layout markers. Only the frame's content swaps. Use this sparingly -
folder-based layouts handle 99% of cases.

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
   components.** Direct imports of `@prisma/client`, `node:*`, or any
   server-only dependency from a page, layout, loading.ts, error.ts,
   not-found.ts, or component will crash the browser at module load.
   Wrap the access in a `.server.{js,ts}` file; the framework
   rewrites that import into an RPC stub for the browser. The `lib/`
   layout makes the split visible by path:
   - `lib/server/` is server-only (`prisma.ts`, `session.ts`,
     `password.ts`, mailers, external server clients, plus a
     `lib/server/utils/` subfolder for server-only helpers like
     `logger.ts`). Import these only from `.server.{js,ts}`,
     `route.ts`, or `middleware.ts`.
   - `lib/` everywhere else is browser-safe (runs in the browser, or
     on both server and browser). `lib/utils/` groups helper functions
     by concern (`cn.ts` for class merging, `ui.ts` for Tailwind
     helpers, `format.ts` for formatters). Files at the root of `lib/`
     (like `lib/constants.ts`) hold app-wide values, shared types, or
     thin helpers that don't fit a utils/ grouping. These can be
     imported from anywhere, including components and pages.
3. Event / property / boolean holes in `` html`` `` are unquoted:
   `@click=${fn}`, not `@click="${fn}"`.
4. Use `setState()`. Never mutate `this.state` directly.
5. Pages / layouts / metadata routes default-export a server-only function.
6. One exported function per action / query file. Name the file after it.
7. **Components must render meaningful HTML on first paint** (SSR
   uses constructor defaults + attributes, while `connectedCallback` is
   browser-only). Never fetch initial data in `connectedCallback` /
   `firstUpdated`. Fetch in the page function (server) and pass it as
   a prop. See *Component pattern* above.
8. **Erasable TypeScript only.** Node 24+ strips types via
   `module.stripTypeScriptTypes` (whitespace replacement, byte-exact
   line and column position preservation, no sourcemap shipped to the
   browser). Your `tsconfig.json` sets `erasableSyntaxOnly: true`, so
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
   the dev server falls back to esbuild and emits inline sourcemaps
   for those specific files: roughly 3x wire bytes per request, and
   stack-trace positions are no longer byte-exact. The
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

1. Branch before editing. Never push to `main` directly.
2. Every code change comes with: unit test(s), AGENTS.md / docs updates if
   the feature surface changed, `webjs check` passing.
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
   | Windsurf | text rule only (post-write hooks cannot inject context) | `.windsurfrules` |
   | GitHub Copilot | text rule only (no hooks API) | `.github/copilot-instructions.md` |
   | Google Antigravity | text rule only (no hooks API) | `AGENTS.md` |

   Tool-agnostic fallback: `.hooks/pre-commit` runs `webjs test` + `webjs check`
   on every commit, regardless of which agent (or human) made it. No AI
   attribution trailers in commit messages.
4. When unsure how a framework feature works, `grep` or `cat` the
   relevant `node_modules/@webjskit/*/src/` file before asking the user.

Project-specific conventions and overrides live in
[CONVENTIONS.md](./CONVENTIONS.md).
