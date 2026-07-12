# Styling: Tailwind-first, plus vanilla-CSS opt-out

Tailwind is the strong default. The conventions below cover the
Tailwind-first rule and the lit reflex it exists to counter, then how to
opt out and use plain CSS everywhere (fully supported).

## Tailwind-first is the strong default

**Use Tailwind utilities for pages AND light-DOM components (the default
DOM mode).** Layout, spacing, color (via the `@theme` tokens),
typography, borders, radius, shadows, and interaction states
(hover/focus/active/disabled, dark mode) are all utility-expressible.
Light DOM does not scope styles, so a utility class on a light-DOM
element resolves against the global stylesheet exactly as it does on a
page. That is why utilities are the right tool there, not an exception.

### The lit muscle-memory trap (read this first)

AI agents with strong lit / web-components training carry one habit that
fights this default: in lit, a component owns a shadow root and scopes
its CSS with `static styles = css\`\``, so the reflex is to author scoped
CSS or an inline `<style>` with semantic class names (`.hero`,
`.feature`, `.card`, `.btn`) for every component.

**In WebJs the default is light DOM, which does NOT scope.** A scoped
`css` block does nothing without `static shadow = true` (the framework
warns at runtime), and an inline `<style>` with bare semantic class names
leaks those names into the global namespace. So reaching for either in a
light-DOM component is the reflex to resist. Prefer Tailwind utilities.
When the same utility bundle repeats, extract it into a `lib/utils/ui.ts`
helper that returns an `` html`...` `` fragment (the existing pattern,
below), NOT a CSS class. The helper keeps the utilities visible at the
definition site and runs at SSR time, so the output is identical to
writing the classes inline.

### The custom-CSS allowlist (the only things raw CSS is for)

Reserve raw CSS for what utilities genuinely cannot express. This is the
exhaustive list; anything outside it should be a utility (or a
`lib/utils/ui.ts` helper):

- **design-token `:root` + `@theme` definitions** (the palette, fonts,
  fluid type scale, motion durations declared once in the root layout),
- **`@property` animated custom properties** paired with `@keyframes`,
- **`::-webkit-scrollbar` and `scrollbar-color`** (no utility surface),
- **`prefers-reduced-motion` blocks**,
- **complex `color-mix()` or gradient effects** a utility cannot spell.

When custom CSS IS unavoidable inside a light-DOM component, the
tag-prefix invariant still holds (see the Vanilla CSS section below):
every class selector is prefixed with the component tag. **Shadow-DOM components
(`static shadow = true`) legitimately author `static styles = css\`\``,
which is the right home for scoped CSS and is unchanged by this rule.**
The Tailwind-first steer is about the LIGHT-DOM default, not about
shadow DOM.

## Tailwind + JS helpers (default convention)

Default stack: Tailwind CSS browser runtime + `@theme` design tokens
declared once in the root layout (palette, fonts, fluid type, motion
durations). Consume via utility classes (`text-fg`, `bg-bg-elev`,
`font-serif`, `duration-fast`, `text-display`).

**DRY via JS helpers, not `@apply`.** When the same bundle of Tailwind
classes repeats across 2+ places, extract it into a helper in
`lib/utils/ui.ts`:

```ts
import { html } from '@webjsdev/core';

/** `● label` kicker: small caps, accent colour, above headings. */
export function rubric(label: string, mb: 'sm' | 'md' = 'md') {
  const mbCls = mb === 'sm' ? 'mb-3' : 'mb-4';
  return html`
    <span class="block font-mono text-[11px] leading-none font-semibold tracking-[0.2em] uppercase text-accent ${mbCls}">● ${label}</span>
  `;
}

/** "← label" back link: small caps, muted. */
export function backLink(href: string, label: string) {
  return html`
    <a href=${href} class="inline-block mb-12 text-fg-subtle no-underline font-mono text-[11px] leading-none font-medium tracking-[0.15em] uppercase transition-colors duration-fast hover:text-fg">← ${label}</a>
  `;
}
```

