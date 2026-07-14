---
title: "What is a web components framework?"
date: 2026-07-14T09:00:00+05:30
slug: web-components-framework
description: "A web components framework builds your UI on native custom elements instead of a proprietary component runtime. This guide explains what that buys you and how WebJs turns web components into a full-stack framework."
keyword: "web components framework"
tagline: "Build your UI on the browser's own component model, then add the full-stack pieces around it."
tags: web components framework, custom elements, shadow dom, ssr, no build
author: Vivek
---

A web components framework is a framework that builds your user interface on native custom elements, the browser's own built-in component model, rather than on a proprietary runtime like React or Vue. Instead of a virtual DOM and a component tree that only exists inside a library, your components are real elements the browser understands. A web components framework then adds the pieces the raw platform leaves out: server-side rendering, routing, data loading, and a comfortable authoring experience.

WebJs is a full-stack web components framework. This guide explains what choosing web components as your foundation actually gets you, where the raw platform falls short, and how WebJs fills those gaps without abandoning the standard.

## Why build on web components at all

Custom elements, shadow DOM, and templates are part of the web platform. They ship in every modern browser and they are not going away. Building on them means:

- **No framework lock-in at the component boundary.** A custom element works in any page, whether the rest of the app uses WebJs, another framework, or nothing at all.
- **Interoperability by default.** Components are just DOM. They compose with plain HTML, with each other, and with any tool that understands elements.
- **Longevity.** The platform's own APIs outlive any single library's release cycle. Code written against standards ages more slowly.
- **A smaller conceptual load.** If you know the DOM, you already know most of the model. There is no separate reconciliation algorithm to reason about.

The catch is that the raw platform gives you the component primitive and stops there. It does not give you server rendering, a router, or a data layer. That gap is exactly what a web components framework fills.

## What the raw platform leaves out, and how WebJs fills it

- **Server-side rendering.** Hand-written custom elements typically render on the client, which hurts first paint and SEO. WebJs server-renders components to HTML (with Declarative Shadow DOM when you opt into shadow DOM), so the first paint is real content, then the element hydrates in place.
- **Progressive enhancement.** WebJs pages work with JavaScript disabled: content reads, links navigate, and forms submit through server actions. Interactivity is added per behavior, so you never ship a first paint that depends on hydration.
- **Routing and data.** File-based routing, typed server actions for client-to-server calls, and streaming SSR come built in, so a page is more than a bag of elements.
- **A familiar authoring model.** WebJs components use reactive properties, signals, and a lifecycle that matches Lit closely, so existing web components knowledge transfers directly. The one deliberate difference is how reactive properties are declared.
- **No build step.** Many web components setups still reach for a bundler. WebJs serves ES modules directly and strips TypeScript at load, so there is nothing to compile.

## Web components framework, not a component library

There is a useful distinction here. A component library (Lit is the best-known) gives you a great way to author individual custom elements, but you still assemble the server, the router, and the data layer yourself. A web components framework gives you the whole app: the same component model plus the full-stack scaffolding around it. WebJs uses a Lit-compatible component API precisely so that the authoring experience feels familiar, then wraps it in the framework pieces you would otherwise wire up by hand.

If you already reach for custom elements and wish the full-stack story around them were as good as the component model, that gap is the reason WebJs exists.

## FAQ

### What is the difference between a web components framework and React?

React uses its own component model (a virtual DOM and a proprietary runtime) that only exists inside the React library. A web components framework builds on native custom elements, which the browser understands directly. React components only work in React; web components work anywhere DOM works. WebJs is a full-stack web components framework, so it gives you the app-level pieces (SSR, routing, data) on top of the standard component model.

### Is Lit a web components framework?

Lit is a component library, not a full framework. It is an excellent way to author individual custom elements, but you still assemble server rendering, routing, and a data layer yourself. WebJs uses a Lit-compatible component API and adds the full-stack pieces around it, so you get the same authoring feel plus the whole app.

### Do web components work with server-side rendering?

Yes, and it is a core part of a good web components framework. WebJs server-renders components to HTML, using Declarative Shadow DOM for components that opt into shadow DOM, so the first paint is real content and the element hydrates in place. Raw hand-written custom elements usually render only on the client, which is the gap the framework closes.

### Do I need a build step for a web components framework?

Not with WebJs. It serves native ES modules directly and strips TypeScript types at load, so there is no bundler and no compiled output to keep in sync with your source. Some other web components setups still use a bundler, but it is not inherent to the approach.
