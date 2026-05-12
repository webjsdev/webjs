# CONVENTIONS.md — {{APP_NAME}}

This file defines the conventions for this webjs app. **AI agents MUST read
this file before writing any code.** It is the single source of truth for
how code should be structured, tested, and organized.

Sections marked `<!-- OVERRIDE -->` contain defaults you can customize.
Edit the content below the marker to change the convention for your project.

---

## How `CONVENTIONS.md` relates to `webjs check`

These are **two separate mechanisms** that share a topic but don't read
each other:

| | This file (`CONVENTIONS.md`) | `webjs check` |
|---|---|---|
| **Kind** | Markdown documentation. | Programmatic linter (code in `node_modules/@webjskit/server/src/check.js`). |
| **Audience** | Humans + AI agents who read the project. | Run from the CLI / CI. |
| **Effect of editing this markdown** | Changes the rules AI agents follow when they write code. | **Zero.** The linter does not parse this file. |
| **How to customize the LINTER** | n/a — it's hardcoded in `@webjskit/server`. | Disable rules via `package.json` or `webjs.conventions.js` (see below). |

So when you edit a `<!-- OVERRIDE -->` section here, you're telling AI
agents to follow a different convention — but `webjs check` will still
enforce its hardcoded rules. If you want the linter to stop flagging
something it currently flags, you have to **disable that rule** as a
separate step.

### Disabling a `webjs check` rule

`webjs check --rules` prints the full list. To disable one, add to
`package.json`:

```jsonc
{
  "webjs": {
    "conventions": {
      "tests-exist": false,
      "actions-in-modules": false
    }
  }
}
```

Or create `webjs.conventions.js`:

```js
export default {
  'tests-exist': false,
};
```

Only `false` is meaningful — there's no way to tweak rule *behaviour* via
config today, only to switch a whole rule on or off.

### What `webjs check` enforces today

Run `webjs check --rules` for the current set with descriptions. As of
`@webjskit/server@0.4.1`:

- `actions-in-modules` — `.server.{js,ts}` / `'use server'` files belong
  in `modules/<feature>/actions/` or `queries/`. `lib/` is exempt
  (cross-cutting server infra).
- `one-function-per-action` — files inside `modules/*/actions/` or
  `modules/*/queries/` should export exactly one async function.
- `components-have-register` — `WebComponent` subclasses must call
  `Class.register('tag')` or `customElements.define`.
- `no-server-imports-in-components` — components must not import
  `@prisma/client`, `node:*`, or `lib/*`.
