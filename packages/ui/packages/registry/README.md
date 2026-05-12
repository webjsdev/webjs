# @webjskit/ui-registry

Internal — sources for the `@webjskit/ui` component registry.

Not published. The build script reads `registry.json` + the files it points at
and emits `r/*.json` — one JSON file per registry item, wire-compatible with
shadcn's `registryItemSchema`. Those JSON files are served by
[`@webjskit/ui-website`](../ui-website) at `https://ui.webjs.dev/r/<name>.json`,
which the `@webjskit/ui` CLI fetches.

## Layout

```
components/        — one .ts per shadcn component (web component port, light DOM + Tailwind)
lib/               — shared lib code shipped into user projects (utils.ts → cn)
themes/            — theme CSS + base-colour palettes (neutral, stone, zinc, …)
registry.json      — manifest read by scripts/build.js
scripts/build.js   — compile registry.json + sources → r/*.json
r/                 — build output (gitignored)
```

## Build

```sh
npm run build
```

Emits:
- `r/<name>.json` for every component (`type: "registry:ui"`)
- `r/themes/<name>.json` for each base-colour theme (`type: "registry:theme"`)
- `r/index.json` — flat list of all items
- `r/registry.json` — full manifest (for clients that want it all in one fetch)
