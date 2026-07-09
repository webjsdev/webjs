---
title: "Next.js 16 File-Routing Parity in WebJs: forbidden(), unauthorized(), and Nearest not-found"
date: 2026-07-08T10:00:00+05:30
slug: nextjs-16-file-routing-parity
description: "WebJs closed the last Next.js 15/16 file-routing parity gaps. forbidden() and unauthorized() control-flow throws, nearest-wins not-found boundaries, sync-or-await params, and an instrumentation.js boot hook, explained for anyone migrating from Next.js."
tags: nextjs, routing, web-standards, migration, auth
author: Vivek
---

If you have built with Next.js, the routing primitives live in your muscle memory. You throw `notFound()` and a `not-found.tsx` renders. You reach for a boundary file and it just appears at the right place in the tree. WebJs has matched that file-routing model from early on, but a handful of the newer Next.js 15 and 16 primitives were still missing. Those are the ones that bite a migrator, because you write the call you have written a hundred times and nothing happens.

This post is about the four gaps WebJs just closed. If you are coming from Next, these are the last routing pieces that were not there yet, and now they match.

# forbidden() and unauthorized() are control-flow throws

Next 15 added `forbidden()` and `unauthorized()` alongside the older `notFound()`. WebJs now has both, and they behave exactly the way the `notFound()` pattern already taught you. You throw them, and the framework catches the throw, sets the HTTP status, and renders the matching boundary file.

```ts
// app/dashboard/page.ts
import { html, forbidden, unauthorized } from '@webjsdev/core';

export default async function Dashboard() {
  const session = await getSession();
  if (!session) unauthorized();          // 401, not authenticated
  if (!session.canSeeDashboard) forbidden(); // 403, authenticated but not allowed
  return html`<h1>Dashboard</h1>`;
}
```

The distinction is the useful part, and it is the same one HTTP has always drawn. `unauthorized()` returns a 401 and is for a request that is not authenticated at all (no session, nobody logged in). `forbidden()` returns a 403 and is for a user who IS logged in but lacks permission for this particular thing. Reaching for the right one gives you honest status codes for free.

Each renders the nearest boundary file walking up from where you threw. A `forbidden()` renders the closest `forbidden.{js,ts}`, an `unauthorized()` renders the closest `unauthorized.{js,ts}`, innermost wins, and if you have not written one, WebJs renders a sensible default page. So you can put a single `app/forbidden.ts` at the root for the whole app, or drop a `app/admin/forbidden.ts` that is specific to the admin section, and the nearer one takes over inside its subtree.

```ts
// app/admin/forbidden.ts
import { html } from '@webjsdev/core';
export default function AdminForbidden() {
  return html`<p>You need admin access for this area.</p>`;
}
```

One thing to internalize, because it is where the throw model has edges. These work from a page or layout render, and from a page `action` (the no-JS write path, the function that handles a form POST to the page's own URL). They do NOT belong in a `route.ts` handler, which is a raw HTTP handler that should return a `Response` itself. And inside a `'use server'` RPC action, a raw `forbidden()` throw becomes a generic 500, because an action's job is to return a value. For an auth failure in an action, return an `ActionResult` instead.

```ts
// modules/posts/actions/delete-post.server.ts
'use server';
export async function deletePost(id: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Sign in first.', status: 401 };
  if (!session.isAdmin) return { success: false, error: 'Not allowed.', status: 403 };
  // ...delete
  return { success: true };
}
```

The rule of thumb is the same one that governs `notFound()` and `redirect()`. Throw in a render path, return an envelope in an action, return a `Response` in a route.

# not-found is now nearest-wins

This is the fix that quietly matters most for a migrator (issue #848). Previously a thrown `notFound()` in WebJs always rendered the single root `not-found` page. In Next, a `not-found.tsx` is nearest-wins, so a `not-found` deep in your tree takes over for pages beneath it. WebJs now matches that.

```
app/
  not-found.ts                 root 404
  blog/
    [slug]/
      page.ts                  throws notFound() for a missing post
    not-found.ts               renders THIS for a missing post
```

Throw `notFound()` from `app/blog/[slug]/page.ts` and you get `app/blog/not-found.ts`, the nearest one walking up from the throwing page. No blog-specific boundary in that subtree? It keeps walking and lands on the root. This means you can give a section its own styled 404 (a missing product looks different from a missing blog post) without any wiring beyond dropping the file in the right folder.

There is also a root-only `global-not-found.{js,ts}`, which renders for a URL that matches nothing anywhere in your app. That is the catch-all for an address that never resolves to a route at all, as opposed to a route that ran and decided the thing it wanted does not exist.

# params and searchParams are sync or awaited, your choice

Next 15 made `params` and `searchParams` async (you `await params` before reading it). Plenty of existing code, and plenty of tutorials, still read them synchronously. WebJs supports both, so a migrating Next dev does not have to think about it.

```ts
// Both of these work, in the same codebase, on the same object.
export default async function Post({ params }) {
  const { slug } = await params;   // the Next 15/16 way
  // ...
}

export default function Post2({ params }) {
  const slug = params.slug;        // the synchronous way
  // ...
}
```

Paste your `await params` code from a Next project and it runs. Prefer the plainer synchronous read and that runs too. The object is awaitable AND directly subscriptable, so neither style is wrong and you never hit the confusing "params is a Promise now" error mid-migration.

# instrumentation.js for boot-time wiring

The last piece is the boot hook. WebJs now reads an optional `instrumentation.{js,ts}` at your app root, matching Next's file of the same name. It exports a `register()` function that runs once at server boot, which is where you wire up APM (application performance monitoring), tracing, or any one-time setup.

```ts
// instrumentation.ts
import { setOnError } from '@webjsdev/server';

export function register() {
  setOnError((err, ctx) => {
    myApm.captureException(err, { url: ctx.url });
  });
}
```

`setOnError` registers the hook the framework calls on an unhandled request error, so your monitoring tool sees every server-side failure with its request context. There is also an `instrumentation-client.{js,ts}` that runs first on the client, before your app modules, for the browser side of the same idea (a client error reporter, an analytics init).

# The takeaway

WebJs was already file-routing compatible with Next in shape, and these four changes (all shipped in #848 and #849) close the remaining gaps a migrator actually trips on. `forbidden()` and `unauthorized()` are control-flow throws that render the nearest boundary, with honest 403 and 401 status codes and the clear rule that you throw in a render, return an `ActionResult` in an action, and return a `Response` in a route. `not-found` is nearest-wins now, so sections get their own 404s. `params` and `searchParams` read either synchronously or awaited, so your Next code just works. And `instrumentation.js` gives you the boot hook for wiring monitoring. Bring your Next.js routing habits over, and the ones that used to fall through now land.
