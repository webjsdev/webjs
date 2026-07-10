---
title: "Streaming Slow Web Components With <webjs-suspense>"
date: 2026-05-30T13:00:00+05:30
slug: component-suspense-streaming
description: "How WebJs streams slow web components with <webjs-suspense> so the first byte flushes immediately, the fallback shows, and the slow data streams in over plain HTML with no RSC or Flight protocol, all while keeping progressive enhancement."
tags: streaming, suspense, web-components, ssr, performance
author: Vivek
---

Here is the situation I kept hitting. A dashboard, header and summary card and nav all instant, and then one panel that runs an analytics query taking 400ms on a good day. In WebJs an `async render()` blocks server-side rendering (SSR) by default, so the framework awaits your data before it sends a byte of HTML. For everything fast on that page, that is exactly right. The resolved data is in the first paint, a crawler indexes real content, a reader with JavaScript off sees the whole thing. But the one slow panel holds the entire page's first byte hostage for 400ms, and while it waits, everything else is ready and the user is staring at a blank tab.

That is the wrong trade for one slow region on an otherwise fast page. The fix is `<webjs-suspense>`.

# The default is the thing you are opting out of

Before the streaming case makes any sense, be clear on what it departs from. Write `await` inside a component's `render()` and WebJs blocks SSR for it and bakes the resolved data into the HTML. No spinner, no empty box, no hydration flicker. I want that to be the default and I want people to keep it as the default, because it is progressive-enhancement-safe (the page works before JavaScript runs) and it is good for search engine optimization (SEO), the content is genuinely in the document.

You opt a region out only when blocking the first byte on its query starts to cost you more than a fallback would. You do it by wrapping the slow component in a `<webjs-suspense>` with a fallback.

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

On the wire, the framework renders everything fast, flushes the first byte with the summary card already filled in, and in the hole where `<slow-analytics>` goes it emits the `.fallback` markup. The browser paints that skeleton at once. The slow component keeps rendering on the server, and when its data resolves WebJs streams the real content down the same response and swaps it in. Shell instantly, skeleton where the slow panel will be, then the panel.

Watch the dot on `.fallback`. It is a property hole, so it must be unquoted. Write `.fallback=${html`...`}`, never `.fallback="${...}"`. The leading dot is what tells WebJs to pass the template as a DOM property instead of stringifying it into an attribute, and quoting it breaks that.

# Two slow panels do not wait on each other

The part that makes this actually fast is that boundaries do not queue. Put three `<webjs-suspense>` regions on a page, each with its own slow query, and they all start on the server at once and stream in as they finish, in whatever order they resolve.

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

Revenue and customers fetch in parallel. If customers resolves first, it streams in first. There is no server-side waterfall where the second query waits on the first to flush, and nothing about one boundary is coupled to the other.

# If the word "Suspense" is making you think of React, stop

It carries baggage, so let me draw the line. WebJs has no React Server Components, no Flight protocol, no serialized render tree crossing the wire in a special format. `<webjs-suspense>` is HTML streaming and that is all it is. The server flushes ordinary HTML in chunks. The fallback is real markup. The streamed-in content is real markup, rendered with Declarative Shadow DOM or light DOM exactly like every other component. Nothing on the client reconstructs a virtual tree out of a binary protocol. The browser's own streaming HTML parser does the work, which is why it degrades so gracefully when JavaScript is slow or off.

Two behaviors fall out of that for free. It streams on soft navigation, so when the client router swaps content on an in-app link click, the same boundaries stream progressively into the new view, fallback first and slow content after, exactly like the initial server load. And a throwing component is isolated. If a component inside a boundary throws while rendering, that one renders its own error state and its siblings keep streaming as if nothing happened. Slow data tends to be flaky data, so one broken panel blanking the whole page would be the worst version of this feature. It does not.

# The rule I use

Do not reach for `<webjs-suspense>` reflexively. It is the exception, not the pattern. For request-time server data that resolves fast, block in `async render()` and bake it into the first paint. That is faster, simpler, and the whole reason WebJs blocks by default. The signal that flips me to a boundary is concrete: I want a first-paint skeleton for a region. That is the tell that the region is slow enough to be worth streaming, because a blocking `async render()` never shows a first-paint fallback (it has real data instead), so wanting one means the data is not there fast enough. One genuinely slow panel on a fast page is the case `<webjs-suspense>` exists for. A page where the whole route is slow is a different tool, the region-level `Suspense({ fallback, children })` you drop into a template hole, or a `loading.js` route file that wraps the whole page with an immediately flushed fallback.

One note for the curious. A streamed component with `static shadow = true` always ships its JavaScript module, even when it would otherwise be elided, because Declarative Shadow DOM only attaches during initial HTML parsing, so a component arriving mid-stream needs its module to re-run `attachShadow` in the browser. Light-DOM streamed components have no such requirement.
