# CONVENTIONS.md for {{APP_NAME}}

This file defines the conventions for this webjs app. **AI agents MUST read
this file before writing any code.** It is the single source of truth for
how code should be structured, tested, and organized.

Sections marked `<!-- OVERRIDE -->` contain defaults you can customize.
Edit the content below the marker to change the convention for your project.

---

## How `CONVENTIONS.md` relates to `webjs check`

This markdown file holds **architectural conventions** (modules layout,
styling, testing, git workflow) that the linter can't enforce
programmatically. The `<!-- OVERRIDE -->` markers let you customize
those for this project, and AI agents read them when writing code.

The **lint rules** are a separate, narrower thing: the boolean checks
that `webjs check` runs (one function per action, components register
themselves, tag names have hyphens, etc.). They are NOT documented in
this file. Their **single source of truth** is the
`"webjs": { "conventions": { … } }` key in `package.json`.

If that key is absent, **every default rule is enabled** and AI agents
must follow all of them.

### Discovering the active rules

```sh
webjs check --rules
```

prints every available rule with its description and shows which ones
are currently disabled by this project's overrides. That command is the
**authoritative** list. Do not maintain a copy elsewhere; it will drift.

### Disabling a rule

Add the rule name to `package.json` with a value of `false`:

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

Only `false` is meaningful. There's no way to tweak rule *behaviour*
via config. A rule is either on or off.

### Rule for AI agents

1. Run `webjs check --rules` to learn the active rule set for this
   project.
2. Treat every rule not explicitly disabled as binding when writing
   code.
3. To change which rules are active, edit the `webjs.conventions`
   block in `package.json`. Never inline a rule list into prose, since
   it will drift.

---

## AI agent workflow (non-negotiable)

**These rules apply to ALL AI agents (Claude, Cursor, Copilot, etc.)
working on this codebase. They are not optional and must not be skipped
even if the user doesn't explicitly ask.**

### Before starting ANY work: verify and sync the branch

1. Check `git branch --show-current`
2. If on `main`/`master` → create a feature branch first
3. If on a feature branch → verify it matches the current task
4. Sync with parent: `git fetch origin && git rebase origin/main` if behind
5. Don't mix unrelated work on the wrong branch

### Every code change must include:

1. **Commit and push per logical unit, not at the end.** A logical unit is
   one feature, one fix, one rename, one doc rewrite. Small, focused commits
   with meaningful messages. Always `git push` after committing. Do not
   accumulate uncommitted or unpushed changes. If you have 5+ unstaged files
   spanning different concerns, commit before continuing. The
   `.claude/hooks/nudge-uncommitted.sh` hook fires at threshold 4 to remind
   you, and ignoring it means you are batching. The user should never have
   to ask for a commit.

2. **Tests.** Unit test for logic, E2E test for user-facing behavior.
   See the "Testing" section below for what type of test each change needs.
   Run `webjs test` after every change. Never mark work as done with
   failing tests.

3. **Documentation updates.** See the **Definition of done** section
   below for the per-surface checklist. The short version: docs land on
   the same PR as the code, never as a follow-up. Drift is how a
   codebase rots; the user should never have to ask "did you update the
   docs?"

4. **Convention check.** Run `webjs check` after changes and fix
   any violations before reporting the task as done.

### Definition of done (MUST be addressed BEFORE opening the PR)

This is the per-PR contract. Before running `gh pr create`, walk through
every surface below and either update it OR write `N/A because <reason>`
in the PR body so the omission is visible. The
[`.github/pull_request_template.md`](./.github/pull_request_template.md)
checklist mirrors this list.

**Surfaces to consider on EVERY PR:**

1. **Tests.** Unit coverage for new logic. Real-browser coverage for
   user-facing behaviour. `webjs test` must pass; `webjs test --browser`
   for any DOM-touching change. See the "Testing" section below for the
   per-change matrix.
