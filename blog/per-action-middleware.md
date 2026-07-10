---
title: "Per-Action Middleware: Auth and Context Around a Single Server Action"
date: 2026-06-17T10:00:00+05:30
slug: per-action-middleware
description: "How WebJs attaches per-action middleware to a single server action for auth, rate-limit checks, logging, and tenant resolution. Declarative middleware that runs automatically on the RPC boundary, short-circuits cleanly, and feeds context via actionContext()."
tags: server-actions, middleware, auth, rpc, composition
author: Vivek
---

Every app I build ends up with the same two lines at the top of a dozen server actions. Get the current user. If there is no user, bail out. Then, below that, the actual work: delete the post, charge the card, update the profile.

```ts
// modules/posts/actions/delete-post.server.ts
'use server';
export async function deletePost(id: string) {
  const user = await auth();
  if (!user) return { success: false, error: 'unauthorized' };
  await db.delete(posts).where(eq(posts.id, id));
  return { success: true };
}
```

It looks harmless the first time. By the fifteenth action it is a liability. The check is copy-pasted, which means it is one careless paste away from being subtly wrong, and it is one forgotten paste away from being absent. An action missing its two lines is a hole, and nothing about the file looks different from the fifteen that have them. You find out when someone deletes a post they do not own.

The deeper problem is that the check does not belong in the action at all. Deleting a post is the action's job. Deciding whether the caller is allowed to is a separate concern that happens to run in the same place. They are tangled together because there was nowhere else to put the guard.

# Give the guard its own home

A WebJs server action is a function in a `*.server.ts` file marked `'use server'`. Next to that function you can declare a reserved export the framework reads statically, `export const middleware`, an array of functions that wrap the action.

```ts
// modules/posts/actions/delete-post.server.ts
'use server';
import { requireUser } from '#lib/auth-middleware.server.ts';
import { actionContext } from '@webjsdev/server';

export const middleware = [requireUser];

export async function deletePost(id: string) {
  const user = actionContext().user;
  await db.delete(posts).where(eq(posts.id, id)).where(eq(posts.authorId, user.id));
  return { success: true };
}
```

The two lines are gone. `deletePost` no longer knows how auth works or where the user comes from. It reads `actionContext().user` and gets on with deleting a post. `requireUser` is the guard, written once, and every action that lists it in its `middleware` array is protected identically. There is no fifteenth file that quietly forgot.

# What requireUser actually is

A middleware is `async (ctx, next) => result`. It gets a context object it can write to, and a `next` function that runs the rest of the chain, whether that is the next middleware or finally the action. This is the onion model from Express or Koa, narrowed down to a single action.

```ts
// lib/auth-middleware.server.ts
import { getSession } from '#lib/session.server.ts';

export async function requireUser(ctx, next) {
  const user = await getSession();
  if (!user) {
    return { success: false, error: 'unauthorized', status: 401 };
  }
  ctx.user = user;
  return next();
}
```

Two behaviors are doing the work here.

When there is no session, `requireUser` returns an `ActionResult` and never calls `next()`. That return is a hard stop. The action body is not entered, so there is no half-run mutation and no query fired with a null user. The chain ends and that result is what the caller sees. This is the guarantee the copy-pasted version could never make, because a forgotten paste failed open. A missing middleware is visible in the array, not invisible in its absence.

When there is a session, `requireUser` hangs the user on `ctx` and calls `next()`. Whatever a middleware writes onto `ctx` is readable in the action through `actionContext()`. The action's signature does not change to accommodate this. `deletePost(id)` still takes one argument. The user rides in out of band, so the code that calls `deletePost` stays as simple as it ever was.

# It travels with the action, not with the transport

Here is the part that sold me on doing it this way. A WebJs action is reachable through two doors. A client component imports it and the import becomes a typed RPC (Remote Procedure Call) stub. Or a `route.ts` REST endpoint imports it and calls it, often through the `route()` adapter from `@webjsdev/server`.

On the RPC boundary the guard runs on its own. When the browser calls `deletePost` over RPC, `requireUser` runs first, because the framework reads the `export const middleware` off the action and wraps the chain for you. Components import actions directly, so this is the everyday path, and it needs no wiring.

The `route()` adapter picks the same chain up, on one condition. You hand it the action's module namespace, not the bare function.

```ts
// app/api/posts/[id]/route.ts
import { route } from '@webjsdev/server';
import * as postActions from '#modules/posts/actions/delete-post.server.ts';
export const DELETE = route(postActions);
```

Passing the whole module is what lets the adapter see the `export const middleware` (and `export const validate`) sitting beside the action, so `requireUser` guards the REST door the same way it guards the RPC one. Import just the function instead, `import { deletePost }` then `route(deletePost)`, and the adapter has no path to that sibling config, so nothing is applied automatically. There you pass the chain yourself with `route(deletePost, { middleware })`. The bare form only runs what you hand it.

# Stack them up

Because `middleware` is an array, guards compose. They run left to right, each wrapping the next.

```ts
export const middleware = [requireUser, requireAdmin, auditLog];

export async function banUser(id: string) {
  const admin = actionContext().user;
  await db.update(users).set({ banned: true }).where(eq(users.id, id));
  return { success: true };
}
```

`requireUser` runs first and sets `ctx.user`. `requireAdmin` reads that user and short-circuits with a `403` if they are not an admin. `auditLog` records the attempt and calls `next()`, which finally runs `banUser`. Three concerns, three small functions, each testable alone and reusable on any action that needs it. The action reads one line of context and knows the caller made it through all three.

# The other exports next to the function

Middleware belongs to a family of reserved exports a `'use server'` file can declare, all read statically. `export const method` sets the HTTP verb. `export const cache` sets a GET's cache window. `export const tags` labels a read's cache entries and `export const invalidates` names the tags a mutation evicts. `export const validate` is the boundary validator. Each one describes how the function should be treated, not what it does, and each sits right next to it.

That is also why a configured action file holds exactly one callable function. The config describes THE function in the file, so a second function would have nowhere to attach its own. `webjs check` flags a configured file with more than one export. One function, one file, one set of guards wrapped around it.

Next.js has no first-class version of this. You wrap the check by hand in every action, or you push it up to route middleware that cannot see which action it is guarding. In WebJs the guard is a property of the action itself. You declare `requireUser` once, in the file where `deletePost` lives, and it comes along on every path into that action, RPC or REST, without you carrying it there.
