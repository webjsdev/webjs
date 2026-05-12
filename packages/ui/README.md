# @webjskit/ui

An **AI-first component library** for the web. Source-copied into your project —
you own the code.

Two-tier composition designed for AI agents who reason about real HTML +
function calls, not for a layered React abstraction over every primitive:

- **Tier 1 — class-helper functions** (`buttonClass`, `cardClass`,
  `inputClass`, `labelClass`, `alertClass`, …). Pure functions that return
  Tailwind class strings. You spread them onto raw native elements —
  `<button class=${buttonClass({ variant: 'outline' })}>` — so a real
  `<button>` participates in form submission, autocomplete, screen readers,
  and devtools as itself.
- **Tier 2 — stateful custom elements** (`<ui-dialog>`, `<ui-popover>`,
  `<ui-tabs>`, `<ui-tooltip>`, `<ui-dropdown-menu>`, `<ui-accordion>`, …).
  Reserved for behavior the browser doesn't give you natively: focus
  traps, portaled overlays, keyboard-navigated lists, body-scroll lock.
  Decorate the host, no shadow DOM.

Works with any project that uses Tailwind CSS v4 and supports custom elements:
webjs, Next, Astro, Vite, SvelteKit, Lit, vanilla HTML — as long as Tailwind
is configured, the components render correctly. Variant names, sizes, and
data-attribute conventions mirror shadcn's so an AI agent's existing
knowledge of shadcn maps directly.

Tier-2 elements extend `Base` (a Node-safe `HTMLElement` shim) from a small
shared `lib/utils.ts` the CLI writes into your project.

## Install

### Option A — Webjs users (already have `@webjskit/cli`)

Nothing to install. `@webjskit/ui` is a hard dependency of `@webjskit/cli`,
so a global webjs install already includes it. Apps scaffolded with
`webjs create` also have it pre-listed in `devDependencies`.

```sh
webjs ui init
webjs ui add button card dialog
```

### Option B — Everyone else (Next, Astro, Vite, SvelteKit, Lit, vanilla, …)

Two npm installs — the CLI and the runtime base class — then run the CLI:

```sh
npm install -D @webjskit/ui
npm install @webjskit/core
npx webjsui init
npx webjsui add button card dialog
```

The `webjsui` binary is standalone — it doesn't require `@webjskit/cli`.
`init` auto-detects your project type (Next / Astro / Vite / Lit / plain)
and picks sensible defaults.

## What `init` writes

- `components.json` — your project's UI config (aliases, base color, Tailwind path)
- `lib/utils.ts` — the `cn()` class-merge helper
- Tailwind tokens + CSS variables appended to your global stylesheet

## What `add` does

Copies the component's `.ts` source into `components/ui/<name>.ts` (or your
configured alias). Resolves transitive deps via `registryDependencies` and
auto-installs npm deps like `@floating-ui/dom` for popover-style components.

## Commands

| Command | Effect |
|---|---|
| `webjsui init` | Initialize a project (writes `components.json`, theme CSS, `lib/utils.ts`) |
| `webjsui add <names...>` | Add components to your project |
| `webjsui list` | List all available components |
| `webjsui view <name>` | Print a component's source to stdout |
| `webjsui diff [name]` | Show diff between your local copy and the registry |
| `webjsui info` | Print project diagnostics |
| `webjsui build` | (For registry authors) Compile a custom registry |

## Tag convention

Every component uses a single `ui-` prefix:

```html
<ui-button variant="default">Click me</ui-button>
<ui-card>
  <ui-card-header>
    <ui-card-title>Title</ui-card-title>
    <ui-card-description>Description</ui-card-description>
  </ui-card-header>
  <ui-card-content>Content here</ui-card-content>
</ui-card>
```

## License

MIT
