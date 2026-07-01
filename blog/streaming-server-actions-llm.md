---
title: "How to Stream AI Responses From a Server Action"
date: 2026-06-06T14:00:00+05:30
slug: streaming-server-actions-llm
description: "How to stream an LLM response token by token in WebJs by returning an async generator from a server action. Streaming server actions push each AI token over one RPC response, no WebSockets, no SSE, no hand-written ReadableStream plumbing."
tags: server-actions, streaming, llm, ai, rpc
author: Vivek
---

You have seen the effect. You ask ChatGPT a question and the answer appears word by word, like someone typing on the other end. The alternative is a spinner that sits there for eight seconds and then dumps a wall of text at once. The word-by-word version feels alive. The spinner feels broken.

The catch is that the streaming version usually costs you a lot of plumbing. You reach for WebSockets, or for Server-Sent Events (a one-way stream of text from server to browser), and now you are wiring up a channel, parsing frames on the client, and handling reconnects. That is a lot of ceremony for "show the text as it arrives."

In WebJs you do not write any of that. A server action can return an async generator (a function that `yield`s values over time instead of returning once), and WebJs streams each yielded chunk to the caller over the single RPC response. The call site reads them with a plain `for await` loop. That is the whole feature (#489). Let me show you.

# The action: yield tokens instead of returning a string

A server action is any exported async function in a `*.server.ts` file marked `'use server'`. Normally it returns a value and WebJs round-trips that value back to the caller. The new part is that if you return something streamable (a `ReadableStream`, an async iterable, or an async generator), WebJs streams the pieces instead of buffering the whole thing.

Here is an action that calls an LLM SDK and yields tokens as they come off the model:

```ts
// modules/chat/actions/stream-answer.server.ts
'use server';
import { actionSignal } from '@webjsdev/server';
import { openai } from '../../../lib/llm.server.ts';

export async function* streamAnswer(prompt: string) {
  const signal = actionSignal();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  }, { signal });

  for await (const part of completion) {
    const token = part.choices[0]?.delta?.content;
    if (token) yield token;
  }
}
```

The `async function*` syntax (note the asterisk) is a generator. Every `yield token` hands one piece back to whoever is looping over the call. WebJs serializes each yielded value and flushes it down the response as it is produced, so the browser sees token one while the model is still working on token fifty.

Detection is purely on the return value. There is no config export to set, no `export const stream = true`. You return an async generator, you get streaming.

# The call site: a normal import and a `for await` loop

You never hand-write a `fetch`. When a client component imports `streamAnswer`, WebJs rewrites that import into a typed RPC stub that POSTs to the action endpoint under the hood. The import looks like any other import, and the types flow across the network boundary intact.

Because the action streams, awaiting the stub gives you an async iterable. You loop over it:

```ts
// modules/chat/components/answer-box.ts
import { html, WebComponent, signal } from '@webjsdev/core';
import { streamAnswer } from '../actions/stream-answer.server.ts';

class AnswerBox extends WebComponent({ prompt: String }) {
  #text = signal('');

  async ask() {
    this.#text.set('');
    for await (const token of await streamAnswer(this.prompt)) {
      this.#text.set(this.#text.get() + token);
    }
  }

  render() {
    return html`
      <button @click=${() => this.ask()}>Ask</button>
      <p>${this.#text.get()}</p>
    `;
  }
}
AnswerBox.register('answer-box');
```

Each token appends to a signal (WebJs's default reactive state primitive), and the built-in watcher re-renders the paragraph on every change. The text grows on screen exactly the way you wanted, one token at a time, and the transport is one HTTP response you never had to think about.

# Back-pressure comes for free

Back-pressure is the mechanism that stops a fast producer from overwhelming a slow consumer. If the model emits tokens faster than the browser can read them, you do not want the server to buffer the entire completion in memory.

WebJs respects back-pressure on the stream. The generator only advances as the response is drained, so a slow client naturally slows the producer instead of ballooning server memory. You get this without writing a single line for it.

# Cancellation is wired end to end

The other half of streaming is stopping. A user closes the tab halfway through a long answer. You do not want the server to keep paying an LLM to generate tokens nobody will read.

WebJs handles this on both sides (#492).

On the server, an action reads the request's `AbortSignal` through `actionSignal()` from `@webjsdev/server`. That is the `signal` I passed to the OpenAI SDK above. When the client disconnects, the signal aborts, the SDK call stops, and the generator is cancelled. (Called outside an action, `actionSignal()` returns a signal that never aborts, so a plain server-to-server call is always safe.)

On the client, a superseded render aborts the previous request automatically. If your component re-renders with a new prompt while an older `streamAnswer` call is still streaming, WebJs aborts the old in-flight fetch rather than leaking it. Each render gets its own `AbortController`, and the RPC stub binds every fetch to it. You do not manage any of this.

# What streaming turns off, and one thing to know

A streamed result is deliberately never cached, never ETagged, and never seeded into the SSR payload. That makes sense: a live token stream is not a static value you can freeze and replay. If the action is a mutation (a POST, PUT, PATCH, or DELETE), it still emits its `X-Webjs-Invalidate` header on completion so the client cache coordinator knows to revalidate related reads.

Errors are the one thing to keep in mind. Because streaming starts the moment the first byte flushes, the HTTP status is already `200` by the time an error can happen mid-stream. So a throw does not become a `500`. It surfaces as an error from the iterable itself, which means your `for await` loop will throw and you can wrap it in a `try/catch`. In production the message is sanitized to the author-facing text, the same rule that governs every WebJs server action error.

```ts
try {
  for await (const token of await streamAnswer(this.prompt)) {
    this.#text.set(this.#text.get() + token);
  }
} catch (err) {
  this.#text.set('Something went wrong. Please try again.');
}
```

# The takeaway

Streaming an AI response used to mean standing up a WebSocket or an SSE endpoint and parsing frames by hand. In WebJs you return an async generator from a `'use server'` action, `yield` each token, and consume it with a `for await` loop on a normal import that WebJs turns into a typed RPC stub. Back-pressure is respected, cancellation is wired through `actionSignal()` on the server and an automatic abort on the client, and a mid-stream error surfaces as a throw from the iterable rather than a broken status code. It is the same mechanism you already use for every server action, so streaming LLM tokens is not a new subsystem to learn. It is one keyword: `yield`.
