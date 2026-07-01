---
title: "webjs vs Lit: a Lit-Shaped Runtime Without the Dependency"
date: 2026-02-08T11:00:00+05:30
slug: betting-on-lits-mental-model
description: "webjs ships its own web-component runtime whose public API mirrors Lit (reactive properties, the Lit lifecycle, lit-html directives), so Lit knowledge transfers with no Lit dependency. What that buys and what it costs."
tags: components, lit-parity, runtime, ssr, ai-first
author: Vivek
---

The most-asked question I get about webjs is some version of "if you wanted lit's API, why didn't you just use lit?"

It is a reasonable question. The webjs `WebComponent` class has reactive properties, `render() { return html\`\` }`, `ReactiveController`, the full directive set. It looks like lit. The minimal version of "just use lit" would be:

```ts
// packages/core/src/component.js (hypothetical)
export { LitElement as WebComponent, html, css } from 'lit';
export { ReactiveController } from 'lit';
```

Five lines instead of two thousand. Components would extend `LitElement`, write `render()`, get reactive properties and the full lit-html template engine. The client-side story would work.

I considered it for about a week. Then I wrote my own runtime. Here is why.


# What I wanted to keep from lit

In late 2025 I ran a small experiment. I asked four agents (Claude Code, Cursor, GitHub Copilot, Codex CLI) to write a simple counter web component from a one-line prompt. No framework hints, no AGENTS.md, just "make me a counter component as a web component."

All four produced lit-shaped code. `class Counter extends LitElement`, `@property() count = 0`, `render() { return html\`...\` }`. Three of them did it within five seconds.

That is what I wanted to keep. Not lit specifically. Lit's _shape_. The shape an agent already knows from training data.

So webjs picked off the exact API surface that an agent recognizes:

- `extends WebComponent` (in lit, `extends LitElement`)
- reactive properties declared up front (lit uses the `@property` decorator; webjs uses the `extends WebComponent({ count: Number })` factory, for the erasability reason below)
- `render() { return html\`...\` }` with the same tagged-template directive set
- `static styles = css\`...\`` for shadow DOM
- Lifecycle hooks named the same: `shouldUpdate`, `willUpdate`, `update`, `updated`, `firstUpdated`, `updateComplete`
- `ReactiveController` with `hostConnected` / `hostDisconnected` / `hostUpdate` / `hostUpdated`
- The lit-html directives that earn their place (the ones with no clean native equivalent): `repeat`, `unsafeHTML`, `live`, `keyed`, `guard`, `templateContent`, `ref`, `createRef`, `cache`, `until`, `asyncAppend`, `asyncReplace`, `watch`. The sugar-over-JS ones (`classMap`, `styleMap`, `ifDefined`, `when`, `choose`) are deliberately left out in favor of plain template expressions.

