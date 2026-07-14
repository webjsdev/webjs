---
title: "HTML web components, explained"
date: 2026-07-11T10:00:00+05:30
slug: html-web-components
description: "What HTML web components are, how augmenting server-rendered markup differs from JavaScript-only custom elements, and how WebJs makes the HTML-web-components pattern the default."
keyword: "HTML web components"
tagline: "Custom elements that wrap real markup and enhance it, instead of rendering everything from an empty tag in JavaScript."
tags: html web components, custom elements, progressive enhancement, light dom, ssr
author: Vivek
---

An HTML web component is a custom element that wraps real, server-rendered markup and enhances it, rather than an empty tag that renders its entire contents from JavaScript. The distinction is small in code and large in philosophy. `<my-widget></my-widget>` that fills itself in on the client is a JavaScript-only component. `<my-widget><button>Save</button></my-widget>` where the element adds behaviour to markup that already works is an HTML web component. The term got its name from a few writers making this exact point, and it happens to describe how WebJs wants you to build.

# The empty-tag habit, and why it is fragile

Most custom-element tutorials teach the empty-tag pattern. You write `<user-menu></user-menu>`, and the component's JavaScript builds the whole menu, the button, the list, the markup, from nothing, once it loads. It works, but it has a failure mode: until that JavaScript downloads and runs, the tag is empty. If the script is slow, the user stares at nothing. If it fails, they stare at nothing forever. And a crawler that does not run the script sees an empty element.

The empty-tag habit treats the custom element as the source of the content. That puts everything downstream of JavaScript executing successfully, which is the one thing on the web you cannot count on.

# Augmentation instead of replacement

The HTML-web-components approach flips it. You render the meaningful HTML on the server, the button, the list, the form, and you wrap it in a custom element whose job is to enhance what is already there. The content exists before the component's JavaScript runs. If the script is slow, the content still reads. If it fails, the button still submits, because it was a real `<button>` in a real `<form>` all along. When the script does run, it adds the richer behaviour on top.

This is progressive enhancement (building in layers so a baseline works everywhere, with richer behaviour layered on when the browser can support it) expressed through custom elements. The element is the enhancement layer, not the foundation.

# How WebJs makes this the default

WebJs is built around exactly this shape, so you do not have to opt into it.

- **Server rendering first.** Components render to HTML on the server, so the markup is in the first response. The element wraps real content, not a placeholder.
- **Light DOM by default.** WebJs components render into ordinary page DOM rather than a sealed shadow root, so the markup they wrap is regular HTML that global CSS styles and that a crawler reads. This is the natural home for HTML web components, and the reasoning is in [light DOM by default](/blog/light-dom-by-default).
- **Interactivity added per behaviour.** A `@click` handler or a signal read is the enhancement. Without JavaScript the content reads, links navigate, and forms submit through server actions. With it, the element upgrades in place.
- **Slots for composition.** A component can wrap and project children with `<slot>`, so an HTML web component can enhance markup that a page author passes into it, not just markup it renders itself.

The payoff is resilience without extra work. You are not choosing between a rich interactive component and one that survives JavaScript failing. The HTML-web-components shape gives you both, because the baseline is real HTML and the component only ever adds to it.

If you have been writing custom elements as empty tags that build everything on the client, the shift is mostly a mindset one. Render the content, then reach for a component to enhance it, rather than reaching for a component to produce it.

## FAQ

### What is the difference between HTML web components and regular web components?

Regular custom elements are often written as empty tags that render all their content from JavaScript once loaded. An HTML web component instead wraps real, server-rendered markup and enhances it, so the content exists before the script runs. The term describes a usage pattern (augmentation over replacement), not a different browser API. WebJs makes this pattern the default by server-rendering components in light DOM.

### Why are HTML web components better for progressive enhancement?

Because the meaningful content is real HTML that exists before the component's JavaScript runs. If the script is slow or fails, the text still reads, links still navigate, and forms still submit. The custom element is the enhancement layer rather than the source of the content, so nothing essential depends on JavaScript executing successfully.

### Do HTML web components use shadow DOM?

Usually not. The pattern is about enhancing real page markup, which fits light DOM, where the component's content is ordinary HTML that global CSS styles and crawlers read. WebJs defaults to light DOM for this reason and keeps shadow DOM as an opt-in for components that genuinely need style isolation.

### Can I use HTML web components with server-side rendering?

Yes, and server-side rendering is what makes them work. The markup the element wraps has to be in the first HTML response, which means the server renders it. WebJs server-renders components by default, so the content is present before any JavaScript loads and the element enhances it once its module runs.
