# AGENTS.md for the docs site

The WebJs documentation site, built on WebJs itself (eating our own
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

## Machine-readable agent entrypoints (llms.txt)

The docs site serves the open llms.txt standard (llmstxt.org) so AI
agents can read the docs as plain text. Three surfaces, all generated
**live at request time** from the doc pages under `app/docs/**`, so they
stay in sync with zero build step (add a doc page and it appears
automatically):

| URL | What it serves |
|---|---|
| `/llms.txt` | A structured INDEX. An `# WebJs documentation` H1, a one-line blurb, then a markdown bullet list of every doc page (title, blurb, absolute link). Ordered to match the sidebar nav. |
| `/llms-full.txt` | The full prose CORPUS. Every doc page concatenated as lightweight markdown. In the monorepo it also folds in the skill at `.agents/skills/webjs/` (SKILL.md + references/); a standalone deploy that lacks the repo root simply skips that (try/catch read). |
| `/docs/<topic>/llms.txt` | One page's raw markdown. Every topic gets one via the `app/docs/[topic]/llms.txt/route.ts` dynamic route. |

The generators live in `lib/llms.server.ts` (server-only `.server.ts`
infix, reads doc pages with node:fs, reuses the search route's title /
heading / template-stripping approach). The routes are thin
`route.ts` GET handlers under `app/llms.txt/`, `app/llms-full.txt/`, and
`app/docs/[topic]/llms.txt/`. The folder named `llms.txt` maps to the
`/llms.txt` URL because a `route.ts` handler matches before the
static-asset gate. Absolute links derive from the request origin (so
they are correct in dev and prod). Integration test:
`../test/docs/llms.test.mjs`.

## Style

- Light DOM throughout. Tailwind utilities. Design tokens via `@theme`
  in the root layout.
- Doc pages return plain HTML in `html\`…\``: `<h1>`, `<h2>`, `<p>`,
  `<pre>`, `<code>`, `<ul>`. No custom components per page. Consistency
  comes from the layout's global styles.

## Run

```sh
cd docs && npm run dev          # http://localhost:5002
```

`npm run dev` and `webjs dev` behave identically (#550): the Tailwind
`--watch` (which produces `public/tailwind.css`) lives in `webjs.dev.parallel`
and runs INSIDE `webjs dev`. In prod, `npm start` and `webjs start` are
equivalent too: `webjs.start.before` runs `npm run css:build` before serving.

---

Framework-wide rules and full API reference:

@../AGENTS.md
