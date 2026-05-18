# WebComponent deep-dive

## Property options in full detail

| Option | Type | Default | Meaning |
|---|---|---|---|
| `type` | `Number\|String\|Boolean\|Object\|Array` | `String` | Used by the default attribute converter |
| `reflect` | `boolean` | `false` | Property changes write back to the HTML attribute |
| `state` | `boolean` | `false` | Internal-only. No attribute, not in `observedAttributes` |
| `hasChanged` | `(newVal, oldVal) => boolean` | strict `!==` | Custom change detection |
| `converter` | `{ fromAttribute?, toAttribute? }` | type-based | Custom attribute ↔ property serialization |

Built-in constructors (`String`, `Number`, `Boolean`, `Array`, `Object`) feed
the default attribute coercion. For anything the default can't parse correctly
(Date, Map, Set, discriminated unions) supply a custom `converter`.

## Why `declare` is required in TypeScript

The framework installs reactive getter/setter on `this` inside the
constructor via `Object.defineProperty`. Without `declare`, TypeScript
emits `student = undefined` after `super()`, which under modern class-
field semantics uses `[[Define]]` to overwrite the accessor. Result:
`this.student = …` no longer goes through the setter, no `requestUpdate`,
no `hasChanged`, no reflect, and reactivity silently breaks.

The `.d.ts` overlay shipped with the framework makes every other class
member fully typed, so only the reactive properties need the `declare`
line, and only in TypeScript files.

## ReactiveControllers: composable lifecycle

```js
class FetchController {
  constructor(host, url) {
    this.host = host;
    this.url = url;
    this.data = null;
    host.addController(this);     // ← register
  }
  async onMount() {
    this.data = await (await fetch(this.url)).json();
    this.host.requestUpdate();
  }
  onUnmount() { /* cleanup */ }
}

class MyEl extends WebComponent {
  #users = new FetchController(this, '/api/users');
  render() { return html`${this.#users.data?.length} users`; }
}
```

Use controllers when the same lifecycle logic (fetch, timer, subscription,
resize observer) is needed in multiple unrelated components. The built-in
`Task`, `ContextProvider`, and `ContextConsumer` are all controllers.

## Light DOM (default) vs Shadow DOM (opt-in), full detail

Light DOM is the default because global CSS and Tailwind utility classes
apply directly, with no `::part`, no `:host`, no CSS-var plumbing, no
`adoptedStyleSheets` needed. The browser renders a plain element with
normal children, and hydration replaces SSR content in place.

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Just use `class="..."` in your `html\`...\`` template |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` + bare selectors are scoped |
| `<slot>` content projection | **Both** | Same `<slot>` / `<slot name="x">` syntax. Light DOM uses framework projection; shadow DOM uses native browser projection. Full spec parity in both modes (see "Slots" section below). |
| Third-party embeds needing isolation | Shadow DOM | CSS can't leak in or out |

Both modes are fully SSR'd (shadow DOM via Declarative Shadow DOM, light
DOM as direct HTML with a `<!--webjs-hydrate-->` marker) and hydrate
without flash on the client.

### Class-prefix rule for light-DOM components

If a light-DOM component authors its own custom CSS (a `<style>` block
inside `render()`, or an imported stylesheet), every class selector MUST
be prefixed with the component's tag name. Pick one of these two
patterns per component:

```ts
// Pattern A: BEM-ish class names prefixed with tag
class MyCard extends WebComponent {
  render() {
    return html`
      <style>
        .my-card__body { padding: 16px; }
        .my-card__title { font-weight: 600; }
      </style>
      <div class="my-card__body">
        <h3 class="my-card__title"><slot name="title"></slot></h3>
      </div>
    `;
  }
}

// Pattern B: descendant selector rooted at the tag
class MyCard extends WebComponent {
  render() {
    return html`
      <style>
        my-card .body  { padding: 16px; }
        my-card .title { font-weight: 600; }
      </style>
      <div class="body">
        <h3 class="title"><slot name="title"></slot></h3>
      </div>
    `;
  }
}
```

Prefer Tailwind utility classes first. They're unique by construction.
Drop down to custom CSS only when Tailwind can't express it.

### When to opt in to shadow DOM

Set `static shadow = true` when:
- You author styles via `static styles = css\`...\`` and want them
  `adoptedStyleSheets`-scoped without a prefix discipline.
- You're publishing a component for third parties who won't have your
  Tailwind build, and you need the embed to look right in any host.
- You want the browser's built-in `::slotted()` CSS selector for
  styling projected children from inside the shadow tree.

Slots themselves are no longer a reason to opt into shadow DOM. The
same `<slot>` / `<slot name="x">` syntax works in light DOM with full
shadow-DOM spec parity (`assignedNodes`, `assignedElements`,
`assignedSlot`, `slotchange`, named slots, fallback content, first-wins
resolution). See the "Slots" section below.

`static styles` on a light-DOM component is silently ignored.

## Slots: full shadow-DOM parity in both DOM modes

