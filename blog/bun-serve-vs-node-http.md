---
title: "Why Bun.serve Beats the node:http Bridge (a ~1.9x Story)"
date: 2026-06-07T10:00:00+05:30
slug: bun-serve-vs-node-http
description: "On Bun, WebJs serves through native Bun.serve instead of routing every request through Node's compatibility bridge. That is roughly 1.9x more requests per second on the listening path, at near-complete feature parity, with 103 Early Hints the one honest gap."
tags: bun, nodejs, performance, runtime, throughput
author: Vivek
---

You have a WebJs app in production. It is buildless, so the same `.ts` source runs on Node 24 and on Bun with nothing to recompile. One afternoon you try Bun under it, mostly because you have heard it is faster. You flip the runtime, run a load test, and the requests-per-second number on the listening path jumps by roughly 1.9x. You changed no code. That number is the whole subject of this post: where it comes from, what "the listening path" actually is, and the one feature you give up to get it.

If you want the mechanics of how WebJs runs on two runtimes at all (the runtime-neutral seam, the two TypeScript strippers, the parity test matrix), that is a separate story in the companion post `node-and-bun-no-build`. This one is purely about throughput.

# What "requests per second" and "the listening path" mean

Let me define the pieces in plain terms, because the win lives in one specific place and it is easy to overstate.

Every web server has a listening path, sometimes just called the listener. It is the code that accepts an incoming network connection, reads the raw HTTP bytes off the socket, hands a request object to your application, takes the response your app hands back, and writes it to the socket. It is the plumbing between the network and your code. Separate from it is your application work: the SSR, the routing, the queries, the actual WebJs logic.

Requests per second (req/s) is simply how many of those accept-read-respond cycles the server turns through in one second under load. A leaner listening path means more req/s for the same application work, because less of each request's time is spent in the plumbing.

So the 1.9x is a listening-path number. It is not 1.9x on your whole app end to end, because your SSR and queries cost the same on either runtime. It is 1.9x on the plumbing, which you get for free by choosing the runtime.

# A compatibility bridge, and why it costs you

Bun can run Node's built-in `node:http` module, which is a big reason so much of the Node ecosystem runs on Bun unmodified. But when Bun runs `node:http`, it runs a compatibility bridge (a compat bridge for short): a translation layer that emulates Node's HTTP request and response objects on top of Bun's own native machinery. Every single request pays that translation cost. You are asking Bun to pretend to be Node on the hottest path in the server.

Bun also ships its own native HTTP server, `Bun.serve`, which speaks Bun's request and response objects directly with zero emulation. The catch is that `Bun.serve` is not shaped like `node:http`, so a framework that wants the native path cannot just flip a config value; it has to write a second listener that talks to `Bun.serve` on its own terms.

WebJs writes that second listener. On Bun it serves through a native `Bun.serve` shell and skips the compat bridge entirely. On Node it serves through `node:http`. Your application code sits above that boundary and never knows which shell is underneath.

```sh
# same app, same source. the runtime is a command choice:
npm run dev            # Node, node:http listener
bun --bun run dev      # Bun, native Bun.serve listener
```

Skipping the bridge is where the 1.9x comes from. Nothing in your app changed. You stopped paying a per-request translation tax that existed only so Bun could look like Node.

# The one honest gap: 103 Early Hints

I will not pretend the native path is a perfect superset of the bridged one, because the missing piece is worth naming plainly.

The one Node-only feature the Bun listener cannot match is 103 Early Hints. That is an informational HTTP response (a preliminary status the server can send before the real one) that lets the server tell the browser to start preloading assets while the actual response is still being produced. It is a first-paint latency optimization. `Bun.serve` has no informational-response API at all, so there is nothing for WebJs to build on, and on Bun that optimization is simply off.

That is the entire tradeoff. You give up one preload-timing feature and you get 1.9x on the listener in exchange. For most apps that is a clear win, and I would rather document the gap honestly than paper over it with a shim that fakes an API Bun does not have.

# Trimming the per-request cost on the Bun path

The listener choice is the headline, but a buildless server has to earn throughput in the small places too, because there is no build step ahead of time to absorb overhead. So the Bun request path got its own passes.

Brotli compression on the Bun listener runs through `node:zlib`, so a Bun-served response gets the same compression a Node-served one does, no native gap there. And the per-request overhead got trimmed directly: one pass removed a full request-object clone that existed only to stamp the client's IP address onto every request, and another removed an extra stream hop that every compressed response was being bridged through. Neither was large alone, but they are per-request costs, so they multiply by your traffic. On the hot path, a clone you do not need and a stream hop you can collapse are exactly the kind of thing worth cutting by hand.

# You pick the runtime

The runtime is your choice, not the framework's. You write one WebJs app. Run it on Node and you get the mature `node:http` listener and 103 Early Hints. Run it on Bun and you get the native `Bun.serve` listener and roughly 1.9x the listening-path throughput, minus that one Early Hints feature. Everything else behaves the same. Pass `--runtime bun` to `webjs create` and the generated app is wired for Bun from the first commit, or run `bun create webjs <name>` and it detects the runtime for you.

# The takeaway

The 1.9x is not magic and it is not the whole app; it is the listening path, the plumbing that accepts a connection and produces a response. On Bun, WebJs serves through native `Bun.serve` instead of running `node:http` over a compatibility bridge, and skipping that per-request translation tax is where the throughput comes from. The honest cost is 103 Early Hints, which Bun has no API to support. Brotli compression rides `node:zlib` and the per-request overhead has been trimmed to keep the Bun path lean. You pick the runtime, and if you pick Bun you get a real throughput win on the hot path with almost no change in behavior.