```ts
// app/blog/[slug]/page.ts
import { rubric, backLink } from '../../../lib/utils/ui.ts';

export default function Post({ params }) {
  return html`
    ${backLink('/', 'Posts')}
    ${rubric('post')}
    <h1 class="font-serif text-display ...">${title}</h1>
  `;
}
```

### When to extract, when to keep inline

| Repeats | Action |
|---|---|
| Once | Inline the classes. |
| 2–3 times, identical | Extract to `lib/utils/ui.ts`. |
| Varies by 1–2 props | Extract with a small parameter (`mb: 'sm' \| 'md'`). |
| Radically different per call site | Keep inline. Don't force-fit. |

### Why not `@apply`?

`@apply` hides which utilities a class uses from the reader and creates
a second source of truth. JS helpers keep the class bundle visible at
the definition site and compose naturally with other props (conditional
classes, active states, etc.). They run at SSR time. Output HTML is
identical to inline classes, no client-side runtime.

## Dark mode: two signals, keep them in sync

The default scaffold runs **two** theming systems, and a theme switch must
drive **both** or one half goes stale (this is the single most common
dark-mode bug in a scaffolded app):

1. **Editorial chrome tokens** (`--fg`, `--bg`, `--accent`, ...) declared in
   the root layout. They react to a **`data-theme` attribute** on `<html>`
   (`data-theme="light"` vs absent) and default to dark.
2. **Webjs UI (shadcn) component tokens** (`--background`, `--foreground`,
   `--primary`, ...) used by everything under `components/ui/`. They react
   to a **`.dark` class** on an ancestor (`@custom-variant dark (&:is(.dark *))`)
   and default to light.

The scaffold's head init script and `theme-toggle` set **both** signals on
`<html>`: they write `data-theme` AND `classList.toggle('dark', isDark)`. If
you wire your own theme switch or replace the toggle, you MUST set both.
Setting only `data-theme` leaves the ui-* components rendering light tokens
on a dark page (white buttons, white cards, invisible text) while the chrome
looks correct.

**Verify dark mode in a real browser, not just light.** Light mode passing
proves nothing about dark mode: with neither signal set, both systems sit at
a coincidentally matching default, so the divergence only appears once
`.dark` / `data-theme` are applied. Emulate dark (`colorScheme: 'dark'` or
flip the toggle) and check a shadcn component's computed `background-color`,
not just the page chrome.

## Vanilla CSS for the whole app (opt-out of Tailwind)

Tailwind isn't required. To hand-write CSS everywhere, you need a
scoping convention so generic class names (`.btn`, `.input`, `.header`)
don't collide across pages, layouts, and components in the global
light-DOM namespace.

### Convention: three scopes, one rule each

| Scope | Wrapper selector | Where it lives |
|---|---|---|
| **Component** | Custom-element tag | Nested CSS under `my-counter { … }` |
| **Page** | `.page-<route>` | Wrap the page's markup in `<div class="page-<route>">` |
| **Layout** | `.layout-<name>` | Wrap the layout's markup in `<div class="layout-<name>">` |

Naming convention: derive the scope class from the file path. Slashes
→ hyphens. Dynamic segments become their param name. Route groups
`(marketing)` drop.

- `app/page.ts`                       → `.page-home`
- `app/about/page.ts`                 → `.page-about`
- `app/dashboard/posts/new/page.ts`   → `.page-dashboard-posts-new`
- `app/blog/[slug]/page.ts`           → `.page-blog-slug`
- `app/(marketing)/about/page.ts`     → `.page-about`
- `app/layout.ts`                     → `.layout-root`
- `app/admin/layout.ts`               → `.layout-admin`

Styles colocate with the markup as `const STYLES = css\`…\`` and
interpolate via `<style>${STYLES.text}</style>`. The standalone
`@webjsdev/intellisense` (and the `webjs` editor extension) resolves class
go-to-definition inside those blocks.

