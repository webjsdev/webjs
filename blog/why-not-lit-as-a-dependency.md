---
title: "Why not just depend on lit?"
date: 2026-02-15T13:00:00+05:30
slug: why-not-lit-as-a-dependency
description: "The honest reasons webjs ships a custom component runtime instead of importing lit-html and LitElement: SSR, edge cases, decorators, and the size of the contract we want to own."
tags: lit, runtime, ssr, dependencies
author: Vivek
---

I get this question every time someone reads `packages/core/src/component.js`. The webjs WebComponent class has `static properties`, `render() { return html\`\` }`, `ReactiveController`, the full directive set. It looks like lit. So why not just import lit?

The short answer is SSR. The longer answer takes about 800 more words.

# What "just importing lit" would mean

The minimal version is:

```ts
// packages/core/src/component.js (hypothetical)
export { LitElement as WebComponent, html, css } from 'lit';
export { ReactiveController } from 'lit';
// ... re-export everything
```

That works for the client side. Components extend `LitElement`, write `render()`, get reactive properties and the full lit-html template engine. Five lines instead of two thousand.

What breaks: SSR.

# The SSR story

lit-ssr exists. It is a separate package (`@lit-labs/ssr`) that takes a lit template and renders it to an HTML string. It has been around for a few years, works for most cases, and the lit team maintains it.

But it has structural limits that matter for webjs:

**It does not share a code path with the client.** lit-ssr's renderer is a separate implementation that processes the same `html\`\`` templates. There is duplication, and in edge cases the server-side output and the client-side hydration disagree. The lit team has fixed many of these; some are still latent.

