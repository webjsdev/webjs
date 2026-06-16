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
    theme-toggle.ts    system/light/dark cycle
    copy-cmd.ts        click-to-copy command line (light DOM, always-on button)
  lib/
    highlight.ts       SSR syntax highlighter for the code samples
    frontmatter.ts     parse changelog/blog markdown frontmatter
  scripts/             manual dev tools, NOT part of build/deploy
    fetch-fonts.mjs    download the self-hosted variable woff2 fonts
    generate-og.mjs    regenerate the OG social card (needs playwright + ImageMagick)
  public/              favicon, og image, self-hosted fonts, static assets
```

The site is intentionally one page in long-form scroll. When you edit
copy, find the section in `app/page.ts` (search for the visible text
that needs to change) and update inline.

## How to add a feature card

The features grid is driven by the `PILLARS` array near the top of
`app/page.ts`. Each entry is `{ icon, title, desc }`, where `icon` is a
key into the local `ICON` map (for example `ICON.bolt`). Add a new entry
in the correct order and the grid reflows automatically. If no existing
icon fits, add one to the `ICON` map first.

## Announcement banner

The layout (`app/layout.ts`) renders a top-of-page announcement strip
just above the sticky header: a small utility-class `<div>` with a "New"
badge and a link (currently the `UI_URL` link, "Introducing the AI-first
component library"). To swap the announcement, edit that `<div>` (its copy
and the link `href`). The banner shows on every page. Remove the `<div>`
to hide it.

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
cd website && npm run dev       # http://localhost:5001
```

`npm run dev` and `webjs dev` behave identically (#550): the Tailwind
`--watch` (which produces `public/tailwind.css`) lives in the `webjs.dev.parallel`
block of `package.json` and runs INSIDE `webjs dev`. In prod, `npm start` and
`webjs start` are equivalent too: `webjs.start.before` runs `npm run css:build`
before serving.

Set `DOCS_URL` / `UI_URL` / `EXAMPLE_BLOG_URL` env vars to point the header links at
the right hosts when deploying. `EXAMPLE_BLOG_URL` is the live example-blog app
surfaced as the "Demo" link. Locally, `.env` in this directory sets them to
the sibling apps' localhost ports. Blog and Changelog are in-app routes, so
they need no env var.

---

Framework-wide rules and full API reference:

@../AGENTS.md