### Example: a page

```ts
import { html, css } from '@webjsdev/core';

const STYLES = css`
  .page-dashboard {
    .actions      { display: flex; gap: 12px; }
    .btn          { padding: 12px 24px; border-radius: 999px; }
    .btn-primary  { background: var(--accent); color: var(--accent-fg); }
  }
`;

export default function Dashboard() {
  return html`
    <style>${STYLES.text}</style>
    <div class="page-dashboard">
      <div class="actions">
        <a class="btn btn-primary" href="/new">+ New</a>
      </div>
    </div>
  `;
}
```

### Example: a layout

```ts
const STYLES = css`
  .layout-root {
    .header { position: sticky; top: 0; }
    .nav    { display: flex; gap: 16px; }
  }
`;

export default function RootLayout({ children }) {
  return html`
    <style>${STYLES.text}</style>
    <div class="layout-root">
      <header class="header">
        <nav class="nav">…</nav>
      </header>
      <main>${children}</main>
    </div>
  `;
}
```

Inside each scope, `.btn` / `.input` / `.header` / `.form` / `.item`
are free names because CSS descendant combinators stop them at the scope
boundary. A small curated set of **primitives** (`rubric`, `banner`,
`accent-link`, `display-h1`, …) can live global in the root layout as
your design system. Everything else is scoped.

### Tradeoffs vs Tailwind

More files you write, more discipline required, slight rename cost (2
textual edits when a route folder moves). In exchange: no browser-
runtime script, no `@theme` block, idiomatic CSS, plain cascade you can
debug with any tool.

## Gotcha: a sticky header flickers on iOS, use `position: fixed`

A `position: sticky` header (the common `sticky top-0` pattern) flickers its
background for one frame on iOS WebKit (every iOS browser, since they all use
WebKit) during a client-router FORWARD navigation. The scroll-to-top the router
runs after the content swap drives a sticky stuck-to-static recompute that
WebKit mis-repaints. It is iOS-only (fine on desktop and Android, and invisible
in DevTools device emulation, so it shows only on a real device). #610 confirmed
on-device that neither compositor promotion (`translateZ(0)` / `will-change`)
nor changing the swap paint timing fixes it.

The fix is `position: fixed` instead of sticky. A fixed header is always pinned
and never does the scroll-relative recompute, so the repaint bug never fires.
There is no reliable CSS-only fix that KEEPS `position: sticky` (the GPU-promotion
hacks `translateZ(0)` / `translate3d` / `will-change` / a wrapper element are all
variants that do NOT reliably work, confirmed on-device for #610). Preserving the
header across nav is correct and standard (Next.js, Remix, SvelteKit all preserve
nested layouts); only the `sticky` positioning is the problem.

Because fixed leaves normal flow, reserve the header height on the content below.
Use a single `--header-height` custom property as the source of truth rather than
a hardcoded number, and keep it exact with a `ResizeObserver` so it tracks
responsive / dynamic headers (degrades fine with no JS via the default):

```css
:root  { --header-h: 56px; }              /* sane SSR first-paint default */
header { position: fixed; inset-inline: 0; top: 0; }
body   { padding-top: var(--header-h); }
```
```js
// refine the default to the header's real height (and on resize)
const hdr = document.querySelector('header');
const apply = () => document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
apply();
new ResizeObserver(apply).observe(hdr);
```

The example blog's root layout does exactly this (`examples/blog/app/layout.ts`).
For an app/dashboard layout, an alternative is an app-shell scroll container (a
non-scrolling `100dvh` flex column with `<main>` as the internal scroller), which
needs no offset at all but changes the scroll model (the window no longer
scrolls, so the iOS URL bar stays visible).

## Layout recipes: even grids, aspect-ratio, and no reflow

These are the CSS traps that cause a visually-broken app (uneven cells, a
collapsed board, a layout that resizes as it fills). They are not app-specific;
they apply to any grid / board / gallery / card layout.

**Light-DOM component hosts are `display: block` by default.** A custom element
is `display: inline` in plain CSS, which collapses a component used as a block
container (a board, a card) to its content size. WebJs marks every LIGHT-DOM host
`data-wj-host` and defaults it to `display: block` via one rule in the document
head, wrapped in a dedicated low-priority cascade layer (`@layer webjs-host {
:where([data-wj-host]) { display: block } }`), so this does not bite you. The
layer is what keeps it overridable: any author style, INCLUDING a Tailwind
utility (`class="flex"`, `grid`, `hidden`), wins over it (Tailwind's utilities
live in a later layer). So sizing a host with `class="flex ..."` just works.
`[hidden]` still hides a host (a same-layer `[hidden]` carve-out), so
`?hidden=${cond}` works. If you WANT an inline light-DOM component (a badge in
flowing text), opt out with a tag-prefixed rule `my-badge { display: inline }`.

**Shadow-DOM hosts are NOT marked; set their display via `:host`.** A document
rule targeting the host would override the shadow tree's own `:host` (the
encapsulation-context criterion outranks layer and specificity for normal
declarations), so WebJs does not touch shadow hosts. A shadow-DOM component
controls its host display the idiomatic way, `:host { display: block }` (or
`flex` / `grid` / `inline`) in `static styles`. Because the framework does not
mark it, that `:host` is fully respected. A shadow component used as a block
container should set `:host { display: block }` itself (a shadow host with no
`:host` display stays `display: inline`).