**It does not handle light-DOM `<slot>` projection.** lit-ssr renders shadow-DOM `<slot>` correctly via Declarative Shadow DOM. Light-DOM `<slot>` projection (where the framework manually inserts projected children into the host's slot markers) is not part of lit's model. webjs wanted this to be a first-class feature ([its own blog post here](/blog/light-dom-slots-with-full-parity)).

**Hydration is async.** lit-ssr emits the static HTML, but the client has to download `@lit/lit-element-hydrate-support` (a separate package), opt in per-component (`extends LitElement implements HydratableMixin` or the equivalent), and the hydration runs as a second-pass walk after lit boots. For a framework where most pages are server-rendered, this is a significant runtime cost on top of the initial paint.

**There is no built-in property-binding serialization channel.** If you write `<my-counter .data=${richObject}>` in a server-rendered template, lit-ssr drops the `.data` binding (no DOM property on the server-side). webjs preserves it via a `data-webjs-prop-*` attribute that the client picks up before the component's `render()` runs. This is a custom serializer hooking into webjs's renderer; no lit equivalent exists.

# The decorator problem

lit is decorator-friendly. The idiomatic API is:

```ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-counter')
class MyCounter extends LitElement {
  @property() count = 0;
  render() { return html`<button>${this.count}</button>`; }
}
```

That syntax requires `emitDecoratorMetadata: true` in tsconfig. With Node 24's built-in `module.stripTypeScriptTypes`, decorator metadata is non-erasable. webjs's `erasable-typescript-only` invariant rules it out. Strip-types-friendly TS does not support legacy decorators with metadata.

The webjs alternative is the `declare` + `static properties` pattern:

```ts
import { WebComponent, html } from '@webjsdev/core';

class MyCounter extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;
  constructor() { super(); this.count = 0; }
  render() { return html`<button>${this.count}</button>`; }
}
MyCounter.register('my-counter');
```

Three more lines per component than the lit decorator version. Tedious but tractable. The agent learns it from the AGENTS.md and writes it correctly thereafter.

If webjs depended on lit, we would carry the decorator path as the "main" pattern in lit's docs and have to constantly fight the divergence. By owning the runtime, we get to make the constructor-based pattern the only pattern.

# The "AI agent reads node_modules" reason

This is the one I keep underweighting in conversations and overweighting in practice.

The webjs framework ships as plain `.js` files with JSDoc type annotations. Not TypeScript compiled to JS, not bundled, not minified. `node_modules/@webjsdev/core/src/component.js` is a 1000-line JS file with comments and JSDoc and is readable end-to-end. So is `signal.js`, `slot.js`, `render-client.js`, every other source file in the framework. The whole framework is about 30 KLOC of JS that an agent can `cat` and reason about like project code.

This is by design. The first rule of the AI-first thesis is "the file the agent reads is the file that runs." That rule applies to the framework itself, not just the user's app code. When an agent hits an unexpected behavior in webjs, it can read the framework source and figure it out. When it does not understand why `firstUpdated` fires before `updated`, it opens `component.js`, finds the update loop, reads the JSDoc above it, and gets the answer.

lit is also open source and well-documented. But the version that lands in `node_modules` is the published build: TypeScript compiled to JS, minified for the production-target build, with the comments stripped. Reading it is doable but considerably worse than reading webjs's source, especially for an agent whose context window has to hold the relevant code.

If webjs depended on lit, every framework-internals question the agent might ask about lit would route through that compiled output. The framework's commentary on why a hook exists, what an edge case does, why a particular workaround is in place, would not be reachable. Worse, the lit team has no reason to write their internal comments for a downstream AI-first framework. They are not trying to make their `node_modules` readable for agents reading apps that depend on them.

Owning the runtime means we get to write the comments. The 1000-line `component.js` is paid forward to every agent reading it.


# The runtime size question

lit ships about ~20 KB minified + gzipped for the full LitElement + lit-html bundle. webjs's `@webjsdev/core` is about ~30 KB for the equivalent feature set, plus the slot-projection logic, the partial-swap-frame element, the client router, and the property-binding SSR channel.

So webjs is bigger. Not dramatically, but it is bigger.

The reason is that the framework includes the things lit treats as separate packages. The router, the SSR pipeline, the slot host, the live-reload SSE client. lit users assemble these from `@lit-labs/*` packages or third-party libraries. webjs ships them in one.

The trade-off is fewer dependencies to manage, fewer version-mismatch debugging sessions, smaller dependency graph in the user's `package-lock.json`. For an AI-first framework where the agent has to reason about the runtime, having one cohesive module is easier than navigating six related packages.

# The "what if lit ships SSR + slots tomorrow" question

If lit shipped full SSR with light-DOM `<slot>` parity and no separate hydration support package, the cost-benefit of owning the runtime would tip the other way. We would consider importing lit instead.

It has been roughly two years since lit-ssr stabilized and the design has not moved in this direction. The lit team has signaled that shadow-DOM-with-DSD is their model and they do not plan to support framework-owned light-DOM slot projection. That is a defensible architectural choice; it is just not webjs's choice.

If the situation changes, refactoring webjs to use lit underneath is a finite amount of work. The public API is already lit-shaped. The migration would be in the framework's internals, not in user code. We have the option to make the change later.

# The dependency direction

Worth noting: this is not lit-vs-webjs as products. Lit is great. The lit team has built a careful, principled web-components library. If you do not need SSR, do not need light-DOM slots, do not mind decorators, and do not want a full-stack framework wrapper, just use lit.

webjs is for the case where you want SSR + light-DOM slots + an AI-first contract + the rest of the framework (routing, server actions, auth, sessions, etc.) in one cohesive thing. Owning the runtime is one of the necessary conditions to deliver that, not a goal in itself.

# What I changed my mind about

When I started, I told myself "we will write a thin wrapper over lit and add the SSR layer ourselves." That was the plan for about a week.

What broke it was the realization that the SSR layer needs to call render() in the same shape that the client renderer does. The lit-html template parsing and the part-system are tightly coupled to lit's update lifecycle. We could either reimplement the part of lit-html we need (which is what webjs does), or we could fight lit's lifecycle from the outside and accept that some edge cases would never work.

Ship-it pragmatism won. I forked the conceptual model, wrote a clean implementation of the parts we use, and kept the public API identical so the agent does not see a difference.

The repo's `packages/core/src/component.js`, `render-client.js`, `render-server.js`, and `slot.js` are the result. They are some of the more carefully-tested code in the project (the lit-parity test suite has 127 tests ported verbatim from lit's repo, with one-line import changes). When lit adds a feature, we look at whether it makes sense in webjs's model and port it if so. We are not slavishly tracking, but we stay close.

# What this leaves open

The one piece I keep going back and forth on is whether to publish webjs's runtime as a standalone package that other tools could use. Right now `@webjsdev/core` is tightly integrated with `@webjsdev/server`. The component-rendering part is conceptually separable, and someone could in principle use it as a lit replacement without the rest of the framework. We have not made that easy.

Not a priority right now. The framework value is the whole stack working together. If someone wants just the renderer, they probably want lit anyway.
