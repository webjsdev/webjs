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
- Components render light DOM by default and `<slot>` works there too.
  `static shadow = true` opts into shadow DOM.
- TypeScript must be erasable, so no decorators and no enums.
- Server-only code and server actions live in `*.server.ts` files. With
  `'use server'` at the top, their exports are callable from components and
  bindable as `<form action=${fn}>`. A failed form action re-renders the page
  with its result on `actionData`.
- `cookies()`, `headers()` and `revalidatePath()` come from `@webjsdev/server`.
  Files in `public/` are served from the site root.
- Never import `lit`, `next` or `react`.

After each edit run `npx webjs check` and `npx webjs status`. For an exact
contract read the framework source in `node_modules/@webjsdev/*` (there is no
build, so it is the code that runs) or run `npx webjs source <Export>`. The
human docs are at https://webjs.dev/docs.

Keep app data in the wired-up Drizzle database (`db/`), never in a JSON file
or an in-memory array.
