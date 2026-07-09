---
title: "Your Page Module Should Not Be in the Network Tab"
date: 2026-07-03T10:00:00+05:30
slug: import-only-pages-zero-js
description: "In WebJs, pages and layouts never hydrate, so their JavaScript has no job in the browser. An import-only page or layout is dropped entirely and the boot ships just the interactive component leaves it imported. How it works, when a page still ships whole, and how to check."
tags: performance, elision, no-build, ssr, web-components
author: Vivek
---

Open a WebJs blog post, pop the network tab, and look for `page.ts`. It is not there. Look for `layout.ts` either. Neither downloaded. The page rendered, the theme toggle in the corner works, the two files that describe the whole page never crossed the wire. Do the same on a typical React or Next app and you watch the page component and its layout come down as client JavaScript that then hydrates. That contrast is the whole point of this post.

The reason those two files stayed home is not something you configured. It falls out of one fact about the framework, and once you see it, the empty network tab becomes the thing you check for.

# Pages run on the server. Components run in the browser.

The mental model to unlearn comes from React, where a page component is JavaScript you ship and then hydrate. In WebJs there is no server or client component split, and pages do not work that way.

Pages and layouts are isomorphic modules, meaning the same source can run on both sides. But a page function runs only on the server. It executes once to produce HTML and is never invoked again in the browser. There is no second render, no client-side re-run, no event wiring at the page level. A layout is the same: it runs on the server to wrap its children and it is done.

All the interactivity lives one level down, in components. A component is an island: its module loads in the browser, the custom element upgrades in place, and its `@click` handlers, signals, and reactive properties come alive. That client-side run is the entire reason a component's module ships at all. It hydrates; the page around it does not.

So a page's own module usually has nothing to do on the client. It rendered its HTML on the server, the components inside it are the parts that come alive, and the page function finished the moment SSR did. Shipping that module to the browser buys you nothing, because no code in it runs there.

# What "import-only" means

Here is the subtle case, and the one this post is really about. It landed in #605 and #609.

A page rarely sits there doing nothing. It imports things, in particular the interactive components it wants to render: a `<theme-toggle>`, a `<comment-box>`, a `<search-bar>`. Those components DO hydrate, so their modules genuinely need to reach the browser.

The naive way to get them there is to ship the page module and let the browser follow its imports. But that drags the whole page module across the wire just to act as a pointer to its children. WebJs does better. A page or layout that is non-inert only because it imports interactive components is called import-only. Since the page never hydrates, the framework does not need it in the browser to reach its imports. The boot emits the component modules directly and drops the page or layout wrapper, so the browser fetches the interactive leaves and nothing else. The page module was the middleman, and the middleman gets cut out.

You never annotated anything. No `"use client"` on the components, no marker on the page. You wrote a page that imports some components, and the browser received exactly the components that run there, not the page that listed them.

The other module elision touches is the display-only component itself, the interactive-looking element whose JavaScript changes nothing so the framework strips it too. I wrote that side up separately in `ship-zero-javascript-display-only-components`; here I am staying on the page and layout half.

# When a page still ships whole

Import-only is a specific condition, and it is worth knowing when it fails, because that is when `page.ts` shows up in your network tab. A page or layout ships whole when it has a client side effect of its own, not just interactive imports. Any of these in the module's closure pins it to the browser:

- An explicit client-router import.
- A call at module scope, something that runs the instant the module loads.
- A self-registering bare import, a module imported purely for its side effect.
- Importing a client-effecting non-component utility. The classic offender is a `cn.ts` class-name helper that touches a browser global. Import that into your page and the page module now does client work, so it ships whole.

That last one is sneaky, because a class-name helper looks innocent. But if it reads a browser global at module load, importing it makes your page module client-effecting, and a client-effecting page module ships. The fix is to keep client-only behavior inside a component and server-only work in a `.server.ts` file, and if a utility mixes a pure helper with client-global code, split the client part out so the pure helper does not pin every page that imports it.

# The self-check, and the tool that names the reason

The rule of thumb is short. `page.ts` and `layout.ts` should never appear in the network tab or in the boot `<script type="module">`. If one does, something in its closure is doing client-side work, and that is your signal to find the stray side effect and move it where it belongs.

You do not have to squint at the network tab to figure out which one. `webjs doctor` includes a page and layout elision advisory (#646), and a later change (#666) added advisory naming of the specific reason a given page or layout ships, so the tool tells you which client side effect pinned the module to the browser.

If you ever want everything shipped, for a debugging session or because you distrust the analysis, turn elision off with `"webjs": { "elide": false }` in the config or `WEBJS_ELIDE=0` in the environment, and every module ships as written. Dropping a page module can never change your first paint anyway, because the served HTML is identical with elision on or off.

# The takeaway

A React page component is client JavaScript you ship and hydrate. A WebJs page is not, because pages and layouts do not hydrate at all. Their functions run only on the server, so an import-only page or layout gets dropped entirely and the boot ships just the interactive component leaves it imported (#605, #609). A page ships whole only when it does client work of its own, and `webjs doctor` names the reason when it happens (#646, #666). The self-check is a glance at the network tab: if `page.ts` or `layout.ts` is in it, something in that module is doing browser work it should not. The result is a mostly-static page that ships almost no JavaScript, with not a single boundary marked by hand.
