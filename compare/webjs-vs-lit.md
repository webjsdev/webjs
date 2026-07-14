---
title: "WebJs vs Lit: The Same Component API, Now a Full Framework"
date: 2026-07-09T10:00:00+05:30
slug: webjs-vs-lit
description: "An honest comparison of WebJs and Lit. WebJs deliberately matches Lit's component API (html templates, reactive properties, lifecycle, directives) and wraps it in a full-stack framework with routing, SSR, server actions, and a client router, all with no build step."
competitor: "Lit"
link: "https://lit.dev"
tagline: "Lit's component model you already know, wrapped in a full-stack framework."
tags: comparison, lit, web-components, ssr, no-build
author: Vivek
---

If you write Lit, WebJs will feel immediately familiar, and that is on purpose. WebJs's component API is aligned with Lit's so the muscle memory and the training data transfer directly. The difference is scope: Lit is an excellent library for building web components, and WebJs is a full-stack framework that uses a Lit-shaped component layer as its view.

This page is for Lit users deciding whether to reach for a framework, and for people choosing between the two.


# The component API is intentionally the same

WebJs matches the Lit surface you already know:

- `render()` returning `` html`...` `` tagged-template literals.
- The `css` tagged template for scoped styles.
- Reactive properties, reflection, and attribute mapping.
- The full lit lifecycle (`willUpdate`, `firstUpdated`, `updated`, `updateComplete`, and the rest), each receiving a `changedProperties` map.
- `ReactiveController` and `ReactiveControllerHost`.
- The lit-html directive set (`repeat`, `unsafeHTML`, `live`, `keyed`, `guard`, `ref`, `cache`, `until`, `asyncAppend`, and more).

Code you have written against Lit reads almost unchanged in WebJs. There is one deliberate divergence, covered below.


# The one deliberate difference: reactive properties

Lit declares reactive properties with the `@property()` decorator or a `static properties` block. WebJs declares them through a declare-free base-class factory instead:

```ts
class Counter extends WebComponent({ count: Number }) {
  constructor() {
    super();
    this.count = 0;   // fully typed, no `declare`
  }
  render() {
    return html`<button @click=${() => this.count++}>${this.count}</button>`;
  }
}
Counter.register('my-counter');
```

The reason is the no-build constraint. WebJs strips TypeScript with Node's built-in eraser, which requires erasable syntax only, so legacy decorators with metadata are out. The factory gives you the same typed reactive properties without a decorator and without a `declare` line. It is the single place the API departs from Lit, and it exists so the framework can run your `.ts` with no compile step.


# What WebJs adds around the component

Lit stops at the component, and that is the right scope for a library. You bring your own router, your own SSR story, your own data layer, your own server. WebJs ships those as a coherent whole:

- **File-based routing:** `page`, `layout`, `route`, dynamic segments, route groups, error and loading boundaries.
- **Server-side rendering** of your components, including Declarative Shadow DOM, with streaming Suspense.
- **Server actions:** a `.server.ts` file with `'use server'` becomes a typed RPC stub when a component imports it, so calling the server is a normal function call with types across the wire.
- **A client router** that preserves layout DOM across navigations, with prefetch, and no white flash.
- **Built-ins:** auth, sessions, cookies, caching, and rate limiting over one pluggable store, plus Drizzle and Tailwind wired out of the box.

Lit does have `@lit-labs/ssr`, but server rendering, hydration, routing, and data flow are pieces you assemble yourself. WebJs makes those decisions for you and controls the SSR pipeline end to end so hydration is not something you configure.


# Progressive enhancement and elision

Because WebJs owns the SSR path, it can do things a component library on its own cannot. Pages are server-rendered HTML that work with JavaScript off. A display-only component, one with no interactive signal, renders identical HTML with or without its script, so WebJs strips its module from what the browser downloads. You write a normal component and it ships zero JavaScript when it does not need any. With plain Lit you would ship the element's definition regardless.


# Where Lit is the better pick

- You are adding a few interactive elements to an existing app (any stack, any backend) and do not want a framework at all. Lit is purpose-built for that, and a full framework is more than that job needs.
- You are building a design system or a widget library meant to be consumed anywhere. Lit's narrow scope is exactly what you want; you should not ship a full framework inside a distributable component.
- You need Lit's exact ecosystem: a specific Lit Labs package, an established Lit-based design system, or an integration built for Lit.


# Where WebJs is the better pick

- You are building a whole application, not a handful of elements, and you want routing, SSR, a data layer, and a server without assembling them yourself.
- You like the Lit component model and want to keep it while getting a Next.js-style developer experience above it.
- You want SSR and progressive enhancement to be the default rather than a configuration exercise.
- You want no build step across the entire stack, not just clever templates in the browser.

The short version: if you love the Lit way of writing components but want a framework around it, WebJs is that framework. You keep the model and stop hand-rolling everything above it.

## FAQ

### Is WebJs built on Lit?

No. WebJs ships its own no-build component runtime, but its component API matches Lit closely (reactive properties, the Lit lifecycle hooks, reactive controllers, and the `html` / `css` template tags), so Lit knowledge transfers directly. The one deliberate difference is how reactive properties are declared.

### What does WebJs add over Lit?

Lit is a component library; WebJs is a full-stack framework. On top of the Lit-style component model, WebJs adds server-side rendering, file-based routing, typed server actions, streaming SSR, auth, sessions, and caching, all with no build step. With Lit you assemble those pieces yourself.

### Can I migrate my Lit components to WebJs?

Mostly yes. The template syntax and lifecycle are the same, so the render logic ports with little change. The main edit is swapping Lit's `@property()` decorator or `static properties` block for the WebJs reactive-property declaration, and letting WebJs handle SSR and routing.
