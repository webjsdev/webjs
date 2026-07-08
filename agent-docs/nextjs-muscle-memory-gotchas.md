# Next.js muscle-memory gotchas

AI agents trained on Next.js will reach for patterns that look correct
because webjs borrows Next's **file-based routing** (the `app/` directory,
`page` / `layout` / `route` / `loading` / `error` / `not-found`, dynamic
`[param]` segments, route groups, `middleware`, the metadata routes). The
routing SHAPE is familiar; the execution model underneath is not. This file
catalogs the Next patterns that break webjs, with the webjs-shaped fix for each.

The architectural disagreement underneath all of these. Next is React-first
with a server/client component split (RSC, the Flight protocol, `'use client'`).
Webjs has **no RSC and no server/client component split**: pages and layouts
render server-only and never hydrate, and the ONE client boundary is a
`WebComponent` custom element. Read the "Execution model" section of the root
`AGENTS.md` first; every gotcha below is downstream of that one difference.

## 1. There is no RSC, no `'use client'`, no `'use server'` component boundary

Do not reach for `'use client'` at the top of a component or a `'use server'`
directive to make a component a Server Component. Those do nothing in webjs.

- **Interactivity lives in a `WebComponent`**, an islands-style custom element
  that hydrates per-element. A page or layout cannot be interactive in its own
  markup (an `@click` in a page template is dropped at SSR).
- **`'use server'` is an RPC + source-protection mechanism on a `*.server.ts`
  file, not a component annotation.** It marks a file's exports as callable from
  the client (rewritten to a typed RPC stub), the opposite direction from Next's
  Server Actions form binding.

## 2. `redirect()` throws, and it is illegal in a route handler

In Next, `redirect()` works in Server Components, Server Actions, and Route
Handlers alike. In webjs, `redirect()` (and `notFound()`) throw a control-flow
sentinel the SSR page pipeline and the action pipeline catch. They are valid in
**page functions, layouts, and server actions**. They are **NOT** valid in a
`route.ts` handler, where the throw goes uncaught and returns a 500 (the
`no-redirect-in-api-route` check flags this).

```ts
// route.ts. WRONG: redirect() is uncaught here.
export async function GET() { redirect('/login'); }
// route.ts. RIGHT: return a real redirect Response.
export async function GET() { return Response.redirect(new URL('/login', ...), 303); }
```

Also note the default status. A no-status `redirect()` is convention-picked at
the catching site (302 for a GET page-render gate, 307 method-preserving for a
server-action redirect). Do not THROW `redirect()` from a page `action` to bounce
a form POST: 307 re-POSTs the body and re-runs the mutation. Return an
`ActionResult` with a `redirect` field instead (a 303 PRG), or throw only for a
real external redirect.

## 3. Reads are also server actions, not `fetch()` in a Server Component

Next fetches data by calling `fetch()` / an ORM directly inside an async Server
Component. Webjs has no Server Components, so:

- Fetch server data in the **page function** (server-only) and pass it down, or
  fetch in a component via an **async `render()`** (#469, the resolved data is in
  the first paint), or a `'use server'` GET action.
- **Never `fetch('/api/...')` from a component for your own server data.**
  Importing a `'use server'` action IS the API (the import becomes an RPC stub).
  Hand-written `fetch` to your own endpoint is the anti-pattern.
- There is no React `cache()`, `use()`, or `unstable_cache`. Caching is the
  `cache()` query helper, `export const revalidate` on a page, or `export const
  cache` on a GET action (see `agent-docs/built-ins.md`).

## 4. `params` and `searchParams` are plain objects, not Promises

Next 15 made `params` / `searchParams` async (you `await` them). In webjs they
are plain synchronous objects on the page/layout/route context.

```ts
// WRONG (Next 15 habit): const { id } = await params;
export default async function User({ params }: PageProps<'/users/[id]'>) {
  const id = params.id;   // plain object, no await
}
```

## 5. The page default export returns a template, and runs server-only

A Next page returns JSX and (as a Server Component) may embed client
interactivity directly. A webjs page default export returns a `TemplateResult`
from `html` and **runs only on the server**. It is never re-invoked in the
browser, so a signal read or `@click` in a page body does nothing after load. Put
interactivity in a `WebComponent` and render its tag from the page.

