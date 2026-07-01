---
title: "Server Actions Without React Server Components"
date: 2026-07-01T15:00:00+05:30
slug: server-actions-without-react-server-components
description: "webjs has no server/client component split, no Flight protocol, and no use client boundary. It gets await-data-in-the-leaf and typed server mutations from one RPC boundary instead. How the execution model works and why it drops the RSC machinery."
tags: server-actions, rsc, execution-model, rpc, data-fetching
author: Vivek
---

The hardest thing to hold in your head about a modern React app is the boundary. Which code runs on the server, which runs on the client, what `"use client"` really does to the tree below it, how a Server Component serializes its output down to a Client Component, and why a value that looks fine throws when it crosses the line. React Server Components are powerful, and they are also the single concept that generates the most confusion in the stack.

webjs does not have them. There is no server component, no client component, no Flight protocol, no `"use client"` directive, and no two render trees. And yet you can still `await` data inside a leaf component and call typed server functions from the browser. This post is about how that works with one boundary instead of a render architecture.

# The execution model in three sentences

Pages and layouts run only on the server. They produce HTML and are never invoked again in the browser. Components are isomorphic: the same module runs on the server to SSR, and runs again in the browser to upgrade the custom element and become interactive.

That is the whole model. There is no server-versus-client component distinction, because the split is not between two kinds of component. It is between two kinds of FILE. A page is a server-only render function. A component is an island that hydrates. A `.server.ts` file is a server boundary. Nothing annotates a component as one side or the other, because a component is always both.

# The one boundary that exists

The only real server boundary in webjs is the `.server.{js,ts}` file. It does two jobs.

With a `'use server'` directive, its exports become callable from the browser. When a client component imports one, the import is rewritten into an RPC stub that POSTs to `/__webjs/action/<hash>/<fn>`. You call it like a normal async function and the framework moves the arguments and the return value across the wire.

Without the directive, the file is a server-only utility, and importing it from browser code gives you a stub that throws at module load. That is the source-protection half: your database driver, your secrets, your `node:*` imports live behind this boundary and physically cannot reach the client. The file is never served.

That is it. One file convention, two behaviours. Compare this to the RSC mental model, where you are reasoning about a render tree that spans the network, a serialization protocol between its layers, and an annotation that changes the meaning of every import beneath it. webjs replaced all of that with "this file is a server function, and importing it is the API."

# The wire is richer than JSON

Because calling a server action is just an import, the arguments and results have to survive the trip. webjs does not use JSON for this. The serializer round-trips `Date`, `Map`, `Set`, `BigInt`, `Error`, typed arrays, `Blob`, `File`, `FormData`, `Symbol`, and cyclic references. So this works with no ceremony:

```ts
// modules/reports/actions/build.server.ts
'use server';
export async function buildReport(range: { from: Date; to: Date }) {
  const rows = await db.query(range);
  return { generatedAt: new Date(), rows: new Map(rows) };
}
```

The client calls `await buildReport({ from, to })` and gets back a real `Date` and a real `Map`, not stringified stand-ins. You never hand-write a `fetch`, never define an API route, never serialize by hand. The import is the contract, and the types flow through it end to end.

# Awaiting data in a leaf, without a render tree

The feature people reach for RSC to get is "fetch data inside the component that needs it, on the server, without a client waterfall." webjs gets this from `async render()` (#469):

```ts
class UserCard extends WebComponent {
  async render() {
    const u = await getUser(this.id);
    return html`<h3>${u.name}</h3>`;
  }
}
```

`getUser` is a `'use server'` action. During SSR it is the real function, so the render blocks on it and the resolved data is baked into the first paint. No fallback markup, no loading flash, and it reads fine with JavaScript disabled because the data is already in the HTML. The fetch is co-located in the leaf that uses it, which is the RSC ergonomic, and there is no prop-drilling and no parent orchestration.

The model is decoupled into three separate concerns so it stays predictable. SSR always blocks, so the data is in the first paint. On the client, when a prop change re-runs `async render()`, the current content stays on screen until the new render resolves, so there is no blank flash (this is stale-while-revalidate by default). And `renderFallback()` is an optional method shown only during a client re-fetch, never on the first paint. You opt into a loading state, you do not inherit one.

# Killing the hydration re-fetch

There is a subtle cost hiding in that design. If a component fetched its data on the server during SSR, and then hydrates in the browser, does it fetch again on hydration?

By default, no, because of SSR action seeding (#472). Every `'use server'` action result produced during a server render is serialized into the page, keyed by the action hash, the function name, and the serialized arguments. The generated RPC stub checks that seed on its first client call and resolves synchronously from it instead of hitting the network. So `await getUser(this.id)` runs once, on the server, and the browser reuses the result on its first render. A later refetch or an argument change misses the seed (it is consume-once) and goes to the network as normal.

It is fail-open by construction. A seed miss is always a normal RPC call, never wrong data. And it needs no build step and no source transform: the capture is a server-side facade over the action module, so the files on disk and the source the browser sees are byte-unchanged. You get the RSC benefit of "the server already did this work, do not redo it on the client" without the protocol that RSC needs to deliver it.

# Why webjs does not need RSC, and Next does

This is the part worth being precise about, because it is not that RSC is bad. It is that webjs does not have the problem RSC solves.

In React, a component is a client thing by default. To run data-fetching on the server without shipping that code to the browser, React needs a way to mark parts of the tree as server-only and stream their rendered output down to the client parts. That is Server Components and the Flight protocol. The split exists because React's unit, the component, has to be told which side it belongs to.

webjs never has that problem, because its reads and writes do not flow through components at all. They flow through the `.server.ts` boundary. A read is a GET server action. A write is a POST server action. Both are just server functions you import. There is no need to designate a component as server-rendered, because the data crossing was never the component's job. So the machinery that manages a network-spanning render tree is machinery webjs has no tree to manage. One boundary, not a boundary per component.

That is also why the whole thing is easier to teach, and easier for an AI agent to get right on the first try. There is exactly one rule to internalise: server code lives in `.server.ts`, and importing a `'use server'` file is how you call it. There is no second render tree to model, no serialization boundary to reason about mid-tree, and no annotation whose blast radius is everything below it.

# What it costs

The honest trade is that you give up the parts of RSC that are genuinely nice when you are deep in React. You do not get a unified tree where a server component and a client component compose as freely as two functions. You compose a server-rendered page with hydrating islands, which is a coarser seam. For an app that is mostly content with islands of interactivity, that seam is exactly where you want it. For an app that is a deeply interleaved client tree with server data threaded through every level, RSC's finer boundary does more for you.

webjs is built for the first shape. It says the page is the server artifact, the islands are the interactive leaves, and the one server boundary is where data crosses. If that matches how you are building, dropping RSC is not a loss. It is the confusing part of the stack you get to not have.

# The takeaway

You do not need a server/client component split to fetch data on the server and call it from the browser. You need one clear boundary for server code and a serializer good enough to move real values across it. webjs puts that boundary at the file level, makes importing it the API, and recovers await-in-the-leaf and no-hydration-refetch on top of it. The result is a model you can hold in your head in three sentences, which is the whole point.
