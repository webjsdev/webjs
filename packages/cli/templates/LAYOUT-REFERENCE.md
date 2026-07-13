# Layout reference

`app/layout.ts` ships as a **minimal shell**: it wires the theme, design tokens,
and the Tailwind runtime, then renders `${children}` in a bare full-height
container with no chrome. That is on purpose. A delivered app should design its
own layout from what the app IS, not inherit a generic header and footer.

This file is the **reference** for how to build a real layout: read it to learn
the patterns (a fixed header, a brand mark, a nav, a theme toggle, a reading
column, a footer), then write the layout your app actually needs in
`app/layout.ts`. Decide from scratch: does a tic-tac-toe game want a header at
all? Does a dashboard want a sidebar instead? Does a landing page want a
full-bleed hero? Keep only what fits.

> **This is ONE example, not a template to reproduce.** Reproducing this exact
> header (a slim bar with a mark on the left and a theme toggle on the right)
> just recreates the old scaffold look under a new name. It is here to show the
> mechanics (how a header, nav, theme toggle, or footer are wired), not the
> design. Design a layout that fits what THIS app is: a game might be a
> full-bleed centered stage with no header; a tool might have a compact command
> bar; a reader might have a wide sidebar. Take the mechanics, invent the form.

You do not import from this file. Copy the mechanics you want into
`app/layout.ts`'s returned template, inside the `<main>` (or replacing it), and
restyle them into your own design.

## A complete worked layout

This is the chrome the scaffold used to ship inline. It goes in the body of
`RootLayout`, after the `<script>`/`<style>` infrastructure blocks. `navLink` is a
small SSR helper you would declare above `RootLayout`.

```ts
// Declare above RootLayout: a nav-link helper (SSR-time, no client runtime).
const navLink = (href: string, label: string) => html`
  <a href=${href} class="text-muted-foreground no-underline font-medium text-[13px] leading-none tracking-[0.005em] transition-colors duration-fast hover:text-foreground">${label}</a>
`;

// Inside RootLayout's returned html``, in place of the minimal <main>:

// A fixed header (NOT sticky: a sticky header flickers on iOS WebKit during a
// client-router nav). --header-h reserves its height for the content below; the
// header-measure script already in app/layout.ts sets --header-h to the real
// height the moment a <header> exists.
<header class="fixed inset-x-0 top-0 z-20 flex items-center gap-6 px-4 sm:px-6 py-3 border-b border-border bg-[color-mix(in_oklch,var(--background)_75%,transparent)] backdrop-blur-[18px]">
  <a href="/" class="mr-auto inline-flex items-center gap-2 no-underline text-foreground font-semibold text-[15px] leading-none tracking-tight">
    <!-- Your brand or logo mark goes here. A glyph, a wordmark, the real product name. -->
    <span>{{APP_NAME}}</span>
  </a>
  <nav class="flex gap-4 items-center">
    <!-- Your app's real navigation (or drop the nav entirely for a single-page app). -->
    ${navLink('/', 'Home')}
    <theme-toggle></theme-toggle>
  </nav>
</header>

// A content shell. The max-w-[760px] cap is a comfortable READING width, right
// for prose, forms, and marketing. For a full-bleed app, dashboard, or board,
// widen the cap (for example max-w-[1400px]) or drop the cap and mx-auto for an
// edge-to-edge layout. A wide layout left in the 760px column overflows into a
// horizontal scrollbar.
<div class="flex flex-col min-h-[calc(100dvh-var(--header-h))]">
  <main class="flex-1 w-full max-w-[760px] mx-auto px-4 sm:px-6 pt-[72px] pb-12">
    ${children}
  </main>
  <!-- Your footer. Do NOT ship a "Built with webjs" footer: write your app's own. -->
  <footer class="border-t border-border">
    <div class="max-w-[760px] mx-auto px-4 sm:px-6 py-6 flex items-center justify-center">
      <span class="text-sm text-muted-foreground">Your footer</span>
    </div>
  </footer>
</div>
```

## The `theme-toggle` element

The scaffold ships `components/theme-toggle.ts` (already imported by
`app/layout.ts` as a side effect, so the element is registered). Place
`<theme-toggle></theme-toggle>` wherever you want the light/dark switch, or delete
the import and the theme apparatus in `app/layout.ts` for a single-theme app.

## What stays in `app/layout.ts` no matter what

The infrastructure above the `<main>` is not chrome and should stay:

- the theme-detection `<script>` (light/dark apparatus) and the header-measure
  script,
- the `<link rel="stylesheet" href="/public/tailwind.css">` (the STATIC stylesheet
  compiled from `public/input.css` by `css:build`, so the app is styled with JS
  off),
- the `<style>` block of design-token VALUES (`:root` / dark / light), which
  carries its own `webjs-scaffold-placeholder` marker, so own the colors. The
  Tailwind `@theme` maps that turn those tokens into utilities live in
  `public/input.css`.

Design the chrome; keep the plumbing.
