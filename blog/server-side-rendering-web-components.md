---
title: "Server-Side Rendering for Web Components, Without a Blank First Paint"
date: 2026-07-13T10:00:00+05:30
slug: server-side-rendering-web-components
description: "Server-side rendering for web components used to be the thing that did not work. Why the wall was there, how Declarative Shadow DOM removed it, and how WebJs renders custom elements to HTML with no build step."
keyword: "server side rendering web components"
tagline: "Real HTML in the first response, from custom elements, before any JavaScript runs."
tags: server side rendering web components, ssr, custom elements, declarative shadow dom, hydration
author: Vivek
---

For a long time, server-side rendering for web components was the thing that quietly did not work. You could build a lovely custom element, ship it, and then notice in the network tab that the server sent `<user-card></user-card>` and nothing inside it. The content only showed up after the JavaScript downloaded and ran. With the script blocked, or slow, or broken, the tag stayed empty. I hit that wall early building WebJs, and getting past it is one of the reasons the framework renders the way it does. Here is why the wall was there and how it comes down.

# Why the browser cannot just render a custom element on the server

A custom element is defined imperatively. You call `customElements.define('user-card', UserCard)` in JavaScript, and only then does the browser know what `<user-card>` means. On a server there is no `window`, no `customElements` registry, and no DOM to attach anything to. So a naive server render emits the bare tag and stops, because the thing that knows how to fill it in only exists in the browser.

Shadow DOM made it worse. A component that renders into a shadow root (an isolated DOM subtree) had no way to express that root as plain HTML, because a shadow root was something you could only attach by running JavaScript. Even if you rendered the inner markup on the server, there was nowhere to put it that the browser would recognize as the component's shadow tree.

So for years web components were a client-only story. The page shipped empty tags, and the content appeared only after the JavaScript did its work. That is bad for first paint, bad for crawlers, and it falls apart entirely when the script does not load.

# Declarative Shadow DOM was the missing piece

The browsers fixed the hard part, and it is worth knowing the name because it is doing the heavy lifting. Declarative Shadow DOM (a way to write a shadow root directly in HTML, with `<template shadowrootmode="open">`) lets the server ship a shadow tree as markup. The browser reads it while parsing the HTML and attaches the shadow root then and there, with no script involved. In current Chrome and Safari, a server-rendered component shows up, shadow DOM and all, before a single byte of JavaScript executes.

That is the primitive that makes server-side rendering for web components real. Everything left is a framework's job: walk the component tree on the server, run each component's render, emit the right HTML, and wire the client up so the already-rendered element becomes interactive without redrawing it.

# How WebJs renders web components on the server

I made server rendering the default in WebJs, not an add-on you reach for. When a page renders, the framework walks the components it contains, runs each one's `render()` on the server, and puts real HTML in the first response.

- **Light DOM by default.** Most WebJs components render into ordinary page DOM, so their content is just HTML in the response. A crawler reads it, and it shows with JavaScript off. Shadow DOM is a per-component opt-in (`static shadow = true`), and those components ship as Declarative Shadow DOM. I wrote up why light DOM is the default in [Light DOM vs Shadow DOM](/blog/light-dom-by-default).
- **One renderer, both sides.** The server walker and the client renderer share a code path, so the server HTML and the client hydration (the browser wiring interactivity onto that HTML) agree instead of drifting. Hydration upgrades the existing element in place rather than throwing it away and redrawing.
- **Property bindings survive the trip.** Pass a rich value to an element (`<user-card .user=${user}>`) and WebJs serializes it through a `data-webjs-prop` channel so the client has it before the first client render. A naive SSR pass drops that binding.

Because the content is in the first response, a WebJs page reads with JavaScript turned off, and interactivity is layered on per behaviour once the module loads. That is progressive enhancement, and server-rendered web components are what make it possible instead of aspirational.

The old browser-global problem still bites during a server render, and this is the one thing people trip on. Code that touches `window` or `localStorage` at render time has no browser to touch. WebJs runs only the constructor, attribute wiring, and `render()` on the server, and it flags browser-global access that would crash there, so you get a clear message instead of a mystery 500. If you want the render-time data story (fetching in the component and still landing it in the first paint), that is [async rendering in web components](/blog/async-render-in-web-components).

The short version is that the reason SSR for web components felt impossible was a genuine platform gap, and the platform closed it. What is left is a framework choosing to render on the server by default, which is the choice I made.

## FAQ

### Can web components be server rendered?

Yes. The obstacle used to be that shadow DOM could only be attached with JavaScript, so a custom element could not be expressed as server HTML. Declarative Shadow DOM removed that limit by letting a shadow root be written directly in markup, so browsers attach it during parsing with no script. A framework like WebJs walks the component tree on the server, runs each render, and emits the HTML.

### Do I need shadow DOM to server-render a web component?

No. Shadow DOM is one option, and it ships as Declarative Shadow DOM when you use it. WebJs renders components in light DOM by default, where the output is ordinary page HTML with no shadow root at all, which sidesteps the whole shadow-serialization question and lets global CSS cascade in. Shadow DOM stays a per-component opt-in for the cases that want isolation.

### What is Declarative Shadow DOM?

Declarative Shadow DOM is a way to write a shadow root as HTML, using a `<template shadowrootmode="open">` element, instead of attaching it imperatively with JavaScript. The browser reads it during HTML parsing and attaches the shadow tree before any script runs. It is what makes server-side rendering of shadow-DOM web components possible, and it is supported in current Chrome and Safari.

### Does server-side rendering web components help SEO?

Yes. When the content is in the first HTML response, a crawler reads it immediately with no need to execute JavaScript or reassemble a shadow tree. WebJs renders in light DOM by default, so the post body, headings, and navigation are plain HTML in the response, which is the most reliable path to being indexed across the full range of crawlers.
