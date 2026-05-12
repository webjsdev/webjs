# AGENTS.md — {{APP_NAME}}

Read this before editing any file. This is a webjs app: AI-first, web-
components-first, no build step. The framework's own full API reference
lives at https://github.com/vivek7405/webjs/blob/main/AGENTS.md and the
full hosted documentation (every API, recipe, and example) lives at
**https://docs.webjs.com** — treat this file as the app-scoped
companion and reach for docs.webjs.com whenever you need more detail.

## If you just scaffolded this app (AI agents — read first)

This project was created with `webjs create`. The files you see right
now — `app/page.ts` ("Hello from {{APP_NAME}}"), the example `User`
model in `prisma/schema.prisma`, the `theme-toggle` component, the
example users module (api/saas templates) — are **starting-point
references, not the final product**. Your job is to replace them with
the app the user actually asked for.

**Non-negotiables for every webjs app:**

1. **Use Prisma + SQLite for persistence.** It's already wired up
   (`prisma/schema.prisma`, `lib/prisma.ts`, `npm run db:migrate`,
   `predev` hook running `prisma generate`). For any data the app
   stores — todos, posts, messages, products, comments, anything —
   define a Prisma model and persist there.
   - **NEVER** store app data in JSON files (`data/todos.json`,
     `db.json`, …). The convention check `no-json-data-files` flags
     this and the user's prompt explicitly forbids it.
   - **NEVER** use in-memory arrays or `Map`s as a substitute for the
     database — they vanish on every dev-server reload and aren't
     shared across processes.
   - **NEVER** use `localStorage` to persist app data — it's per-browser
     and doesn't reach the server.
2. **One of three scaffolds only.** The CLI exposes exactly three:
   `full-stack` (default), `--template api`, `--template saas`. Don't
   reach for a `--template blog` / `--template todo` / `--template
   ecommerce` — they don't exist and the CLI will reject them.
3. **First step after scaffolding:** edit `prisma/schema.prisma` to the
   app's real domain models (delete the example `User` model unless the
   app actually needs users), run `webjs db migrate <name>`, then build
   pages / actions / queries against those models.

**Picking the right scaffold from the user's prompt** (you do this BEFORE
running `webjs create`; if you're reading this you've already scaffolded —
verify the choice was correct, otherwise re-scaffold in a fresh dir):

| User asks for… | Scaffold |
|---|---|
| Todo app, blog, notes, dashboard, marketplace, social feed, e-commerce, any product with a UI | `webjs create <name>` (default full-stack) |
| HTTP/JSON API only, no UI | `webjs create <name> --template api` |
| Anything with login / signup / accounts / protected pages / SaaS | `webjs create <name> --template saas` |

When in doubt, **full-stack is the default**. Pick `api` only if the user
is explicit about wanting a backend-only API. Pick `saas` only if the user
is explicit about auth / accounts / SaaS.

## Framework source is in `node_modules/`

No build step, no bundler, no minification — what you read is what
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
doesn't X work?" — no documentation guesswork, no stale blog posts.

## Editor TS plugin — `@webjskit/ts-plugin`

This scaffold's `tsconfig.json` lists a single tsserver plugin. It is
editor-only — not required for the framework to run.

```jsonc
// tsconfig.json (already wired by the scaffold)
"plugins": [
  { "name": "@webjskit/ts-plugin" }
]
```

`@webjskit/ts-plugin` bundles `ts-lit-plugin` internally (it's a runtime
dependency of the plugin) and loads it programmatically — so users
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

## UI components — Webjs UI (preinstalled)

This scaffold ships with the standard Webjs UI component kit
**already installed at `components/ui/`**. The kit is **AI-first** and
splits into two tiers. Internalise the split — picking the wrong tier
produces broken markup.

### Tier 1 — class-helper functions (the majority)

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

### Tier 2 — stateful custom elements

For things the browser doesn't provide natively (focus traps, portaled
overlays, keyboard-navigated lists): `dialog`, `alert-dialog`, `popover`,
`tooltip`, `hover-card`, `tabs`, `accordion`, `collapsible`,
`dropdown-menu`, `progress`, `sonner`, `toggle-group`. These ARE custom
elements — import them once (typically in `app/layout.ts`) and use
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

### AI agents — picking the right tier

For forms, dashboards, settings pages, marketing layouts: **call the
Tier-1 class helpers on raw native elements**. You get accessibility,
visual consistency, and form submission semantics for free —
`<input class=${inputClass()}>` is a real `<input>`, with native
autofill, browser validation, and `<form>` submission unchanged.

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
app/                     thin route adapters — import from modules/
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
components/              web components — extend WebComponent, call .register()
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
  schema.prisma          Prisma schema — SQLite by default, switch provider for Postgres/MySQL
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

- `npm run db:migrate` — `prisma migrate dev` (dev-time schema changes + migration + generate)
- `npm run db:generate` — `prisma generate` (regenerate client only)
- `npm run db:studio` — `prisma studio` (GUI)
- `predev` hook auto-runs `prisma generate` before `npm run dev`
- `prestart` hook runs `prisma migrate deploy` before `npm start` (idempotent in prod)

Always import the client from `lib/prisma.ts` (never `new PrismaClient()` directly —
the singleton avoids opening a new connection on every dev-server reload):

```ts
import { prisma } from '../../../lib/prisma.ts';
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

## Component pattern

```ts
import { WebComponent, html, css } from '@webjskit/core';

export class Counter extends WebComponent {
  static properties = { count: { type: Number } };
  static styles = css`button { padding: 8px 12px; }`;   // shadow-DOM only
  // static shadow = true;          // opt into shadow DOM (default: light DOM)
  // static lazy = true;             // download JS only when scrolled into view

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

## Server action pattern

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { prisma } from '../../../lib/prisma.ts';

export async function createPost(input: { title: string; body: string }) {
  if (!input.title) return { success: false, error: 'title required', status: 400 };
  const post = await prisma.post.create({ data: input });
  return { success: true, data: post };
}
```

Import it from a client component — the framework rewrites it into a
type-safe RPC stub automatically.

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
  // OR: title: { template: '%s — {{APP_NAME}}', default: '{{APP_NAME}}' }
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
// app/layout.ts — root, optionally owning the shell
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
2. Never import `@prisma/client` or `node:*` from client-reachable files —
   only from `.server.ts` modules or `lib/*.ts`.
3. Event / property / boolean holes in `` html`` `` are unquoted:
   `@click=${fn}`, not `@click="${fn}"`.
4. Use `setState()` — never mutate `this.state` directly.
5. Pages / layouts / metadata routes default-export a server-only function.
6. One exported function per action / query file. Name the file after it.

## Workflow expectations for AI agents

1. Branch before editing — never push to `main` directly.
2. Every code change comes with: unit test(s), AGENTS.md / docs updates if
   the feature surface changed, `webjs check` passing.
3. Commit and push after each logical unit. No AI attribution trailers.
4. When unsure how a framework feature works, `grep` or `cat` the
   relevant `node_modules/@webjskit/*/src/` file before asking the user.

Project-specific conventions and overrides live in
[CONVENTIONS.md](./CONVENTIONS.md).