2. **`AGENTS.md`.** The project contract for AI agents. Update when:
   - A new API surface is exposed (a new server action / query module,
     a new exposed REST endpoint, a new component tag in the public
     catalogue).
   - An invariant changes (file routing, persistence rules, security
     posture).
   - A new project-wide agent workflow rule applies.
3. **`CONVENTIONS.md`** (this file). Update when:
   - A new architectural convention is introduced (a new module split,
     a new testing layout, a new git rule).
   - An existing convention shifts. Do NOT enumerate lint rules in
     prose; those live in `package.json` under
     `"webjs": { "conventions": { … } }`.
4. **`README.md`.** Update when install steps, the homepage example,
   or the public surface description changes.
5. **`docs/`** (if the project has one). Every user-visible change. Add
   a new page if the surface is new and there's no obvious home.
6. **`website/`** (if the project has one). Marketing copy on the
   landing page or pricing page when the change touches a claim made
   there.
7. **Scaffold or codegen scripts** (if the project has any). Update
   when the change affects what new instances generate.
8. **PR body.** Summary, test plan checklist, and a per-row answer to
   the Definition-of-done checklist (`Updated <path>` or `N/A because
   <reason>`).

**How to use the checklist.** For each surface above, explicitly answer
one of:

- **Updated**, with the file path in the commit and PR body.
- **N/A because**, with a one-sentence reason.

If you find yourself writing `N/A` for every surface except tests, that
is a smell. Most user-visible code changes touch at least one doc page
and either `AGENTS.md` or `CONVENTIONS.md`.

**Worked examples:**

- Add a new server action `modules/posts/actions/create-post.server.ts`.
  Updated: test (`test/posts/posts.test.ts`), AGENTS.md (action listed
  in the module map if the project keeps one), docs
  (`/docs/server-actions` if the page lists shipped actions). N/A on
  README / website / scaffold.
- Rename a directory convention (e.g. `modules/` to `features/`).
  Updated: existing tests still pass after renames, AGENTS.md (whole
  modules section), CONVENTIONS.md (architecture section), scaffold
  scripts (so new generations follow the new name), README if the
  layout is documented there. N/A on website unless the layout appears
  in a landing-page screenshot.
- Fix a bug in `rateLimit()` that doesn't change the surface. Updated:
  test (regression). N/A on everything else (the public contract did
  not change).

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
docs". That is the agent's default behavior in a webjs project.

---

## Data persistence: Prisma + SQLite, never JSON files

<!-- OVERRIDE -->

Every webjs app uses **Prisma + SQLite** for persistence by default. The
scaffold ships `prisma/schema.prisma`, `lib/prisma.server.ts` (singleton), the
`predev` / `prestart` hooks that run `prisma generate` / `prisma migrate
deploy`, and `npm run db:migrate` / `db:generate` / `db:studio` scripts.

**AI agents: these rules are absolute.**

1. For ANY data the app stores (todos, posts, messages, products,
   comments, users…), define a Prisma model in `prisma/schema.prisma`
   and persist there.
2. **NEVER** create JSON files under `data/`, `db.json`, `posts.json`,
   `todos.json`, etc. as a fake database. The `no-json-data-files`
   convention check flags this and `webjs check` will fail.
3. **NEVER** use module-scope arrays or `Map`s as a "store". They
   reset on every dev-server reload and can't scale beyond one process.
4. **NEVER** use `localStorage` / `sessionStorage` to persist app data -
   it's per-browser and never reaches the server. Use it only for UI
   preferences (theme, sidebar collapsed, etc.).
5. To add a model: edit `prisma/schema.prisma`, then `npm run db:migrate
   -- --name <description>`. Access via `import { prisma } from
   '../../../lib/prisma.server.ts'` **only inside `.server.{js,ts}` files,
   `route.ts` handlers, or `middleware.ts`**. Never new `PrismaClient()`.
   Components, pages, and layouts call into the wrapped server query
   instead; the framework rewrites that import to an RPC stub on the
   browser side, so prisma source never reaches the client.

