---
title: "File-based routing the Next.js way (because the agent already knows it)"
date: 2026-01-28T11:30:00+05:30
slug: file-based-routing
description: "Why WebJs copies Next.js's app-router conventions verbatim, what each file type does, and where WebJs's routing diverges."
tags: routing, conventions, next-js, ai-first
author: Vivek
---

When I was sketching WebJs's routing layer, I had two options. Invent something custom. Or copy Next.js's app router, which is the routing model I personally enjoy using.

I went with Next.js. Same `page.ts`, `layout.ts`, `route.ts`, `[param]`, `(group)`, `_private`. Two reasons: it is the shape I want to work in day to day, and it is the shape the agent has already read ten thousand examples of. Reproduce that shape and the agent writes correct code immediately.


# The file types

The server's `buildRouteTable()` function in `packages/server/src/router.js` lists the full set in its JSDoc:

```
app/page.js                     → /
app/about/page.js               → /about
app/blog/[slug]/page.js         → /blog/:slug
app/files/[...rest]/page.js     → /files/*
app/(marketing)/about/page.js   → /about   (folders in parens are route groups)
app/_internal/page.js           → ignored  (folders starting with _ are private)
app/api/hello/route.js          → /api/hello
app/layout.js                   → wraps every page
app/error.js                    → error boundary (nested)
app/loading.js                  → loading UI (auto-wraps page in Suspense)
app/not-found.js                → 404 fallback (nested: nearest wins)
app/[[...slug]]/page.js         → optional catch-all (matches / AND /a/b)
app/sitemap.js                  → serves /sitemap.xml
app/robots.js                   → serves /robots.txt
app/icon.js                     → serves /icon (dynamic)
app/opengraph-image.js          → serves /opengraph-image (dynamic)
```

If you have used Next.js's app router, none of this is new. Even the brackets-for-params, parens-for-groups, and underscore-for-private conventions match.

The metadata routes (`sitemap`, `robots`, `manifest`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`) are listed in a hard-coded `METADATA_STEMS` Set in the same file, mapped to their URL paths via `METADATA_URL_MAP`. Each one is a file that default-exports a possibly-async function. The router maps it to the right URL.


# What page.ts looks like

```ts
import { html } from '@webjsdev/core';
import { listPosts } from '../../modules/posts/queries/list-posts.server.ts';

export const metadata = { title: 'Posts · my-app' };

export default async function Posts() {
  const posts = await listPosts();
  return html`
    <h1>Posts</h1>
    <ul>${posts.map((p) => html`<li>${p.title}</li>`)}</ul>
  `;
}
```

Async default export receiving `{ params, searchParams, url }`. Returns a TemplateResult (the same `html\`\`` shape components use). The framework calls it server-side; it never runs in the browser.

For 404 / redirect short-circuits, import the helpers:

```ts
import { notFound, redirect } from '@webjsdev/core';

export default async function Post({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();
  if (post.archived) redirect('/posts');
  return html`<h1>${post.title}</h1>`;
}
```

Both throw a sentinel that the framework catches and translates to a 404 / 302 response. The error boundary chain (nested `error.js`) does not catch the sentinels (they are flow-control, not errors).


# What route.ts looks like

```ts
import { listPosts } from '../../../modules/posts/queries/list-posts.server.ts';
import { createPost } from '../../../modules/posts/actions/create-post.server.ts';

export async function GET() {
  return Response.json(await listPosts());
}

export async function POST(req: Request) {
  const body = await req.json();
  return Response.json(await createPost(body));
}
```

Named async functions per HTTP method. Each receives `(Request, { params })`. Each returns a Response. The default body is JSON-stringified if you return a plain object.

A folder cannot have both `page.js` and `route.js`. The router enforces it at scan time.


# How WebJs's routing is different from Next.js

A few things are not the same.

No server components vs. client components split. Pages and components are not divided into "RSC" and "client" categories. A page is server-only (returns HTML). A component is universal (renders identically server-side for first paint and client-side for hydration). There is no `"use client"` directive.

Server actions are explicit, file-based. A `*.server.{js,ts}` file with `'use server'` exports functions that the browser imports as RPC stubs. The dev server rewrites the import. The split is path-level (the `.server.` infix is the boundary) and directive-level (the `'use server'` makes exports RPC-callable).

WebSockets ride the same route file. If you export `WS(ws, req, { params })` from `route.ts`, the URL becomes a WebSocket endpoint. No separate file type.

No metadata API for fetch caching. WebJs uses HTTP `Cache-Control` headers for response caching and the framework's `cache()` function for query memoization. There is no `fetch(...).cache(...)` extension on the global fetch.

Streaming uses Suspense directly. Wrap a slow part of your tree in `<Suspense fallback=${...}>`. The framework streams the response, flushes the fallback, then patches in the resolved content when the promise lands. No special exports.


# Why this matters more for agents than for humans

A human picks up file-based routing in five minutes. Open one example, read one tutorial, you understand the shape.

An agent gets it for free. When the prompt says "add a page at /posts/:slug," the agent reaches for `app/posts/[slug]/page.ts` with no further hints. When the prompt says "add an API endpoint at /api/posts," the agent creates `app/api/posts/route.ts`. The convention is in the training data already.

Compare with a Rails-shaped router. The agent has seen Rails too, but Rails routes live in a `routes.rb` file with a DSL. The agent has to read the existing file, decide where the new route goes, edit it, and verify the controller exists. Three more steps than the file-based version, each a chance for a mistake.

The file-based shape is also self-documenting. The list of pages in your app is `find app -name page.ts`. The list of API routes is `find app -name route.ts`. No DSL traversal needed. No route inspector tool needed. The filesystem is the routing table.


# The pieces I added that Next.js does not have

Two.

`<webjs-frame>` is an escape hatch for partial-swap regions not tied to a folder structure. Wrap a chunk of your page in `<webjs-frame id="cart-summary">`, and you can use `revalidate('/cart-summary')` to refresh just that fragment without a full navigation. It is for cases where you want to re-fetch data in place without leaving the page. Implementation is at `packages/core/src/webjs-frame.js`.

A server action can also live at a REST URL. The same function powers both call paths. From a client component: `import { createPost }` and call it as RPC. From curl: drop it into a `route.ts` (`export const POST = route(createPost)`), so `POST /api/posts` hits the same implementation. One function, two protocols. The `route()` helper lives in `packages/server/src/action-route.js`.


# What I am still figuring out

Catch-all routes (`[...rest]` and `[[...rest]]` for optional) work. The router builds the regex pattern from the route pattern, captures `paramNames`, and exposes them as `params.rest` as a string array.

Per-segment loading boundaries work. If you have a `loading.ts` deep in a route tree, it wraps the sibling page in a Suspense boundary. If both inner and outer segments have `loading.ts` files, the inner wraps first, the outer wraps the inner.

If you want to read the router itself, it is at [`packages/server/src/router.js`](https://github.com/webjsdev/webjs/blob/main/packages/server/src/router.js). The complete picture of a parsed app is in the `RouteTable` typedef at the top of that file. Most of the complexity is in the parameter matching and the precedence rules (static beats dynamic beats catch-all).
