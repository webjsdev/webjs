# @webjsdev/ui

An **AI-first component library** for the web. Source-copied into your project , 
you own the code.

Two-tier composition designed for AI agents who reason about real HTML +
function calls, not for a layered React abstraction over every primitive:

- **Tier 1, class-helper functions** (`buttonClass`, `cardClass`,
  `inputClass`, `labelClass`, `alertClass`, `popoverContentClass`,
  `accordionItemClass`, `collapsibleTriggerClass`, …). Pure functions that
  return Tailwind class strings. You spread them onto raw native elements
 , including `<button class=${buttonClass({ variant: 'outline' })}>`,
  `<details name="faq" class=${accordionItemClass()}>`, and
  `<div popover class=${popoverContentClass()}>`, so real native elements
  participate in form submission, autocomplete, screen readers, the
  Popover API ancestry, and devtools as themselves.
- **Tier 2, stateful custom elements** (`<ui-dialog>`, `<ui-alert-dialog>`,
  `<ui-tabs>`, `<ui-tooltip>`, `<ui-hover-card>`, `<ui-dropdown-menu>`,
  `<ui-sonner>`, …). Reserved for the behavior the browser still doesn't
  give you for free: hover-with-delay tooltips, roving-focus keyboard nav
  for menus and tabs, toast queue with stack and dismiss. Dialog and
  alert-dialog wrap the native `<dialog>.showModal()`, so focus trap,
  Escape, and backdrop overlay all come from the platform. Light DOM
  throughout (no shadow DOM); authored children project through `<slot>`.

Works with any project that uses Tailwind CSS v4 and supports custom elements:
webjs, Next, Astro, Vite, SvelteKit, Lit, vanilla HTML, as long as Tailwind
is configured, the components render correctly. Variant names, sizes, and
data-attribute conventions mirror shadcn's so an AI agent's existing
knowledge of shadcn maps directly.

Tier-2 elements extend `WebComponent` from `@webjsdev/core`, a tiny
Lit-shaped base class with `static properties` for reactive attributes,
`render()` returning an `` html`...` `` template, and declarative
bindings (`@click`, `?attr`, `attr=`). Light DOM throughout, so Tailwind
utility classes on authored children apply directly. The `webjsui add`
CLI installs `@webjsdev/core` automatically when you add a Tier-2
component.

## Install

### Option A : Webjs users (already have `@webjsdev/cli`)

Nothing to install. `@webjsdev/ui` is a hard dependency of `@webjsdev/cli`,
so a global webjs install already includes it. Apps scaffolded with
`webjs create` also have it pre-listed in `devDependencies`.

```sh
webjs ui init
webjs ui add button card dialog
```

### Option B : Everyone else (Next, Astro, Vite, SvelteKit, Lit, vanilla, …)

Two npm installs, the CLI and the runtime base class, then run the CLI:

```sh
npm install -D @webjsdev/ui
npm install @webjsdev/core
npx webjsui init
npx webjsui add button card dialog
```

The `webjsui` binary is standalone, it doesn't require `@webjsdev/cli`.
`init` auto-detects your project type (Next / Astro / Vite / Lit / plain)
and picks sensible defaults.

## What `init` writes

- `components.json`, your project's UI config (aliases, base color, Tailwind path)
- `lib/utils.ts`, the `cn()` class-merge helper
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
