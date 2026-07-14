---
title: "HTML Web Components: Enhance Markup, Do Not Replace It"
date: 2026-07-12T12:00:00+05:30
slug: html-web-components
description: "HTML web components wrap real server-rendered markup and enhance it, instead of rendering everything from an empty tag in JavaScript. Why the pattern is more resilient, and how WebJs makes it the default."
keyword: "HTML web components"
tagline: "Custom elements that wrap real markup and enhance it, instead of rendering everything from an empty tag in JavaScript."
tags: html web components, custom elements, progressive enhancement, light dom, ssr
author: Vivek
---

Almost every web-component tutorial I have read teaches the same habit, and I think it is the wrong one. You write `<user-menu></user-menu>`, an empty tag, and the component's JavaScript builds the entire menu from nothing once it loads. HTML web components are the opposite habit. Instead of an empty tag that renders its whole contents in the browser, an HTML web component wraps real, server-rendered markup and enhances it. The name got coined by a few writers making exactly this point, and it happens to describe how I want you to build with WebJs.

# The empty-tag habit, and why it is fragile

The empty-tag pattern treats the custom element as the source of the content. `<user-menu></user-menu>` ships with nothing inside, and the button, the list, the whole thing appears only after the element's script downloads and runs. It works, right up until it does not. Until that JavaScript loads, the user stares at nothing. If it fails, they stare at nothing forever. And a crawler that does not run the script sees an empty element and moves on.

The deeper problem is that it puts everything downstream of one event: JavaScript executing successfully. That is the single thing on the web you cannot count on. The network drops, a CDN hiccups, an extension breaks the page, the parser hits an error three modules up. The empty-tag component has no answer for any of it, because it never rendered anything the browser could show on its own.

# Augmentation instead of replacement

HTML web components flip the order. You render the meaningful HTML on the server, the button, the list, the form, and you wrap it in a custom element whose only job is to enhance what is already there. The content exists before the component's JavaScript runs. If the script is slow, the content still reads. If it fails, the button still submits, because it was a real `<button>` in a real `<form>` the whole time. When the script does run, it adds the richer behaviour on top of a page that already worked.

This is progressive enhancement (building in layers, so a baseline works everywhere and richer behaviour layers on when the browser can support it) expressed through custom elements. The element is the enhancement layer, not the foundation. That one reframing is the whole idea.

# How WebJs makes this the default

I did not want this to be a discipline you have to remember, so WebJs is built around the shape.

- **Server rendering first.** Components render to HTML on the server, so the markup is in the first response. The element wraps real content, never a placeholder.
- **Light DOM by default.** WebJs components render into ordinary page DOM instead of a sealed shadow root, so the markup they wrap is regular HTML that global CSS styles and a crawler reads. This is the natural home for HTML web components, and the reasoning is in [Light DOM vs Shadow DOM](/blog/light-dom-by-default).
- **Interactivity added per behaviour.** A `@click` handler or a signal read is the enhancement. Without JavaScript the content reads, links navigate, and forms submit through server actions. With it, the element upgrades in place.
- **Slots for composition.** A component can wrap and project children with `<slot>`, so an HTML web component can enhance markup a page author passes into it, not only markup it renders itself.

The payoff is resilience for free. You are not picking between a rich interactive component and one that survives JavaScript failing. The HTML-web-components shape gives you both, because the baseline is real HTML and the component only ever adds to it.

If you have been writing custom elements as empty tags that build everything on the client, the shift is mostly in your head. Render the content, then reach for a component to enhance it, instead of reaching for a component to produce it. Once it clicks, the empty-tag version starts to look like a liability.
