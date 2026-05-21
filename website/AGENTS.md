# AGENTS.md for the landing site

The webjs marketing / landing site, built on webjs itself. All
framework-wide rules (file conventions, public API, workflow, scaffold
rules, persistence rules, autonomous-mode behaviour) live in the
**framework root [`../AGENTS.md`](../AGENTS.md)** and apply here. Read
that first.

This file only covers what's specific to the landing site.

## Layout

```
website/
  app/
    layout.ts          root layout (head, OG/Twitter metadata,
                       header/footer chrome, Tailwind tokens)
    page.ts            /  → the entire one-page landing site.
                           Hero, features grid, code samples, agent
                           badges, and footer all live here.
    changelog/page.ts  /changelog. Reads ../../../changelog/<pkg>/*.md
                       at SSR time and renders the unified release
                       feed. The deployment image must include the
                       changelog/ tree at the repo root, the
                       Dockerfile's `COPY changelog ./changelog` line
                       is what ships it on Railway.
  components/
    theme-toggle.ts    light/dark cycle
  public/              favicon, og image, static assets
```

The site is intentionally one page in long-form scroll. When you edit
copy, find the section in `app/page.ts` (search for the visible text
that needs to change) and update inline.

## How to add a feature card

The features grid is driven by the `FEATURES` array near the top of
`app/page.ts`. Each entry is `{ icon, title, desc }`. Add a new entry
in the correct order; the layout reflows automatically.

The grid currently includes a card for **Webjs UI** (the AI-first
component library at https://ui.webjs.dev). When shipping major UI-kit
changes, update that card's copy or pin a companion card highlighting
the new components.

## Announcement banner

The layout (`app/layout.ts`) renders a top-of-page announcement strip,
a `<div class="announce">` block, typically pointing at the current
release or shipping highlight (e.g. "v1: @webjskit/ui is live"). To
swap the announcement target, edit the layout's `<div class="announce">`
block. The banner shows on every page. Remove the block entirely to
hide it.

## How to update headline / hero copy

`app/page.ts`: the hero block is at the top of the default-exported
function. Edit the inline `<h1>` / `<p>` text.

## Style

- Light DOM, Tailwind utilities, `@theme` tokens from the root layout
  (same palette / type scale as the blog and docs).
- Each section in `page.ts` is a `<section>` wrapper for predictable
  scroll anchors.

## Run

```sh
cd website && npm run dev       # http://localhost:5000
```

**Use `npm run dev`, not `webjs dev` directly.** `webjs dev` only runs
the server; this app's `npm run dev` uses `concurrently` to also spawn
`tailwindcss --watch`, which is what produces `public/tailwind.css`.
Running `webjs dev` alone ships the page with no Tailwind utilities
applied (the navbar and most of the layout look broken). Same in prod:
prefer `npm start` over `webjs start` so the `prestart: css:build` hook
fires.

Set `DOCS_URL` / `BLOG_URL` / `UI_URL` env vars to point the header links
at the right hosts when deploying. Locally, `.env` in this directory
sets them to the sibling apps' localhost ports.

---

Framework-wide rules and full API reference:

@../AGENTS.md