## 6. Route handlers: named method exports, value returns auto-JSON

Close to Next, with differences. Export `GET` / `POST` / etc. as named async
functions `(request, { params }) => Response | value` (a non-Response value is
auto-JSON'd). A folder cannot have both `page` and `route`. There is no
`NextRequest` / `NextResponse`; use the platform `Request` / `Response`. A
WebSocket endpoint is a `WS(ws, req, { params })` export from the same file.

## 7. Metadata is webjs's own shape, not Next's superset

`metadata` and `generateMetadata(ctx)` exist and feel familiar, but the field set
is what `@webjsdev/server` actually reads, not Next's. Type both with `Metadata`
from `@webjsdev/core` and consult `agent-docs/metadata.md`; do not assume a Next
metadata field exists. Metadata ROUTES (`sitemap`, `robots`, `manifest`, `icon`,
`opengraph-image`, ...) default-export a function and live at app root or static
segments only.

## 8. `middleware.ts` is a per-segment function, not a matcher config

No `export const config = { matcher }`. The default export is `async (req, next)
=> Response`: return a Response to short-circuit, or call `next()` and
post-process. Middleware nests by folder (a `middleware.ts` in a segment applies
to its subtree), outermost to innermost, plus an optional root `middleware.ts`.

## 9. No `<Link>`, no `next/navigation` hooks, no `next/*` component libraries

- **Navigation is automatic.** The client router auto-enables when
  `@webjsdev/core` loads (any page with a component), so a plain `<a href>` gets
  soft navigation for free. There is no `<Link>` to import, no `useRouter`. For
  programmatic navigation import `navigate()` / `revalidate()` from
  `@webjsdev/core`.
- **No `next/image`, `next/font`, `next/script`, `next/dynamic`.** webjs is
  no-build; use a plain `<img>`, a `<link>`/`@font-face`, a component's
  `static lazy = true` for viewport lazy-loading, and a dynamic `import()` where
  you need code to load lazily.

## 10. Server-only code: the `.server.ts` boundary, not a `server-only` package

Next uses the `server-only` package to poison a module imported client-side.
webjs uses the file extension: `*.server.ts` is the path-level boundary (the file
router refuses to serve the source). A `'use server'` file's exports are
RPC-callable; a `.server.ts` file WITHOUT `'use server'` is a server-only utility
whose browser import throws at load. Never import a no-`'use server'` `.server.ts`
utility directly into a page/layout/component that ships; reach it through a
`'use server'` action, `route.ts`, or `middleware`.

## 11. Public env vars use `WEBJS_PUBLIC_`, not `NEXT_PUBLIC_`

`process.env.X` is server-only. To expose a value to the browser, prefix it
`WEBJS_PUBLIC_` (inlined via an inline `<script>`, no build step). `NODE_ENV` is
defined both sides. Reading a non-public server env var in a component is flagged
by the `no-server-env-in-components` check (it would leak into SSR'd HTML or read
as undefined after hydration).

## Quick reference

| Next habit | webjs |
|---|---|
| `'use client'` / RSC split | No split; interactivity is a `WebComponent` island |
| `redirect()` in a route handler | `Response.redirect(url, 303)`; `redirect()` only in pages/actions |
| `throw redirect()` from a form action | return an `ActionResult` `{ redirect }` (303 PRG) |
| `fetch()` in a Server Component | page function, async `render()`, or a `'use server'` action import |
| `await params` | `params` is a plain object |
| page returns JSX, can be interactive | page returns a `TemplateResult`, server-only, never hydrates |
| `NextRequest` / `NextResponse` | platform `Request` / `Response` |
| `<Link>` / `useRouter` | plain `<a>` (auto soft-nav) / `navigate()` |
| `next/image`, `next/font` | plain `<img>`, `@font-face` (no-build) |
| `server-only` package | the `.server.ts` file boundary |
| `NEXT_PUBLIC_` | `WEBJS_PUBLIC_` |

## When in doubt

The routing file names are the same; the runtime is not. If a Next pattern
assumes a React render tree, a Server/Client component boundary, or a
`next/*` import, it does not transfer. See the root `AGENTS.md` execution-model
section and `agent-docs/recipes.md` for the webjs-shaped equivalent.
