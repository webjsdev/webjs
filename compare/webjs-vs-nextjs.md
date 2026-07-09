---
title: "WebJs vs Next.js: No Build Step, No RSC, Web Components"
date: 2026-07-09T10:00:00+05:30
slug: webjs-vs-nextjs
description: "An honest comparison of WebJs and Next.js. WebJs keeps the Next-style developer experience (file routing, server actions, streaming SSR) but drops the build step and the React Server Component split, building the view layer on native web components instead."
competitor: "Next.js"
link: "https://nextjs.org"
tagline: "The Next.js developer experience, minus the build step and the RSC mental model."
tags: comparison, nextjs, react, web-components, no-build
author: Vivek
---

I built WebJs because I wanted the developer experience I enjoy in Next.js without the two things that make it heavy: the build step, and the React Server Component split you now have to reason about on every component. This page is an honest account of where the two frameworks agree, where they genuinely differ, and who should pick which.

If you already ship Next.js and it works for you, nothing here says you are wrong. WebJs is for people who want the same app shape on web standards.


# What the two share

The surface is close on purpose, because the Next.js app-router shape is good and the muscle memory is worth keeping. Both give you:

- File-based routing with `page`, `layout`, dynamic `[param]` segments, catch-all routes, route groups, and per-segment error and loading boundaries.
- Server-side rendering with streaming Suspense.
- Server actions you import into client code and call like normal functions.
- Metadata as data (`metadata` and `generateMetadata`) that becomes your `<head>`.
- Sensible built-in defaults so you write features instead of wiring integrations.

Someone fluent in the Next.js app router can read a WebJs `app/` tree and know what every file does on the first try.


# Difference one: there is no build step

The `.ts` files you write are the files the browser fetches. WebJs uses Node 24's built-in `module.stripTypeScriptTypes` to erase types in place, so the source you read is the source that runs, with stack traces that point at your real line numbers and no sourcemap layer in between.

There is no `webjs build` command because there is nothing to build. Production performance comes from HTTP/2 multiplex plus `<link rel="modulepreload">` hints emitted at render time, the same model as Rails 7 with `importmap-rails`. Next.js takes the opposite bet: a highly optimized bundler (Turbopack) that produces excellent output, at the cost of a compile step between you and the browser and a build to wait on in CI.

The practical effect for day-to-day work is the dev loop. Edit, save, refresh. Nothing recompiles.


# Difference two: no React Server Component split

This is the big one. Next.js is built on RSC now. Every component is a Server Component until you write `'use client'`, and you spend real attention tracking which side of that boundary a given piece of code lives on, what can cross it, and how the Flight protocol serializes the tree.

WebJs has no server/client component split at all. There is no RSC render tree, no Flight protocol, no `'use client'`. Instead:

- **Pages and layouts run only on the server.** They produce HTML and are never re-invoked in the browser.
- **Components hydrate.** A component module loads in the browser, the custom element upgrades, and its interactivity runs client-side, islands-style, per element.
- **`.server.ts` is the one server boundary.** A file with `'use server'` exports becomes a typed RPC stub when imported from client code. A file without it is a server-only utility whose browser import is a load-time error, which is how a dependency is kept off the client.

Reads and writes both flow through that one action mechanism, so there is a single boundary to learn rather than a component-coloring rule applied everywhere.


# Difference three: web components, not a React runtime

The WebJs view layer is native web components: `customElements.define`, shadow DOM when you want it, `<slot>` projection. The authoring API is lit-shaped (`render()` returning `html` templates, reactive properties, the lit lifecycle and directive set), so lit muscle memory transfers, but the runtime is WebJs's own so the SSR pipeline is controlled end to end.

That means no virtual DOM, no reconciler, and no custom hydration protocol to ship. The elements render without a framework and survive framework churn. Next.js gives you the enormous React ecosystem in exchange; WebJs gives you smaller, standards-based output and elements that keep working when the framework does not.


# Progressive enhancement is the default, not a mode

A WebJs page is server-rendered HTML that reads, navigates, and submits forms with JavaScript disabled. JS is opt-in per interactive behavior. Display-only components are detected and their code is stripped from what the browser downloads, so a static component ships zero JavaScript. In Next.js, progressive enhancement is possible but it is something you architect toward, not the default you get for free.


# Where Next.js is the better pick

- You need the React ecosystem: a specific component library, a charting or table library, React Native code sharing, or a large team already fluent in React.
- You want managed edge deployment with zero configuration on Vercel, integrated image optimization, and first-party i18n. WebJs defers image optimization and i18n to libraries you layer on.
- You are hiring against a deep React talent pool and that matters more than output size.


# Where WebJs is the better pick

- You want the source you read in `node_modules` to be the source that runs, with no compiled layer to debug through.
- You are tired of tracking the server/client boundary on every component and want one clear RPC boundary instead.
- You care about shipping little JavaScript and want progressive enhancement by default.
- You build with AI agents and want a framework small enough (roughly 5 to 10 percent of Next.js by source) for an agent to read end to end, with conventions the tooling enforces.

WebJs is the framework I wanted to exist: the good parts of the Next.js experience, rebuilt on the platform instead of on top of a compiler and a component runtime.
