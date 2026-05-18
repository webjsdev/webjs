# AGENTS.md for the docs site

The webjs documentation site, built on webjs itself (eating our own
dogfood). All framework-wide rules (file conventions, public API,
workflow, scaffold rules, persistence rules, autonomous-mode behaviour)
live in the **framework root [`../AGENTS.md`](../AGENTS.md)** and apply
here. Read that first.

This file only covers what's specific to the docs app.

## Layout

```
docs/
  app/
    layout.ts                 root layout (head, theme, GA, fonts)
    page.ts                   /  → docs homepage / landing
    docs/
      layout.ts               sub-layout: sidebar + content shell.
                              **The sidebar source-of-truth lives here.**
      <topic>/page.ts         one page per doc topic
    api/                      lightweight endpoints (search index, etc.)
  components/
    doc-search.ts             search palette
    theme-toggle.ts           light/dark cycle
  public/                     static assets (favicon, og image)
```

## How to add a new doc page

1. Create `docs/app/docs/<topic-slug>/page.ts`. Export a default
   function returning `html\`…\`` and export a `metadata` object with
   at least `title`.
2. Register it in the sidebar in `docs/app/docs/layout.ts`. Find the
   `sections` array (look for entries like
   `{ href: '/docs/getting-started', label: 'Introduction' }`) and
   add a new entry in the correct section. The href must match the
   folder name, and the label is the visible sidebar text.
3. If the page covers a NEW API surface, also update the framework
   root `../AGENTS.md` (the API reference) per the framework workflow.

That's it. No separate manifest, no rebuild.

## Style

- Light DOM throughout. Tailwind utilities. Design tokens via `@theme`
  in the root layout.
- Doc pages return plain HTML in `html\`…\``: `<h1>`, `<h2>`, `<p>`,
  `<pre>`, `<code>`, `<ul>`. No custom components per page. Consistency
  comes from the layout's global styles.

## Run

```sh
cd docs && npm run dev          # http://localhost:4000
```

---

Framework-wide rules and full API reference:

@../AGENTS.md
