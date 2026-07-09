---
title: "WebJs vs Remix 3: No Build, Beyond React, Web Standards"
date: 2026-07-09T10:00:00+05:30
slug: webjs-vs-remix
description: "An honest comparison of WebJs and Remix 3. Both drop the bundler, move beyond React, run on web standards, and are built for AI agents. They diverge on the view layer: WebJs uses native web components with a declarative reactive API, Remix 3 uses its own runtime-first virtual DOM with an imperative model."
competitor: "Remix 3"
link: "https://remix.run"
tagline: "Two frameworks that dropped the bundler and moved beyond React, diverging on the view layer."
tags: comparison, remix, remix-3, web-standards, no-build
author: Vivek
---

This compares WebJs with **Remix 3**, the ground-up rewrite currently in beta, not Remix 1 or 2. That distinction matters, because Remix 3 is a different framework from the React-based Remix that came before. It drops React entirely, drops the bundler, and rebuilds on web standards. Where the older Remix was a React framework with a compiler, Remix 3 shares a surprising amount of philosophy with WebJs, so this is more a story of two frameworks reaching similar conclusions and then diverging on the view layer.


# What the two share

Remix 3 and WebJs agree on more than most framework pairs:

- **No bundler.** Remix 3 is "religiously runtime": bundler-free, zero-dependency, running your source through a Node `--import` loader that strips TypeScript types and compiles JSX. WebJs is no-build too, through the same kind of Node loader, but its transform only strips types (its `html` templates are ordinary tagged template literals, so nothing else needs compiling). Neither has a Webpack or Vite step, and both treat pre-runtime static analysis as something to avoid designing around.
- **Beyond React.** Remix 3 removed React and renders through its own lightweight virtual DOM (a few low-level pieces adapted from Preact), authored in JSX. WebJs uses native web components. Both concluded that the React runtime is not the thing to build the future on.
- **Web standards at the core.** Remix 3 runs directly on the Fetch API with standard `Request` and `Response` objects. WebJs is built on native custom elements and the same web platform primitives.
- **Built for AI agents.** Remix 3 aims for a model-first API surface optimized for humans and AI agents. WebJs is AI-first by design, small enough to read end to end, with conventions the tooling enforces.
- **Progressive enhancement.** Both send real HTML and treat forms and the request/response cycle as first-class, not a fallback nobody tests.

If you were drawn to Remix 3's direction, WebJs will feel philosophically adjacent. The differences are in how each one builds the view and the data layer.


# Difference one: native web components vs a runtime-first VDOM

This is the core divergence. Remix 3 renders through its own lightweight virtual DOM (with a reconciler, a `mix` composition system, JSX, and frame hydration) that it ships and controls. WebJs renders through native web components: `customElements.define`, shadow DOM when you want it, `<slot>` projection, no virtual DOM and no reconciler shipped to the browser.

The consequence is what outlives the framework. A WebJs `<my-counter>` is a real custom element that the browser upgrades and runs on its own; it keeps working independent of the framework version. Remix 3's components live inside its VDOM runtime. One bets on the browser's own component model, the other on a small controlled virtual DOM. WebJs also elides display-only components entirely, so a component with no interactivity ships zero JavaScript, which a shipped VDOM runtime does not do by default.


# Difference two: declarative reactivity vs an imperative model

Remix 3 leans deliberately imperative. A component is a setup function that receives a `handle` and returns a render function: the outer function runs once, the inner one runs on each update. State is plain local variables, you trigger a re-render explicitly by calling `handle.update()`, and you compose reusable behavior with `mix` and mixins. It is a procedural style: first do this, then do that.

WebJs is declarative and lit-shaped. State lives in signals or reactive properties, and reads inside `render()` re-render automatically when they change, through the lit lifecycle (`willUpdate`, `updated`, and the rest). You describe what the UI is for a given state rather than imperatively pushing updates. Neither is objectively better; it is a genuine taste split between an explicit imperative model and an automatic declarative one, and it is the clearest day-to-day difference in how the two feel to write.


# Difference three: data and mutations

Both keep data and mutations on the server, but the surface differs. Remix 3 is model-first: you start from a declarative schema, with first-class database drivers, and mutations are actions tied to form submissions.

WebJs uses one server-action boundary. A `.server.ts` file with `'use server'` exports functions that a component imports and calls directly; the import is rewritten to a typed RPC stub, and the same mechanism carries both reads and writes, with the HTTP verb, caching, and validation declared through sibling config exports. Types flow across that boundary, so a component sees the real signature of a server function. A leaf component can also `await` its own data during SSR and have it in the first paint. WebJs keeps the Next.js-style nested `app/` routing (route groups, per-segment error and loading boundaries, catch-all segments) as its one strong convention, and leaves the rest of the architecture to you.


# Difference four: stability today

Remix 3 is in [beta preview](https://remix.run/blog/remix-3-beta-preview). Its ideas are compelling and its direction is close to WebJs's, but the API is still moving, and building on it today means building on a moving target. This is a factual note about where Remix 3 is in its cycle, worth weighing if you need to ship on a stable surface now.


# Where Remix 3 is the better pick

- You prefer JSX and an explicit imperative model (plain variables, `handle.update()`, `mix` composition) over a declarative reactive one.
- You want the model-first, schema-driven approach where routes and components derive from a declarative data model.
- You want to follow the Remix team's roadmap and ecosystem as Remix 3 matures.


# Where WebJs is the better pick

- You want native web components as the view layer: standards-based custom elements that render on their own and outlive the framework, with no virtual DOM shipped to the browser.
- You prefer a declarative, lit-shaped reactive model over an imperative one, with signals and reactive properties that re-render automatically.
- You want automatic zero-JavaScript elision for display-only components, so static parts of the page ship no script.
- You want a single typed server-action boundary for reads and writes, with types spanning the client and server, and file-routing conventions you already know from the Next.js app router.

WebJs and Remix 3 arrived at the same crossroads, no bundler, beyond React, web standards, built for agents, and then took different roads through the view layer. The choice is largely native web components with declarative reactivity, versus a runtime-first virtual DOM with an imperative model.
