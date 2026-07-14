---
title: "Server-side rendering for web components"
date: 2026-07-13T10:00:00+05:30
slug: server-side-rendering-web-components
description: "How server-side rendering works for web components, why it is hard out of the box, and how WebJs renders custom elements to HTML with Declarative Shadow DOM and no build step."
keyword: "server side rendering web components"
tagline: "Real HTML in the first response, from custom elements, before any JavaScript runs."
tags: server side rendering web components, ssr, custom elements, declarative shadow dom, hydration
author: Vivek
---

Server-side rendering for web components is the trick of producing a custom element's real HTML on the server, before its JavaScript has loaded, so the first response the browser gets is content and not an empty tag waiting to be filled in. It sounds like it should be automatic, and out of the box it is not. This is the piece most people hit a wall on, so let me explain why the wall is there and how WebJs gets past it.

# Why the browser cannot just render a custom element on the server

A custom element is defined imperatively. You call `customElements.define('my-card', MyCard)` in JavaScript, and only then does the browser know what `<my-card>` means. On the server there is no `window`, no `customElements` registry, and no DOM to attach anything to. So a naive server render emits `<my-card></my-card>` and stops, because the thing that knows how to fill it in only exists in the browser.

Shadow DOM makes it worse. A component that renders into a shadow root has no way to express that root as plain HTML, historically, because a shadow root was something you could only attach by running JavaScript. So even if you rendered the inner markup on the server, there was no place to put it that the browser would recognize as the component's shadow tree.

The result, for years, was that web components were a client-only story. The page shipped empty custom-element tags, and the content appeared only after the JavaScript downloaded, parsed, and ran. That is bad for first paint, bad for search crawlers, and it breaks entirely when JavaScript fails to load.

# Declarative Shadow DOM is the missing primitive

The browsers fixed the hard part. Declarative Shadow DOM (a way to write a shadow root directly in HTML, using `<template shadowrootmode="open">`) lets the server ship a shadow tree as markup. The browser parses it and attaches the shadow root during HTML parsing, with no JavaScript involved. Chrome and Safari render a server-rendered component, shadow DOM and all, before a single script runs.

That is the primitive that makes server-side rendering for web components real. The remaining work is a framework's job: walk the component tree on the server, run each component's render, and emit the right HTML (a Declarative Shadow DOM template for shadow components, plain light-DOM markup for the rest), then wire the client up so the already-rendered element becomes interactive without redrawing.

# How WebJs renders web components on the server

WebJs treats server rendering as the default, not an add-on. When a page renders, the framework walks the components it contains and runs each one's `render()` on the server, producing real HTML in the first response.

- **Light DOM by default.** Most WebJs components render into ordinary page DOM, so their content is just HTML in the response. A crawler reads it, and it shows with JavaScript disabled. Shadow DOM is a per-component opt-in (`static shadow = true`), and those components ship as Declarative Shadow DOM.
- **One renderer, both sides.** The server walker and the client renderer share a code path, so the server HTML and the client hydration agree instead of drifting. Hydration (the browser wiring interactivity onto the server-rendered HTML) upgrades the existing element in place rather than throwing it away and redrawing.
- **Property bindings survive the boundary.** If you pass a rich value to a custom element (`<user-card .user=${user}>`), WebJs serializes it through a `data-webjs-prop` channel so the client picks it up before the component's first client render, instead of dropping it the way a naive SSR pass would.
- **No build step.** The `.ts` file you write is the file that runs on the server and ships to the browser. There is no separate SSR bundle to keep in sync.

Because the content is in the first response, a WebJs page reads with JavaScript turned off, and interactivity is added per behaviour once the module loads. That is progressive enhancement, and server-rendered web components are what make it possible.

The browser-global problem from earlier still applies during a server render: code that touches `window` or `localStorage` at render time has no browser to touch. WebJs runs only the constructor, attribute application, and `render()` on the server, and it flags browser-global access that would crash there, so the failure is a clear message at build time rather than a mysterious server error.

If you want the deeper mechanics of how the first paint carries real data and hydration adds no refetch, the [async rendering in web components](/blog/async-render-in-web-components) write-up goes further.

## FAQ

### Can web components be server-side rendered?

Yes. The obstacle used to be that shadow DOM could only be attached with JavaScript, so a custom element could not be expressed as server HTML. Declarative Shadow DOM removed that limit by letting a shadow root be written directly in markup, so browsers attach it during parsing with no script. A framework like WebJs walks the component tree on the server, runs each render, and emits the HTML.

### Do I need shadow DOM to server-render a web component?

No. Shadow DOM is one option, and it ships as Declarative Shadow DOM when you use it. WebJs renders components in light DOM by default, where the output is ordinary page HTML with no shadow root at all, which sidesteps the whole shadow-serialization question and lets global CSS cascade in. Shadow DOM stays a per-component opt-in for the cases that want isolation.

### What is Declarative Shadow DOM?

Declarative Shadow DOM is a way to write a shadow root as HTML, using a `<template shadowrootmode="open">` element, instead of attaching it imperatively with JavaScript. The browser reads it during HTML parsing and attaches the shadow tree before any script runs. It is what makes server-side rendering of shadow-DOM web components possible, and it is supported in current Chrome and Safari.

### Does server-side rendering web components help SEO?

Yes. When the content is in the first HTML response, a crawler reads it immediately with no need to execute JavaScript or reassemble a shadow tree. WebJs renders in light DOM by default, so the post body, headings, and navigation are plain HTML in the response, which is the most reliable path to being indexed across the full range of crawlers.
