# AGENTS.md: @webjskit/ui-website

The HTTP host for `@webjskit/ui`'s registry + the per-component docs site.

Framework-wide rules live in the root [`../../../AGENTS.md`](../../../AGENTS.md).
This file covers ONLY what's specific to this package.

---

## ⚠️ Directory layout: does NOT match a normal scaffolded webjs app

**Read this before adding ANY file.** This package has a unique layout
because it's both the *publisher* of the `@webjskit/ui` component kit
(it serves `/registry/<name>.json` to the CLI) and a *consumer* of the
same kit (its docs pages import the components to render live previews).
The footgun this creates has already broken a live deploy once, so don't
re-introduce it.

| Directory | Tracked in git? | Add hand-written files here? |
|---|---|---|
| `components/` | **NO: gitignored**, regenerated at `predev`/`prestart` by `scripts/copy-registry.js` from `../registry/`. | ❌ **NEVER.** Anything you put here is wiped every dev cycle AND never reaches the deploy. |
| `lib/` | **NO: gitignored**, same as above. | ❌ **NEVER.** |
| `app/_components/` | ✅ **YES: tracked.** Underscore prefix = webjs private folder (not routable). | ✅ **Yes, this is the home for hand-written website-chrome components** (`theme-toggle`, etc.). |
| `app/` (other), `public/`, `scripts/` | ✅ Tracked, normal webjs source | ✅ Yes |

### How to register a new website-chrome component

```ts
// app/_components/my-widget.ts
import { WebComponent, html } from '@webjskit/core';
class MyWidget extends WebComponent { /* … */ }
MyWidget.register('my-widget');
```

Then in `app/layout.ts`:

```ts
import './_components/my-widget.ts';   // side-effect: registers the element
```

Use the tag (`<my-widget>`) wherever you'd normally use a custom element
in the layout / pages.

### Why this layout exists

`scripts/copy-registry.js` mirrors `../registry/components/*.ts` into
`components/ui/*.ts` at prestart, rewriting each component's internal
`'../lib/utils.ts'` import to `'../../lib/utils.ts'` (one extra `..`
for the website's deeper path). The docs preview pages then import
locally. Committing the mirror would create two sources of truth that
drift, hence the wholesale `.gitignore` on `/components/` and `/lib/`.

If a hand-written component slips into `components/`, it gets
gitignored too. The file works locally (it's in your working tree)
but never gets pushed to the deploy, the deploy can't import it, and
the layout module throws at SSR → every request returns a prod 500.

The rule above (`app/_components/`) prevents this entirely.

### Architecture is unique to THIS package

| Surface | `components/ui/` |
|---|---|
| **This package** (`@webjskit/ui-website`) | gitignored, mirror of `../registry/` |
| Scaffolded user apps (`webjs create`) | tracked source, `webjs ui add` writes more |
| Example blog (`examples/blog`) | tracked source, hand-edited |
| Any other webjs app | tracked source, shadcn-style "you own it" |

When working in any of the other surfaces, the trap above does NOT
apply, and `components/ui/` is just normal project source.

---

## Routes (HTTP surface)

- `GET /registry`              full manifest, content inlined
- `GET /registry/index.json`   flat metadata-only list
- `GET /registry/<name>.json`  single item, content inlined
- `GET /docs`                  docs root
- `GET /docs/components/<name>` per-component docs page
- `GET /`                      homepage / component index

The `app/registry/**` route handlers call `app/_lib/registry.server.ts`,
which composes JSON on demand from `../registry/` (no build step).

## Dev

```sh
npm run dev    # http://localhost:5001
```

**Use `npm run dev`, not `webjs dev` directly.** `webjs dev` only runs
the server. This app's `npm run dev` does two more things via
`concurrently` + `predev`: it spawns `tailwindcss --watch` (which
produces `public/tailwind.css`) and runs `scripts/copy-registry.js`
(which populates `components/ui/` + `lib/utils.ts`). Skip the npm
wrapper and the page renders unstyled with broken imports. Same in
prod: prefer `npm start` over `webjs start` so the `prestart: copy-
registry + css:build` hook fires.

The `predev` hook runs `scripts/copy-registry.js` to populate
`components/ui/` and `lib/utils.ts` so the docs preview pages have
something to import. Re-running `npm run dev` re-populates from the
current registry state.

### Sibling-app URLs (header, footer)

Sibling-app links in the header + footer (Webjs site, Docs) read from
`WEBSITE_URL` / `DOCS_URL` env vars. Fallbacks are the canonical
localhost dev ports so local `npm run dev` works with zero setup. Deploy
by overriding via the service env (e.g. Railway's variables):

| Env var | Local fallback | Production value |
|---|---|---|
| `WEBSITE_URL` | `http://localhost:5000` | `https://webjs.dev` |
| `DOCS_URL` | `http://localhost:4000` | `https://docs.webjs.dev` |

`.env.example` in this directory documents the same defaults. Copy it to
`.env` only if you need to override locally; the fallbacks already match.

---

Framework-wide rules and the framework API reference:

@../../../AGENTS.md
