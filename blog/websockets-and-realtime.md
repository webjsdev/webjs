---
title: "Real-Time WebJs: WebSockets and Broadcast Without a Separate Server"
date: 2026-06-27T15:00:00+05:30
slug: websockets-and-realtime
description: "How WebJs adds real-time features with WebSockets folded into the file router: a WS export in route.ts, connectWS with auto-reconnect and queued sends on the client, and a broadcast built-in for fan-out, no separate WebSocket server required."
tags: websockets, realtime, broadcast, routing, web-standards
author: Vivek
---

The moment your app needs to feel alive, the ground shifts under you. A live chat. A little green "3 people viewing" presence dot. A cursor gliding across a shared document. All of these need the server to push to the browser without the browser asking first, which a normal HTTP request cannot do. HTTP is a question-and-answer format: the client asks, the server answers, the line closes.

A WebSocket is the fix. It is a connection that stays open in both directions, so the server can send you a message the instant something happens, and you can send one back, all over the same pipe. Great. Except in most stacks, adding one means standing up a second server.

That is the part I always found deflating. You already have an app with routing and auth and sessions, and now you bolt a separate WebSocket process next to it and re-wire all of that by hand. Which user is this socket? What route does it belong to? Is it allowed to be here? You answer those questions once for HTTP and then answer them all over again, differently, for the socket server. WebJs skips the second server entirely.


# The old way: a socket server living next door

Here is the shape of the pain, roughly. You install a WebSocket library, create its server, and run it alongside your app, often on another port.

```ts
// a whole separate process, more or less
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

Nothing here is exotic, but every line is a small re-implementation of something your app already does. The socket server does not share your routing, so a connection to `/chat/42` is just a string you parse yourself. It does not share your auth, so you re-derive the user. And it runs beside your app, so now you have two things to deploy, two things to scale, and two things to keep from drifting apart.


# The WebJs way: a WS export in the same route file

WebJs folds WebSockets into the file router you already use for pages and HTTP handlers. A `route.{js,ts}` file can export named HTTP methods like `GET` and `POST`, and it can also export a `WS` function. That function defines a WebSocket endpoint at exactly that path, sitting right next to (or instead of) the HTTP handlers.

```js
// app/api/chat/route.js
export function WS(ws, req, { params }) {
  ws.on('message', (data) => ws.send('echo:' + data));
  ws.on('close', () => { /* cleanup */ });
}
```

A socket at `/api/chat` is now a file at `app/api/chat/route.js`, the same way a page at `/about` is a file at `app/about/page.js`. The `params` argument is the same route-params object your dynamic routes get, so a socket at `app/room/[id]/route.js` reads `params.id` with no string parsing. There is no second server, no second port, no second deploy. The endpoint lives inside the app that already knows your routes.

One dev-mode detail worth knowing. In development the module re-imports on each new connection so it picks up your edits without a restart. That means you cannot keep shared state (like the set of connected clients) in a module-level variable, because it would reset per connection. Park it on `globalThis` instead:

```js
const clients = globalThis.__chat_clients ?? (globalThis.__chat_clients = new Set());
```


# The client: connectWS, and why queued sends matter

On the browser side you open the socket with `connectWS(url, handlers)` from `@webjsdev/core`.

```ts
import { connectWS } from '@webjsdev/core';

const socket = connectWS('/api/chat', {
  onOpen: () => console.log('connected'),
  onMessage: (msg) => appendMessage(msg),
  onClose: () => console.log('gone'),
});
```

Two things it does for you that you would otherwise hand-roll. It auto-reconnects with exponential backoff, which means when the connection drops (a phone leaving a tunnel, a laptop lid closing, a flaky cafe network) it quietly tries again, waiting a little longer between each attempt so it does not hammer a struggling server. And it queues sends while disconnected. If your code calls send during that brief dead window, the message is not thrown away; it is held and flushed the instant the socket comes back. It also JSON-encodes and decodes for you, so you send and receive objects, not strings.

Those two behaviors are exactly the fiddly bits people get wrong when they wire a raw socket by hand, which is why baking them in matters. Real networks are unreliable, and a chat that silently loses the message you sent at the wrong half-second is worse than no chat.


# Fan-out: the broadcast built-in

A live feature is rarely one client talking to the server. It is one client's action showing up on everyone else's screen. That is fan-out, or broadcast: take one message and push it to every connected client on a channel. WebJs ships a `broadcast` helper in `@webjsdev/server` so you do not build the "who else is connected" bookkeeping yourself.

```js
import { broadcast } from '@webjsdev/server';

export function WS(ws, req) {
  ws.on('message', (data) => {
    broadcast('/api/chat', data);  // to every client connected on this path
  });
}
```

The first argument is the channel (here just the path), and everyone connected to it receives the message. This same primitive powers presence indicators and notifications, not just chat, because they are all the same shape underneath: something happened, tell everyone watching.

It also composes with WebJs's server-push rendering. A route can build a `<webjs-stream>` HTML fragment and `broadcast` it, and every viewer's client applies the DOM update with no custom handler, the same applier the client router already uses. So "a new comment appears live for everyone reading the post" is a broadcast of a rendered fragment, not a bespoke client script.

One honest limit. The built-in `broadcast` is single-instance: it fans out to the clients connected to this one server process. When you scale to multiple instances behind a load balancer, you add Redis pub/sub yourself to bridge them. WebJs does not hide that behind magic, and I would rather it be upfront about the boundary than pretend a single-process broadcast scales horizontally on its own.


# The takeaway

Real-time features usually mean a second server that re-implements your app's routing and auth just to hold an open connection. WebJs folds WebSockets into the same file router: a `WS(ws, req, { params })` export in a `route.{js,ts}` file defines a socket endpoint at that path, with the same route params your pages get and no separate process to deploy. On the client, `connectWS` gives you auto-reconnect and queued sends so a dropped connection does not lose a message, and `broadcast` fans one message out to every connected client for chat, presence, or live updates. It is single-instance out of the box (add Redis pub/sub when you scale past one process), but the everyday version, the one you build to make an app feel alive, is a file next to your pages instead of a server next to your app.
