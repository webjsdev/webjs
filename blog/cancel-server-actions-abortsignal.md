---
title: "Cancelling Server Actions With AbortSignal (No Wasted Work on Disconnect)"
date: 2026-06-15T10:00:00+05:30
slug: cancel-server-actions-abortsignal
description: "WebJs wires the platform's own AbortSignal through the server-action RPC boundary in both directions, so a client that navigates away actually cancels the in-flight request and the server stops paying for work nobody is waiting for."
tags: server-actions, abortsignal, performance, cancellation, web-standards
author: Vivek
---

Watch the network tab while someone uses a typeahead. They type "web" and you fire an action. They type "webj" and you fire another. They type "webjs" and you fire a third. The moment that third request is in flight, the first two are answers nobody will ever read. Or take the plainer version: a user kicks off a slow report and then switches tabs or closes the page. The result no longer has an audience.

Here is the part that bothered me. In most setups those obsolete requests still run to completion on the server. They still hit the database, still serialize a result, and only then get dropped on the client because something newer arrived. You paid full server price for an answer that was stale before it finished. Under a fast typist that is not one wasted query, it is a pile of them, all live at the same time.

The web platform already has the primitive for calling off work in flight. It is `AbortSignal`, the same object `fetch` has accepted for cancellation for years. What was missing was threading it through the boundary between a client component and a server action. So WebJs wires it through the server-action RPC (remote procedure call) boundary in both directions, and a cancelled request is cancelled on the wire, not just ignored once its answer shows up.

# Reading the signal on the server

Inside an action you can read the current request's `AbortSignal` and stop the instant the client is gone. One import.

```ts
// modules/search/queries/search.server.ts
'use server';
import { actionSignal } from '@webjsdev/server';

export async function search(term: string) {
  const signal = actionSignal();
  const res = await fetch(`https://api.example.com/q?term=${term}`, { signal });
  return res.json();
}
```

`actionSignal()` returns the signal tied to the in-flight request. When the client disconnects or aborts, it fires, and anything you handed it to unwinds. Pass it to a `fetch`, pass it to a database driver that accepts a signal, or check `signal.aborted` yourself inside a loop.

```ts
export async function crunch(rows: Row[]) {
  const signal = actionSignal();
  const out = [];
  for (const row of rows) {
    if (signal.aborted) break;   // client left, stop chewing
    out.push(expensiveTransform(row));
  }
  return out;
}
```

There is a deliberate safety detail in there. Call an action directly server-to-server, one server function invoking another with no HTTP request wrapped around it, and `actionSignal()` returns a signal that never aborts. So the same code is always safe to write. Your action never has to know whether it was reached over the network or called inline, and it will not spuriously abort just because there was no request context.

# The client aborts the stale render for you

The server half only matters if the client actually raises the abort, and this is where the RPC boundary earns its place. When a component's `async render()` is superseded by a newer one (a prop changed, the user hit another key), WebJs does not merely discard the old render's result. It aborts the in-flight action fetch that render kicked off.

The generated RPC stub binds every fetch it issues to a per-render `AbortController`. Supersede the render and its controller aborts, the underlying HTTP request is torn down, and the `AbortSignal` you read on the server with `actionSignal()` fires. The whole chain connects end to end. The client supersedes a render, the fetch dies on the wire, the server's signal trips, your action stops.

```ts
class Search extends WebComponent({ term: String }) {
  async render() {
    if (!this.term) return html`<ul></ul>`;
    const hits = await search(this.term);   // superseded by the next keystroke
    return html`<ul>${hits.map((h) => html`<li>${h.title}</li>`)}</ul>`;
  }
}
Search.register('search-box');
```

Type quickly into that and every keystroke supersedes the render before it. Without cancellation, each stale request runs to completion server-side before its result is thrown away. With it, the stale request is cancelled the instant the next keystroke lands, so the server abandons the query it was midway through and moves on. Across a burst of typing that is the difference between one live query and five, and you wrote none of the plumbing. It falls out of two facts: `async render()` is cancellable, and the stub ties each fetch to the render that issued it.

# Streaming actions cancel at the source

The same idea carries to streaming results. An action that returns a `ReadableStream`, an async iterable, or an async generator streams its chunks over the one RPC response instead of buffering them all up front.

```ts
// modules/tokens/actions/stream-tokens.server.ts
'use server';
export async function* streamTokens(n: number) {
  for (let i = 0; i < n; i++) {
    yield { i, token: await nextToken() };
  }
}
```

```ts
for await (const chunk of await streamTokens(8)) {
  this.tokens = [...this.tokens, chunk.token];
}
```

If the client disconnects, or the render that started the stream is superseded, WebJs cancels the source generator. The `for await` on the server stops advancing, so a long or endless stream (picture a token feed from a model) does not keep producing into a void. The producer is torn down at the source, not merely ignored at the consumer. Back-pressure works the same way, so a slow reader never forces the generator to run ahead of what anyone is actually reading.

# Why this is the right shape

What I like most is that none of it is a WebJs invention bolted on top of the platform. `AbortSignal` and `AbortController` are the web's own cancellation primitives, the same ones `fetch` has taken for years. WebJs threads them through the one place they were previously absent, the RPC boundary between a client component and a server action. The server reads the platform signal, the client drives the platform controller, and the framework joins the two ends across the network, so an abort on one side is an abort on the other. You write the ordinary, boring, correct thing. Hand a signal to your `fetch`, check `signal.aborted` in a hot loop, let a superseded render tidy up after itself. There is no cancellation library, no request-ID bookkeeping, no "is this still the latest response" guard riveted onto the client. Work nobody is waiting for is work you should not be doing, and the platform already handed you the tool to stop it. WebJs runs the wire from one end of that tool to the other.
