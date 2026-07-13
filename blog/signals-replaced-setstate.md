---
title: "TC39 Signals vs setState in Web Components"
date: 2026-05-21T16:57:26+05:30
slug: signals-replaced-setstate
description: "Why WebJs deleted its setState/this.state API and went all-in on TC39 Stage 1 Signals. What it broke, what shipped instead, and the breaking-change recipe."
tags: signals, reactive, breaking-change, components
author: Vivek
---

If you have written React, you know the ritual. You call `setState` (or a `useState` setter), and the component re-renders. WebJs used to work the same way, with `this.state` and `this.setState({ ... })`. Then it deleted that whole API and replaced it with signals (wrapped values you read with `.get()` and write with `.set()`, and the UI updates itself). Here is why I made that call, what it broke, and how the migration went.

The most disruptive change to WebJs since launch was that signals migration, in commit `6e50ae6` (PR #43). It removed an entire framework-custom API surface. Every component using `this.state` or `this.setState({ ... })` had to be rewritten. I would not normally take a swing this big.

I did it anyway because the platform is shipping signals, and building a custom reactivity model that we would have to migrate away from later was paying technical debt twice.


# What got deleted

Two methods, one property bag. The base `WebComponent` had:

```ts
this.state = { count: 0 };
this.setState({ count: this.state.count + 1 });
```

setState batched updates, merged the partial bag into `this.state`, and scheduled a re-render. About 80 lines of code in `component.js`, plus the `changedProperties` Map tracking that the lifecycle hooks read.

All of it is gone. `this.state` does not exist. `this.setState` is not a method. The framework's `webjs check` lint refuses code that still references either.


# What the new primitive looks like

Signals are wrapped values with `.get()` and `.set()`:

```ts
import { signal, computed } from '@webjsdev/core';

const count = signal(0);
const doubled = computed(() => count.get() * 2);

count.set(count.get() + 1);
```

The implementation lives in `packages/core/src/signal.js`. It is a hand-rolled push-pull hybrid that matches the [TC39 Signals proposal](https://github.com/tc39/proposal-signals) (TC39 is the committee that standardizes JavaScript) Stage 1 shape, including `Signal.subtle.untrack`, `Signal.State`, `Signal.Computed`, and the `Watcher` class. When the proposal lands in browsers, the WebJs `signal()` is intended to become a one-line re-export of `globalThis.Signal.State`.

The algorithm is what the spec-shaped signal-polyfill uses. Each producer (State or Computed) carries a `version` that bumps when the value actually changes (`Object.is` comparison). Consumers record the version they saw at read time. On the next read, the consumer polls each producer's version: same number means no recompute needed. This is what makes diamond dependencies glitch-free and memoizes the common case where a computed's output is unchanged.


# How the integration works

Every `WebComponent` ships with a built-in `Signal.subtle.Watcher`. The default `update()` wraps `render()` in `watcher.observe(...)`, so any signal read inside `render()` registers as a dependency. When any read signal changes, the watcher's `notify` calls `requestUpdate()` and the component re-renders through the normal lifecycle.

```ts
const count = signal(0);

class Counter extends WebComponent {
  render() {
    return html`<button @click=${() => count.set(count.get() + 1)}>${count.get()}</button>`;
  }
}
```

Three properties of this matter for the user:

The watcher is lazy-allocated. Components that never read a signal pay nothing beyond an unused property slot.

Dependency tracking is dynamic. `observe()` clears prior dep edges before each render, so signals that fall out of the current control flow drop out of the dep set on the next render.

`disconnectedCallback` disposes the watcher, breaking the reference cycle between the element and any module-scope signals it was tracking. No leaks.


# The watch() directive for fine-grained reactivity

The component-level integration above re-renders the whole component when any read signal changes. That is the right default. But sometimes you want only ONE template hole to update, not the whole render. That is what the `watch()` directive is for:

```ts
import { html } from '@webjsdev/core';
import { watch } from '@webjsdev/core/directives';

class Counter extends WebComponent {
  render() {
    return html`<p>Count: ${watch(count)}</p>`;
  }
}
```

When `count.set(...)` fires, only the text inside the `<p>` updates. No `render()` invocation, no lifecycle hooks, no diff over the rest of the template. The directive owns a per-part `Signal.subtle.Watcher` that maintains the subscription.

SSR (server-side rendering) inlines the signal's current value once. Subscription is a client-only concern.


# What the migration looked like in the framework's own code

The PR removed setState references from:

- `packages/core/src/component.js` (the base class)
- The `Task` controller (`packages/core/src/task.js`)
- The `Context` provider/consumer (`packages/core/src/context.js`)
- All tests across `packages/core/test/`
- AGENTS.md, the skill at `.agents/skills/webjs/`, and the framework's docs site

The `@webjsdev/ui` library's `sonner` toast component used setState; it was rewritten to use instance signals. The `<webjs-frame>` element used setState; same treatment. The `examples/blog` app's counter, theme-toggle, and chat-box were all migrated.

The breaking-change marker (`!` in the conventional-commit prefix) made the version bump explicit: `@webjsdev/core` went `0.6.x → 0.7.0`.


# What replaced reactive properties

Reactive properties are still in the API, declared via the `extends WebComponent({ … })` factory. They are now reserved for declared HTML attributes that should round-trip from the DOM. If a component is `<my-counter count="5">` and declares `class Counter extends WebComponent({ count: Number })`, the browser-set attribute initializes the property. Useful, and signals do not replace it.

For component-local state that does not need to ride an HTML attribute, the answer is an instance signal:

```ts
class Counter extends WebComponent {
  count = signal(0);
  render() {
    return html`<button @click=${() => this.count.set(this.count.get() + 1)}>${this.count.get()}</button>`;
  }
}
```

For state shared across components, a module-scope signal:

```ts
// modules/cart/state.ts
import { signal } from '@webjsdev/core';
export const items = signal<Item[]>([]);
```

Both components that `import { items }` and read `items.get()` inside their render automatically re-render when `items.set(...)` fires. No context provider, no event bus, no props plumbing.

There is one SSR caveat the comment block in `signal.js` is explicit about: a module-scope signal in a server module lives for the lifetime of the Node process, so it would leak state across requests. Keep module-scope signals in browser-only modules (or `*.client.ts` if you want the path to advertise it). Server-side request-scoped state goes through the framework's request-context primitives.


# What ships in the test suite

The signals integration is covered by:

- `packages/core/test/signals/signal.test.js` (10 unit tests on the primitive)
- `packages/core/test/signals/signal-ssr.test.js` (7 SSR-rendering tests)
- `packages/core/test/signals/signal-spec-conformance.test.js` (19 tests asserting TC39-shape compliance)
- `packages/core/test/signals/browser/signal-component.test.js` (component re-render on signal change)
- `packages/core/test/signals/browser/signal-hydration.test.js` (signal-driven hydration)
- `packages/core/test/signals/browser/signal-slot-integration.test.js` (signals inside slotted children)
- `packages/core/test/signals/browser/watch-directive.test.js` (the fine-grained watch directive)

The spec-conformance tests are ported from the signal-polyfill repo with one-line import changes. They check things like diamond-dependency glitch freedom, untracked reads, batch semantics under nesting.


# Two things stand out

Two things stand out.

The first is that the SignalWatcher trick (auto-subscribe inside render, auto-cleanup on disconnect) was the missing piece that made signals feel as ergonomic as the React-style setState. Without it, every component would have to manually create an effect that calls `requestUpdate`. With it, you just read the signal in render and the framework handles the wiring. That part is at the top of `component.js`'s update path.

The second is that platform-tracking pays. The TC39 proposal was Stage 1 when this work landed. It is still Stage 1. But the shape has not changed in the relevant ways. The signal-polyfill that the proposal authors maintain is what WebJs's algorithm mirrors. When the proposal lands in V8, our `signal.js` shrinks to a re-export and every user keeps working.

The breaking change was worth it. We carry one API now, not two. The agent does not have to model both setState's behavior and signal's behavior, just one. And when someone asks "what is the reactivity primitive in WebJs?" the answer is "signals, the TC39 shape." Anyone who has read about the proposal already knows how it works.
