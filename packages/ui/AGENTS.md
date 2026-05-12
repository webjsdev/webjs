# AGENTS.md — @webjskit/ui

The webjs **shadcn-equivalent component CLI** — `webjsui init` / `add` / `list` /
`view` / `diff` / `info` / `build`. Ships ~55 web-component ports of shadcn's
new-york-v4 style.

Framework-wide rules live in the root [`../../AGENTS.md`](../../AGENTS.md) and
apply here. Read that first. This file only covers what's specific to
`@webjskit/ui`.

## Role

`@webjskit/ui` is a **CLI + registry-fetcher**. It does not contain the
component sources directly — those live in
[`packages/ui/packages/registry/`](./packages/registry/) (internal, not
published). The CLI fetches compiled JSON from
[`https://ui.webjs.com/r/<name>.json`](https://ui.webjs.com) and copies the
source into the user's project.

Three workspace packages cooperate:

```
packages/ui/                       @webjskit/ui — published CLI (this package)
└─ packages/
   ├─ registry/                    internal: component sources + build pipeline
   └─ website/                     internal: registry HTTP host + docs site
```

## Module map

```
packages/ui/
  bin/
    webjsui.js                    standalone binary entry
  src/
    index.js                      CLI entry (Commander program + dispatch)
    commands/
      init.js                     init — writes components.json, theme CSS, lib/utils.ts
      add.js                      add — resolve registry items + write into project + install deps
      list.js                     list — show all registry items
      view.js                     view — print a component's source
      diff.js                     diff — compare local vs registry
      info.js                     info — project diagnostics
      build.js                    build — compile a custom registry (for registry authors)
    registry/
      schema.js                   zod schemas (wire-compatible with shadcn's)
      fetcher.js                  HTTP GET + cache for registry items
      resolver.js                 walk registryDependencies transitively
    utils/
      get-config.js               read components.json
      detect-project.js           webjs / next / vite / astro / plain detection
      logger.js                   kleur-based logger
      index.js                    barrel
  test/
    schema.test.js                schema validation
    resolver.test.js              transitive deps + npm dedupe
    detect-project.test.js        project-type detection + defaults
    get-config.test.js            config read/write/round-trip

  packages/registry/              the registry (internal, not published)
    components/                   55 .ts files, one per shadcn component
    lib/utils.ts                  cn() class-merge helper (shipped to user projects)
    themes/
      index.css                   @theme block + CSS variables (light + dark)
      base-colors.js              the 7 base palettes (neutral/stone/zinc/mauve/olive/mist/taupe)
    registry.json                 manifest read by scripts/build.js
    scripts/build.js              compile components → r/*.json (one JSON per item)
    r/                            BUILD OUTPUT (gitignored, served by website)

  packages/website/               the registry HTTP host + docs (internal)
    app/
      layout.ts, page.ts          docs site shell + home
      r/route.ts                  GET /r — full manifest
      r/index.json/route.ts       GET /r/index.json — flat list
      r/[name]/route.ts           GET /r/<name>.json — single item (CLI fetches from here)
      docs/page.ts                docs root
      docs/components/[name]/page.ts  per-component docs page
```

## Public commands (binary: `webjsui`)

| Command | What it does |
|---|---|
| `webjsui init` | Initialize a project — writes `components.json`, copies `lib/utils.ts`, appends theme CSS |
| `webjsui add <names...>` | Resolve transitive deps, copy component sources, install npm deps |
| `webjsui list [filter]` | List components in the registry |
| `webjsui view <name>` | Print a component's source to stdout |
| `webjsui diff [name]` | Show diffs between local and registry |
| `webjsui info` | Print project type + config + registry URL |
| `webjsui build [file]` | Compile a custom registry (for registry authors) |

## Webjs‑CLI subcommand

`webjs ui <subcmd>` proxies to `@webjskit/ui`. Implementation lives in
[`../cli/bin/webjs.js`](../cli/bin/webjs.js) under `case 'ui':`. Resolves
`@webjskit/ui` from the CLI's own location (it's a hard dependency of
`@webjskit/cli`), with a fallback to the user's `cwd`.

## Package-specific invariants

1. **`@webjskit/ui` is a hard dependency of `@webjskit/cli`.** Listed in
   `packages/cli/package.json` `dependencies` — global `webjs` install ships
   with the UI CLI out of the box. `webjs create` also preinstalls it as a
   devDependency in scaffolded apps (see `packages/cli/lib/create.js`).

2. **Registry wire format mirrors shadcn's `registryItemSchema`.** Same `name`,
   `type`, `files[].path/content/target`, `dependencies`, `devDependencies`,
   `registryDependencies` shape. A shadcn-compatible client could in principle
   point at our registry URL and consume it (modulo TS vs TSX file extensions).

3. **Components are light DOM + Tailwind.** Each extends `WebComponent` from
   `@webjskit/core`. Children projection uses the `innerHTML`-capture pattern
   (capture `this.innerHTML` in `connectedCallback` BEFORE `super`, re-emit via
   `unsafeHTML`). Light DOM means the host's Tailwind stylesheet reaches the
   component template directly — exact visual parity with shadcn.

4. **`@webjskit/core` is the single runtime dependency.** No Radix, no
   class-variance-authority, no clsx, no tailwind-merge. The `cn()` helper
   in `lib/utils.ts` is hand-rolled. Components that need positioning import
   `@floating-ui/dom`; the CLI auto-installs it.

5. **All 7 base colours** ship as `registry:theme` items (neutral, stone, zinc,
   mauve, olive, mist, taupe). `init` writes one into the user's global CSS.

## Component tag convention

Single `ui-` prefix; sub-components hyphenated:

```html
<ui-button variant="default" size="lg">Click me</ui-button>

<ui-card>
  <ui-card-header>
    <ui-card-title>Title</ui-card-title>
    <ui-card-description>Description</ui-card-description>
  </ui-card-header>
  <ui-card-content>
    <ui-input placeholder="Type here..." />
  </ui-card-content>
  <ui-card-footer>
    <ui-button>Save</ui-button>
  </ui-card-footer>
</ui-card>

<ui-dialog>
  <ui-dialog-trigger><ui-button>Open</ui-button></ui-dialog-trigger>
  <ui-dialog-content>
    <ui-dialog-header>
      <ui-dialog-title>Confirm</ui-dialog-title>
      <ui-dialog-description>Are you sure?</ui-dialog-description>
    </ui-dialog-header>
  </ui-dialog-content>
</ui-dialog>
```

Direct 1:1 mapping with shadcn's React tag names. `Button` → `ui-button`,
`DialogContent` → `ui-dialog-content`, etc. The AI translation from a known
shadcn pattern to a webjs page is mechanical.

## Tests

```sh
npm test --workspace=@webjskit/ui    # schema + resolver + project-detect + config
```

The component sources themselves are smoke-validated via the registry build
(empty content is flagged, schema is re-validated on every file). Browser
tests for individual components are deliberately limited in v1.

## Building / running

```sh
npm run ui:build                     # rebuild registry/r/*.json
npm run ui:dev                       # serve the registry website on :5001
```

## Scope cuts in v1 (documented, not abandoned)

- `chart` — DOM scaffolding only; no recharts/vega-lite integration.
- `sidebar` — visual layout works; no drag-to-resize / cookie persistence.
- `command`, `combobox` — substring filter only (no fuzzy ranking).
- `calendar` — month view, single date select only.
- `form` — layout primitives; no React Hook Form equivalent.
- `carousel` — simple slide tracker; no swipe gestures, no autoplay.

Each component file has a header TODO when scope was trimmed.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