To switch to Postgres or MySQL: change `provider` in
`prisma/schema.prisma` and the `DATABASE_URL` in `.env`. Do this only
if the user explicitly asks for it. SQLite is the right default for
dev and small production workloads.

---

## The scaffold is reference, not the final product

<!-- OVERRIDE -->

This project was created with `webjs create`. Every file you see right
now (the `app/page.ts` "Hello from …" homepage, the example `User`
model, the `theme-toggle` component, the example users module in api /
saas templates) is a **starting point**.

When the user asks the agent to build their actual app:

1. **Replace the example `User` model** in `prisma/schema.prisma` with
   the real domain models the app needs (e.g. `Todo`, `Post`, `Message`)
   - unless the app actually has users.
2. **Replace `app/page.ts`** with the app's real homepage. Don't ship
   "Hello from …" as the deliverable.
3. **Delete or replace `components/theme-toggle.ts`** if the app doesn't
   need a theme picker.
4. **Delete the example users module** (api/saas templates) if the app
   doesn't use it.
5. **Keep:** the Prisma setup, the test config, the agent config files
   (`AGENTS.md`, `CONVENTIONS.md`, `CLAUDE.md`, `.cursorrules`, etc.),
   `lib/prisma.server.ts`, the directory conventions, the design tokens in
   `app/layout.ts`. These are the infrastructure, not the example app.

The scaffold exists so the agent doesn't reinvent the directory layout,
the Prisma wiring, the test runner config, or the convention files. It
does NOT exist so the agent ships the example homepage.

---

## Sensible defaults

<!-- OVERRIDE -->
webjs uses sensible defaults. Environment
variables control infrastructure (no config files needed):

| Environment variable | Effect |
|---|---|
| `REDIS_URL` | Connection string consumed by `redisStore({ url: process.env.REDIS_URL })`. Not auto-wired. Call `setStore(redisStore())` once at app startup to put cache / sessions / rate-limit on Redis. |
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID (optional) |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID (optional) |
| `PORT` | Server port (default: 8080) |
| `WEBJS_PUBLIC_*` | Any env var starting with this prefix is exposed to the browser as `process.env.WEBJS_PUBLIC_X`. Components can read it directly. No build step, no transform. Use for API base URLs, Stripe publishable keys, analytics IDs, anything that is intended to be visible client-side. |

**Server-only by default.** Any env var without the `WEBJS_PUBLIC_` prefix never reaches the browser. Reading `process.env.DATABASE_URL` from a component returns `undefined`, the same as a typo. The prefix is fail-closed: secrets cannot accidentally leak.

**Development:** zero env vars needed. Everything works with memory/cookie/disk.
**Production:** set `AUTH_SECRET` + `SESSION_SECRET`. For horizontal scaling, also set `REDIS_URL` and add one line at app startup:

```js
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

---

## Architecture: Modules

<!-- OVERRIDE -->
This app uses the **modules architecture** for feature-scoped code:

```
modules/
  <feature>/
    actions/        Server mutations (one async function per file, *.server.ts)
    queries/        Server reads (one async function per file, *.server.ts)
    components/     Feature-owned web components
    utils/          Pure helper functions
    types.ts        Shared TypeScript types / JSDoc typedefs
