# Styling: Tailwind default plus vanilla-CSS opt-out

The framework default is Tailwind. The conventions below describe how to
opt out and use plain CSS everywhere. Fully supported.

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
interpolate via `<style>${STYLES.text}</style>`. `ts-lit-plugin` /
`@webjsdev/ts-plugin` highlights the CSS and resolves class go-to-definition.

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
