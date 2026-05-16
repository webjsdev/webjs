# WebComponent — deep dive

## Property options — full detail

| Option | Type | Default | Meaning |
|---|---|---|---|
| `type` | `Number\|String\|Boolean\|Object\|Array` | `String` | Used by the default attribute converter |
| `reflect` | `boolean` | `false` | Property changes write back to the HTML attribute |
| `state` | `boolean` | `false` | Internal-only — no attribute, not in `observedAttributes` |
| `hasChanged` | `(newVal, oldVal) => boolean` | strict `!==` | Custom change detection |
| `converter` | `{ fromAttribute?, toAttribute? }` | type-based | Custom attribute ↔ property serialization |

Built-in constructors (`String`, `Number`, `Boolean`, `Array`, `Object`) feed
the default attribute coercion. For anything the default can't parse correctly
(Date, Map, Set, discriminated unions) supply a custom `converter`.

## Why `declare` is required in TypeScript

The framework installs reactive getter/setter on `this` inside the
constructor via `Object.defineProperty`. Without `declare`, TypeScript
emits `student = undefined` after `super()` — which under modern class-
field semantics uses `[[Define]]` to overwrite the accessor. Result:
`this.student = …` no longer goes through the setter, no `requestUpdate`,
no `hasChanged`, no reflect — reactivity silently breaks.

The `.d.ts` overlay shipped with the framework makes every other class
member fully typed — only the reactive properties need the `declare`
line, and only in TypeScript files.

## ReactiveControllers — composable lifecycle

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

## Light DOM (default) vs Shadow DOM (opt-in) — full detail

Light DOM is the default because global CSS and Tailwind utility classes
apply directly — no `::part`, no `:host`, no CSS-var plumbing, no
`adoptedStyleSheets` needed. The browser renders a plain element with
normal children, and hydration replaces SSR content in place.

| Use case | Mode | How |
|---|---|---|
| Global / Tailwind CSS, simple composition | **Light DOM** (default) | Just use `class="..."` in your `html\`...\`` template |
| Scoped styles via `static styles = css\`\`` | Shadow DOM | Set `static shadow = true`. `adoptedStyleSheets` + bare selectors are scoped |
| `<slot>` content projection | Shadow DOM | Slots only exist inside shadow roots |
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
// Pattern A — BEM-ish class names prefixed with tag
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

// Pattern B — descendant selector rooted at the tag
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

Prefer Tailwind utility classes first — they're unique by construction.
Drop down to custom CSS only when Tailwind can't express it.

### When to opt in to shadow DOM

Set `static shadow = true` when:
- You author styles via `static styles = css\`...\`` and want them
  `adoptedStyleSheets`-scoped without a prefix discipline.
- You need `<slot>` to project children (`::slotted`, named slots).
- You're publishing a component for third parties who won't have your
  Tailwind build, and you need the embed to look right in any host.

`static styles` on a light-DOM component is silently ignored.

## Helper methods

| Method | Purpose |
|---|---|
| `this.setState({...})` | Batched state update via microtask |
| `this.requestUpdate()` | Manually schedule a re-render (controllers) |
| `this.shadowRoot.querySelector(sel)` | Query shadow DOM (native API) |
