---
title: "Async Data Fetching in Web Components (await Right in render())"
date: 2026-05-29T10:00:00+05:30
slug: async-render-in-web-components
description: "Web component data fetching without useEffect or a first-paint spinner. WebJs lets you await server data right inside async render(), so SSR bakes the data into the first paint, the client stays stale-while-revalidate, and there is no request waterfall."
tags: web-components, data-fetching, async-render, ssr, suspense
author: Vivek
---

Fetching data inside a component usually goes like this. You write a `useEffect`, you set a loading flag, you show a spinner, and the first thing the user sees is an empty box. The data only arrives after the component has already painted once, rendered nothing useful, and then re-rendered. If a parent and a child both fetch, they fetch in sequence, one waiting on the other, which is the request waterfall everyone eventually trips over. And none of that data is in the HTML the server sent, so a search crawler or a reader with JavaScript off sees the empty box too.

I wanted the opposite of all of that. In WebJs you `await` the data directly inside the component's `render()` method, and the framework handles the three separate problems that `useEffect` conflates into one mess.

Here is the whole thing.

```ts
class UserProfile extends WebComponent({ uid: String }) {
  async render() {
    const u = await getUser(this.uid);   // a 'use server' action
    return html`<h3>${u.name}</h3>`;
  }
}
UserProfile.register('user-profile');
```

That is it. No effect, no loading flag, no spinner, no `this.setState`. `render()` is allowed to be `async`. Writing `await` makes the function return a promise by the normal JavaScript rule, and every render path in WebJs already awaits a promise-returning `render()` automatically. There is no flag to set. A plain synchronous `render()` stays the zero-cost default, so you only pay for async where you actually reach for it. This is issue #469 if you want to read the history.


# Why this is not just useEffect with nicer syntax

The reason `async render()` works is that it decouples three concerns that React's fetch-in-effect pattern jams together. Keep them separate in your head and the whole model clicks.

**One. SSR always blocks.** On the server, WebJs awaits your `async render()` before it sends any HTML. So the resolved data is baked into the first paint. There is no fallback markup, no spinner, no empty box, ever. The `<h3>` arrives with the name already in it. This is what "progressive enhancement" means in practice (the page works before JavaScript runs). A reader with JS off still reads the data, and a crawler indexes real content instead of a loading state. That is a genuine upgrade over a client-side fetch, which can only show something after the browser has downloaded, parsed, and run your script.

**Two. The client re-fetch is stale-while-revalidate by default.** Say the `uid` prop changes and the component needs fresh data. WebJs re-runs `async render()`, but the content already on screen stays put until the new render resolves. No blank flash, no layout jump, no user code. The old data is shown while the new data loads, then it swaps. This is the behavior you would hand-write with a bunch of state in React, and here it is the default you get for free.

**Three. `renderFallback()` is an optional loading UI, and only for the re-fetch.** Sometimes stale content would mislead (a different user's profile, say). For those cases you define `renderFallback()`, and WebJs shows it during a client re-fetch instead of the stale content.

```ts
class UserActivity extends WebComponent({ uid: String }) {
  renderFallback() { return html`<div class="skeleton h-24"></div>`; }
  async render() {
    const items = await getActivity(this.uid);
    return html`<ul>${items.map((i) => html`<li>${i.label}</li>`)}</ul>`;
  }
}
```

The important part, and the part that trips people coming from React. `renderFallback()` is shown ONLY during a client re-fetch. It is NEVER shown on the first paint. The first paint always has real data because SSR blocked for it. So `renderFallback()` is not "the loading spinner", it is "the loading spinner for the second and later fetches". If you were reaching for it to fill the first paint, you do not need it.


# Errors are isolated for free

If your `await getData()` throws, WebJs renders a component-scoped error state and lets the sibling components render normally. One broken widget does not blank the page and it does not bubble up to the route's `error.js`. In dev the default shows you the tag and message; in prod it renders a silent empty element so nothing leaks. You override it only if you want a custom message.

```ts
class Report extends WebComponent {
  async render() { return html`<pre>${await getReport()}</pre>`; }
  renderError(error) { return html`<p class="error">Could not load the report.</p>`; }
}
```

Again, this is behavior you would otherwise build by hand with an error boundary around every fetching component. Here it is the default and `renderError()` is the opt-in customization.


# The one line that works on both sides

Look back at `const u = await getUser(this.uid)`. That single line runs on the server during SSR and on the client during a re-fetch, and it is the same line both times. This works because `getUser` is a `'use server'` action. During SSR it is the real function talking to your database. On the client, WebJs has rewritten the import into a typed RPC stub that posts to the server for you. You never hand-write a `fetch()` call, and you never think about which side you are on. The function is isomorphic (same source, both environments), so the co-located fetch just works.

That co-location is the other quiet win. The fetch lives in the leaf component that needs the data. No prop-drilling a `user` object down four layers, no lifting fetches to a parent, no request waterfall from parent-waits-for-child chains.


# What you do not pay for

Two optimizations make this cheap, and both are on by default.

A display-only async component gets **elided** (#474). If a component just fetches and renders, with no click handlers, no signals, no interactivity of any kind, then its server-rendered HTML is already the complete and final output. So WebJs drops its JavaScript module from the page entirely. The data is in the HTML, the component has nothing left to do in the browser, so nothing ships. A docs page or a content card built this way costs zero client JavaScript.

For a component that DOES ship (because it is also interactive), **SSR action seeding** (#472) kills the redundant re-fetch. Every `'use server'` action result computed during SSR is serialized into the page. When the component hydrates in the browser, its first RPC call reads that seed instead of hitting the network. So `getUser(this.uid)` runs once, on the server, and the client reuses the result on its first render. No hydration flicker, no wasted round trip. A later re-fetch or an argument change still goes to the server as normal.


# When to reach for something else

`async render()` blocks the first byte, because SSR waits for your data before sending HTML. For fast queries that is exactly right. For a genuinely slow region, blocking the whole page's time-to-first-byte on one slow query is the wrong tradeoff. That is what `<webjs-suspense>` is for.

```ts
html`
  <webjs-suspense .fallback=${html`<p>Loading section…</p>`}>
    <slow-report></slow-report>
  </webjs-suspense>
`
```

The fallback flushes on the first byte, and the slow content streams in when it resolves. Multiple boundaries on one page fetch concurrently, so you get fast-content-first with no server waterfall. This is the one and only way to show a fallback on the first paint, and it is a deliberate choice you make for slow regions, not the default.

And to be clear about the boundary. Use `async render()` for server data that is known at request time and belongs in the first paint. Keep `Task` and signals for data that is genuinely client-only (a `Task` renders its pending state at SSR, which means it loses the first-paint data, so it is the wrong tool for server data you want in the HTML).


# The takeaway

Fetching data in a component should not mean a spinner, an empty first paint, and a request waterfall. In WebJs you `await` your server data right inside `async render()`, and the framework splits the problem into three clean pieces: SSR always blocks so the data is in the first paint (no `useEffect`, no empty box, works with JS off), the client re-fetch is stale-while-revalidate by default, and `renderFallback()` is an optional loading state for re-fetches only. Errors isolate per component automatically, the fetch is one isomorphic line that runs on both sides, display-only components ship zero JavaScript, and SSR seeding means no wasted re-fetch on hydration. When a query is slow enough that blocking the first byte hurts, wrap it in `<webjs-suspense>` and stream it. That is data fetching that starts from the server instead of fighting to catch up to it.