```

**Rules:**
- One exported function per server action/query file
- Server actions need BOTH the `.server.{js,ts}` extension AND a `'use server'` directive at the top. Extension alone marks a server-only utility (source-protected, not RPC-callable). Directive alone is a lint violation (`use-server-needs-extension`).
- Components must call `Class.register('tag')`
- **Server-only code goes in `.server.{js,ts}` files, `route.ts` handlers, or `middleware.ts`. Never in pages, layouts, or components.** Direct imports of `@prisma/client` or `node:*` from pages, layouts, or components crash the browser at module load. Wrap in a `.server.{js,ts}` file; the framework rewrites that import to an RPC stub on the browser side. `lib/` holds both server-only infra (`lib/prisma.server.ts`) and browser-safe utilities (`lib/utils/cn.ts` with `cn`); the convention is "if a `lib/` file needs Node APIs, only import it from server-only files."
- Routes (`app/**/page.ts`, `app/**/route.ts`) must be thin: import logic from modules

---

## Architecture: Routes

<!-- OVERRIDE -->
Routes live under `app/` and follow NextJs App Router conventions:

- `app/page.ts`: Homepage
- `app/<segment>/page.ts`: Static route
- `app/[param]/page.ts`: Dynamic route
- `app/[...rest]/page.ts`: Catch-all
- `app/(group)/...`: Route group (folder not in URL)
- `app/**/route.ts`: API endpoint
- `app/**/layout.ts`: Layout wrapper
- `app/**/error.ts`: Error boundary
- `app/**/middleware.ts`: Per-segment middleware

**Special route files:**
- `app/**/error.ts`: Error boundary. Default export receives `{ error }`, returns `TemplateResult`. Nearest boundary catches errors from pages below it.
- `app/**/loading.ts`: Loading state. Auto-wraps the sibling page in a `Suspense` boundary. Shown while async page functions resolve.
- `app/**/not-found.ts`: 404 page. Nearest wins when `notFound()` is thrown.
- `app/sitemap.ts`: Dynamic sitemap at `/sitemap.xml`. Export a function returning an array of `{ url, lastModified }`.
- `app/robots.ts`: Dynamic robots.txt at `/robots.txt`.
- `app/manifest.ts`: Web app manifest at `/manifest.json`.

**Rules:**
- A folder cannot have both `page.ts` and `route.ts`
- Page/layout default exports must be functions (possibly async)
- Route handlers export named methods: `GET`, `POST`, `PUT`, `DELETE`, `WS`

---

## Testing

<!-- OVERRIDE -->
Tests are organised by **feature**, mirroring `modules/<feature>/`.
Each feature gets its own folder under `test/`, even when it starts
with a single file. Test KIND (browser / e2e / smoke) lives in a
subfolder inside the feature, and only appears when there is a real
test of that kind.

```
test/
  <feature>/
    <name>.test.ts             ← node test: unit + integration
    browser/<name>.test.js     ← real-browser test (web-test-runner)
    e2e/<name>.test.ts         ← full-app end-to-end (opt in: WEBJS_E2E=1)
    smoke/<name>.test.ts       ← fast post-deploy sanity check
```

Concrete example:

```
test/
  auth/
    auth.test.ts                 # signup / login / currentUser, node
    password.test.ts             # hashing / verify, node
    browser/login-form.test.js   # real-browser, only if exercising DOM
  posts/
    posts.test.ts                # CRUD via actions
    browser/post-editor.test.js
  hello/
    hello.test.ts                # the scaffold's starter test
    browser/hello.test.js
    e2e/hello.test.ts