**Size the HOST, not just an inner wrapper.** The host custom element is the box
the parent lays out. `display: block` (above) stops the inline-collapse, but a
host that is a flex/grid ITEM in a centering parent (`flex justify-center`, `grid
place-items-center`) is still sized to its content unless it carries width
itself. So put the sizing classes on the host, not only on an inner `<div>`. In a
light-DOM component the host is the custom element rendering the template, so give
it `w-full max-w-[...]` (or render your outermost element AS the sized box); an
inner `<div class="w-full">` alone resolves `w-full` against a collapsed host and
the whole component shrinks. Symptom: a board or card that renders tiny even
though its inner grid says `w-full max-w-[400px]`. Fix: move `w-full
max-w-[400px]` onto the host.

**An even grid uses `1fr` tracks, never `auto` rows.** The reflow bug (a cell
grows when it gets content while the others shrink) comes from `auto`-sized grid
rows: the row with content is taller. Size the tracks explicitly so every cell is
an equal fraction regardless of content:

```html
<!-- a 3x3 board whose cells stay equal and square as it fills -->
<div class="grid gap-2 aspect-square [grid-template-columns:repeat(3,1fr)] [grid-template-rows:repeat(3,1fr)]">
  ${cells.map((c) => html`
    <button class="grid place-items-center min-h-0 overflow-hidden text-[clamp(1rem,8cqi,3rem)]">${c}</button>
  `)}
</div>
```

- `aspect-ratio` (e.g. `aspect-square`) on the CONTAINER, plus `repeat(N,1fr)`
  columns AND rows, makes every cell an equal square that does not change size as
  marks are placed. Putting `aspect-square` on the CELLS instead is the common
  mistake that produces uneven rows.
- `min-h-0` + `overflow-hidden` on a cell stops its content from forcing the
  track taller (the other half of the reflow bug). A grid/flex child has an
  implicit `min-height: auto` that lets content push it past its track.
- Size text relative to the cell (`clamp()`, container-query units `cqi`) so the
  glyph scales with the board rather than dictating the cell size.

**Verify by USING it, not by glancing at the first paint.** A layout bug only
shows mid-interaction: render the app, then play through every state (fill the
board, win, draw, reload) and confirm nothing resizes or shifts and the cells
stay equal. See the layout-stability test recipe in `agent-docs/testing.md`.
