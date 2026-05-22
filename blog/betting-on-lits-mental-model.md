---
title: "Betting on lit's mental model (without depending on lit)"
date: 2026-02-08T11:00:00+05:30
slug: betting-on-lits-mental-model
description: "Why webjs ships a custom component runtime with an API that mirrors lit's, what that buys, and what it costs."
tags: components, lit-parity, runtime, ai-first
author: Vivek
---

The most-asked question I get about webjs is some version of: "if you wanted lit's API, why didn't you just use lit?"

I considered it. The runtime lives in `node_modules/@webjsdev/core/src/` and you can read every byte of it. The component class, the reactive controllers, the lifecycle hooks, the directives. It is roughly two thousand lines of plain JS with JSDoc types. lit is more lines, more abstractions, but most of those are about doing the same thing.

I went with a custom runtime anyway. Here is the math.

# What lit's API gets you for free

In late 2025 I ran a small experiment. I asked four agents (Claude Code, Cursor, GitHub Copilot, Codex CLI) to write a simple counter web component from a one-line prompt. No framework hints, no AGENTS.md, just "make me a counter component as a web component."

All four produced lit-shaped code. `class Counter extends LitElement`, `@property() count = 0`, `render() { return html\`...\` }`. Three of them did it within five seconds. Not because lit is the only web-components library. Because lit's API is what the corpus weighted toward.

That is what I wanted to keep. Not lit specifically. Lit's _shape_. The shape an agent already knows.

So webjs picked off the exact API surface that an agent recognizes:

- `extends WebComponent` (in lit: `extends LitElement`)
- `static properties = { count: { type: Number } }`
- `render() { return html\`...\` }` with the same tagged-template directive set
- `static styles = css\`...\`` for shadow DOM
- Lifecycle hooks named exactly the same: `shouldUpdate`, `willUpdate`, `update`, `updated`, `firstUpdated`, `updateComplete`
- `ReactiveController` with `hostConnected` / `hostDisconnected` / `hostUpdate` / `hostUpdated`
- The full lit-html directive set: `repeat`, `unsafeHTML`, `live`, `keyed`, `guard`, `templateContent`, `ref`, `createRef`, `cache`, `until`, `asyncAppend`, `asyncReplace`

The version of webjs that landed full parity ([PR #31](https://github.com/webjsdev/webjs/pull/31)) ported 127 lit tests verbatim and watched them pass on the webjs runtime. Same exit status. The behaviors that were undefined in lit got pinned down too, because the tests covered them.

# What the parity costs

You give up two things by writing your own runtime.

First, you give up the lit team's bug fixes. If they find a memory leak in their template parser, I do not get the patch for free. I have to be tracking lit's repo to notice.

Second, you give up some genuine cleverness in lit's implementation. Their template caching, their parts model, the way they handle `<slot>` lifecycle. It is excellent code. Writing my own version of it took weeks I would not have spent if I had just imported lit.

The reason I did it anyway comes down to one thing: SSR.

lit-ssr exists. It works. But it is a side-bolted artifact that does not share a code path with the client renderer, and the SSR story for `<slot>` in light DOM is incomplete. I needed light-DOM rendering to be a first-class peer of shadow DOM, with the same `<slot>` semantics in both. That is hard to retrofit onto an existing runtime. It is straightforward to build into one.

Concretely, webjs's `render()` runs server-side without any DOM, produces a string, and gets the same component tree the client would draw. Light-DOM children project through `<slot>` whether the component is shadow or light. lit ships none of that.

The other thing is fine-grained control over edge cases that matter to AI agents. The `data-webjs-prop-*` SSR hydration channel for property bindings on custom elements. The MutationObserver upgrade safety net that catches components rendered before their definition loads. The `<webjs-frame>` partial-swap region for escape-hatch updates. Each of these is a few hundred lines. Cumulatively they justify owning the runtime.

# What an LLM sees when it reads webjs

The component file the agent reads looks like a lit component. Same `static properties`. Same `render()`. Same `html\`\`` directive syntax. The only differences are:

```
- import { LitElement, html } from 'lit';
+ import { WebComponent, html } from '@webjsdev/core';

- @property() count = 0;
+ static properties = { count: { type: Number } };
+ declare count: number;
+ constructor() { super(); this.count = 0; }
```

The decorator import goes away because [webjs invariant 10](https://github.com/webjsdev/webjs/blob/main/AGENTS.md) requires erasable TypeScript (Node 24's built-in stripper does not support decorators with `emitDecoratorMetadata`). The `declare` + `static properties` + constructor pattern is the erasable equivalent. It is one extra line per reactive property, which the model has no trouble with once it has seen the convention in `AGENTS.md`.

Everything else is the same. Lifecycle hooks. Directives. Reactive controllers. The agent writes lit-shaped code and it works.

# Why the bet was right

The proof was watching a freshly-installed Claude Code session add a feature to the example blog without me telling it anything about the framework. The model was not trained on webjs (it could not have been; the repo is small and the package is new). It was trained on lit, and on Next.js routing, and on Tailwind. webjs presents exactly those surfaces. So the agent wrote correct code.

That is the whole pitch. Not "agents will adapt to whatever framework you throw at them." They will, eventually, with enough docs and enough corrections. But the cheap thing is to meet them where their priors already are.

# What I am still figuring out

The lit-parity is at the API surface level. The internals diverge. Most of the time that is invisible, but every few weeks I find an edge case where a developer who knows lit reaches for something the agent does not, and webjs does not implement it. The `LitElementClass.finalize()` static. Some of the `TemplatePart` internals. The exact timing of `updateComplete` resolution under async controller hooks.

I add what people actually use. I do not promise that everything lit supports works in webjs. That is the price of owning the runtime.

If you want to read the actual implementation, it starts at [`packages/core/src/component.js`](https://github.com/webjsdev/webjs/blob/main/packages/core/src/component.js). It is the most-changed file in the repo. Most of the design decisions have a commit message that says why.