```

### Test kinds

| Kind | Where | What it does |
|------|-------|--------------|
| node (unit + integration) | `test/<feature>/*.test.ts` | Fast, no spawned process. Import server actions/queries/utilities and call them directly. Use `renderToString` for SSR HTML assertions. |
| browser | `test/<feature>/browser/*.test.js` | Real Chromium via web-test-runner + Playwright. Shadow DOM, events, `adoptedStyleSheets`, `IntersectionObserver`. |
| e2e | `test/<feature>/e2e/*.test.ts` | Boots the app and drives it through HTTP / a real browser. Gated behind `WEBJS_E2E=1` so it doesn't run on every `webjs test`. |
| smoke | `test/<feature>/smoke/*.test.ts` | Fast deploy-time sanity check (single critical path; "does this surface still return 200"). |

### Running

- `webjs test` (or `node --test`) runs the node tests (unit + integration + smoke).
- `webjs test --browser` (or `npx wtr`) runs the browser tests.
- `WEBJS_E2E=1 webjs test` adds the e2e tests.

### Choosing a feature folder

Use the same name as the matching module folder when one exists:
`modules/posts/` ↔ `test/posts/`. If the test spans more than one
module (a full-stack flow), pick the most prominent one or create a
new feature folder (`test/checkout/`, `test/onboarding/`).

If you find yourself reaching for `test/utils/` or `test/misc/`,
the feature folder is missing. Name it after the user-facing concern.

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
| New server action | Required | - |
| New component | Required (SSR output) | Required (interaction) |
| New page/route | - | Required |
| Bug fix | Required (regression) | If user-facing |
| Refactor | Existing tests must pass | Existing tests must pass |

---

## UI components: prefer the Webjs UI kit over raw Tailwind

<!-- OVERRIDE -->

This scaffold ships with the Webjs UI kit preinstalled at `components/ui/`.
The kit splits into **two tiers**. Picking the wrong tier produces
broken markup.

**Tier 1: class helpers** (button, card, input, label, alert, badge,
separator, skeleton, table, etc.): pure functions that return Tailwind
class strings. Call them and spread onto a **raw native element**.

**Tier 2: custom elements** (dialog, popover, tooltip, dropdown-menu,
tabs, accordion, collapsible, progress, etc.): real `<ui-X>` tags. Import
the module once (typically in `app/layout.ts`) and use the tag.

```ts
// Tier 1: class helpers on native elements (use this for forms,
// dashboards, cards, layouts, anywhere the value is purely visual)
import { buttonClass } from '../components/ui/button.ts';
import { inputClass } from '../components/ui/input.ts';
return html`
  <button class=${buttonClass({ size: 'lg' })}>Save</button>
  <input class=${inputClass()} placeholder="Email">
`;

// Tier 2: custom elements (modals, dropdowns, tab strips, tooltips,
// state the browser doesn't give you natively)
return html`
  <ui-dialog>
    <ui-dialog-trigger>
      <button class=${buttonClass({ variant: 'outline' })}>Edit</button>
    </ui-dialog-trigger>
    <ui-dialog-content>…</ui-dialog-content>
  </ui-dialog>
`;

// Avoid: hand-rolled Tailwind on every <button> loses visual
// consistency. Tier-1 helpers give you the same control with one import.
return html`
  <button class="px-4 py-2 rounded-md bg-accent text-accent-fg">Save</button>
`;
```

Add more components with `webjs ui add <name>` (e.g. `webjs ui add dialog
tabs popover`). The catalogue lives at
[https://ui.webjs.dev](https://ui.webjs.dev).

**Hand-rolled Tailwind is still appropriate for:**
- One-off marketing pages, hero sections, landing CTAs.
- Anywhere the visual design intentionally diverges from the kit baseline.
- Layout primitives (`<div class="grid grid-cols-3 gap-4">`).

The convention: any visual element with a Tier-1 helper uses the helper.
Any stateful behavior with a Tier-2 element uses the element.

---

## Components

<!-- OVERRIDE -->

```ts
import { WebComponent, html } from '@webjsdev/core';

export class MyWidget extends WebComponent {
  static properties = { label: { type: String }, count: { type: Number } };
  declare label: string;
  declare count: number;
  // Light DOM is the default; Tailwind utility classes apply directly.

  constructor() {
    super();
    // Defaults go here, never as class-field initializers
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
editor. See the Editor Setup docs for the `ts-lit-plugin` +
`@webjsdev/ts-plugin` setup that extends this to tag / attribute
intelligence inside `html\`…\`` templates (go-to-definition, attribute
auto-complete from `static properties`, no "Unknown tag" red-squiggle on
registered webjs elements).

**Rules:**
- One component per file
- **Light DOM by default.** Opt in to shadow DOM with `static shadow = true` when you need scoped styles (via `static styles = css\`...\``) or third-party-embed isolation. `<slot>` projection works identically in both modes (named slots, fallback content, `assignedNodes` / `slotchange`, first-wins resolution), so slot usage alone is never a reason to opt into shadow DOM.
- Prefer Tailwind utility classes for styling. They're unique by construction (`p-4`, `font-semibold`) so they can't collide across components.
- **If a light-DOM component authors its own custom CSS (a `<style>` block in `render()` or an imported stylesheet), every class selector MUST be prefixed with the component's tag name.** Either pattern works. Pick one and stay consistent:
  - `.my-widget__body`, `.my-widget__title` (BEM-ish)
  - `my-widget .body`, `my-widget .title` (descendant selector)
- Tag name must contain a hyphen (HTML spec)
- Always call `Class.register('tag')`. That's the standard DOM API.
- **Reactive props use `declare propName: Type` (no value) plus a default in `constructor()` after `super()`.** Never write `propName = value` or `propName: Type = value` as a class-field initializer. It compiles to `Object.defineProperty(this, …)` after `super()` and clobbers the framework's reactive accessor, silently breaking re-renders. `webjs check` flags this via the `reactive-props-use-declare` rule.
- Component state lives in signals. Import `signal` from
  `@webjsdev/core`, read via `signal.get()` inside `render()`, write
  via `signal.set(value)`. Module-scope signals share state across
  components; instance signals (created in the constructor) carry
  component-local state. Reactive properties (`static properties =
  { foo: { type: ... } }` with a sibling `declare foo: T`) wrap HTML
  attributes, attribute reflection, and `.prop=${value}` SSR
  hydration.
- Use lifecycle hooks (`firstUpdated`, `updated`) only when needed

---

## Components: Light DOM (default) vs Shadow DOM (opt-in)

<!-- OVERRIDE -->

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Write `class="..."` in your template. Plain children, global styles apply. |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` scopes bare selectors. |
| `<slot>` content projection | **Either** | Same `<slot>` / `<slot name="x">` / fallback / `assignedNodes` / `slotchange` API in both modes. Light DOM uses framework projection; shadow DOM uses native browser projection. |
| Third-party embed isolation | Shadow DOM | CSS can't leak in or out. |

**Light DOM** = the component renders as plain HTML. Global CSS and
Tailwind utility classes apply directly. Use `document.querySelector`
to find elements. No `:host`, no `::part`, no CSS-variable plumbing.

**Shadow DOM** = opt-in style encapsulation. Declare `static shadow = true`
and author styles via `static styles = css\`...\`` (adopted via
`adoptedStyleSheets`). The browser enforces the boundary, and nothing
leaks in or out.

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
small function in `lib/utils/ui.ts`:

```ts
// lib/utils/ui.ts
import { html } from '@webjsdev/core';

export function rubric(label: string) {
  return html`
    <span class="block font-mono text-[11px] leading-none font-semibold tracking-[0.2em] uppercase text-accent mb-4">● ${label}</span>
  `;
}
```

Consume:

```ts
// app/page.ts
import { rubric } from '../lib/utils/ui.ts';

export default function Home() {
  return html`
    ${rubric('welcome')}
    <h1 class="font-serif text-display">Hello</h1>
  `;
}
```

Helpers run at SSR time inside `html\`\``, so the output is identical
to writing the classes inline. No client-side runtime.

**Why not `@apply`?** `@apply` hides which utilities back a class and
creates a second source of truth. JS helpers keep the class bundle
visible at the definition site and compose naturally with conditional
classes and active states.

**Custom CSS is still supported.** Plain `<style>` blocks, CSS modules,
or a build-step pipeline. The framework has no hard dependency on Tailwind.
If you mix custom CSS into a light-DOM component, apply the class-prefix
rule (see Components section above).

**Dark mode uses two signals; a theme switch must set both.** The editorial
chrome tokens (`--fg`, `--bg`, `--accent`) follow a `data-theme` attribute on
`<html>`; the Webjs UI kit under `components/ui/` follows a `.dark` class
(`@custom-variant dark (&:is(.dark *))`). The scaffold's head init script and
`theme-toggle` set **both** (`data-theme` AND
`classList.toggle('dark', isDark)`). If you replace the toggle or build your
own theme switch, set both, or the `components/ui/*` render light tokens on a
dark page (white buttons and cards, invisible text) while the chrome looks
correct. Light mode hides this (both systems default to light), so **verify
dark mode in a browser, not just light.**

---

## Styling alternative: vanilla CSS end-to-end

<!-- OVERRIDE -->

If you'd rather skip Tailwind, webjs works with plain CSS as long as you
wrap pages, layouts, and components so class names don't collide in the
global light-DOM namespace.

**Convention: three scopes**

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
import { html, css } from '@webjsdev/core';

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
names. CSS descendant combinators stop them at the scope boundary.
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
// app/api/auth/middleware.ts: protect auth endpoints
import { rateLimit } from '@webjsdev/server';
export default rateLimit({ window: '10s', max: 5 });
```

Place `middleware.ts` at any route level. It applies to that subtree only.
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

SSR content is visible immediately. Only the JS download is deferred.
**Do NOT use** for above-the-fold or critical UI (navigation, forms).

---

## expose(): REST endpoints from server actions

<!-- OVERRIDE -->
Tag a server action to also be reachable over HTTP:

```ts
import { expose } from '@webjsdev/core';
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

## Progressive enhancement (write HTML-first)

<!-- OVERRIDE -->

webjs pages work without JavaScript by design. Read-paths render to
real HTML on the server. Write-paths run through plain `<form>` plus
server actions, and navigation is a real `<a href>`. Every web component
is SSR'd too. Its `render()` runs on the server, so the component's
initial markup is in the response before any script loads. With JS
disabled, a display-only custom element looks correct, and an
interactive one (counter, dropdown, tabs) still paints its initial
state. Only the *interactivity itself* (the +/- click, the open/close
toggle, the tab switch) requires JS.

**Default rules:**
- **Forms must work as plain HTML POSTs.** Use `<form action=…>` bound
  to a server action. Never `fetch` + a JS click handler for the
  happy path. The framework upgrades the form to a partial-swap
  submission automatically when the client router is active, and with
  JS disabled the same form does a full-page POST and works identically
  end-to-end.
- **Links must be real `<a href="…">`.** Don't roll a JS-only click
  handler for navigation. The client router intercepts `<a>` clicks and
  enhances them into SPA transitions. Without JS, the browser navigates
  the old-fashioned way.
- **Custom elements are the only place JS is allowed to be required.**
  If a feature works without state (a styled card, a layout, a list,
  a marketing section), it should not be a custom element with
  lifecycle. Use a plain function returning `html\`…\`` or a Tier-1
  Webjs-UI class helper (`buttonClass`, `cardClass`).
- **Test JS-off explicitly before marking a feature done.** Open the
  page in a browser with JS disabled (DevTools → Settings → Debugger
  → "Disable JavaScript") and exercise the user's read + write paths.
  If a write fails without JS, you've reached for `fetch` where a
  server action would have done the job.
- **Don't gate read-paths on hydration.** Never write components whose
  SSR'd HTML is empty or wrong on purpose with the expectation that
  JS will fill it in. The first paint must be the right content.

**SSR-meaningful component state.** The SSR pipeline constructs the
component, applies its attributes, and calls `render()`. It does NOT
call `connectedCallback`, `firstUpdated`, or any other browser-only
lifecycle hook. Whatever state should appear on first paint MUST be
set in the constructor (after `super()`) or be derivable from
`static properties` + attributes on the rendered tag.

```ts
import { WebComponent, html, signal } from '@webjsdev/core';

class Cart extends WebComponent {
  items = signal<Item[]>([]);          // instance signal, SSR uses this for first paint

  connectedCallback() {
    super.connectedCallback();
    // Browser-only refinement, read localStorage and write the
    // signal. The component re-renders automatically.
    const stored = readFromLocalStorage();
    if (stored) this.items.set(stored);
  }

  render() {
    return html`<ul>${this.items.get().map(/* … */)}</ul>`;
  }
}
```

