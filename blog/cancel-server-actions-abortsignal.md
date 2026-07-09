---
title: "Cancelling Server Actions With AbortSignal (No Wasted Work on Disconnect)"
date: 2026-06-15T10:00:00+05:30
slug: cancel-server-actions-abortsignal
description: "WebJs wires the platform's own AbortSignal through the server-action RPC boundary in both directions, so a client that navigates away actually cancels the in-flight request and the server stops paying for work nobody is waiting for."
tags: server-actions, abortsignal, performance, cancellation, web-standards
author: Vivek
---

Picture a typeahead search. The user types "web", you fire an action, they type "webj", you fire another, they type "webjs", you fire a third. By the time they stop, the first two requests are answers nobody wants. In most setups those first two still run to completion on the server, still hit the database, still serialize a result, and only then get thrown away on the client. You paid full price for two answers that were obsolete the moment they were requested.

I did not want WebJs to pay for work nobody is waiting for. The web platform already has the primitive for this. It is `AbortSignal`, the same object `fetch` accepts to be cancelled. So WebJs wires that signal through the server-action RPC (remote procedure call) boundary, in both directions, and a cancelled request is actually cancelled on the wire.

# The server side reads the request's signal

Inside an action, you can read the current request's `AbortSignal` and stop working the moment the client goes away. It is one import.

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

`actionSignal()` returns the `AbortSignal` tied to the in-flight request. When the client disconnects or aborts, that signal fires, and anything you passed it to unwinds. You hand it to a `fetch`, or to a database query that accepts a signal, or you check `signal.aborted` yourself inside a loop.

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

There is a deliberate safety detail here. When you call an action directly server-to-server (not across an HTTP request, just one server function calling another), `actionSignal()` returns a signal that never aborts. So the pattern is always safe to write. Your action does not need to know whether it is being reached over the network or called inline, and it will never spuriously abort just because there was no request context around it.

# The client side aborts the superseded render for you

The server half is only useful if the client actually signals the abort, and this is where the RPC boundary earns its keep. When a component's `async render()` is superseded by a newer render (a prop changed, the user typed again), WebJs does not merely ignore the old render's result. It aborts the in-flight action fetch that render started.

The generated RPC stub binds every fetch it issues to a per-render `AbortController`. When that render is superseded, its controller is aborted, the underlying HTTP request is torn down, and the `AbortSignal` you read on the server with `actionSignal()` fires. The whole chain connects. Client supersedes a render, the fetch is aborted on the wire, the server's signal trips, your action stops.

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

Type fast into this and every keystroke supersedes the last render. Without cancellation, each stale request runs to completion server-side before its result is dropped. With it, the stale request is actually cancelled the moment the next keystroke lands, so the server stops the query it was running and moves on. Under a burst of typing that is the difference between one live query and five, and you wrote none of the plumbing. It falls out of `async render()` being cancellable and the stub binding each fetch to the render that issued it.

# Streaming actions cancel their source too

The same principle extends to streaming results. An action that returns a `ReadableStream`, an async iterable, or an async generator streams its chunks over the single RPC response instead of buffering them all first.

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

If the client disconnects, or the render that started the stream is superseded, WebJs cancels the source generator. The `for await` on the server stops advancing, so a long or infinite stream (think a token feed from a model) does not keep producing into a void. The producer is torn down at the source, not just ignored at the consumer. Back-pressure is respected the same way, so a slow reader does not force the generator to run ahead of what anyone is consuming.

# Why this is the right shape

The thing I like about this is that it is not a WebJs invention layered on top of the platform. `AbortSignal` and `AbortController` are the web's own cancellation primitives, the same ones `fetch` has accepted for years. WebJs just threads them through the one place they were previously missing, which is the RPC boundary between a client component and a server action. The server reads the platform signal, the client drives the platform controller, and the framework connects the two ends across the network so an abort on one side becomes an abort on the other.

You get to write the ordinary, boring, correct thing. Pass a signal to your `fetch`, check `signal.aborted` in a hot loop, let a superseded render clean up after itself. No cancellation library, no request-ID bookkeeping, no manual "is this response still the latest" guard on the client.

# The takeaway

Work that nobody is waiting for is work you should not be doing. WebJs makes server actions cancellable by wiring the platform's own `AbortSignal` through the RPC boundary in both directions. On the server, `actionSignal()` gives you the request's signal to pass to a fetch, a DB query, or an `aborted` check, and it returns a never-aborting signal outside a request so server-to-server calls stay safe. On the client, a superseded `async render()` aborts the previous render's in-flight fetch through a per-render `AbortController`, so a fast typeahead cancels stale requests on the wire instead of letting them finish and drop. Streaming actions cancel their source generator on disconnect or supersession too. It is the platform's cancellation model, threaded through the one boundary that was missing it, so you stop paying for answers no one wants.
