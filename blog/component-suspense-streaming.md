---
title: "Streaming Slow Web Components With <webjs-suspense>"
date: 2026-05-30T13:00:00+05:30
slug: component-suspense-streaming
description: "How WebJs streams slow web components with <webjs-suspense> so the first byte flushes immediately, the fallback shows, and the slow data streams in over plain HTML with no RSC or Flight protocol, all while keeping progressive enhancement."
tags: streaming, suspense, web-components, ssr, performance
author: Vivek
---

Picture a dashboard page. Most of it is instant. There is a header, a summary card, a nav. But one panel calls out to a slow analytics query that takes 400ms on a good day. In WebJs the default behavior is that `async render()` blocks server-side rendering (SSR), which means the framework awaits your data before sending a single byte of HTML. For the fast parts that is exactly what you want, because the resolved data lands in the first paint, a crawler indexes real content, and a reader with JavaScript off still sees everything. But that one slow panel would hold the entire page's first byte hostage for 400ms. Everything else is ready and the user sees a blank tab.

That is the wrong trade for a slow region, and the fix is `<webjs-suspense>`.

# Block by default, stream on purpose

I want to be precise about the default first, because the streaming case only makes sense against it. When you write `await` inside a component's `render()`, WebJs blocks SSR for it and bakes the resolved data into the HTML. No spinner, no empty box, no hydration flicker. That is the right default. It is progressive-enhancement-safe (the page works before JavaScript runs) and it is good for search engine optimization (SEO) because the content is really in the document.

The moment blocking the first byte on one query starts to hurt time-to-first-byte, you opt that region out of blocking and into streaming. You do it by wrapping the slow component in a `<webjs-suspense>` element with a fallback.

```ts
class SalesDashboard extends WebComponent {
  render() {
    return html`
      <section class="grid gap-6">
        <summary-card></summary-card>
        <webjs-suspense .fallback=${html`<div class="skeleton h-48"></div>`}>
          <slow-analytics></slow-analytics>
        </webjs-suspense>
      </section>
    `;
  }
}
SalesDashboard.register('sales-dashboard');
```

Here is what happens on the wire. The framework renders everything that is fast, flushes the first byte with the summary card already filled in, and in the hole where `<slow-analytics>` goes it emits the `.fallback` markup (the skeleton). The browser paints that immediately. Meanwhile the slow component keeps rendering on the server, and when its data resolves WebJs streams the real content down the same response and swaps it into place. The user sees the shell instantly, a skeleton where the slow panel will be, and then the panel fills in.

One detail that matters and is easy to miss. The `.fallback` hole is a property hole, so it must be unquoted. Write `.fallback=${html`...`}`, never `.fallback="${...}"`. The leading dot tells WebJs to pass the template as a DOM property rather than stringify it into an attribute.

# Multiple boundaries fetch concurrently

The part that makes this genuinely fast is that boundaries do not queue. If a page has three `<webjs-suspense>` regions, each wrapping its own slow query, they all start on the server at once and stream in as they finish, in whatever order they resolve. There is no server-side waterfall where the second slow query waits for the first to flush. You get fast-content-first, and each slow region arrives independently the instant it is ready.

```ts
html`
  <webjs-suspense .fallback=${html`<div class="skeleton h-32"></div>`}>
    <revenue-chart></revenue-chart>
  </webjs-suspense>
  <webjs-suspense .fallback=${html`<div class="skeleton h-32"></div>`}>
    <top-customers></top-customers>
  </webjs-suspense>
`
```

Revenue and customers fetch in parallel. If customers resolves first, it streams in first. Nothing about one boundary is coupled to another.

# This is plain HTML streaming, not RSC

If you come from React, the word "Suspense" carries baggage, so let me draw the line clearly. WebJs has no React Server Components, no Flight protocol, no serialized render tree traveling over a special wire format. `<webjs-suspense>` is HTML streaming and nothing more. The server flushes ordinary HTML in chunks, the fallback is real markup, and the streamed-in content is real markup too, rendered with Declarative Shadow DOM or light DOM exactly like every other WebJs component. There is no client runtime reconstructing a virtual tree from a binary protocol. The browser's own streaming HTML parser does the work, which is why it degrades so gracefully.

# It streams on soft navigation too

The streaming is not only a first-load trick. When the client router does a soft navigation (an in-app link click that swaps content without a full page reload), the same boundaries stream progressively into the new view. The fallback flushes into the swapped region, and the slow content streams in after, so a client-side navigation to a page with a slow panel behaves exactly like the initial server load. You author it once and it works both ways.

# A thrown component is isolated

Slow data is also flaky data, so failure handling matters. If a component inside a boundary throws while it renders, WebJs isolates it. That one component renders its own error state, and its siblings keep streaming as if nothing happened. A single broken panel does not blank the page and it does not tear down the other boundaries mid-stream. This is the same per-component error isolation WebJs gives you for a blocking `async render()`, carried through the streaming path.

# When to reach for it, and when not to

Do not reach for `<webjs-suspense>` reflexively. It is the exception, not the pattern. For request-time server data that resolves fast, block in `async render()` and bake it into the first paint. That is faster and simpler and it is the whole reason WebJs blocks by default. Reserve `<webjs-suspense>` for a region that is genuinely slow enough that holding the first byte for it hurts more than showing a fallback for it would.

It is worth knowing this is the ONLY way to show a fallback on the first paint in WebJs. A blocking `async render()` never shows a first-paint fallback, by design, because it has real data instead. So if you find yourself wanting a first-paint skeleton, that want is the signal that the region is slow and belongs in a boundary. There is also a page-level and region-level `Suspense({ fallback, children })` (a value you drop into a template hole rather than an element you wrap), and a `loading.js` route file that wraps a whole page in Suspense with an immediately flushed fallback, for when the slow thing is the entire route rather than one island.

One implementation note for the curious. A streamed component that uses `static shadow = true` always ships its JavaScript module, even when it would otherwise be elided. Declarative Shadow DOM only attaches during initial HTML parsing, so a component that arrives mid-stream needs its module to re-run `attachShadow` in the browser. Light-DOM streamed components have no such requirement.

# The takeaway

WebJs blocks SSR by default so your data is in the first paint, which is the right call for fast queries and keeps the page working without JavaScript. For the one slow panel that would otherwise stall the whole first byte, wrap it in `<webjs-suspense .fallback=${...}>`. The fallback flushes immediately, the slow content streams in when it resolves, multiple boundaries fetch concurrently with no server waterfall, a throwing component stays isolated, and it all works on soft navigation too. It is plain HTML streaming, no RSC and no Flight, so the browser's own parser carries it. Fast first byte for slow data, without giving up progressive enhancement. This shipped in #470 and #471.