webjs supports the entire shadow-DOM `<slot>` surface in light DOM. The
same `render()` template projects children identically whether your
component declares `static shadow = true` or leaves it at the default
`false`. Migrating between modes never requires a template rewrite.

### Syntax

```ts
class MyCard extends WebComponent {
  // static shadow defaults to false. Either value works for everything
  // below.
  render() {
    return html`
      <header><slot name="header"></slot></header>
      <main><slot></slot></main>
      <footer><slot name="footer">no actions</slot></footer>
    `;
  }
}
MyCard.register('my-card');
```

Author markup:

```html
<my-card>
  <h2 slot="header">Title</h2>
  <p>Body content</p>
  <p>More body content</p>
  <button slot="footer">Save</button>
</my-card>
```

The `<h2>` projects into the `header` slot, both `<p>` elements into the
default slot in source order, and the `<button>` into the `footer` slot.

### Default slot

A `<slot>` without a `name` attribute receives all authored children
without a `slot=""` attribute. Text nodes, comments, and whitespace also
route to the default slot.

```ts
class Wrapper extends WebComponent {
  render() { return html`<div><slot></slot></div>`; }
}
```

```html
<wrapper>
  Plain text
  <p>An element</p>
  <!-- a comment -->
</wrapper>
```

### Named slot

`<slot name="x">` receives authored children with `slot="x"`. A child
with `slot=""` (empty string) routes to the default slot, matching the
shadow-DOM spec.

### Fallback content

A slot's authored inner content is its fallback. If no children match
the slot, the fallback renders.

```ts
render() { return html`<slot name="actions">no actions</slot>`; }
```

When no `slot="actions"` child is provided, the slot shows "no actions".
When projection happens, the fallback is replaced by the projected
content.

### First-wins resolution

Multiple slots with the same `name` (or multiple default slots) are
permitted. Per shadow-DOM spec, the first one in document order receives
the assignment; subsequent same-named slots show their fallback content.

```ts
render() {
  return html`
    <slot name="title">Untitled</slot>
    <slot name="title">never shown</slot>
  `;
}
```

### Dynamic slot name and child slot attribute

A slot's `name` attribute can be a template hole. Re-projection happens
automatically when the value changes. Likewise, a child's `slot=""`
attribute can change at runtime; the child re-routes to the new slot.

```ts
render() {
  return html`<slot name=${this.section}></slot>`;
}
```

### DOM API

Every shadow-DOM slot API is mirrored on light-DOM slots:

| API | Returns |
|---|---|
| `slot.assignedNodes(options?)` | Projected nodes in source order; empty array when slot shows fallback |
| `slot.assignedNodes({ flatten: true })` | Recursively unwraps nested forwarding slots to the leaf nodes |
| `slot.assignedElements(options?)` | Element-only filter of `assignedNodes` |
| `element.assignedSlot` | Returns the slot a child is projected into, or `null` |
| `slotchange` event | Fires on a slot when its assigned-node set actually changes (with equality detection to avoid no-op fires) |

The polyfills are gated on a `data-webjs-light` attribute that the
framework places on its slots, so the polyfill never interferes with
real shadow-DOM slots elsewhere on the page.

### SSR + hydration

Both modes are SSR'd:

- **Light DOM.** The server emits projected children directly inside
  `<slot data-webjs-light data-projection="actual">` elements. Without
  JavaScript, the page renders correctly because the projection is
  baked into the HTML. On hydration the framework adopts the SSR-placed
  Node references; DOM identity (event listeners, focus, scroll, input
  values) survives the round-trip.
- **Shadow DOM.** The server emits Declarative Shadow DOM
  (`<template shadowrootmode="open">…<slot>…</slot>…</template>`). The
  browser opens the shadow root on parse and projects natively, again
  without JavaScript.

### Slot inside conditionals and lists

A slot can live inside any `html\`\`` template fragment: conditional
ternaries, `${repeat()}` iterations, async `Task` results. When a slot
disappears (e.g., its containing template collapses), the projected
children move to a per-host pending map and re-attach with DOM identity
preserved when the slot reappears.

```ts
render() {
  return html`
    <div>
      ${this.expanded
        ? html`<section><slot></slot></section>`
        : html`<i>collapsed</i>`}
    </div>
  `;
}
```

Toggling `this.expanded` between true and false preserves the projected
child Node references.

### Composition with Suspense

A slot composes naturally with `Suspense`. Authored children that
include `${Suspense({ fallback, children })}` project the fallback HTML
into the slot at SSR time; when the children promise resolves and
streams in, the `data-webjs-resolve` swap targets the
`<webjs-boundary>` element which lives inside the slot, updating the
slot's content in place.

## Helper methods

| Method | Purpose |
|---|---|
| `this.setState({...})` | Batched state update via microtask |
| `this.requestUpdate()` | Manually schedule a re-render (controllers) |
| `this.shadowRoot.querySelector(sel)` | Query shadow DOM (native API) |
