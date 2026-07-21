---
title: "Light-DOM Slots in Web Components (With Full Shadow-DOM Parity)"
date: 2025-12-30T16:00:00+05:30
slug: light-dom-slots-with-full-parity
description: "Light-DOM slots in web components with full shadow-DOM parity. WebJs ships named slots, fallback content, assignedNodes, and slotchange with no shadow DOM required."
tags: components, slots, light-dom, shadow-dom
author: Vivek
---

Slots are how you let whoever uses your component drop their own content inside it, the way you pass children into a wrapper. Almost every tutorial ties them to shadow DOM (the isolated DOM subtree a custom element attaches to itself), and that is the part I wanted to get away from.

When you read web-components docs anywhere on the internet, `<slot>` is described as a shadow-DOM thing. The browser only resolves slots inside a shadow root. If you write a custom element with `static shadow = false` (the WebJs default), the `<slot>` tag is just a meaningless element. Children dropped between the tags sit there as plain DOM. There is no projection (nothing moves those children into the slot's position).

This is correct as the platform stands. It is also limiting in a specific way that hurts an AI-first framework where pages and components are written in the same light-DOM (the normal page DOM, with no shadow root) Tailwind idiom.


# Why the limit hurts

The platform model says you trade scoping for projection. If you want `<slot>` semantics, you opt into shadow DOM. Shadow DOM gives you scoped styles and isolated subtrees, but it also breaks every external stylesheet. Tailwind utility classes do not cross the shadow boundary. The global typography in the layout does not cascade in. Page-wide CSS variables work, but `body { font: ... }` does not.

For agents writing components, that boundary is a sharp cliff. A component opts into shadow DOM for one feature, suddenly its typography breaks, and the agent has to redefine the theme via `:host` and `--css-vars`. The mental model fragments.

The shape I wanted: light DOM by default, with full `<slot>` semantics. Tailwind classes still apply to slotted children, global styles still cascade, and the slot APIs work everywhere.


# What "full parity" means concretely

The light-DOM slot runtime in `packages/core/src/slot.js` (the docstring at the top spells out the design) supports:

- Default slot: `<slot></slot>` projecting unnamed children.
- Named slots: `<slot name="header"></slot>` projecting `<div slot="header">`.
- Fallback content: `<slot>shown when nothing is provided</slot>`.
- `slotElement.assignedNodes()`, `assignedNodes({ flatten: true })`, `assignedElements()`.
- `node.assignedSlot` returning the slot the element projects into.
- The `slotchange` event firing when projected children change.
- First-wins resolution: a child that could match multiple slots picks the first.
- Server-side rendering: slot resolution runs at SSR time so projected children appear in their final positions in the initial HTML response.

The DOM API surface is exposed via polyfills (code that supplies a browser API the platform does not provide here) on `HTMLSlotElement.prototype` and `Element.prototype`. The polyfill is gated: every patched method first checks for the `data-webjs-light` attribute on the target slot. If absent (real shadow-DOM slot or a non-webjs custom element), the patch falls through to the saved native implementation. Real shadow-DOM slots elsewhere on the page keep their native behaviour exactly.

The module is import-safe in Node. Polyfill setup is guarded on `typeof HTMLSlotElement !== 'undefined'`. The server pipeline imports `slot.js` for the constants and helpers without crashing.


# How a render flows through it

The framework owns the lifecycle of a slot host. When a WebJs component connects:

1. `captureAuthoredChildren(host)` snapshots the original children before render fires.
2. `render()` produces a template that may contain `<slot>` elements (or `<slot name="x">`).
3. The renderer walks the output. For each slot, it looks up matching children from the snapshot. Default slot matches unnamed children. Named slot matches children whose `slot=""` attribute equals the slot's name.
4. Matched children get moved into the slot's position. Unmatched children stay connected but unrendered inside a hidden holding element (matching shadow-DOM semantics for unassigned slottables).
5. Fallback content inside the slot tag stays put if no child matched. `data-projection="fallback"` flags this state.
6. Runtime liveness rides the component's own writer, never a node-moving observer: the host's mutating DOM methods are intercepted to update the record, two read-only sensors catch raw bypass writes and `slot=` attribute flips, and a self-heal step folds in what a parent template or a library legitimately wrote inside an actively assigned slot (fallback content stays renderer-owned). When an assignment actually changes, `slotchange` fires with native async-coalesced timing.


# The SSR piece

Because slot resolution runs in the renderer, server-side rendering produces the final DOM tree directly. No hydration step (the browser re-running component JavaScript to wire up the server HTML) is required to fix the slot projection. The HTML that arrives in the browser already has slotted children in their final positions.

This matters for progressive enhancement (the page still working with JavaScript switched off). If a user has JavaScript disabled, a WebJs component with light-DOM slots still displays its slotted content correctly. The component is just a styled wrapper with the slotted nodes projected into the right place. No JS required for the layout to be correct.

In shadow DOM that win exists too (via Declarative Shadow DOM, shadow DOM written straight into the HTML so the server can render it), but DSD has uneven browser support and serializes differently. The light-DOM path just produces HTML the browser already knows how to display.


# What it looks like in practice

```ts
import { WebComponent, html } from '@webjsdev/core';

class Card extends WebComponent {
  // Light DOM is the default. Tailwind classes apply to projected children.
  render() {
    return html`
      <article class="rounded-lg border border-border p-4 bg-bg-elev">
        <header class="font-semibold text-fg mb-2">
          <slot name="title">Untitled</slot>
        </header>
        <div class="text-fg-muted text-sm">
          <slot></slot>
        </div>
      </article>
    `;
  }
}
Card.register('my-card');
```

Used in a page:

```ts
return html`
  <my-card>
    <span slot="title">Quarterly report</span>
    <p>Revenue is up. Costs are flat. We are profitable.</p>
  </my-card>
`;
```

The rendered HTML has the title in the header position, the paragraph in the body. The Tailwind classes (`text-fg-muted`, `text-sm`) inherit through. The card's border styles cascade in from the global theme. The agent does not have to think about scopes, CSS-var bridging, or shadow piercing.


# The cross-file coordination

The slot runtime is not all in one file. Two pieces of behavior live partly in `slot.js` and partly in `render-client.js`, and the slot module's docstring is explicit about it:

1. Fallback content restoration. When a slot transitions to `data-projection="fallback"`, `slot.js` clears the actual-assigned children. The slot-part's apply step in `render-client.js` restores the compiled fallback template into the slot.

2. Slot-part teardown when a slot is removed from the DOM (because it was inside a conditional that collapsed). `render-client.js` calls `rescueAssignedNodes()` before removing the slot, so its assigned children survive as record-held values, re-projected when a matching slot next renders.

These were the bugs that took the longest to find. The slot lifecycle and the template-part lifecycle had to coordinate without either owning the other. The current shape is the result of several rounds of fixing things that broke at the boundary.


# The bug that made me rebuild this once

PR #44 (commit `272d417`, titled "fix(core): filter framework records in light-DOM slot observer") was a slot-related bug fix. The MutationObserver in the slot host was firing `slotchange` for the framework's own internal DOM operations. When the framework re-rendered a component, it ran child-list mutations (creating instances, swapping template parts) that the observer interpreted as the user changing slot content.

The bug surfaced as infinite re-render loops in components that read `assignedNodes()` inside `render()`. The render mutates the DOM, the observer fires, the framework schedules another render, repeat.

The fix was to tag framework-driven mutations with a sentinel and filter them in the observer callback. The fix had been latent for weeks because none of the example components used `assignedNodes()` in render. The first user-built component that did, hit the loop immediately.

I keep this in mind when adding new framework features. Owning the runtime means owning the failure modes. Most users will never hit them, but the few who do hit them hard.


# Why other frameworks do not ship this

lit's `<slot>` works inside shadow roots, full stop. lit-ssr respects Declarative Shadow DOM for shadow components. Neither lit nor lit-ssr does light-DOM projection.

Stencil has a light-DOM-slot polyfill, but with documented gaps around fallback content and the mixed-tree case where some components in the tree use shadow DOM and others use light.

As far as I have found, no other web-components framework ships the full slot surface in light DOM. The work is non-trivial (the cross-file coordination above is real), and most frameworks default to shadow DOM, so the demand has not been there.


# What this enables for the ecosystem

The library that benefits most is `@webjsdev/ui`, the component kit. About a third of the tier-2 components (`<ui-dialog>`, `<ui-tabs>`, `<ui-tooltip>`, `<ui-dropdown-menu>`, etc.) use slot projection for content. Because they are light DOM with slot support, Tailwind classes the user applies to slotted children still work. No CSS-var translation layer needed.

The example components in `examples/blog/` follow the same pattern. The chat box, the post composer, the new-post form, all use light-DOM `<slot>` for the user's content. The agent does not need to think about scope.

If you read the framework's documentation page on components, this is the single most-discussed feature. People who have been writing web components for years did not realize it was possible to have light-DOM `<slot>` work the way they wanted. It is, and it has been since merge `fa4b921` (PR #8) landed.
