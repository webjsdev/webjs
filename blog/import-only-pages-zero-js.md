---
title: "Your Page Module Should Not Be in the Network Tab"
date: 2026-07-03T10:00:00+05:30
slug: import-only-pages-zero-js
description: "In WebJs, pages and layouts never hydrate, so their JavaScript has no job in the browser. An import-only page or layout is dropped entirely and the boot ships just the interactive component leaves it imported. How it works, when a page still ships whole, and how to check."
tags: performance, elision, no-build, ssr, web-components
author: Vivek
---

Open a WebJs blog post and pop the network tab. Now look for `page.ts`. It is not there. Look for `layout.ts`. Also not there. The post rendered, the theme toggle in the corner works, and the two files that describe the entire page never crossed the wire. Do the same on a typical React or Next app and you watch the page component and its layout come down as client JavaScript that then hydrates.

That gap is the whole post. Those two files stayed home, and you did not configure anything to make them. It falls out of one fact about how WebJs runs, and once you have seen it, the empty network tab is the thing you learn to check.

# Pages run on the server, components run in the browser

The habit to drop comes from React, where a page is JavaScript you ship and then hydrate. WebJs has no server-versus-client component split, and pages do not work that way.

Pages and layouts are isomorphic modules, so the same source can run on either side. But the page function runs only on the server. It executes once to produce HTML and is never called again in the browser. No second render, no client re-run, no event wiring at the page level. A layout is the same. It runs on the server to wrap its children, and then it is finished.

The interactivity lives one level down, in components. A component is an island. Its module loads in the browser, the custom element upgrades in place, and its `@click` handlers, signals, and reactive properties come alive. That client-side run is the entire reason a component ships at all. The component hydrates. The page around it does not.

So the page's own module has nothing left to do in the browser. It rendered its HTML on the server, the components inside it are the parts that wake up, and the page function was done the moment SSR (server-side rendering) finished. Shipping that module buys nothing, because no line of it runs on the client.

# The subtle case: import-only

A page rarely just sits there, though. It imports things, and the important ones are the interactive components it renders: a `<theme-toggle>`, a `<comment-box>`, a `<search-bar>`. Those components DO hydrate, so their modules genuinely have to reach the browser.

The obvious way to get them there is to ship the page module and let the browser follow its imports. But that hauls the whole page across the wire just to serve as a pointer to its children. WebJs does not do that. A page or layout that is non-inert only because it imports interactive components is import-only. Since it never hydrates, the framework does not need it in the browser to reach its imports. The boot emits the component modules directly and drops the page or layout wrapper. The browser fetches the interactive leaves and nothing else. The page module was the middleman, and the middleman gets cut.

Nothing was annotated to make this happen. No `"use client"` on the components, no marker on the page. You wrote a page that imports some components, and the browser received exactly the components that run in it, not the page that listed them.

Elision also touches the display-only component itself, the interactive-looking element whose JavaScript changes nothing, which the framework strips the same way. I wrote that half up separately in `ship-zero-javascript-display-only-components`. This post stays on the page and layout side.

# When a page ships whole anyway

Import-only is a specific condition, and knowing when it breaks matters, because that is precisely when `page.ts` reappears in your network tab. A page or layout ships whole when it has a client side effect of its own, beyond just interactive imports. Any of these in the module's closure pins it to the browser:

- An explicit client-router import.
- A call at module scope, something that runs the instant the module loads.
- A self-registering bare import, pulled in only for its side effect.
- Importing a client-effecting non-component utility.

That last one is the sneaky one. The usual offender is a `cn.ts` class-name helper that reads a browser global at module load. It looks completely innocent, a tiny string function. But importing it makes your page module do client work, and a page module that does client work ships whole. The fix is to keep client-only behavior inside a component and server-only work in a `.server.ts` file, and when a utility mixes a pure helper with client-global code, split the client part out so the pure helper does not drag in every page that imports it.

# The tool that names the reason

You do not have to stare at the network tab guessing which side effect did it. `webjs doctor` includes a page and layout elision advisory, and it names the specific reason a given page or layout ships. The tool points at the client side effect that pinned the module, so you fix the cause instead of hunting for it.

And if you ever want everything shipped, for a debugging session or because you simply distrust the analysis, turn elision off with `"webjs": { "elide": false }` in the config or `WEBJS_ELIDE=0` in the environment, and every module ships as written. Dropping a page module can never change your first paint, because the served HTML is byte-for-byte identical with elision on or off.

Which brings it back to the instruction at the top. Open the network tab. `page.ts` and `layout.ts` should not be in it, and neither should show up in the boot `<script type="module">`. If one does, something in that module is doing browser work it should not, and that is your signal to find the stray side effect and move it where it belongs.
