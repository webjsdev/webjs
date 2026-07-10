---
title: "Device-Adaptive Link Prefetch That Does Not Bloat the Network Tab"
date: 2026-07-04T10:00:00+05:30
slug: device-adaptive-link-prefetch
description: "How WebJs's client router prefetches links with a device-adaptive default: intent-based prefetch on desktop hover, dwell-gated viewport prefetch on mobile. Instant navigation without a bandwidth tax, tuned to the device, no import required."
tags: client-router, prefetch, performance, mobile, navigation
author: Vivek
---

Two things I want out of navigation pull against each other. A link should feel instant, which means fetching the page behind it before you click. And I do not want to spend a user's bandwidth on pages they never open, which is exactly what prefetching does when you get it wrong. On a desktop with a fat pipe you can ignore the conflict, prefetch everything, and nobody notices. On a phone on cellular data, warming forty links to make the one tap feel fast is a bill the user pays and never agreed to.

The two goals are real and they disagree. Prefetching is what makes a link feel instant. Before you click, the browser has already fetched the target, so the moment you tap, the content is just there, no spinner. But a fetch-everything prefetcher lights up the network tab like a christmas tree, and most of that is pages nobody will ever see.

The rule I held while building this settled the disagreement in one direction. Snappy is the goal, but never at the cost of over-fetching. When in doubt, under-fetch. A prefetch you did not need is pure waste, and waste on mobile data is worse than a 100ms wait.

# The device adapts to how you'd click it

WebJs's client router prefetches, and the default strategy changes with the device it runs on. The signal it reads is whether the pointer can hover.

On a hover-capable pointer (a desktop with a mouse) the default is `intent` prefetch. The page is fetched when you hover the link. A hover is a strong signal, because on desktop, moving the cursor onto a link and pausing there is most of the way to a click already. The fetch fires on hover, and by the time your finger presses the button, the page is usually ready. You warm exactly the links the user is weighing, not the whole document.

On a touch device there is no hover to lean on. Your finger does not float over a link before tapping it. So the default becomes `viewport` prefetch, with two guards that keep it from turning back into fetch-everything.

The first guard is dwell-gating. A link is not prefetched the instant it scrolls into view. It has to stay in view for a short moment first. Flick through a long feed and links stream past the viewport constantly, and prefetching each one as it flashes by is exactly the flood we are trying to avoid. The dwell timer warms a link only if the user paused on it, which is the touch-device equivalent of a hover.

The second guard is cancel-on-scroll-out. A link can enter the viewport, start its dwell timer, and scroll back out before the timer elapses. When that happens the prefetch never fires. You looked away in time, so nothing was fetched.

Put together, a mobile user scrolling a feed prefetches the handful of links they lingered on, not the hundreds they scrolled past. The network tab stays quiet, and the navigation still feels instant on the links that matter.

# Per-link override

The default is device-adaptive, but any single link can override it with `data-prefetch`.

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

Set `data-prefetch="none"` on a link whose target is expensive to render or rarely visited, and it is never prefetched, on any device. Force a strategy the other way when you know something the heuristic does not. The default is tuned for the common case, and the attribute is the escape hatch for the links you understand better than the framework does.

# Nothing to import

There is no prefetch library to install and no router to wire up. The client router auto-enables the moment `@webjsdev/core` loads in the browser, and core is the bundle every component pulls in. So any page that ships a single component gets client navigation, and with it device-adaptive prefetch, for free. You did not opt into it and you do not configure it to get sensible behaviour.

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

# Prefetch is the front edge of one pipeline

Prefetch is where a navigation starts, but the router keeps working once you click. It swaps pages in place with no full-page reload, so there is no white flash between routes and your nested layouts stay mounted. It sends an `X-Webjs-Have` header listing the layout fragments it already holds, so the server returns only the divergent part of the next page instead of re-serializing the shared header, sidebar, and footer every time. It restores scroll position on back and forward. These pieces reinforce each other. Prefetch warms the divergent fragment early, `X-Webjs-Have` keeps that fragment small, and the in-place swap paints it without a flash. The client-router post goes deep on the rest. The point here is that prefetch is not a bolt-on, it is the leading edge of one coherent navigation pipeline.

# Snappy, but never greedy

Prefetching the page behind a link is what makes navigation feel instant, and fetching every visible link is what makes it expensive, most of all for the person on mobile data. The device-adaptive default resolves that tension by matching the prefetch to how you would actually click. It uses `intent` on a hover-capable desktop, because a hover is a strong click signal, and dwell-gated, cancel-on-scroll-out `viewport` prefetch on touch, because only a link you paused on is one you might tap. Override any link with `data-prefetch`, and get all of it with no import because the router auto-enables when core loads. The rule underneath is the one worth stealing. Be snappy, but under-fetch when in doubt, because a prefetch you did not need is waste you charged to someone else.