[PR #31](https://github.com/webjsdev/webjs/pull/31) is where the full parity landed. It ported 127 lit tests verbatim and watched them pass on the webjs runtime. Same exit status. The behaviors that were undefined in lit got pinned down too, because the tests covered them.


# Why I did not depend on lit

Four reasons, in order of how load-bearing each one is.

## 1. SSR

lit-ssr exists. It is a separate package (`@lit-labs/ssr`) that takes a lit template and renders it to an HTML string. It works for most cases and the lit team maintains it.

But it has structural limits that matter for webjs:

- **It does not share a code path with the client.** lit-ssr's renderer is a separate implementation that processes the same `html\`\`` templates. There is duplication, and in edge cases the server-side output and the client-side hydration disagree.

- **It does not handle light-DOM `<slot>` projection.** lit-ssr renders shadow-DOM `<slot>` correctly via Declarative Shadow DOM. Light-DOM `<slot>` projection (where the framework manually inserts projected children into the host's slot markers) is not part of lit's model. webjs wanted this to be a first-class feature ([its own blog post here](/blog/light-dom-slots-with-full-parity)).

- **Hydration is async.** lit-ssr emits the static HTML, but the client has to download `@lit/lit-element-hydrate-support`, opt in per-component, and the hydration runs as a second-pass walk after lit boots.

- **There is no built-in property-binding serialization channel.** If you write `<my-counter .data=${richObject}>` in a server-rendered template, lit-ssr drops the `.data` binding. webjs preserves it via a `data-webjs-prop-*` attribute that the client picks up before the component's `render()` runs.

What I wanted was light-DOM rendering as a first-class peer of shadow DOM, with the same `<slot>` semantics in both, sharing one code path with the client renderer. That is hard to retrofit onto an existing runtime. It is straightforward to build into one.

## 2. The decorator problem

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

The webjs alternative is the `extends WebComponent({ … })` factory:

```ts
import { WebComponent, html } from '@webjsdev/core';

class MyCounter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html`<button>${this.count}</button>`; }
}
MyCounter.register('my-counter');
```

The factory declares the reactive property and types `this.count` for you, with no decorator and no separate `declare` field. The agent learns it from `AGENTS.md` and writes it correctly thereafter.

If webjs depended on lit, we would carry the decorator path as the "main" pattern in lit's docs and have to constantly fight the divergence. By owning the runtime, the factory is the only pattern.

## 3. The AI agent reads node_modules

This is the one I keep underweighting in conversations and overweighting in practice.

The webjs framework ships as plain `.js` files with JSDoc type annotations. Not TypeScript compiled to JS, not bundled, not minified. `node_modules/@webjsdev/core/src/component.js` is a JS file with comments and JSDoc that is readable end-to-end. So is `signal.js`, `slot.js`, `render-client.js`, every other source file in the framework. The whole framework is around 30,000 lines of JS that an agent can `cat` and reason about like project code.

This is by design. The first rule of the AI-first thesis is "the file the agent reads is the file that runs." That rule applies to the framework itself, not just the user's app code. When an agent hits an unexpected behavior in webjs, it can read the framework source and figure it out. When it does not understand why `firstUpdated` fires before `updated`, it opens `component.js`, finds the update loop, reads the JSDoc above it, and gets the answer.

lit is also open source and well-documented. But the version that lands in `node_modules` is the published build: TypeScript compiled to JS with comments stripped. Reading it is doable but considerably worse than reading webjs's source, especially for an agent whose context window has to hold the relevant code.

If webjs depended on lit, every framework-internals question the agent asks about lit would route through that compiled output. The lit team has no reason to write their internal comments for a downstream AI-first framework. They are not trying to make their `node_modules` readable for agents reading apps that depend on them.

Owning the runtime means we get to write the comments.

## 4. Fine-grained control over edge cases

A few things I wanted that lit does not ship and would be hard to retrofit:

- The `data-webjs-prop-*` SSR hydration channel for property bindings on custom elements
- The MutationObserver upgrade safety net that catches components rendered before their definition loads
- The `<webjs-frame>` partial-swap region for escape-hatch updates
- The custom event-loop bookkeeping that makes our SignalWatcher integration zero-cost when a component does not read a signal

Each of these is a few hundred lines. Cumulatively they justify owning the runtime.


# What an LLM sees when it reads webjs

The component file the agent reads looks like a lit component. Same reactive properties. Same `render()`. Same `html\`\`` directive syntax. The differences are minimal:

```
- import { LitElement, html } from 'lit';
+ import { WebComponent, html } from '@webjsdev/core';

- class MyCounter extends LitElement {
+ class MyCounter extends WebComponent({ count: Number }) {

- @property() count = 0;
+ constructor() { super(); this.count = 0; }
```

The decorator import goes away because of the erasable-TypeScript invariant. The `extends WebComponent({ … })` factory is the erasable equivalent.

Everything else is the same. Lifecycle hooks. Directives. Reactive controllers. The agent writes lit-shaped code and it works.

The proof was watching a freshly-installed Claude Code session add a feature to the example blog without me telling it anything about the framework. The model was not trained on webjs. It was trained on lit, and on Next.js routing, and on Tailwind. webjs presents exactly those surfaces. So the agent wrote correct code.

The thesis is "meet agents where their priors already are." webjs is small enough to do that without inventing.


# What it cost

You give up two things by writing your own runtime.

You give up the lit team's bug fixes. If they find a memory leak in their template parser, I do not get the patch for free. I have to be tracking lit's repo to notice.

You give up some genuine cleverness in lit's implementation. Their template caching, their parts model, the way they handle slot lifecycle. It is excellent code. Writing my own version of it took weeks I would not have spent had I just imported lit.

The size delta is also real. lit ships about 20 KB minified + gzipped for the full LitElement + lit-html bundle. webjs's `@webjsdev/core` is about 30 KB for the equivalent feature set plus the slot-projection logic, the partial-swap-frame element, the client router, and the property-binding SSR channel. webjs is bigger because it includes things lit treats as separate packages (the router, the SSR pipeline, the slot host, the live-reload SSE client). lit users assemble these from `@lit-labs/*` packages or third-party libraries. webjs ships them in one.

The trade-off is fewer dependencies to manage, fewer version-mismatch debugging sessions, smaller dependency graph in the user's `package-lock.json`. For an AI-first framework where the agent has to reason about the runtime, one cohesive module is easier than six related packages.


# What if lit ships SSR + light-DOM slots tomorrow

If lit shipped full SSR with light-DOM `<slot>` parity and no separate hydration support package, the cost-benefit of owning the runtime would tip the other way. webjs would consider importing lit instead.

It has been roughly two years since lit-ssr stabilized and the design has not moved in that direction. The lit team has signaled that shadow-DOM-with-DSD is their model and they do not plan to support framework-owned light-DOM slot projection. That is a defensible architectural choice; it is just not webjs's choice.

If the situation changes, refactoring webjs to use lit underneath is a finite amount of work. The public API is already lit-shaped. The migration would be in the framework's internals, not in user code.


# Not a dig at lit

Worth noting: this is not lit-vs-webjs as products. lit is great. The lit team has built a careful, principled web-components library. If you do not need SSR, do not need light-DOM slots, do not mind decorators, and do not want a full-stack framework wrapper, just use lit.

webjs is for the case where you want SSR + light-DOM slots + an AI-first contract + the rest of the framework (routing, server actions, auth, sessions, etc.) in one cohesive thing. Owning the runtime is one of the necessary conditions to deliver that, not a goal in itself.


# Reading the actual implementation

The webjs component runtime starts at [`packages/core/src/component.js`](https://github.com/webjsdev/webjs/blob/main/packages/core/src/component.js). It is the most-changed file in the repo. Most design decisions have a commit message that says why.

The SSR walker is at `render-server.js`. The client renderer is `render-client.js`. The slot runtime is `slot.js`. These are the four files that would be the most-changed if webjs ever depended on lit instead. They are also the four files that explain why it does not.

The lit-parity test suite (127 tests ported verbatim from lit's repo with one-line import changes) is in `packages/core/test/lit-parity/`. When lit adds a feature, we look at whether it makes sense in webjs's model and port it if so. We are not slavishly tracking, but we stay close.