Where the data lives, where to read it:

| Data source | Where to read it |
|---|---|
| Database, session, cookies, request headers | Page function (server). Pass to component as attribute / property. |
| Component's own initial defaults | Component `constructor()` after `super()`. |
| Browser-only: `localStorage`, viewport, `matchMedia`, `navigator.*` | Component `connectedCallback()`, then write a signal (instance-scoped in the constructor, or module-scope if shared) to refine. |
| Theme color, RTL direction (flash-sensitive) | Synchronous inline `<script>` in root layout that sets `document.documentElement` attributes before custom elements upgrade. |

---

## Server actions

<!-- OVERRIDE -->

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { prisma } from '../../../lib/prisma.server.ts';
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
- Never throw for expected errors. Return `{ success: false, error, status }`
- Validate input at the top of the function

---

## Code style

<!-- OVERRIDE -->
- TypeScript with explicit `.ts` extensions in imports
- **Erasable TypeScript only.** The framework strips types via Node 24+'s built-in `module.stripTypeScriptTypes` (whitespace replacement, byte-exact line + column preservation, no sourcemap shipped). Your `tsconfig.json` sets `erasableSyntaxOnly: true`, so the compiler rejects: `enum`, `namespace` with values, constructor parameter properties, legacy decorators with `emitDecoratorMetadata`, and `import = require`. Write the erasable equivalents:
  ```ts
  // Not allowed
  enum Color { Red, Green, Blue }
  class Foo { constructor(public x: number) {} }

  // Erasable equivalents
  const Color = { Red: 'Red', Green: 'Green', Blue: 'Blue' } as const;
  type Color = typeof Color[keyof typeof Color];

  class Foo {
    x: number;
    constructor(x: number) { this.x = x; }
  }
  ```
  If you turn `erasableSyntaxOnly` off and use non-erasable syntax, the dev server fails at strip time and returns a 500 pointing at the `no-non-erasable-typescript` lint rule. webjs is buildless end-to-end and has no bundler fallback. The `erasable-typescript-only` convention check warns when the flag is off.
