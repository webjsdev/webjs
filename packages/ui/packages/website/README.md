# @webjsdev/ui-website

The HTTP host for the `@webjsdev/ui` component registry, plus a docs site with one
page per component.

A webjs app that dogfoods the framework.

## Routes

| Path | Serves |
|---|---|
| `GET /registry` | Full manifest with every item's content inlined |
| `GET /registry/index.json` | Flat metadata-only list of every registry item |
| `GET /registry/<name>.json` | One registry item (with inlined `content`) |
| `GET /docs/components/<name>` | Docs page for a single component (preview + props + install) |
| `GET /` | Index of all components |

Registry JSON is composed on demand from `packages/ui/packages/registry/`
sources by `app/_lib/registry.server.ts`. There is no build step and no
generated output to commit.

## Dev

```sh
npm run dev      # http://localhost:5001
```

A `predev` hook runs `scripts/copy-registry.js`, which mirrors the
registry's component sources into `components/ui/` and `lib/utils.ts`
so the docs preview pages can import them directly.

## ⚠️ Important: directory conventions (read before adding files)

This package has an unusual layout that **does NOT match how a normal
scaffolded webjs app is organised**. Putting a file in the wrong
directory will break a live deploy. The rule:

| Directory | Tracked in git? | Purpose | Add hand-written files here? |
|---|---|---|---|
| `components/` (and `components/ui/`, `components/site/`) | **NO: gitignored** | Auto-populated at `predev`/`prestart` by `scripts/copy-registry.js`. Mirrors `../registry/components/*.ts` with relative-import paths rewritten so the docs preview pages can import them locally. | **NEVER.** Anything you write here is silently deleted/overwritten every dev cycle and won't make it into a deploy. |
| `lib/` | **NO: gitignored** | Same as above for `../registry/lib/utils.ts`. | **NEVER.** Same reason. |
| `app/_components/` | **YES: tracked** | Hand-written website-chrome custom elements (theme-toggle, etc.). The leading `_` makes it a webjs private folder (not routable). | **Yes, this is the place.** |
| `app/`, `public/`, `scripts/`, etc. | **YES: tracked** | Normal webjs source. | Yes, the usual way. |

### Why `components/` is gitignored

The ui-website is **both** the publisher and a consumer of the
component kit:

1. **Publisher:** serves the registry JSON at
   `/registry/<name>.json` (the `@webjsdev/ui` CLI fetches these).
   The canonical sources live in `../registry/components/*.ts`.
2. **Consumer:** docs pages (`app/docs/components/[name]/page.ts`)
   import the actual components to render live previews. They import
   from `'../../components/ui/<name>.ts'`, a path that must resolve
   relative to the website's own directory depth.

Each registry component's internal `import { cn } from '../lib/utils.ts'`
resolves correctly only from `packages/ui/packages/registry/components/`.
From `packages/ui/packages/website/components/ui/`, that same relative
path would point at the wrong file. So we can't import the registry
sources directly. `scripts/copy-registry.js` solves this by:

1. Reading every `../registry/components/*.ts` source.
2. Rewriting the internal `'../lib/utils.ts'` import to `'../../lib/utils.ts'`
   (one extra `..` for the website's depth).
3. Writing the rewritten file to `components/ui/<name>.ts`.

The copies are pure derivatives. Committing them creates two
sources of truth that drift, hence the wholesale `.gitignore` on
`/components/` and `/lib/`.

### The trap (and why we hit it once)

Initially someone added a hand-written `theme-toggle.ts` to
`components/theme-toggle.ts` because that's where "website
components" would normally go. Locally it worked; on Railway the
git clone didn't include the file, the layout's import threw at
SSR, and every request returned a 500 prod-fallback.

**The fix and the new rule: hand-written components for this
website go in `app/_components/`.** That folder is tracked, the
leading underscore keeps it out of the router, and it lives
entirely outside the mirror's scope so the `.gitignore` can stay
simple (`/components/` wholly ignored, no `!` exceptions).

### Architecture-aware downstream

This trap exists **only in this package**. Every other surface
behaves the way a shadcn user expects:

- **Scaffolded apps** (`webjs create my-app`): `components/ui/` is
  normal tracked source. `webjs ui add dialog` adds files; users
  commit them. No prestart copy step.
- **Example blog** (`examples/blog`): same: `components/ui/` is
  fully tracked, edited freely.
- **Any user's app**: same, standard shadcn-style "you own the
  source." Hand-written `components/theme-toggle.ts` works fine.

So when working in `packages/ui/packages/website/`, mentally swap
in this exception. When working in a scaffolded app, ignore this
section entirely.
