---
title: "Why Bun.serve Beats the node:http Bridge (a ~1.9x Story)"
date: 2026-06-07T10:00:00+05:30
slug: bun-serve-vs-node-http
description: "On Bun, WebJs serves through native Bun.serve instead of routing every request through Node's compatibility bridge. That is roughly 1.9x more requests per second on the listening path, at near-complete feature parity, with 103 Early Hints the one honest gap."
tags: bun, nodejs, performance, runtime, throughput
author: Vivek
---

I moved a WebJs app from Node onto Bun, changed nothing else, ran a load test, and the requests-per-second number on the listening path went up by roughly 1.9x. Before you read that as "Bun makes the app twice as fast," it does not. That number is the plumbing, not your app. Your SSR, your routing, your queries cost the same on either runtime. What got 1.9x faster is the layer that accepts a connection and hands your code a request, and I want to spend this post on exactly where that comes from and what it costs.

The app is buildless, so the same `.ts` source runs on Node 24 and on Bun with nothing to recompile. If you want the mechanics of running one codebase on two runtimes (the runtime-neutral seam, the two TypeScript strippers, the parity matrix), that lives in the companion post `node-and-bun-no-build`. Here I only care about throughput.

# The one number, and the one place it lives

Every web server has a listening path. It accepts an incoming connection, reads the raw HTTP bytes off the socket, builds a request object for your app, takes the response back, and writes it to the socket. That is it. That is the plumbing between the network and your code. Separate from it is the application work: SSR, routing, the queries, the actual WebJs logic.

Requests per second (req/s) is how many of those accept-read-respond cycles the server turns through in a second under load. A leaner listening path buys more req/s for the same application work, because less of each request's time is spent in plumbing rather than in your code.

So the 1.9x is a listening-path number and only a listening-path number. Your SSR does not get faster. The plumbing under it does, and you get that by picking the runtime.

# A compatibility bridge, and why it costs you

Bun can run Node's built-in `node:http` module, which is a big reason so much of the Node ecosystem runs on Bun unmodified. But when Bun runs `node:http`, it runs a compatibility bridge: a translation layer that emulates Node's HTTP request and response objects on top of Bun's own native machinery. Every request pays that translation. You are asking Bun to impersonate Node on the single hottest path in the server.

Bun also ships its own native HTTP server, `Bun.serve`, which speaks Bun's request and response objects directly with no emulation. The catch is that `Bun.serve` is not shaped like `node:http`, so a framework that wants the native path cannot flip a config flag and be done. It has to write a second listener that talks to `Bun.serve` on its own terms.

WebJs writes that second listener. On Bun it serves through a native `Bun.serve` shell and skips the bridge. On Node it serves through `node:http`. Your application code sits above that line and never knows which shell is underneath.

```sh
# same app, same source. the runtime is a command choice:
npm run dev            # Node, node:http listener
bun --bun run dev      # Bun, native Bun.serve listener
```

Skipping the bridge is the whole of the 1.9x. Nothing in the app changed. You stopped paying a per-request translation tax that existed only so Bun could look like Node.

# The one thing I give up: 103 Early Hints

I am not going to sell the native path as a clean superset, because it is not, and the missing piece deserves to be named. The one Node-only feature the Bun listener cannot match is 103 Early Hints. That is an informational HTTP response, a preliminary status the server sends before the real one, that lets the server tell the browser to start preloading assets while the actual response is still being produced. It shaves first-paint latency. `Bun.serve` has no informational-response API at all, so there is nothing for WebJs to build on, and on Bun that optimization is off.

I would rather write that sentence than fake the API with a shim that pretends Bun has something it does not.

# Earning the rest by hand

The listener choice is the headline, but a buildless server has to earn throughput in the small places too, because there is no build step ahead of time to soak up overhead. So the Bun request path got its own passes. Brotli compression on the Bun listener runs through `node:zlib`, so a Bun-served response gets the same compression a Node-served one does, no gap there. And two per-request costs came out directly: a full request-object clone that existed only to stamp the client's IP onto every request, and an extra stream hop that every compressed response was being bridged through. Neither was large on its own. But per-request costs multiply by your traffic, and on the hot path a clone you do not need and a stream hop you can collapse are exactly what is worth cutting by hand.

The runtime is your call, not the framework's. Write one WebJs app. Run it on Node and you get the mature `node:http` listener and 103 Early Hints. Run it on Bun and you get the native `Bun.serve` listener and roughly 1.9x the listening-path throughput, minus that one Early Hints feature. Everything else behaves the same. That is the trade in a sentence: for most apps, giving up one preload-timing feature to get 1.9x on the plumbing is a deal I take. Pass `--runtime bun` to `webjs create` and the generated app is wired for Bun from the first commit, or run `bun create webjs <name>` and it detects the runtime for you.
