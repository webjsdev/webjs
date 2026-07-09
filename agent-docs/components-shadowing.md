# Component member shadowing: names a WebComponent must not reuse

A `WebComponent` inherits two layers of members. In the browser it extends
`HTMLElement` (so every DOM property and method is present), and it extends the
framework base that owns the reactivity lifecycle (`render`, `update`,
`requestUpdate`, and the lit-aligned hooks). SSR swaps `HTMLElement` for an
`ElementShim`-style stand-in with the same public surface. When app code
declares a reactive property (via the `WebComponent({ ... })` factory) or a
method whose NAME collides with one of those inherited members, one of two
things happens.

- **Type-incompatible collision.** TypeScript refuses the class. A reactive
  property that shadows a native property of a different type raises **`TS2415`**
  on the `class X extends WebComponent({ ... })` line ("Class 'X' incorrectly
  extends base class ...; types of property 'y' are incompatible"). A method or
  field in the class body whose signature differs from the inherited one raises
  **`TS2416`** on that member ("Property 'y' in type 'X' is not assignable to the
  same property in base type").
- **Type-compatible collision.** It compiles, then silently hijacks the native
  member at runtime (a `title` reactive prop overrides the element's tooltip /
  `title`-attribute reflection, a `hidden` prop overrides native hide behavior).
  No error, wrong behavior.

The fix for every row below is the same. **Rename the field or method** to a
name that is not an inherited member (`postTitle` instead of `title`,
`removeItem` instead of `remove`). Only override an inherited lifecycle method
deliberately and with its exact signature (override `render` / `connectedCallback`
on purpose, never repurpose the name for unrelated app logic).

## Members not to shadow

| Member | Origin | Base type or signature | Shadow with an app prop / method | Error | Fix (rename to) |
|---|---|---|---|---|---|
| `title` | HTMLElement | `string` | `title: prop<Post>(Object)` (a post object) | `TS2415` | `post`, `heading` |
| `id` | HTMLElement | `string` | `id: prop(Number)` (a numeric row id) | `TS2415` | `postId`, `rowId` |
| `slot` | HTMLElement | `string` | `slot: prop<Slot>(Object)` | `TS2415` | `bookingSlot` |
| `role` | HTMLElement | `string \| null` | `role: prop<Role>(Object)` (a user role) | `TS2415` | `userRole` |
| `hidden` | HTMLElement | `boolean` | `hidden: prop(String)` | `TS2415` | `isHidden` (or keep `boolean`) |
| `dir` | HTMLElement | `string` | `dir: prop<Direction>(Object)` | `TS2415` | `direction` |
| `lang` | HTMLElement | `string` | `lang: prop<Lang>(Object)` | `TS2415` | `language` |
| `translate` | HTMLElement | `boolean` | `translate: prop(String)` | `TS2415` | `translationKey` |
| `draggable` | HTMLElement | `boolean` | `draggable: prop(String)` | `TS2415` | `isDraggable` |
| `tabIndex` | HTMLElement | `number` | `tabIndex: prop(String)` | `TS2415` | `tabOrder` |
| `className` | HTMLElement | `string` | `className: prop<string[]>(Array)` | `TS2415` | `variantClasses` |
| `dataset` | HTMLElement | `DOMStringMap` | `dataset: prop<Data>(Object)` | `TS2415` | `payload`, `meta` |
| `remove` | Element | `(): void` | `remove(id: number): Promise<void>` | `TS2416` | `removeItem`, `deleteRow` |
| `closest` | Element | `(sel: string) => Element \| null` | `closest(n: number)` | `TS2416` | `nearest` |
| `matches` | Element | `(sel: string) => boolean` | `matches(other: T)` | `TS2416` | `isMatch` |
| `focus` | HTMLElement | `(opts?) => void` | `focus(field: string)` | `TS2416` | `focusField` |
| `blur` | HTMLElement | `(): void` | `blur(amount: number)` | `TS2416` | `applyBlur` |
| `click` | HTMLElement | `(): void` | `click(e: Event)` | `TS2416` | `handleClick` |
| `append` / `prepend` | Element | `(...nodes) => void` | `append(item: T)` | `TS2416` | `appendItem` |
| `before` / `after` | Element | `(...nodes) => void` | `after(cb: () => void)` | `TS2416` | `runAfter` |
| `render` | WebComponent | `() => TemplateResult \| Promise<...>` | `render(data: T)` (arg added) | `TS2416` | override with the real signature |
| `update` | WebComponent | `(changed: Map) => void` | `update(input: T)` | `TS2416` | `applyUpdate`, `save` |
| `requestUpdate` | WebComponent | `(name?, old?) => void` | `requestUpdate(payload: T)` | `TS2416` | `queueUpdate` |
| `updated` / `firstUpdated` | WebComponent | `(changed: Map) => void` | `updated(row: T)` | `TS2416` | `onUpdated` |
| `willUpdate` / `shouldUpdate` | WebComponent | `(changed: Map) => boolean \| void` | repurposed for app logic | `TS2416` | rename or override correctly |
| `connectedCallback` | WebComponent | `(): void` | `connectedCallback(user: T)` | `TS2416` | override with no args |
| `renderError` / `renderFallback` | WebComponent | `(err?) => TemplateResult` | `renderFallback(id: number)` | `TS2416` | override with the real signature |
| `addController` / `removeController` | WebComponent | `(c: Controller) => void` | app method of the same name | `TS2416` | rename |
| `updateComplete` | WebComponent | `get(): Promise<boolean>` | `updateComplete: prop(Boolean)` | `TS2415` | `isComplete` |

Framework-private fields are all underscore-prefixed (`_renderRoot`,
`_connected`, `_changedProperties`, `_updatePromise`, `_isUpdating`). Never
declare a reactive prop or field with a leading underscore that matches one, and
never write to them from app code. Use a plainly-named reactive prop or a signal
instead.

## Names that are safe (not inherited)

Common component prop names that do NOT collide, so they need no rename.

`label`, `open`, `count`, `value` (declare it, native `HTMLElement` has none),
`name`, `items`, `todos`, `active`, `variant`, `size`, `checked`, `selected`,
`heading`, `caption`, `message`, `status`.

Note. `open`, `value`, `checked`, and `selected` ARE native properties on
specific built-in elements (`<details>`, `<input>`, `<option>`), but a
`WebComponent` extends the generic `HTMLElement`, which does not define them, so
they are free on a custom element. When in doubt, grep the base surface in
`packages/core/src/component.js` (or `node_modules/@webjsdev/core/src/component.js`
in an app) rather than guessing.

Cross-references. Reactive property declaration is in the root `AGENTS.md`
(`WebComponent` essentials) and `agent-docs/components.md`. The lit patterns that
break WebJs reactivity are in `agent-docs/lit-muscle-memory-gotchas.md`.
