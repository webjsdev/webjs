# Client Router and Streaming

## What This Covers

- The automatic client router (SPA-style partial swaps), how it opts out, and programmatic `navigate()` / `revalidate()`.
- Link prefetch with device-adaptive defaults.
- `<webjs-frame>` partial-swap regions (WebJs's Turbo Frames).
- View Transitions opt-in.
- `<webjs-stream>` surgical element updates (WebJs's Turbo Streams) and streaming RPC results.
- `Suspense` page-level streaming and `<webjs-suspense>` component-level streaming.
- WebSockets (`connectWS`, the `WS` route export, `broadcast()`).
- The opt-in navigation-loading indicator.

Read this when a task touches client navigation, prefetch, partial-page swaps, streaming, or realtime. For the components that render inside these regions (async render, `renderFallback()`, signals) see `components.md`. For the server actions these features call see `data-and-actions.md`.

## The Client Router

The router auto-enables the moment `@webjsdev/core` loads in the browser, which is any page that ships a component. There is nothing to import or opt into. It intercepts same-origin `<a>` clicks (including inside shadow DOM), fetches the target HTML, and replaces only the inside of the deepest shared layout. Outer header, sidenav, and footer DOM is never re-rendered, so scroll positions, input values, and `<details>` state survive a navigation.

**Mobile-browser constraint: a dropped layout-marker comment.** SSR wraps each layout's children in a `<!--wj:children:<path>-->...<!--/wj:children-->` comment pair, and the deepest-shared-layout swap matches on those markers. Real Android Chrome was observed to intermittently DROP the trailing `<!--/wj:children-->` comment while parsing a soft-nav response (the open marker survived, the close did not), which left the router with no pairable slot and forced the destructive full-body swap that wiped the outer layout (the top navbar). The router now recovers an orphaned open marker (treating the children as running to the end of the containing element), so a lost close comment still takes the correct scoped swap and the outer chrome keeps its DOM identity. When a layout puts trailing chrome (a `<footer>`) in the marker's OWN parent, the recovered range is bounded against the well-formed side's trailing-sibling count so that footer is preserved rather than swept. Wrapping `${children}` in a container element (the shipped idiom, `<main>${children}</main>` with the footer a sibling outside it) is the safe pattern, because then the close marker is the parent's last child and there is no trailing content to bound. This sits alongside the iOS-WebKit repaint note in [styling.md](./styling.md): both are real mobile-browser divergences from headless Chromium that only surface on-device, so a mobile-only soft-nav regression is worth reproducing against a real device (or the deterministic dropped-close browser test) rather than desktop Playwright alone.

**Opting out.** App-wide with config, or per moment at runtime.

```jsonc
// package.json
{ "webjs": { "clientRouter": false } }
```

```js
import { disableClientRouter } from '@webjsdev/core';
disableClientRouter();
```

Per link, opt out with `data-no-router` (auth flows like `/logout`, OAuth redirects, print views, an experimental route with a different runtime). Cross-origin hrefs, `download`, a non-`_self` target, pure same-page hash jumps, and non-HTML extensions are auto-skipped.

**Programmatic navigation and cache eviction.**

```js
import { navigate, revalidate } from '@webjsdev/core';
await navigate('/about');                     // push history
await navigate('/login', { replace: true });  // replace history
revalidate('/products/123');                  // evict one URL from the snapshot cache
revalidate();                                 // clear the entire snapshot cache
```

The router keeps a URL-keyed snapshot cache (LRU, cap 16) so Back/Forward restores instantly, then refetches in the background. Call `revalidate(path)` after a server action mutates data a cached page depends on. Wire bytes are minimized by an `X-Webjs-Have` header, so the server returns only the divergent layout fragment. Concurrent navigations abort the prior in-flight fetch, and scroll is restored on Back/Forward.

**Error recovery.** A 2xx/3xx swap applies in place, and an HTML error body of any status (a 422 re-rendered form, a 5xx error page) is ALSO applied in place with no reload. For a non-HTML error or a transport failure the router dispatches a cancelable `webjs:navigation-error` on `document` (detail `{ url, status, error }`). Call `preventDefault()` to own recovery, otherwise the router renders a minimal in-place alert into the layout slot.

```ts
document.addEventListener('webjs:navigation-error', (e) => {
  e.preventDefault();
  showToast(`Could not load ${e.detail.url} (status ${e.detail.status})`);
});
```

**Form state.** A form submitting through the router gets `aria-busy="true"` for the in-flight duration, plus bubbling `webjs:submit-start` and `webjs:submit-end` (detail `{ form, url, ok }`) events. Style `form[aria-busy="true"]` in pure CSS or listen for the events.

## Link Prefetch

Same-origin in-app links prefetch speculatively so a click resolves from a warm cache. On by default, no per-link opt-in needed. The default strategy is DEVICE-ADAPTIVE, because one strategy cannot serve both input modalities. On a hover-capable fine pointer the default is `intent` (warm on hover/focus after a ~100ms dwell). On touch the default is `viewport` (warm as links settle on-screen), because touch has no hover. Modality is detected with `matchMedia('(hover: hover) and (pointer: fine)')`, never a UA sniff.

Override per link with the `data-prefetch` attribute.

```html
<a href="/dashboard">adaptive default (intent on pointer, viewport on touch)</a>
<a href="/dashboard" data-prefetch="intent">hover / focus / touch</a>
<a href="/dashboard" data-prefetch="render">eager on insert</a>
<a href="/dashboard" data-prefetch="viewport">on scroll into view</a>
<a href="/dashboard" data-prefetch="none">never</a>
```

Next-style aliases work (`true` = `render`, `auto` = `viewport`, `false` = `none`). `viewport` uses an IntersectionObserver at threshold 0.5 with a ~250ms dwell, cancelled the instant a link scrolls back out, so a fast scroll spends no requests. Speculation is bounded by a concurrency cap, in-flight de-dupe, and an LRU + TTL cache, and is disabled entirely under `Save-Data`, `prefers-reduced-data`, or a 2g connection. The guiding rule is snappy but never at the cost of bloating the network tab, so when the two conflict the gate under-fetches.

A prefetch issues a real GET, so any mutating endpoint MUST be a POST or a `<form>` submission (which the router never prefetches), never a GET link. A `webjs:prefetch` event fires on `document` when a fragment lands in the cache.

## `<webjs-frame>` Partial-Swap Regions

`<webjs-frame>` is WebJs's take on Turbo Frames, so most `<turbo-frame>` muscle memory transfers. It is a lazy, URL-addressable region that swaps on its own, driven by a link or form targeting its id, and it ships zero component JS. Use it for a region that loads or refreshes INDEPENDENTLY of a full-page navigation (a marketing widget, tabbed UI, a filtered results panel), which a page or layout cannot express.

```ts
html`<webjs-frame id="activity">…contents…</webjs-frame>`
```

On click the router walks `closest('webjs-frame')` from the target. If a frame is found and the response carries a matching `<webjs-frame id>`, the swap is scoped to that frame's children, and the server returns ONLY that subtree.

**External targeting.** A trigger does not have to be nested inside the frame. An `<a>` or `<form>` carrying `data-webjs-frame="<id>"` drives that frame from anywhere (an explicit `data-webjs-frame` wins over the enclosing-frame default). `data-webjs-frame="_top"` is a reserved token forcing a full-page navigation that breaks out of the frame.

**Self-loading.** Give a frame a `src` and it self-fetches (through the same swap path).

```html
<webjs-frame id="rail" src="/widgets/rail"></webjs-frame>            <!-- eager on connect -->
<webjs-frame id="comments" src="/posts/42/comments" loading="lazy">  <!-- fetch on viewport entry -->
  <p>Loading comments...</p>
</webjs-frame>
```

A `src`-driven frame is JS-DEPENDENT (the browser does not natively fetch `<webjs-frame src>`), so use it for DEFERRED content where a JS-off placeholder is acceptable. For content that must exist without JS, render it server-side into the frame. A frame's route can itself use `<webjs-suspense>` to stream slow data behind a fallback. Frame events: `webjs:frame-busy` (both edges, `aria-busy` set for free) and a cancelable `webjs:frame-missing` when the response lacks the requested frame.

## View Transitions (opt-in)

The router can wrap a navigation's DOM mutation in the native View Transitions API so a swap cross-fades instead of snapping. It is OFF by default. Opt in with a meta in any page head (re-read per navigation), mirroring Turbo's convention.

```html
<meta name="view-transition" content="same-origin">
```

The accepted value is `same-origin`. When enabled it wraps all three swap paths (the layout-marker swap, the `<webjs-frame>` swap, and the full-body fallback). When `startViewTransition` is unavailable the swap runs synchronously with no flash and no throw. To persist a live element (a playing `<audio>`, an open menu) across a swap by node identity, mark it `data-webjs-permanent` and give it an `id`.

## `<webjs-stream>` Surgical Updates

`<webjs-stream>` is WebJs's take on Turbo Streams, and the action set mirrors `<turbo-stream>`. It is the only SINGLE-element update primitive (append one row, remove one item, bump a count, insert a toast), whereas a frame or layout swap redraws a whole region.

```html
<webjs-stream action="append" target="comments">
  <template><li>Nice post!</li></template>
</webjs-stream>
```

Actions: `append` / `prepend` (child of the target id), `before` / `after` (sibling), `replace` (the target itself), `update` (the target's children), `remove` (no template). A `targets="<css-selector>"` applies to every match. There are two delivery paths sharing one applier. Over HTTP a form submission rides the router with `Accept: text/vnd.webjs-stream.html`, and the server returns a stream only when that Accept is present (JS off gets a normal render, so it stays progressive-enhancement-safe). Over a live channel, `renderStream(message)` applies a server-pushed payload.

```ts
// app/post/[id]/route.ts
import { stream, streamResponse, acceptsStream, broadcast } from '@webjsdev/server';

export async function POST(req: Request, { params }) {
  const comment = await addComment(params.id, await req.formData());
  const parts = stream.append('comments', `<li>${escapeHtml(comment.text)}</li>`);
  broadcast(`post:${params.id}`, parts);              // fan out to every viewer
  if (acceptsStream(req)) return streamResponse(parts);
  return Response.redirect(`/post/${params.id}`, 303); // no-JS fallback
}
```

`stream.*` escapes the target id but NOT the content, so escape any user substring yourself, exactly like an `html` hole.

## Streaming (Suspense and RPC)

**Page-level streaming (`Suspense`).** Pass a promise as `children` to defer a slow region behind a fallback. TTFB is the time to render everything outside the boundary, and the resolved content streams in as a `<template>` when the promise lands.

```js
import { html, Suspense } from '@webjsdev/core';
export default function Page() {
  return html`<h1>Catalogue</h1>
    ${Suspense({ fallback: html`<p>Loading…</p>`, children: fetchExpensive() })}`;
}
```

**Component-level streaming (`<webjs-suspense>`).** An `async render()` component BLOCKS the first byte by default (real data in the first paint). To STREAM a slow component behind a fallback instead, wrap it. Multiple boundaries fetch concurrently, and a throwing component is isolated to its own error state while siblings stream.

```js
html`<webjs-suspense .fallback=${html`<p>Loading section…</p>`}>
  <user-profile uid="42"></user-profile>
</webjs-suspense>`
```

**Streaming RPC results.** A `'use server'` action that RETURNS a `ReadableStream`, async iterable, or async generator streams its chunks over the single RPC response. Detection is purely on the return value, so no config export is needed. This is the token-stream or progress case consumed imperatively after an interaction.

```ts
'use server';
export async function* streamAnswer(prompt: string) {
  for await (const token of llm.complete(prompt)) yield token;
}
// inside a component:
for await (const token of await streamAnswer(q)) this.text.set(this.text.get() + token);
```

Back-pressure is respected, and the request `AbortSignal` cancels the source on a client disconnect or a superseded render. A mid-stream throw surfaces as an error from the iterable, so wrap the `for await` in `try/catch`. For a slow region you want behind a fallback on the FIRST paint, use `<webjs-suspense>` instead.

## WebSockets

**Server.** Export `WS` from a `route.{js,ts}` file. In dev the module re-imports per connection, so keep shared state on `globalThis`.

```js
export function WS(ws, req, { params }) {
  ws.on('message', (data) => ws.send('echo:' + data));
  ws.on('close', () => { /* cleanup */ });
}
```

**Client.** `connectWS(url, handlers)` from `@webjsdev/core` auto-reconnects with exponential backoff, handles JSON parse/stringify, and queues sends while disconnected.

```js
import { connectWS, renderStream } from '@webjsdev/core';
connectWS('/feed', { onMessage: (m) => renderStream(m) });
```

**Broadcast.** `broadcast(path, data)` from `@webjsdev/server` fans a message to every connected client on that path (single-instance). For multi-instance, add Redis pub/sub yourself, there is no framework magic.

## Navigation-Loading Indicator (opt-in)

For a CSS-only progress affordance while a navigation is in flight, add `data-webjs-nav-progress` to `<html>` once in the root layout. The router then sets `data-navigating` on `<html>` during a nav (deferred 150ms, so quick navs never trigger it). Style off that attribute.

```html
<html data-webjs-nav-progress>
```

```css
html[data-navigating] { cursor: progress; }
html[data-navigating]::after {
  content: ''; position: fixed; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent); animation: progress 1s ease-in-out infinite;
}
```

It is opt-in because toggling an `<html>` attribute re-resolves `oklch()` / `color-mix()` tokens on WebKit (every iOS browser), which flashes the background for one frame on a token-driven theme. Enable it only when your theme does not lean on wide-gamut color tokens, otherwise use the JS path (listen for `webjs:navigate`, and `webjs:submit-start` for forms).