- No semicolons (or with semicolons, pick one and stay consistent)
- `const` by default, `let` when needed, never `var`
- Prefer `async/await` over `.then()` chains
- Minimal comments. Code should be self-documenting
- No barrel files (`index.ts` re-exporting everything). Import from the source directly

---

## Git workflow

<!-- OVERRIDE -->

This project enforces a git workflow via agent-specific config files
(`.claude/settings.json`, `.cursorrules`, `.windsurfrules`,
`.github/copilot-instructions.md`). These rules apply to ALL AI agents:

**Commit rules:**
- **Commit per logical unit, not at the end.** One feature, one fix, one
  rename, one doc rewrite per commit. Push after each commit.
- **Hard limit.** If you have 5+ unstaged files spanning different concerns,
  commit before continuing. The `.claude/hooks/nudge-uncommitted.sh` hook
  fires at threshold 4 to enforce this. Do not ignore the reminder.
- **Meaningful messages.** Imperative mood, what changed and why
  (`Add contact form with email validation`, not `update files`).
- **NEVER add AI attribution.** No `Co-Authored-By: Claude`, no
  `Generated by AI`, no `AI-assisted` trailers or prefixes.
- **Committing is automatic.** The user should never have to ask
  "please commit". Commit after completing each logical unit.

**Branch rules:**
- **Feature branches.** Never commit directly to main
- **Branch naming.** `feature/<name>`, `fix/<name>`, `refactor/<name>`
- **Pull requests.** Always create a PR, never push to main directly
- **NEVER merge without user permission.** Before merging ANY branch
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
the top of this file. Short version: set a rule to `false` in
`package.json` under `"webjs": { "conventions": { … } }`. With no
override, every default rule is on.

Run `webjs check` to validate. Run `webjs check --rules` to list every
rule with its description and current enabled state.

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
// app/api/users/route.ts: thin wrapper
import { listUsers } from '../../../modules/users/queries/list-users.server.ts';
import { createUser } from '../../../modules/users/actions/create-user.server.ts';

export async function GET() { return Response.json(await listUsers()); }
export async function POST(req: Request) {
  const result = await createUser(await req.json());
  if (!result.success) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data, { status: 201 });
}
```
