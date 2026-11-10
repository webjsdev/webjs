# AGENTS.md for {{APP_NAME}}

## The WebJs brief

WebJs is a no-build full-stack framework. Write it the way you write Next.js
routing and Lit components, with the differences below.

- Routing follows the Next.js App Router: `app/page.ts`, `layout.ts`,
  `route.ts`, `middleware.ts`, `[param]`, `[...slug]`, `(group)`,
  `loading.ts`, `error.ts`, `not-found.ts`, `metadata` and
  `generateMetadata`, and server actions.
- Components use Lit's APIs (`html`, `css`, reactive properties through
  `static properties` plus `declare` or the `WebComponent({ ... })` factory,
  the lifecycle, directives, context, task), imported from `@webjsdev/core`
  and its `/directives`, `/context`, `/task` and `/signals` subpaths. The base
  class is `WebComponent`. Register with `Class.register('my-tag')` or
  `customElements.define`.
- Components render light DOM by default and `<slot>` works there too. Keep
  them light: page styles such as Tailwind and the UI kit do not reach into a
  shadow root. Use `static shadow = true` only when light DOM cannot work.
- TypeScript must be erasable, so no decorators and no enums.
- Server-only code and server actions live in `*.server.ts` files. With
  `'use server'` at the top, their exports are callable from components and
  bindable as `<form action=${fn}>`. A failed form action re-renders the page
  with its result on `actionData`.
- `cookies()`, `headers()` and `revalidatePath()` come from `@webjsdev/server`,
  and so does `createAuth()`, which is Auth.js's API. Files in `public/` are
  served from the site root.
- Never import `lit`, `next` or `react`.

Before hand-writing auth, sessions, caching, rate limits, uploads, realtime or
SEO, run `npx webjs source`, which lists what WebJs provides for each need.
`npx webjs source <Export>` then prints one export's signature and example.
After each edit run `npx webjs check` and `npx webjs status`. The framework
source is in `node_modules/@webjsdev/*` (no build, so it is the code that
runs) and the human docs are at https://webjs.dev/docs.

Keep app data in the wired-up Drizzle database (`db/`), never in a JSON file
or an in-memory array. Put each feature in `modules/<feature>/` (`actions/` with
one `'use server'` action per `*.server.ts`, `queries/`, `components/`, `types.ts`)
and keep routes thin. `modules/users/` is an example of that shape: read it, then
delete it, its test and whatever uses it before you build the app.

In components, use Lit's APIs over raw DOM calls: `@click=${...}` and `ref()`,
not `document.getElementById`, `document.querySelector` or `addEventListener`.

For UI, add shadcn's components from the WebJs UI kit (class helpers such as
`buttonClass()`, and `<ui-*>` elements where state matters) rather than writing
them: `npx webjs ui add button dialog` copies each into `components/ui/`, and
`npx webjs ui list` shows what exists.

Style with Tailwind utilities on the kit's design tokens (`bg-background`,
`text-muted-foreground`, `border-border`, `rounded-lg`; the theme lives in
`styles/globals.css`), never hard-coded colours or hand-written CSS. Change the
whole look with a theme: `npx webjs ui init --preset <code>` from webjs.dev/ui/create.

`npx webjs help` lists every CLI command. The `webjs` MCP server in `.claude.json`
(`npx @webjsdev/mcp`) answers the same questions as tools: `list_routes`,
`list_actions`, `list_components`, `check`, `source` and `ui`.

## This app

Replace this paragraph with what the app does, its features (one line per
`modules/<feature>/`), its data model and any rule specific to it, and keep it
current as the app grows. `CLAUDE.md` imports this file, so notes go here.
