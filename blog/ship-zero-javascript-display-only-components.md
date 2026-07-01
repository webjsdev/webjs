---
title: "How webjs Ships Zero JavaScript for Display-Only Components"
date: 2026-07-01T11:00:00+05:30
slug: ship-zero-javascript-display-only-components
description: "webjs strips the JavaScript for any component it can prove is display-only, so an islands app ships only its interactive leaves. How the elision analyser works, why it is conservative by construction, and how the invariant is enforced in code."
tags: elision, islands, no-build, performance, web-components
author: Vivek
---

Write a `<price-tag>` component in webjs. It reads a number, formats it, renders some HTML. No click handler, no signal, no reactive property. Server-render a page that uses it, open the network tab, and look for `price-tag.js`.

It is not there. The framework served the component's HTML and then deleted its JavaScript from the page, because it could prove the component does the same thing with or without its script. The browser downloads nothing for it.

This is elision, and it is the mechanism that lets a webjs app ship only its interactive leaves instead of its whole component tree. It landed properly in #474 and I have been sharpening it since. Here is how it works.

# The idea

A webjs component is an isomorphic module. It runs on the server to produce SSR HTML, and it runs again in the browser to upgrade the custom element and wire up interactivity. That second run is the only reason the module ships to the client.

But a lot of components have nothing to do on that second run. A badge, a formatted date, a card, a static icon. Their `render()` produces the same HTML in the browser that it already produced during SSR. Loading the module client-side re-registers the element and re-renders identical output. The download buys you nothing.

So the framework does not send it. If a component is display-only, its module is dropped from the page, its import is stripped from the served source, and any vendor dependency reachable only through it is dropped from the importmap too. The HTML is the complete output. This is islands architecture, except you never mark the islands. The framework finds them.

# What counts as interactive

The decision is made by a static analyser in `packages/server/src/component-elision.js`. It reads the component source and looks for any signal that the component does client-side work. If it finds one, the module ships. The signals are the obvious ones:

- An `@event` binding in a template (`@click=${...}`).
- A reactive property that is not `{ state: true }` (it rides an HTML attribute, so the browser can change it).
- A read of a `signal()` or `computed()`, or an import of one.
- An overridden lifecycle hook (`connectedCallback`, `firstUpdated`, and the rest).
- A `<slot>`, or `static shadow = true` (Declarative Shadow DOM has to re-attach on a client-side DOM insertion).
- Any code that runs at module load: a top-level call, a `new WebSocket(...)`, a `setTimeout`, a browser global.
- A transitively-reachable interactive child.

If none of those are present, the component is display-only and gets elided. If any are, it ships.

# The direction that matters

The interesting property is not the list. It is which way the analyser errs when it is unsure.

There are two ways to be wrong. The analyser can decide a component is interactive when it is actually display-only, or it can decide a component is display-only when it is actually interactive. These failures are not symmetric.

A false "interactive" verdict costs one thing: a module download the browser did not strictly need. The page still works. It is a missed optimization, and the module was cached and shared anyway.

A false "display-only" verdict breaks the page. An interactive component never boots, its click handler never binds, and the user clicks a dead button. Worse, it is silent. The SSR HTML looks right, so nothing crashes. It just does not work.

So every ambiguity resolves to "ship." The analyser is a denylist of interactivity signals, and anything it cannot recognise or parse ships by default. An unreadable file ships. A static field it cannot evaluate ships. A class body it cannot fully parse ships. The header comment in the file states this as the rule, and every branch honours it. Over-shipping is the safe failure, so the framework chooses it every time it is not certain.

# Proving it is actually safe

A conservative rule is only as good as its enforcement. Two things keep elision honest.

The first is differential verification. A test renders a page with elision on and with elision off, and asserts the SSR HTML is byte-identical. If eliding a module ever changed the first paint, that test reds. The whole promise of elision is that the served HTML is the same either way, so the test checks exactly that promise.

The second is that the analyser's signal lists cannot silently fall behind the framework. A denylist is dangerous precisely because it is a maintenance burden: every time someone adds a new way for a component to be interactive, they have to teach the analyser about it, or a component using only that new mechanism gets silently over-elided. That is the one failure mode that would actually break pages.

So the lists are guarded mechanically. `lifecycle-coverage.test.js` introspects the live `WebComponent` prototype and fails the build if a new public method or hook is added without being classified in the analyser. And after a recent change (#785), `sigil-coverage.test.js` does the same for the two surfaces that are not prototype methods: the template binding sigils (`@`, `.`, `?`) and the interactivity static fields. The binding sigils are single-sourced in core, and the guard asserts the analyser classifies every one of them as either a client-behaviour ship signal (like `@event`, which drops at SSR) or an SSR-safe round-trip (like `.prop` and `?bool`, which survive into the served HTML). Add a fourth sigil to the renderer without classifying it, and the build goes red before it can ship a bug.

The point is that the safety is not "we were careful." It is "the test suite refuses to let the analyser drift." Careful is not a property you can rely on across a growing codebase written partly by agents. A failing build is.

# What it looks like on a real app

A content-heavy page is the best case. A blog post is a layout, a page, a header, a formatted date, a code block, a card grid, and maybe one interactive thing like a theme toggle or a comment box. Everything except that one interactive thing is display-only. So the browser fetches the core runtime once (cached and shared across the whole app), the theme toggle's module, and nothing else. The twelve display-only components contribute zero bytes of component JavaScript.

You did not annotate anything. You did not write `"use client"` on the interactive one or `"use server"` on the rest. You wrote components, and the framework worked out which ones need to run in the browser.

You can turn it off. Set `"webjs": { "elide": false }` in the config, or `WEBJS_ELIDE=0` in the environment, and every component module ships. That is the escape hatch for the rare case where the analyser is too conservative for your taste or you are debugging a hydration issue and want everything loaded. In practice I have not needed it.

# What I am still figuring out

The denylist completeness is the load-bearing assumption, and the guard tests cover the surfaces that are enumerable: prototype methods, exported reactive primitives, binding sigils, static conventions. What they cannot mechanically cover is a genuinely new KIND of interactivity surface that is none of those, for example a brand-new template syntax. Adding one is a rare, deliberate, reviewed change that touches the renderer anyway, so a human is already in the right neighbourhood. But it is the one spot where the enforcement is a documented contract rather than a failing build, and I would like to close even that eventually.

The other open question is how aggressive to be about the transitive cases. A component shared between a display-only page and an interactive one has to ship, because one of its two users needs it. The analyser gets this right by shipping it, but "right" here still means the display-only page pays for a module it does not use on its own. The conservative direction protects correctness, and it occasionally costs a fetch. I am comfortable with that trade, because the alternative direction breaks pages, but it is the place where elision leaves value on the table.

# The takeaway

Islands architecture usually asks you to mark the islands. webjs inverts that. You write plain components, and the framework proves which ones are display-only and strips their JavaScript, conservatively, verified differentially, and guarded against drift by tests that fail the build. The result is that a mostly-static page ships almost no component code without you thinking about it.

If you are designing a system that decides what to include or exclude automatically, spend your effort on the direction of the failure, not the cleverness of the detection. Make the safe direction the default for everything ambiguous, then write the test that refuses to let the rule rot. The detection can be simple if the failure is always harmless.
