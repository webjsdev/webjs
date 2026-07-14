---
title: "Web components frameworks, explained"
date: 2026-07-14T09:00:00+05:30
slug: web-components-framework
description: "A web components framework builds your UI on native custom elements instead of a proprietary runtime. What that buys you, and how WebJs turns web components into a full-stack framework."
keyword: "web components framework"
tagline: "Build your UI on the browser's own component model, then add the full-stack pieces around it."
tags: web components framework, custom elements, shadow dom, ssr, no build
author: Vivek
---

A web components framework builds your interface on the browser's own component model, native custom elements, instead of a proprietary runtime like React's. Custom elements, shadow DOM, and `<template>` have shipped in every major browser since 2018. They render without any library, and they survive the framework churn that makes you relearn a new runtime every few years. The catch is that the platform hands you the component primitive and then stops. No server rendering, no router, no data layer. A web components framework is what fills that gap.

WebJs is a full-stack web components framework, and I want to be precise about what that means, because the term gets stretched to cover everything from a component library to a build plugin. Here is what choosing web components as the foundation actually gets you, where the raw platform runs out, and how a framework closes the distance.

# Why build on the platform's own component model

The pitch for native custom elements is not novelty. It is longevity and reach.

A custom element is just DOM. It works in any page, whether the rest of that page uses WebJs, a different framework, or nothing at all. It composes with plain HTML and with any tool that understands elements, because there is no proprietary component tree it has to live inside. When the next big framework arrives, your `<order-summary>` element still works, because it was written against the browser and not against a library's release cycle.

There is also less to learn. A React component lives inside React's virtual DOM (an in-memory copy of the DOM that the library diffs against on every change) and its reconciler. A web component is the DOM. If you know how the DOM works, you already know most of the model, and there is no separate reconciliation algorithm to reason about. That smaller conceptual load is the same reason an AI coding agent writes correct web-component code from training data it already has.

# What the platform leaves out, and what a framework adds

Native custom elements give you the component and nothing above it. The gap is real, and it is exactly what WebJs fills.

**Server-side rendering.** Hand-written custom elements usually render on the client, which hurts first paint and search indexing. WebJs renders components to HTML on the server (using Declarative Shadow DOM for the components that opt into shadow DOM), so the first response carries real content, and the element hydrates in place once its module loads. One code path produces the server HTML and the client render, so the two do not disagree.

**Progressive enhancement.** A WebJs page works with JavaScript turned off. Content reads, links navigate, and forms submit through server actions. Interactivity is added per behaviour, so you never ship a first paint that depends on hydration to show anything.

**Routing and data.** File-based routing, typed server actions (a `.server` file whose functions you import straight into client code, rewritten into a typed network call at request time), and streaming SSR come built in. A page is more than a bag of elements.

**A familiar authoring model.** WebJs components use reactive properties, signals, and a lifecycle that matches Lit (a popular web-components library) closely, so existing web-components knowledge transfers directly. The one deliberate difference is how reactive properties are declared, and the reasoning behind that is its own write-up in [WebJs vs Lit](/blog/betting-on-lits-mental-model).

**No build step.** Many web-components setups still reach for a bundler. WebJs serves native ES modules directly and strips TypeScript types at load, so there is nothing to compile and no compiled output to keep in sync with your source.

By default those components render in light DOM (their output as ordinary page DOM, no isolation boundary), so global CSS and Tailwind cascade in and `document.querySelector` just works. Shadow DOM stays a per-component opt-in for the cases that want isolation. I made the case for that default in [Light DOM vs Shadow DOM](/blog/light-dom-by-default).

# A framework, not just a component library

Here is the distinction that matters most. A component library gives you a good way to author individual custom elements. Lit is the best-known, and it is genuinely good at that job. But with a library you still assemble the server, the router, and the data layer yourself. A web components framework gives you the whole app: the same component model plus the full-stack scaffolding around it, wired together.

WebJs deliberately uses a Lit-compatible component API so the authoring experience feels familiar, then wraps it in the pieces you would otherwise stitch together by hand. If you already reach for custom elements and keep wishing the full-stack story around them were as solid as the component model itself, that gap is the reason WebJs exists.

None of this couples you to a particular database or CSS approach. The scaffold ships Drizzle, SQLite, and Tailwind as defaults because they pair well, but each is swappable. The constant is the foundation: native web components, server-rendered, with the framework filling in everything the platform leaves out.

## FAQ

### What is the difference between a web components framework and React?

React uses its own component model, a virtual DOM and a proprietary runtime that only exists inside React. A web components framework builds on native custom elements, which the browser understands directly. React components run only inside React; web components run anywhere the DOM runs. WebJs is a full-stack web components framework, so it adds the app-level pieces (server rendering, routing, data) on top of the standard component model.

### Is Lit a web components framework?

Lit is a component library, not a full framework. It is an excellent way to author individual custom elements, but you still assemble server rendering, routing, and a data layer yourself. WebJs uses a Lit-compatible component API and adds those full-stack pieces around it, so you keep the authoring feel and get the whole app.

### Do web components work with server-side rendering?

Yes, and it is a core job of a good web components framework. WebJs renders components to HTML on the server, using Declarative Shadow DOM for components that opt into shadow DOM, so the first paint is real content and the element hydrates in place. Raw hand-written custom elements usually render only on the client, which is the gap the framework closes.

### Do I need a build step for a web components framework?

Not with WebJs. It serves native ES modules directly and strips TypeScript types at load, so there is no bundler and no compiled output to keep in sync with your source. Some other web-components setups still use a bundler, but a build step is not inherent to the approach.
