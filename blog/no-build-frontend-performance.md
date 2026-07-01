---
title: "No-Build Frontend Performance: Flattening the CDN Waterfall"
date: 2026-06-06T16:00:00+05:30
slug: no-build-frontend-performance
description: "A no-build framework serves modules instead of bundling them, which risks a request waterfall. How WebJs stays fast with modulepreload over the vendor graph and HTTP/2."
tags: no-build, performance, modulepreload, importmap, http2
author: Vivek
---

The obvious objection to a no-build framework is performance. If you do not bundle, the browser fetches many small ES modules over the network instead of one concatenated file, and those fetches can chain into a waterfall: the page loads, which pulls a component, which pulls a helper, which pulls a vendor package, each round trip discovered only after the previous one lands. Bundlers exist largely to collapse that chain.

WebJs does not bundle, and it is still fast. Not because the waterfall is not real, but because it is attacked directly at the two places it actually hurts. This post is about those two places and the honest limit that remains.

# Where the cost actually is

Start by being precise about what bundling buys. It buys two things: fewer requests, and no runtime discovery latency (everything is in one file, so the browser never has to fetch A to learn it needs B). On HTTP/1.1 with its six-connection limit, fewer requests mattered enormously. On HTTP/2, which multiplexes many streams over one connection, the request-count cost is mostly gone. What remains is discovery latency: the level-by-level unfolding of the dependency graph.

So the no-build performance problem is not really "too many requests." It is "the browser learns about each dependency one level too late." That reframing is the whole game, because discovery latency is fixable without a bundler. You just have to tell the browser what it will need before it discovers it the slow way.

# The importmap and modulepreload

WebJs serves an import map in the page head. Every bare specifier a module might import (`dayjs`, or `@webjsdev/core`) resolves through it to a real URL, pinned to a CDN like jspm for third-party packages. That is the Rails 7 importmap-rails posture: no bundler, direct module URLs, the browser's native loader doing the resolution.

The importmap alone does not solve discovery latency, though. It tells the browser HOW to resolve `dayjs` once it sees the import, not that it WILL need `dayjs`. So the browser still discovers the dependency only when it parses the module that imports it. That was the waterfall crack in the no-build story, and closing it (#754) is what made the posture actually competitive.

The fix is `<link rel="modulepreload">`. During SSR, WebJs walks the module graph from the page's actually-shipped modules, collects every vendor specifier they reach, resolves each to its importmap target, and emits a preload hint for it in the head. So the moment the browser reads the head, it starts fetching the whole reached vendor set in parallel, before it has parsed a single component. The level-by-level discovery collapses into one parallel burst. The bytes the browser needs are already in flight by the time the code that imports them runs.

The walk is careful about which roots it starts from. It uses the boot's shipped-module set, which already drops the display-only modules that elision strips and substitutes an import-only page with its real components. So a vendor reached only through a module that never ships is never preloaded. You do not pay to preload a dependency the page will not actually load. The preload set is exactly the served set, no more.

# The listener path

The second place the cost hides is the server itself. A no-build server does more per request than a static file server, because it is resolving modules, stripping TypeScript, and running SSR. If the request path is heavy, the time-to-first-byte suffers no matter how good the preloading is.

WebJs runs on Node and on Bun, and the Bun listening path got a specific pass (#773) to cut per-request overhead. The Bun shell had been cloning the whole request object on every request just to stamp the client IP, and bridging every compressed response through an extra stream hop. Both were removed: the IP is stamped out of band without rebuilding the request, and a buffered response is compressed synchronously with no bridge. That is the kind of unglamorous work that a no-build framework has to do, because there is no build step absorbing the cost ahead of time. The request path IS the product, so the request path has to be lean.

# What production actually leans on

The honest picture is that no-build production performance rests on HTTP/2 at the edge. The modulepreload hints turn discovery-latency into one parallel fetch, and HTTP/2 multiplexing makes that parallel fetch cheap over a single connection. The `npm run start` server speaks plain HTTP/1.1, so the deployment story is to put a reverse proxy or CDN in front of it for TLS and HTTP/2, exactly as you would for any origin. Cache-Control on static assets and content-hashed asset URLs do the rest, so a returning visitor refetches almost nothing.

None of this is exotic. It is the same performance model Rails uses for importmap apps, plus the preload walk that importmap-rails does not do by default. WebJs is arguably a step ahead of the framework that proved the no-build posture, precisely on the axis people assume no-build loses.

# The limit I will not pretend away

There is one thing bundling does that preloading does not: tree-shaking. A bundler can drop the unused exports of a module before it ships. WebJs serves whole modules, so if you import one function from a package, the browser fetches the module that function lives in. For the core runtime this is a real, fixed floor: a page with one tiny interactive island still loads the whole core, once, cached and shared across the app.

I am comfortable with this because it is the same trade Rails made with Hotwire, whose runtime is the same order of magnitude and has shipped to production for years. The core is off the first-paint path (SSR plus progressive enhancement mean the HTML reads before any of it loads), it is cached, and it is shared. The place it would actually bite is an app that pulls in many large, rarely-co-occurring client dependencies, which is a React-SPA shape that WebJs's whole architecture steers you away from. Stay island-shaped and the tree-shaking you are missing is tree-shaking you did not need.

# The takeaway

No-build performance is not about matching a bundler's request count. It is about killing discovery latency, which you do by telling the browser what it will need before it finds out the slow way, and by keeping the request path lean because there is no build step to hide behind. Preload the reached graph, multiplex it over HTTP/2, cache aggressively, and the waterfall flattens. The one thing you genuinely give up is tree-shaking, so keep your client footprint honest and let the shared, cached core earn its keep.
