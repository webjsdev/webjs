---
title: "Real-Time WebJs: WebSockets and Broadcast Without a Separate Server"
date: 2026-06-27T15:00:00+05:30
slug: websockets-and-realtime
description: "How WebJs adds real-time features with WebSockets folded into the file router: a WS export in route.ts, connectWS with auto-reconnect and queued sends on the client, and a broadcast built-in for fan-out, no separate WebSocket server required."
tags: websockets, realtime, broadcast, routing, web-standards
author: Vivek
---

Ask what it takes to add a live chat to an app and the honest answer, in most stacks, is a second server. HTTP cannot push. The client asks, the server answers, the line closes, and that shape is fine for a page load and useless for a message arriving the instant someone else sends it. So you reach for a WebSocket, a connection that stays open in both directions, and to run it you stand up a separate process next to your app.

That second process is where the deflation sets in. Your app already knows how to route a request, who the logged-in user is, and which session a cookie belongs to. The socket server knows none of it. A connection to `/chat/42` is a raw string you parse yourself. The user is a cookie you re-read and re-validate by hand. You answered all of these questions once for HTTP and now you answer them again, in a different codebase, for the socket. And when you are done you have two things to deploy, two things to scale, and two things that drift apart the first time someone changes one and forgets the other.

I did not want a real-time app to mean a second app. So WebJs does not have one.

# The socket server living next door

Here is the usual shape, roughly. Install a WebSocket library, create its server, run it beside your app on another port.

```ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', (socket, req) => {
  // Which user is this? Your app knows. This server does not.
  // Re-parse cookies, re-validate the session, re-check the route...
  socket.on('message', (data) => {
    // and now fan this out to everyone else, which you also build by hand
  });
});
```

None of it is hard on its own. That is almost the problem. Every line re-implements something the app on the other port already does correctly. The socket server does not share the router, so the path is a string. It does not share auth, so the user is re-derived. It runs as its own process, so it is its own deploy, its own scaling story, its own thing to keep in sync.

# A WS export in the route file you already have

WebJs puts WebSockets in the same file router that serves pages and HTTP handlers. A `route.{js,ts}` file exports named HTTP methods like `GET` and `POST`. It can also export a `WS` function, and that defines a WebSocket endpoint at exactly that path, sitting right beside the HTTP handlers or in place of them.

```js
// app/api/chat/route.js
export function WS(ws, req, { params }) {
  ws.on('message', (data) => ws.send('echo:' + data));
  ws.on('close', () => { /* cleanup */ });
}
```

A socket at `/api/chat` is a file at `app/api/chat/route.js`, the same way a page at `/about` is a file at `app/about/page.js`. That `params` argument is the same route-params object your dynamic routes get, so a socket at `app/room/[id]/route.js` reads `params.id` with no string parsing at all. No second port, no second deploy. The endpoint lives inside the app that already knows the route it belongs to.

One development detail is worth knowing before it surprises you. In dev the module re-imports on each new connection so your edits show up without a restart. That means module-level state resets per connection, so the set of connected clients cannot live in a top-level variable. Park it on `globalThis`:

```js
const clients = globalThis.__chat_clients ?? (globalThis.__chat_clients = new Set());
```

# The client half, and the two things it saves you

On the browser you open the socket with `connectWS(url, handlers)` from `@webjsdev/core`.

```ts
import { connectWS } from '@webjsdev/core';

const socket = connectWS('/api/chat', {
  onOpen: () => console.log('connected'),
  onMessage: (msg) => appendMessage(msg),
  onClose: () => console.log('gone'),
});
```

Two behaviors here are the ones people get wrong by hand, which is exactly why they are built in. It auto-reconnects with exponential backoff, so when the connection drops (a phone leaving a tunnel, a lid closing, a cafe network having a moment) it retries on its own, waiting a little longer each time so it does not pound a server that is already struggling. And it queues sends while disconnected. Call send during that dead window and the message is held, not dropped, then flushed the moment the socket is back. It JSON-encodes and decodes too, so you work in objects, not strings.

Real networks are unreliable, and a chat that quietly eats the message you typed at the wrong half-second is worse than a chat that is honestly down. Getting these two right is most of what "wire a socket by hand" actually costs.

# One message to everyone: broadcast

A live feature is almost never one client and the server. It is one client doing something and everyone else seeing it. That is fan-out, and WebJs ships a `broadcast` helper in `@webjsdev/server` so you do not keep the "who else is connected" bookkeeping yourself.

```js
import { broadcast } from '@webjsdev/server';

export function WS(ws, req) {
  ws.on('message', (data) => {
    broadcast('/api/chat', data);
  });
}
```

The first argument is the channel, here just the path, and everyone connected to it gets the message. The same primitive drives presence dots and notifications, not only chat, because underneath they are one shape: something happened, tell everyone watching.

It also composes with WebJs's server-push rendering. A route can build a `<webjs-stream>` HTML fragment and `broadcast` it, and every viewer's client applies the DOM update with no custom handler, through the same applier the client router already uses. So "a new comment shows up live for everyone reading the post" is a broadcast of a rendered fragment, not a bespoke client script you write and maintain.

One limit, stated plainly. The built-in `broadcast` is single-instance. It fans out to the clients connected to this one server process. Put several instances behind a load balancer and you add Redis pub/sub yourself to bridge them. I would rather the boundary be visible than dressed up as magic that quietly fails to scale the day you add a second instance.

# The takeaway

Real-time usually means a second server that re-derives your app's routing and auth just to hold a connection open. WebJs folds WebSockets into the file router instead: a `WS(ws, req, { params })` export in a `route.{js,ts}` file is a socket endpoint at that path, with the same route params your pages get and nothing extra to deploy. `connectWS` gives the client auto-reconnect and queued sends so a dropped connection does not lose a message, and `broadcast` pushes one message to every connected client for chat, presence, or live updates. It runs single-instance until you add Redis pub/sub to scale past one process. The app you build to feel alive is a file sitting next to your pages, not a server sitting next to your app.
