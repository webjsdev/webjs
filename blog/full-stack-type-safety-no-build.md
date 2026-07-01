---
title: "Full-Stack Type Safety With No Build Step"
date: 2026-06-13T10:30:00+05:30
slug: full-stack-type-safety-no-build
description: "End-to-end type safety in WebJs with no build TypeScript. Typed server actions flow the real function signature across the network boundary, so full-stack types are just a normal import, with no codegen and no compile step."
tags: typescript, type-safety, server-actions, no-build, dx
author: Vivek
---

Here is a pain most people hit early. You write a server function that returns a user. You call it from the browser. Somewhere between those two lines the data becomes JSON, and now your editor has no idea what shape it is. You pass the wrong argument, you read a field that does not exist, you get `undefined` at runtime instead of a red squiggle while you type. The server and the browser are two programs that happen to talk over HTTP, and the type checker only sees one of them at a time.

"Type safety across the network" means closing that gap. Calling your server from the browser becomes as safe as calling a function in the same file. A typo, a missing field, a wrong argument shape gets caught in your editor before you ever run the code. That is the whole promise, and in WebJs it is not a library you bolt on. It is how a server action already works.

Let me show what that looks like, then explain why it needs no build step at all.


# What a build step and codegen usually are

Two quick definitions, because the payoff only makes sense against them.

A **build step** is a program that runs before your code runs. It takes the source you wrote (TypeScript, JSX, whatever) and turns it into something the runtime can execute (plain JavaScript). `tsc`, esbuild, webpack, and Vite are build steps. You edit, the builder compiles, and the thing that actually runs is the compiled output, not the file you opened.

**Codegen** (code generation) is a build step's cousin. A tool inspects your API (a GraphQL schema, an OpenAPI spec, a router definition) and writes TypeScript types into a file so your client code knows the shape of your server responses. You run the generator, it emits `generated.ts`, and you import from that. When your API changes, you rerun the generator, or your types silently lie.

Both are useful. Both are also a step you have to remember, a process that has to be running, and a layer between the code you wrote and the code that runs. Not needing one is nice for a simple reason. There is less to set up, less to keep in sync, and nothing to forget.


# Server actions carry the real signature

In WebJs a server action is a function in a `*.server.ts` file marked `'use server'`. You import it into a client component with a normal import. The framework rewrites that import into a typed RPC stub, a small client function that POSTs to `/__webjs/action/<hash>/<fn>` and gives you back the result. You never hand-write the `fetch`. Importing the function IS the API.

The part that matters for types: the type checker never sees the stub. It resolves your import to the real source file, so it reads the actual function signature, arguments and return type included.

```ts
// modules/posts/actions/create-post.server.ts
'use server';
export async function createPost(
  input: { title: string; body: string },
): Promise<ActionResult<PostFormatted>> {
  /* ... */
}

// modules/posts/components/new-post.ts
import { createPost } from '../actions/create-post.server.ts';

const r = await createPost({ title, body });
//        ^ Promise<ActionResult<PostFormatted>>
if (r.success) r.data.title;   // PostFormatted.title, typed as string
```

Pass `{ titel: '...' }` and the editor flags it. Read `r.data.slug` when `PostFormatted` has no `slug` and the editor flags that too. There is no separate schema file describing the wire, and no generator to rerun when the function changes. Change the return type of `createPost` and every caller updates on the next keystroke, because they were reading the one real definition the whole time.


# The types you get are the types the server returned

A JSON round-trip flattens your data. A `Date` becomes a string. A `Map` becomes `{}`. So even when a tool gives you accurate types, the values at runtime often do not match them, because JSON cannot carry those shapes.

WebJs uses its own wire serializer instead of plain JSON. It round-trips `Date`, `Map`, `Set`, `BigInt`, `Error`, typed arrays, `Blob`, `File`, `FormData`, Symbols, and reference cycles. So a `Date` you return from the server arrives as a real `Date` on the client, not a string you have to reparse.

