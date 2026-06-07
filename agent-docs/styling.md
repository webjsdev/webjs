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

**In webjs the default is light DOM, which does NOT scope.** A scoped
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
`@webjsdev/ts-plugin` (and the `webjs` editor extension) resolves class
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
