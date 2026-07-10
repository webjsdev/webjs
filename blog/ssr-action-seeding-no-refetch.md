---
title: "No Double Fetch: Seeding SSR Data So Hydration Does Not Re-Request"
date: 2026-06-05T13:00:00+05:30
slug: ssr-action-seeding-no-refetch
description: "The classic SSR double-fetch problem, where the server renders with data and the client hydrates and fetches the same data again. How WebJs eliminates it with automatic SSR action-result seeding, no props to pass down and no query-cache hydration boundary."
tags: ssr, hydration, server-actions, performance, no-build
author: Vivek
---

There is a bug that almost every server-rendered app has shipped at least once, and most never fully fix. The server renders a component with real data, sends the HTML, the browser paints it, and then the component hydrates and immediately fetches the exact same data all over again. The user already had the data on screen. The server already did the query. And now the client throws a second request at the network to fetch a copy of what it is already showing. That is the double fetch, and it costs you a wasted round trip, a possible flicker when the second result swaps in, and load on a server that had no reason to answer twice.

I did not want WebJs to have this problem at all, and the fix is a feature you never have to think about. It is called SSR action-result seeding.

# The old way, in any framework

Here is the shape of the workaround everyone writes. In React or Next you fetch on the server, then you have to physically carry that data into the client so hydration does not refetch. Either you thread it down as props through every layer between the fetch and the component that needs it, or you stand up a query-cache hydration boundary and dehydrate and rehydrate the cache across the wire.

```tsx
// the manual version: fetch on the server, then pass it down by hand
export default async function Page() {
  const user = await getUser(uid);          // server fetch
  return <UserProfile initialUser={user} />; // now prop-drill it in
}

function UserProfile({ initialUser }) {
  const { data } = useQuery(['user', uid], () => fetchUser(uid), {
    initialData: initialUser,               // and remember to seed the cache
  });
  // ...
}
```

Every one of those lines is glue. The `initialUser` prop exists only to stop the refetch. The `initialData` option exists only to stop the refetch. If you forget either, it still works, it just quietly fetches twice, which is why this bug ships so often. The framework did the server fetch and then made carrying the result the application's job.

# The WebJs way, which is no way at all

In WebJs you write the fetch inside the component and pass nothing.

```ts
class UserProfile extends WebComponent({ uid: String }) {
  async render() {
    const user = await getUser(this.uid);   // a 'use server' action
    return html`<h3>${user.name}</h3>`;
  }
}
UserProfile.register('user-profile');
```

`getUser` is a `'use server'` action, so during SSR it runs on the server as the real function and its result is baked into the HTML. When this component ships to the browser and hydrates, its first call to `getUser(this.uid)` does not hit the network. It reads a seed that the server already put in the page. The query ran once, on the server, and the client reuses the result on its first render. No prop, no `initialData`, no cache boundary, no code.

# What the framework is doing under the hood

The mechanism is simple to state. Every `'use server'` action result computed during a non-streamed SSR render is serialized into the page. The generated client RPC stub, the typed stub WebJs rewrites your action import into, reads that serialized seed on its FIRST call for a given set of arguments. So the first client invocation is answered from the seed instead of the network.

A few properties make it safe to leave on and forget about:

- It is keyed by the action hash, the function name, and the serialized arguments. So the seed for `getUser(7)` is never handed to `getUser(9)`. The arguments have to match.
- It is consume-once. The seed answers the first call and then it is spent. A later refetch, or a call with changed arguments, goes to the network like normal. Seeding removes the redundant hydration fetch, not real subsequent fetches.
- It fails open. If a seed is missing for any reason, the stub degrades to a normal RPC call. A miss costs you a network request, never wrong data. There is no failure mode where a stale or mismatched seed gets served.

And the way the seed is captured is worth calling out, because it is where a build-based framework would reach for a transform. WebJs captures it through a transparent server-side `'use server'` facade. There is no source transform and no build step. The file on disk is unchanged, and the source you see in the browser's network tab is unchanged. Nothing rewrites your code to inject an initial-data payload. The facade sits at the action boundary at runtime and records what SSR computed. It runs on Bun too, same as on Node.

# It composes with elision

Seeding is one half of a two-part story, and the other half is that most of these components do not even ship. A display-only component, one that just fetches and renders with no click handlers, no signals, no interactivity, is elided entirely. Its server-rendered HTML is already the complete and final output, so WebJs drops its JavaScript module from the page. There is nothing left to hydrate, so there is nothing to refetch. The data is in the HTML and the browser gets zero client JavaScript for it.

So think of it as a clean split. A display-only async component ships no JavaScript, which means no hydration and no second fetch by construction. Seeding is the safety net for the components that DO ship, the ones that are also interactive and therefore have to hydrate. Those hydrate without re-requesting the data SSR already fetched. Between the two, the double fetch has nowhere to live.

# Turning it off

It is on by default and there is rarely a reason to change that, but you can. Set `"webjs": { "seed": false }` in `package.json`, or `WEBJS_SEED=0` in the environment, and the stub always goes to the network on its first call. You would only reach for this to debug the RPC path in isolation. In normal operation the default is what you want.

# The takeaway

The double fetch is a bug that ships constantly because the fix in most frameworks is manual, an `initialData` you have to remember or a prop you have to thread, and forgetting it fails silently. WebJs eliminates it with SSR action-result seeding. Every `'use server'` result computed during SSR is serialized into the page, the client stub reads it on its first call keyed by action hash and function name and arguments, it is consume-once and fails open, and it is captured through a runtime facade with no source transform and no build step. Combine it with elision dropping the display-only components entirely and the picture is clean. The server already did the work, so the client does not redo it, and you wrote zero glue to make that true.
