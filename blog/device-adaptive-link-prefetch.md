---
title: "Device-Adaptive Link Prefetch That Does Not Bloat the Network Tab"
date: 2026-07-04T10:00:00+05:30
slug: device-adaptive-link-prefetch
description: "How WebJs's client router prefetches links with a device-adaptive default: intent-based prefetch on desktop hover, dwell-gated viewport prefetch on mobile. Instant navigation without a bandwidth tax, tuned to the device, no import required."
tags: client-router, prefetch, performance, mobile, navigation
author: Vivek
---

Prefetching is the trick that makes a link feel instant. Before you click, the browser has already fetched the page behind the link, so the moment you tap it, the content is just there. No spinner, no wait. It feels like the app read your mind.

The naive way to do it is to prefetch every link on the page. Every card in a feed, every item in a nav, every footer link, all fetched the instant they render. On a fast desktop connection you might get away with it. On a phone on cellular data you are torching someone's bandwidth to prefetch forty pages they will never visit. Open the network tab on a fetch-everything prefetcher and it lights up like a christmas tree. That is not a feature. That is a bandwidth tax you are quietly charging your users.

The rule I held while building this was simple. Snappy is the goal, but never at the cost of over-fetching. When in doubt, under-fetch. A prefetch you did not need is waste, and waste on mobile data is worse than a 100ms wait.

# The device-adaptive default

WebJs's client router prefetches, but the default strategy adapts to the device it is running on. The signal it uses is whether the pointer can hover.

On a hover-capable pointer (a desktop with a mouse), the default is `intent` prefetch. The page behind a link is fetched when you hover over it. A hover is a strong signal. On desktop, moving the cursor onto a link and pausing there is most of the way to a click already. So the fetch fires on hover, and by the time your finger comes down on the mouse button, the page is usually ready. You prefetch exactly the links the user is actively considering, not the whole document.

On a touch device (a phone or tablet, no hover), there is no hover to lean on. Your finger does not float over a link before tapping it. So the default switches to `viewport` prefetch, with two guards that keep it honest.

The first guard is dwell-gating. A link is not prefetched the instant it scrolls into view. It has to STAY in view for a short moment first. If you are flicking through a long feed, links stream past the viewport constantly, and prefetching each one as it flashed by would be exactly the network-tab flood we are trying to avoid. The dwell timer says "prefetch this only if the user actually paused on it," which is the touch-device equivalent of a hover.

The second guard is cancel-on-scroll-out. If a link enters the viewport, starts its dwell timer, but scrolls back out before the timer elapses, the prefetch never fires. You looked away in time, so nothing was fetched. Only a link you dwelt on long enough to plausibly tap gets warmed.

Together those two guards mean a mobile user scrolling a feed prefetches a handful of links they lingered on, not the hundreds they scrolled past. The network tab stays quiet. The navigation still feels instant on the links that matter.

# Per-link override

The default is device-adaptive, but you can override any single link with `data-prefetch`.

```ts
import { html } from '@webjsdev/core';

export default function Nav() {
  return html`
    <nav>
      <a href="/dashboard">Dashboard</a>              <!-- device-adaptive default -->
      <a href="/heavy-report" data-prefetch="none">Report</a>   <!-- never prefetch -->
      <a href="/pricing" data-prefetch="intent">Pricing</a>     <!-- force intent on any device -->
    </nav>
  `;
}
```

Set `data-prefetch="none"` on a link whose target is expensive to render or rarely visited, and it is never prefetched regardless of device. Force a strategy the other way when you know something the heuristic does not. The default is tuned for the common case, and the attribute is the escape hatch for the ones you understand better than the framework does.

# You do not import anything to get this

There is no prefetch library to install and no router to wire up. The client router auto-enables the moment `@webjsdev/core` loads in the browser, and core is the bundle every component pulls in. So any page that ships a single component gets client navigation, and with it device-adaptive prefetch, for free. Prefetch is on by default. You did not opt into it and you do not configure it to get sensible behaviour.

```ts
// a page with one interactive component. prefetch is already on, nothing to wire.
import { html } from '@webjsdev/core';
import '#components/like-button.ts';

export default function Feed() {
  return html`
    <ul>
      ${posts.map(p => html`
        <li><a href="/posts/${p.id}">${p.title}</a> <like-button .id=${p.id}></like-button></li>
      `)}
    </ul>
  `;
}
```

# Prefetch is one piece of a larger router

Prefetch is the front edge of a navigation, but the client router does more once you click. It swaps pages in place with no full-page reload, so there is no white flash between routes and your nested layouts stay mounted. It sends an `X-Webjs-Have` header listing the layout fragments it already holds, so the server returns only the divergent part of the next page instead of re-serializing the shared header, sidebar, and footer every time. It restores scroll position on back and forward. Prefetch and those pieces reinforce each other. Prefetch warms the divergent fragment early, `X-Webjs-Have` keeps that fragment small, and the in-place swap paints it without a flash. I will not go deep on those here (the client-router post covers them), but it is worth knowing prefetch is not a bolt-on. It is the leading edge of one coherent navigation pipeline.

# The takeaway

Prefetching the page behind a link is what makes navigation feel instant, but fetching every visible link is a bandwidth tax that hits mobile users hardest. WebJs's client router prefetches with a device-adaptive default. On a hover-capable desktop it uses `intent` prefetch (fetch on hover, since a hover is a strong click signal), and on touch it uses `viewport` prefetch that is dwell-gated and cancel-on-scroll-out, so only the links a user actually pauses on get warmed. Override any link with `data-prefetch`, and get all of it with no import because the router auto-enables when core loads. The guiding rule underneath it is the one worth stealing. Be snappy, but under-fetch when in doubt, because a prefetch you did not need is pure waste.