```ts
const r = await createPost({ title, body });
if (r.success) {
  r.data.createdAt.getFullYear();  // a real Date, .getFullYear() works
}
```

This is why the type safety is honest and not just optimistic. The type says `Date`, the value is a `Date`. The one caveat worth knowing: a class instance comes through as a plain object, so prototypes and methods are lost (the same rule as React server actions). If you want that caught at compile time, the optional `SerializableActionFn` annotation turns a non-serializable field or argument into a type error instead of a silent runtime surprise. It is opt-in, because a plain `export async function` stays plain.


# Types for the rest of the app too

Server actions are the headline, but the type flow reaches the routing layer as well.

Run `webjs types` and the framework generates `.webjs/routes.d.ts`, an overlay with one entry per route in `app/`. It gives you a typed `Route` union (`navigate('/blog/anything')` is fine, `navigate('/nonexistent')` is a type error) plus per-route params. `webjs dev` regenerates it on startup and after each route rebuild, so the editor always has fresh route types (this is #258, WebJs's no-build answer to Next 15's `typedRoutes`, done through interface declaration-merging instead of a bundler).

Three exported helper types read that union. `PageProps<R>` types a page's `{ params, searchParams, url, actionData }`, `LayoutProps<R>` adds `children`, and `RouteHandlerContext<R>` types a `route.ts` handler's second argument. Pass the route literal and `params` narrows to the exact shape.

```ts
import type { PageProps } from '@webjsdev/core';

export default function Post({ params }: PageProps<'/blog/[slug]'>) {
  const slug = params.slug;   // typed as string, not Record<string, string>
  /* ... */
}
```

`Metadata` types a page's `metadata` export so a misspelled field (`titel`, `descripton`) is a compile-time error, and `WebjsConfig` types the `webjs` block in `package.json` so a typo'd config key is diagnosed instead of silently dropped. Every one of these is a pure type. It is erased at runtime with zero cost.


# Why none of this needs a build step

Here is the part that surprises people coming from tRPC or GraphQL. There is no build step and no code-generation server anywhere in this.

tRPC gets excellent inference, but you wire up routers and thread a client type through your app to get it. GraphQL is fully typed, but you pay for it with a codegen step that has to run whenever the schema moves. Both are good tools. Both add a process you maintain.

WebJs skips the process because the type flow is just a normal import resolving to a normal file. TypeScript is **erasable** (invariant 10), which means the type annotations can be stripped out with nothing left to compile. On Node 24+ the runtime strips them with the built-in `module.stripTypeScriptTypes`, position-preserving, so the `.ts` file you wrote is the file the browser fetches, with the types whitespace-erased. There is no `tsc` producing output that runs in its place. The only requirement is `erasableSyntaxOnly: true` in `tsconfig.json`, which keeps your TypeScript to the erasable subset (no `enum`, no value `namespace`, no constructor parameter properties) so the editor flags anything the stripper cannot handle before you ever run it.

So the type checker runs in your editor and (optionally) in CI as `tsc --noEmit`. The runtime never type-checks. It just erases. The types are a development-time overlay on files that already run as-is, which is exactly why there is nothing to build and nothing to generate. Full-stack types fall out of the architecture instead of being bolted onto it.


# The takeaway

Full-stack type safety in WebJs is not a feature you configure, it is what you get by default. A server action imported into a client component carries its real signature across the network, so calling your backend is as safe as calling a local function, and a wrong argument or a missing field is caught in your editor before the code runs. The wire serializer round-trips `Date`, `Map`, `Set`, and more, so the types you see are the values you actually get, not a JSON-flattened guess. `webjs types`, `PageProps`, `Metadata`, and `WebjsConfig` extend that safety to routing, metadata, and config. And all of it works with no build step and no codegen, because TypeScript is erasable and the file you write is the file that runs.
