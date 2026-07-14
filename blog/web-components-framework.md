---
title: "What a Web Components Framework Is (and Why It Is Not Just Lit)"
date: 2026-07-14T12:00:00+05:30
slug: web-components-framework
description: "A web components framework builds your UI on native custom elements instead of a proprietary runtime, then adds the server rendering, routing, and data layer the platform leaves out. What that buys you, and how WebJs does it."
keyword: "web components framework"
tagline: "Build your UI on the browser's own component model, then add the full-stack pieces around it."
tags: web components framework, custom elements, shadow dom, ssr, no build
author: Vivek
---

Because I build WebJs on web components, the question I get most is what a web components framework even is, and whether it is any different from just using React or just using Lit. It is different from both, and the difference is the whole point. A web components framework builds your interface on the browser's own component model, native custom elements, instead of a proprietary runtime the way React does. Then it adds the parts the raw platform leaves out. Let me walk through what that actually gets you, because the term gets stretched to cover everything from a component library to a build plugin.

# Why build on the platform's own component model

The case for native custom elements is not novelty. It is longevity and reach, and those are worth more than they sound.

A custom element is just DOM. It works in any page, whether the rest of that page runs WebJs, a different framework, or nothing at all. It composes with plain HTML and with any tool that understands elements, because there is no proprietary component tree it has to live inside. When the next big framework arrives, and it will, your `<order-summary>` element still works, because it was written against the browser and not against a library's release cycle.

There is also less to learn. A React component lives inside React's virtual DOM (an in-memory copy of the DOM the library diffs on every change) and its reconciler. A web component is the DOM. If you know how the DOM works, you already know most of the model, with no separate reconciliation algorithm to reason about. That smaller conceptual load is the same reason an AI coding agent writes correct web-component code from training data it already has.

# What the platform leaves out, and what a framework adds

Native custom elements give you the component and nothing above it. That gap is real, and closing it is the entire job of a web components framework.

**Server-side rendering.** Hand-written custom elements usually render on the client, which hurts first paint and indexing. WebJs renders components to HTML on the server, using Declarative Shadow DOM for the ones that opt into shadow DOM, so the first response carries real content and the element hydrates in place. One code path produces the server HTML and the client render, so the two do not drift. I went deeper on this in [server-side rendering for web components](/blog/server-side-rendering-web-components).

**Progressive enhancement.** A WebJs page works with JavaScript turned off. Content reads, links navigate, forms submit through server actions. Interactivity is added per behaviour, so you never ship a first paint that depends on hydration to show anything.

**Routing and data.** File-based routing, typed server actions (a `.server` file whose functions you import straight into client code, rewritten into a typed network call at request time), and streaming SSR come built in. A page is more than a bag of elements.

**A familiar authoring model.** WebJs components use reactive properties, signals, and a lifecycle that matches Lit closely, so existing web-components knowledge transfers directly. The one deliberate divergence is how reactive properties are declared, and the reasoning is in [WebJs vs Lit](/blog/betting-on-lits-mental-model).

**No build step.** Plenty of web-components setups still reach for a bundler. WebJs serves native ES modules directly and strips TypeScript at load, so there is nothing to compile.

By default those components render in light DOM (their output as ordinary page DOM, no isolation boundary), so global CSS and Tailwind cascade in and `document.querySelector` just works. Shadow DOM stays a per-component opt-in for the cases that want isolation, which I argued for in [Light DOM vs Shadow DOM](/blog/light-dom-by-default).

# A framework, not just a component library

Here is the distinction that trips people up, and it is why "just use Lit" is not the same answer. A component library gives you a good way to author individual custom elements. Lit is the best-known, and it is genuinely excellent at that job. But with a library you still assemble the server, the router, and the data layer yourself. A web components framework gives you the whole app: the same component model plus the full-stack scaffolding around it, wired together.

WebJs uses a Lit-compatible component API on purpose, so the authoring experience feels familiar, and then wraps it in the pieces you would otherwise stitch together by hand. If you already reach for custom elements and keep wishing the full-stack story around them were as solid as the component model itself, that gap is the reason WebJs exists.

None of it couples you to a particular database or CSS approach. The scaffold ships Drizzle, SQLite, and Tailwind as defaults because they pair well, but each is swappable. The constant is the foundation: native web components, server-rendered, with the framework filling in everything the platform leaves out.
