# @webjskit/ui-registry

Internal — sources for the `@webjskit/ui` component registry.

Not published. `registry.json` is the manifest; the files it points at are the
source of truth. The website
([`@webjskit/ui-website`](../ui-website)) composes shadcn-compatible JSON on
demand and serves it at `https://ui.webjs.dev/r/<name>.json`, which the
`@webjskit/ui` CLI fetches. There is no build step — no `r/` output, no
`prestart` hook.

## Layout

```
components/        — one .ts per shadcn component (web component port, light DOM + Tailwind)
lib/               — shared lib code shipped into user projects (utils.ts → cn)
themes/
  index.css        — neutral @theme block + CSS variables (light + dark defaults)
  base-colors.js   — per-base-colour overrides (stone, zinc, mauve, olive, mist, taupe) + mergeThemeCss
registry.json      — manifest read by the website composer at request time
```

Only `theme-neutral` is in `registry.json`. The other 6 base colours are
synthesized by the composer at request time — neutral CSS + per-colour
overrides → merged CSS, same `files[]` shape.

## Wire endpoints

Served by `@webjskit/ui-website` (`app/_lib/registry.server.ts` +
`app/r/**`):

- `GET /r/<name>.json` — single registry item (`type: registry:ui` /
  `registry:theme` / `registry:lib`), with file contents inlined.
- `GET /r/index.json` — flat metadata-only list.
- `GET /r` — full manifest with every item's content inlined.