- `reactive-props-use-declare` — props listed in `static properties` must
  use the `declare propName: Type` + constructor-default pattern (class
  field initializers clobber the framework's reactive accessor).
- `tag-name-has-hyphen` — custom element tags must contain a hyphen.
- `tests-exist` — each `modules/<feature>/` should have a test file.
- `no-json-data-files` — JSON files that look like a database (under
  `data/`, or named `db.json` / `database.json` / `*-db.json`) are
  forbidden; use Prisma + SQLite instead.

---

## AI agent workflow (non-negotiable)

**These rules apply to ALL AI agents (Claude, Cursor, Copilot, etc.)
working on this codebase. They are not optional and must not be skipped
even if the user doesn't explicitly ask.**

### Before starting ANY work — verify and sync the branch:

1. Check `git branch --show-current`
2. If on `main`/`master` → create a feature branch first
3. If on a feature branch → verify it matches the current task
4. Sync with parent: `git fetch origin && git rebase origin/main` if behind
5. Don't mix unrelated work on the wrong branch

### Every code change must include:

1. **Commit and push** — Commit AND push after each logical unit of work.
   Small, focused commits with meaningful messages. Always `git push`
   after committing. Don't accumulate uncommitted or unpushed changes.
   This is automatic — the user should never have to ask.

2. **Tests** — Unit test for logic, E2E test for user-facing behavior.
   See the "Testing" section below for what type of test each change needs.
   Run `webjs test` after every change. Never mark work as done with
   failing tests.

3. **Documentation updates** — When adding or modifying features:
   - Update `AGENTS.md` if the change affects the framework API surface.
   - Update `CONVENTIONS.md` only if the change introduces a new convention.
   - If a `docs/` directory exists, add or update the relevant doc page.
   - If a `website/` directory exists, update the landing page for
     user-facing features.

3. **Convention check** — Run `webjs check` after changes and fix
   any violations before reporting the task as done.

### Autonomous mode (sandbox / bypass permissions)

When running without interactive approval, agents must NOT ask questions.
Instead, auto-decide using best practices:
- On `main`? → Auto-create `feature/<task-slug>` branch
- Parent branch has new commits? → Auto-rebase before starting
- Ready to merge? → Auto-merge, delete feature/fix branches, keep
  long-lived branches (dev, staging, release/*)
- Commit message? → Auto-generate: what changed and why
- Tests failing? → Fix them, don't report the failure and stop
- Convention violations? → Fix them silently

The quality bar is the same. Autonomous mode means faster, not sloppier.

### What "automatically" means:

When a user says "add a contact page" or "add a delete button to posts",
the AI agent must deliver:
- The implementation (page, component, action, etc.)
- Unit tests for any new server actions/queries/components
- E2E test if the feature involves user interaction
- Documentation updates if applicable

The user should never have to say "also write tests" or "also update the
docs" — that is the agent's default behavior in a webjs project.

---

## Data persistence — Prisma + SQLite, never JSON files

<!-- OVERRIDE -->

Every webjs app uses **Prisma + SQLite** for persistence by default. The
scaffold ships `prisma/schema.prisma`, `lib/prisma.ts` (singleton), the
`predev` / `prestart` hooks that run `prisma generate` / `prisma migrate
deploy`, and `npm run db:migrate` / `db:generate` / `db:studio` scripts.

**AI agents — these rules are absolute:**

1. For ANY data the app stores (todos, posts, messages, products,
   comments, users…), define a Prisma model in `prisma/schema.prisma`
   and persist there.
2. **NEVER** create JSON files under `data/`, `db.json`, `posts.json`,
   `todos.json`, etc. as a fake database. The `no-json-data-files`
   convention check flags this and `webjs check` will fail.
3. **NEVER** use module-scope arrays or `Map`s as a "store" — they
   reset on every dev-server reload and can't scale beyond one process.
4. **NEVER** use `localStorage` / `sessionStorage` to persist app data —
   it's per-browser and never reaches the server. Use it only for UI
   preferences (theme, sidebar collapsed, etc.).
5. To add a model: edit `prisma/schema.prisma`, then `npm run db:migrate
   -- --name <description>`. Access via `import { prisma } from
   '../../../lib/prisma.ts'` — never `new PrismaClient()`.

To switch to Postgres or MySQL: change `provider` in
`prisma/schema.prisma` and the `DATABASE_URL` in `.env`. Do this only
if the user explicitly asks for it — SQLite is the right default for
dev and small production workloads.

---

## The scaffold is reference, not the final product

<!-- OVERRIDE -->

This project was created with `webjs create`. Every file you see right
now — `app/page.ts` ("Hello from …"), the example `User` model, the
`theme-toggle` component, the example users module (api / saas
templates) — is a **starting point**.

When the user asks the agent to build their actual app:

1. **Replace the example `User` model** in `prisma/schema.prisma` with
   the real domain models the app needs (e.g. `Todo`, `Post`, `Message`)
   — unless the app actually has users.
2. **Replace `app/page.ts`** with the app's real homepage. Don't ship
   "Hello from …" as the deliverable.
3. **Delete or replace `components/theme-toggle.ts`** if the app doesn't
   need a theme picker.
4. **Delete the example users module** (api/saas templates) if the app
   doesn't use it.
5. **Keep:** the Prisma setup, the test config, the agent config files
   (`AGENTS.md`, `CONVENTIONS.md`, `CLAUDE.md`, `.cursorrules`, etc.),
   `lib/prisma.ts`, the directory conventions, the design tokens in
   `app/layout.ts`. These are the infrastructure, not the example app.

The scaffold exists so the agent doesn't reinvent the directory layout,
the Prisma wiring, the test runner config, or the convention files. It
does NOT exist so the agent ships the example homepage.

---

## Sensible defaults

<!-- OVERRIDE -->
webjs uses sensible defaults. Environment
variables control infrastructure — no config files needed:

| Environment variable | Effect |
|---|---|
| `REDIS_URL` | Connection string consumed by `redisStore({ url: process.env.REDIS_URL })`. Not auto-wired — call `setStore(redisStore())` once at app startup to put cache / sessions / rate-limit on Redis. |
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional) |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID (optional) |
| `PORT` | Server port (default: 3000) |

**Development:** zero env vars needed. Everything works with memory/cookie/disk.
**Production:** set `AUTH_SECRET` + `SESSION_SECRET`. For horizontal scaling, also set `REDIS_URL` and add one line at app startup:

```js
import { setStore, redisStore } from '@webjskit/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

---

## Architecture: Modules

<!-- OVERRIDE -->
This app uses the **modules architecture** for feature-scoped code:

```
modules/
  <feature>/
    actions/        Server mutations — one async function per file (*.server.ts)
    queries/        Server reads — one async function per file (*.server.ts)
    components/     Feature-owned web components
    utils/          Pure helper functions
    types.ts        Shared TypeScript types / JSDoc typedefs
```

**Rules:**
- One exported function per server action/query file
- Server actions must use `'use server'` pragma or `.server.ts` extension
- Components must call `Class.register('tag')`
- Never import `@prisma/client`, `node:*`, or `lib/` directly from components — use server actions
- Routes (`app/**/page.ts`, `app/**/route.ts`) must be thin: import logic from modules

---

## Architecture: Routes

<!-- OVERRIDE -->
Routes live under `app/` and follow NextJs App Router conventions:

- `app/page.ts` — Homepage
- `app/<segment>/page.ts` — Static route
- `app/[param]/page.ts` — Dynamic route
- `app/[...rest]/page.ts` — Catch-all
- `app/(group)/...` — Route group (folder not in URL)
- `app/**/route.ts` — API endpoint
- `app/**/layout.ts` — Layout wrapper
- `app/**/error.ts` — Error boundary
- `app/**/middleware.ts` — Per-segment middleware

**Special route files:**
- `app/**/error.ts` — Error boundary. Default export receives `{ error }`, returns `TemplateResult`. Nearest boundary catches errors from pages below it.
- `app/**/loading.ts` — Loading state. Auto-wraps the sibling page in a `Suspense` boundary. Shown while async page functions resolve.
- `app/**/not-found.ts` — 404 page. Nearest wins when `notFound()` is thrown.
- `app/sitemap.ts` — Dynamic sitemap at `/sitemap.xml`. Export a function returning an array of `{ url, lastModified }`.
- `app/robots.ts` — Dynamic robots.txt at `/robots.txt`.
- `app/manifest.ts` — Web app manifest at `/manifest.json`.

**Rules:**
- A folder cannot have both `page.ts` and `route.ts`
- Page/layout default exports must be functions (possibly async)
- Route handlers export named methods: `GET`, `POST`, `PUT`, `DELETE`, `WS`

---

## Testing

<!-- OVERRIDE -->
Every feature module should have corresponding tests:

### Unit tests — `test/unit/`

```
test/
  unit/
    <feature>.test.ts     One test file per module feature
```

- Run with: `webjs test` or `node --test test/unit/*.test.ts`
- Use `node:test` and `node:assert/strict`
- Test server actions by importing and calling them directly
- Test component rendering with `renderToString` from webjs
- Test utility functions with simple assertions

**Naming:** `test/unit/<module-name>.test.ts` (e.g., `test/unit/auth.test.ts`)

### Browser tests — `test/browser/`

```
test/
  browser/
    <feature>.test.js     Real-browser tests per feature
```

- Run with: `webjs test --browser` or `npx wtr`
- Uses **Web Test Runner (WTR) + Playwright** — tests run in real Chromium
- Full Shadow DOM, events, adoptedStyleSheets, IntersectionObserver
- Test components, user interactions, navigation, form submission

**Naming:** `test/browser/<feature>.test.js` (e.g., `test/browser/auth.test.js`)

### Debugging with Playwright MCP

This project includes a Playwright MCP server (`.claude.json`). When
debugging UI issues, AI agents can use the Playwright MCP tools to:
- Navigate to pages in a real browser
- Click elements, fill forms, interact with the UI
- Take screenshots to see what the user sees
- Inspect the accessibility tree for element discovery

Use `Playwright MCP` tools instead of writing one-shot Bash scripts
with puppeteer or playwright imports.

### When to write tests

| Change | Server test (node:test) | Browser test (WTR) |
|--------|------------------------|-------------------|
| New server action | Required | — |
| New component | Required (SSR output) | Required (interaction) |
| New page/route | — | Required |
| Bug fix | Required (regression) | If user-facing |
| Refactor | Existing tests must pass | Existing tests must pass |

---

## UI components — prefer `ui-*` over hand-rolled Tailwind

<!-- OVERRIDE -->

This scaffold ships with `@webjskit/ui` preinstalled at `components/ui/`.
For buttons, inputs, cards, dialogs, dropdowns, selects, forms, toasts,
tables — anywhere a shadcn-style component fits — **use the `ui-*`
components instead of hand-rolling buttons/inputs with raw Tailwind
classes.**

```ts
// Good — uses the standard kit (a11y, focus mgmt, keyboard handling included)
return html`
  <ui-button variant="default" size="lg">Save</ui-button>
  <ui-input placeholder="Email" />
`;

// Avoid — hand-rolled equivalents lose a11y + visual consistency
return html`
  <button class="px-4 py-2 rounded-md bg-accent text-accent-fg">Save</button>
  <input class="w-full px-3 py-2 border rounded-md" placeholder="Email" />
`;
```

Add more components with `webjs ui add <name>`. The catalogue lives at
[https://ui.webjs.dev](https://ui.webjs.dev).

**Hand-rolled Tailwind is still appropriate for:**
- One-off marketing pages, hero sections, landing CTAs.
- Anywhere the visual design intentionally diverges from the shadcn baseline.
- Layout primitives (`<div class="grid grid-cols-3 gap-4">`).

The convention: any *interactive* element (button, input, select,
dialog, dropdown) on a product surface uses `ui-*`.

---

## Components

<!-- OVERRIDE -->

```ts
import { WebComponent, html } from '@webjskit/core';

export class MyWidget extends WebComponent {
  static properties = { label: { type: String }, count: { type: Number } };
  declare label: string;
  declare count: number;
  // Light DOM is the default; Tailwind utility classes apply directly.

  constructor() {
    super();
    // Defaults go here — never as class-field initializers
    // (`label = ''` would clobber the framework's reactive accessor).
    this.label = '';
    this.count = 0;
  }

  render() {
    return html`
      <div class="p-4 border border-border rounded-lg">
        <p class="font-serif text-fg">${this.label}: ${this.count}</p>
      </div>
    `;
  }
}
MyWidget.register('my-widget');
```

`static properties` is the runtime declaration (reactive accessor,
attribute coercion, reflection). `declare` types the field for
TypeScript without emitting a class-field initializer that would
clobber the reactive accessor at construction time. The two
declarations together give you full intelligence in any tsserver-backed
editor — see the Editor Setup docs for the `ts-lit-plugin` +
`@webjskit/ts-plugin` setup that extends this to tag / attribute
intelligence inside `html\`…\`` templates (go-to-definition, attribute
auto-complete from `static properties`, no "Unknown tag" red-squiggle on
registered webjs elements).

**Rules:**
- One component per file
- **Light DOM by default.** Opt in to shadow DOM with `static shadow = true` when you need scoped styles, `<slot>` projection, or third-party-embed isolation.
- Prefer Tailwind utility classes for styling. They're unique by construction (`p-4`, `font-semibold`) so they can't collide across components.
- **If a light-DOM component authors its own custom CSS (a `<style>` block in `render()` or an imported stylesheet), every class selector MUST be prefixed with the component's tag name.** Either pattern works — pick one and stay consistent:
  - `.my-widget__body`, `.my-widget__title` (BEM-ish)
  - `my-widget .body`, `my-widget .title` (descendant selector)
- Tag name must contain a hyphen (HTML spec)
- Always call `Class.register('tag')` — the standard DOM API
- **Reactive props use `declare propName: Type` (no value) plus a default in `constructor()` after `super()`.** Never write `propName = value` or `propName: Type = value` as a class-field initializer — it compiles to `Object.defineProperty(this, …)` after `super()` and clobbers the framework's reactive accessor, silently breaking re-renders. `webjs check` flags this via the `reactive-props-use-declare` rule.
- Use `setState()` for state changes, never mutate `this.state` directly
- Use lifecycle hooks (`firstUpdated`, `updated`) only when needed

---

## Components: Light DOM (default) vs Shadow DOM (opt-in)

<!-- OVERRIDE -->

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Write `class="..."` in your template. Plain children, global styles apply. |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` scopes bare selectors. |
| `<slot>` content projection | Shadow DOM | Slots only work inside shadow roots. |
| Third-party embed isolation | Shadow DOM | CSS can't leak in or out. |

**Light DOM** = the component renders as plain HTML. Global CSS and
Tailwind utility classes apply directly. Use `document.querySelector`
to find elements. No `:host`, no `::part`, no CSS-variable plumbing.

**Shadow DOM** = opt-in style encapsulation. Declare `static shadow = true`
and author styles via `static styles = css\`...\`` (adopted via
`adoptedStyleSheets`). The browser enforces the boundary; nothing leaks
in or out.

Both modes are fully SSR'd. Light DOM emits content as direct children
with a `<!--webjs-hydrate-->` marker. Shadow DOM emits a
`<template shadowrootmode="open">` that the browser attaches automatically.
Both hydrate without flash on the client.

---

## Styling: Tailwind + JS helpers

<!-- OVERRIDE -->

The scaffold ships with the **Tailwind CSS browser runtime** + `@theme`
design tokens defined in the root layout. Every colour, font family,
fluid type scale value, and motion duration is declared once in `@theme`
and available everywhere via utility classes (`text-fg`, `bg-bg-elev`,
`font-serif`, `duration-fast`, `text-display`).

**Dedup repeated Tailwind class bundles with JS helpers, not `@apply`.**
When the same string of classes appears in 2+ places, extract it into a
small function in `app/_utils/ui.ts`:

```ts
// app/_utils/ui.ts
import { html } from '@webjskit/core';

export function rubric(label: string) {
  return html`
    <span class="block font-mono text-[11px] leading-none font-semibold tracking-[0.2em] uppercase text-accent mb-4">● ${label}</span>
  `;
}
```

Consume:

```ts
// app/page.ts
import { rubric } from './_utils/ui.ts';

export default function Home() {
  return html`
    ${rubric('welcome')}
    <h1 class="font-serif text-display">Hello</h1>
  `;
}
```

Helpers run at SSR time inside `html\`\``, so the output is identical
to writing the classes inline — no client-side runtime.

**Why not `@apply`?** `@apply` hides which utilities back a class and
creates a second source of truth. JS helpers keep the class bundle
visible at the definition site and compose naturally with conditional
classes and active states.

**Custom CSS is still supported** — plain `<style>` blocks, CSS modules,
or a build-step pipeline. The framework has no hard dependency on Tailwind.
If you mix custom CSS into a light-DOM component, apply the class-prefix
rule (see Components section above).

---

## Styling alternative: vanilla CSS end-to-end

<!-- OVERRIDE -->

If you'd rather skip Tailwind, webjs works with plain CSS as long as you
wrap pages, layouts, and components so class names don't collide in the
global light-DOM namespace.

**Convention — three scopes:**

| Scope | Wrapper | Derivation |
|---|---|---|
| **Component** | Custom-element tag | Tag is already unique |
| **Page** | `.page-<route>` | `app/dashboard/page.ts` → `.page-dashboard`; `app/blog/[slug]/page.ts` → `.page-blog-slug`; root `app/page.ts` → `.page-home` |
| **Layout** | `.layout-<name>` | `app/layout.ts` → `.layout-root`; `app/admin/layout.ts` → `.layout-admin` |

Every page wraps its output in `<div class="page-<route>">`. Every
layout wraps in `<div class="layout-<name>">`. Components scope via
their tag. Styles colocate as `const STYLES = css\`…\`` + `<style>${'$'}{STYLES.text}</style>`.

```ts
// app/dashboard/page.ts
import { html, css } from '@webjskit/core';

const STYLES = css\`
  .page-dashboard {
    .actions     { display: flex; gap: 12px; }
    .btn         { padding: 12px 24px; border-radius: 999px; }
    .btn-primary { background: var(--accent); color: var(--accent-fg); }
  }
\`;

export default function Dashboard() {
  return html\`
    <style>${'$'}{STYLES.text}</style>
    <div class="page-dashboard">
      <div class="actions">
        <a class="btn btn-primary" href="/new">+ New</a>
      </div>
    </div>
  \`;
}
```

Inside each scope, `.btn` / `.input` / `.form` / `.item` are free
names — CSS descendant combinators stop them at the scope boundary.
A small curated set of **primitives** (`rubric`, `banner`,
`accent-link`, `display-h1`, …) can live global in the root layout
as your design system.

**When you'd pick this over Tailwind:**
- You want zero runtime scripts and zero build step.
- You prefer idiomatic CSS and plain-cascade debugging.
- You already have a design system in CSS custom properties.

**Costs:**
- Write more per-file CSS (no utility ecosystem).
- Discipline: every page/layout remembers to wrap.
- Renaming a route folder = 2 textual edits in one file (the wrapper class + the matching `class=` attribute).

Pick one convention per project and stay consistent.

---

## Rate limiting & middleware

<!-- OVERRIDE -->
Use `rateLimit()` as per-segment middleware to protect routes:

```ts
// app/api/auth/middleware.ts — protect auth endpoints
import { rateLimit } from '@webjskit/server';
export default rateLimit({ window: '10s', max: 5 });
```

Place `middleware.ts` at any route level — it applies to that subtree only.
Chain runs outermost → innermost.

---

## Lazy loading

<!-- OVERRIDE -->
For below-the-fold components with heavy JS, defer loading until visible:

```ts
class HeavyChart extends WebComponent {
  static lazy = true;  // module loaded on scroll, not on page load
  // ...
}
```

SSR content is visible immediately — only the JS download is deferred.
**Do NOT use** for above-the-fold or critical UI (navigation, forms).

---

## expose() — REST endpoints from server actions

<!-- OVERRIDE -->
Tag a server action to also be reachable over HTTP:

```ts
import { expose } from '@webjskit/core';
export const createPost = expose('POST /api/posts', async ({ title, body }) => {
  return prisma.post.create({ data: { title, body } });
});
```

The same function works via RPC (from components) and HTTP (for external
callers). Use `expose()` when mobile apps, webhooks, or third parties need
to call your action. For internal-only actions, plain server actions are
simpler and CSRF-protected.

**Security:** `expose()`d endpoints are NOT CSRF-protected. Authenticate
via bearer tokens, API keys, or auth middleware.

---

## Server actions

<!-- OVERRIDE -->

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { prisma } from '../../../lib/prisma.ts';
import type { ActionResult } from '../types.ts';

export async function createPost(input: {
  title: string;
  body: string;
}): Promise<ActionResult<Post>> {
  // validate, create, return
}
```

**Rules:**
- One function per file (greppable, AI-agent friendly)
- File name matches function name: `create-post.server.ts` → `createPost`
- Return `ActionResult<T>` envelope for actions that can fail
- Never throw for expected errors — return `{ success: false, error, status }`
- Validate input at the top of the function

---

## Code style

<!-- OVERRIDE -->
- TypeScript with explicit `.ts` extensions in imports
- No semicolons (or with — pick one and be consistent)
- `const` by default, `let` when needed, never `var`
- Prefer `async/await` over `.then()` chains
- Minimal comments — code should be self-documenting
- No barrel files (`index.ts` re-exporting everything) — import from the source directly

---

## Git workflow

<!-- OVERRIDE -->

This project enforces a git workflow via agent-specific config files
(`.claude/settings.json`, `.cursorrules`, `.windsurfrules`,
`.github/copilot-instructions.md`). These rules apply to ALL AI agents:

**Commit rules:**
- **Commit often** — after each logical unit of work, not at the end
- **Meaningful messages** — imperative mood, what changed and why
  (e.g., `Add contact form with email validation`)
- **NEVER add AI attribution** — no `Co-Authored-By: Claude`, no
  `Generated by AI`, no `AI-assisted` trailers or prefixes
- **Small, focused commits** — don't batch unrelated changes
- **Committing is automatic** — the user should never have to ask
  "please commit". Commit after completing each task.

**Branch rules:**
- **Feature branches** — never commit directly to main
- **Branch naming** — `feature/<name>`, `fix/<name>`, `refactor/<name>`
- **Pull requests** — always create a PR, never push to main directly
- **NEVER merge without user permission** — before merging ANY branch
  into ANY other branch, ask: "Ready to merge `<branch>` into `<target>`?
  Delete or keep `<branch>` after?" Wait for approval AND the preference.
- **Claude Code hook** (`.claude/hooks/guard-main-merge.sh`) enforces
  merge/push-to-main approval programmatically for Claude agents.
  Other agents enforce this via `.cursorrules`, `.windsurfrules`,
  `.github/copilot-instructions.md`.

**Pre-commit checks:**
- `webjs test` must pass
- `webjs check` must pass
- No unrelated files in the commit

---

## Overriding conventions

See the **"How `CONVENTIONS.md` relates to `webjs check`"** section at
the top of this file. Short version: disable specific linter rules via
`package.json` (`webjs.conventions.<rule>: false`) or `webjs.conventions.js`.

Run `webjs check` to validate. Run `webjs check --rules` to list every
rule with its description.

---

## Scaffold

Create new projects with `webjs create`:

```sh
webjs create <name>                  # full-stack (default)
webjs create <name> --template api   # backend-only API
webjs create <name> --template saas  # auth + dashboard + Prisma User model
```

**Route-wrapping pattern (especially for `--template api` apps):**
Routes are thin wrappers over typed server actions. Business logic lives in
`modules/`, routes just import and call the action/query:

```ts
// app/api/users/route.ts — thin wrapper
import { listUsers } from '../../../modules/users/queries/list-users.server.ts';
import { createUser } from '../../../modules/users/actions/create-user.server.ts';

export async function GET() { return Response.json(await listUsers()); }
export async function POST(req: Request) {
  const result = await createUser(await req.json());
  if (!result.success) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data, { status: 201 });
}
```
