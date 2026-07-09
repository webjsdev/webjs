---
title: "Per-Action Middleware: Auth and Context Around a Single Server Action"
date: 2026-06-17T10:00:00+05:30
slug: per-action-middleware
description: "How WebJs attaches per-action middleware to a single server action for auth, rate-limit checks, logging, and tenant resolution. Declarative middleware that runs automatically on the RPC boundary, short-circuits cleanly, and feeds context via actionContext()."
tags: server-actions, middleware, auth, rpc, composition
author: Vivek
---

Here is a shape I write in almost every app. An action that updates a profile, deletes a comment, or charges a card. Before the real work runs, the same three lines run first. Check the user is logged in. Check they are allowed to touch this record. Maybe log the attempt. Then, and only then, do the thing.

The naive version copies those lines into the top of every action body. You have seen it. Fifteen actions, each opening with the same authentication dance, each one a place you could forget it. Miss the check on one action and you have shipped a hole.

```ts
// modules/posts/actions/delete-post.server.ts (the copy-paste way)
'use server';
export async function deletePost(id: string) {
  const user = await auth();                  // repeated
  if (!user) return { success: false, error: 'unauthorized' };   // repeated
  await db.delete(posts).where(eq(posts.id, id));
  return { success: true };
}
```

The cross-cutting concern (auth) is tangled into the business logic (delete a post). Every action re-implements the same preamble, and the preamble is exactly the part you cannot afford to get wrong.

# The WebJs way: declare middleware as a sibling export

In WebJs a server action is a function in a `*.server.ts` file marked `'use server'`. Alongside that function you can declare a reserved export the framework reads statically, `export const middleware`, an array of functions to run around the action.

```ts
// modules/posts/actions/delete-post.server.ts
'use server';
import { requireUser } from '#lib/auth-middleware.server.ts';
import { actionContext } from '@webjsdev/server';

export const middleware = [requireUser];

export async function deletePost(id: string) {
  const user = actionContext().user;          // set by the middleware
  await db.delete(posts).where(eq(posts.id, id)).where(eq(posts.authorId, user.id));
  return { success: true };
}
```

The action body no longer knows how auth works. It just reads the user the middleware put there. The auth logic lives in one place, and every action that lists `requireUser` gets it identically.

# What a middleware function looks like

Each middleware is `async (ctx, next) => result`. It receives a context object it can write to, and a `next` function that runs the rest of the chain (the next middleware, or finally the action itself). This is the same onion model you know from Express or Koa, scoped to a single action.

```ts
// lib/auth-middleware.server.ts
import { getSession } from '#lib/session.server.ts';

export async function requireUser(ctx, next) {
  const user = await getSession();
  if (!user) {
    // short-circuit: the action body never runs
    return { success: false, error: 'unauthorized', status: 401 };
  }
  ctx.user = user;        // hand data down to the action
  return next();          // proceed to the action
}
```

Two things are happening here, and both matter.

First, the middleware short-circuits by returning an `ActionResult` instead of calling `next()`. When `requireUser` finds no session it returns `{ success: false, error: 'unauthorized' }` and the action body is never entered. No half-run mutation, no reaching the database with a null user. The chain simply stops and that result is what the caller receives.

Second, it accumulates context. Anything the middleware writes onto `ctx` is readable inside the action via `actionContext()` (imported from `@webjsdev/server`). The action's own signature never changes. `deletePost(id)` still takes one argument. The user arrives out of band, through the context the middleware built, so the calling code stays exactly as clean as it was.

# Where it runs on every entry point

This is the part that made me want the feature. A WebJs action is reachable two ways. A client component imports it and the import becomes a typed RPC (Remote Procedure Call) stub. Or a `route.ts` REST endpoint imports and calls it, often through the `route()` adapter from `@webjsdev/server`.

On the RPC boundary the declared middleware runs automatically. When the browser calls `deletePost` over RPC, `requireUser` runs first, because the framework reads the `export const middleware` config off the action and wraps the chain around it for you. That is the primary path for a WebJs app, since components import actions directly, and it needs no wiring at all.

The `route()` adapter picks the declared chain up too, as long as you hand it the action's module namespace rather than the bare function:

```ts
// app/api/posts/[id]/route.ts
import { route } from '@webjsdev/server';
import * as deletePost from '#modules/posts/actions/delete-post.server.ts';
export const DELETE = route(deletePost);   // its declared middleware + validate apply
```

Passing the whole module lets the adapter read the `export const middleware` (and `export const validate`) sitting next to the action, so the guard you declared once protects the REST boundary automatically, the same way it does on the RPC one. The guard stays a property of the action, not of a single transport. If you instead import just the function (`import { deletePost }`), the adapter has no way to reach its sibling config, so there you pass the chain explicitly with `route(deletePost, { middleware })`. Verified by dogfooding: the module form applies the declared guards, the bare-function form runs only what you pass it.

# Compose several, in order

Because it is an array, you compose. Middleware run left to right, each wrapping the next.

```ts
export const middleware = [requireUser, requireAdmin, auditLog];

export async function banUser(id: string) {
  const admin = actionContext().user;
  await db.update(users).set({ banned: true }).where(eq(users.id, id));
  return { success: true };
}
```

`requireUser` runs first and sets `ctx.user`. `requireAdmin` reads that user and short-circuits with a `403` if they are not an admin. `auditLog` records the attempt and calls `next()`, which finally runs `banUser`. Each concern is one small function, testable on its own, reusable across every action that needs it.

# The neighbours: the rest of the sibling config exports

Middleware is one of a family of reserved exports a `'use server'` file can declare, all read statically by the framework. You already saw these if you have tuned an action's transport. `export const method` sets the HTTP verb (`'GET'`, `'PATCH'`, and so on). `export const cache` sets a GET's cache window. `export const tags` labels a read's cache entries and `export const invalidates` names the tags a mutation evicts. `export const validate` is the boundary validator. They all sit next to the function and describe how it should be treated, not what it does.

One rule ties this together. A configured action file holds exactly one callable function. That is not an arbitrary limit. The config exports (`middleware`, `method`, `validate`) describe THE function in the file, so a second function would have nowhere to hang its own config. `webjs check` flags a configured file with more than one export as an error. One function, one file, one clear set of guards around it.

# The takeaway

Auth, rate-limit checks, logging, and tenant resolution are cross-cutting, so they do not belong copy-pasted into the top of every action body. WebJs lets a `'use server'` action declare `export const middleware = [mw1, mw2]`, an array of `async (ctx, next) => result` functions that wrap the action. On the RPC boundary they run automatically, and a `route.ts` REST endpoint built with the `route()` adapter picks them up automatically too when you hand it the action's module namespace (or takes the array through its `middleware` option if you pass the bare function). A middleware short-circuits by returning an `ActionResult` before the body runs, and feeds context the action reads through `actionContext()` with no change to its signature. You write the guard once, next to the function, and reuse that one array on every path into the action. Next.js has no first-class primitive for this (you wrap manually or lean on route middleware that cannot even see the action), which is exactly the gap this closes.
