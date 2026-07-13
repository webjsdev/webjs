# AGENTS.md : @webjsdev/ui

The webjs **AI-first component library + CLI**, `webjsui init` / `add` /
`list` / `view` / `diff` / `info` / `build`. Ships 32 primitives across two
tiers: class-helper functions for visual components, custom elements only
where state matters. Variant names, sizes, and data-attribute conventions
mirror shadcn so existing shadcn knowledge transfers directly.

Framework-wide rules live in the root [`../../AGENTS.md`](../../AGENTS.md) and
apply here. Read that first. This file only covers what's specific to
`@webjsdev/ui`.

## Architecture : composition-first, two tiers

`@webjsdev/ui` ships **class-helper functions** (returning Tailwind class
strings) and **a small set of stateful custom elements**, never bundled
wrappers around native form controls.

### Tier 1 : class helpers (the majority)

Pure functions returning Tailwind class strings. Compose with whatever
native element you want.

```ts
import { buttonClass, cardClass, inputClass, labelClass, fieldClass, hintClass }
  from '@/components/ui';

html`
  <div class=${cardClass()}>
    <form class=${formClass()}>
      <div class=${fieldClass()}>
        <label class=${labelClass()} for="email">Email</label>
        <input class=${inputClass()} type="email" id="email" name="email"
               aria-describedby="email-hint" required>
        <p class=${hintClass()} id="email-hint">We never share it.</p>
      </div>
      <button class=${buttonClass()} type="submit">Sign up</button>
    </form>
  </div>
`
```

Helpers that take options accept an object: `buttonClass({ variant: 'outline', size: 'sm' })`.

### Tier 2 : stateful custom elements

For things the browser doesn't provide natively: dialogs, alert-dialogs,
tabs, dropdowns, tooltips, hover-cards, toggle / toggle-group, sonner.
Tier-2 components extend the `WebComponent({ ... })` factory from
`@webjsdev/core` and are Lit-shaped: the factory shape declares reactive
attributes, `render()`
returning an `` html`...` `` template, declarative bindings (`@click`,
`?attr`, `attr=`, `.prop`), and `<slot></slot>` for projecting authored
children. Light DOM throughout, full shadow-DOM slot parity.

popover, accordion, and collapsible used to live here but migrated to
Tier 1 once their behaviour could be expressed by native primitives
(the HTML Popover API + `<details>` / `<summary>` + CSS Anchor
Positioning).

```ts
html`
  <ui-dialog>
    <ui-dialog-trigger>
      <button class=${buttonClass({ variant: 'outline' })}>Edit</button>
    </ui-dialog-trigger>
    <ui-dialog-content>
      <div class=${dialogHeaderClass()}>
        <h2 class=${dialogTitleClass()}>Edit profile</h2>
        <p class=${dialogDescriptionClass()}>Make changes here.</p>
      </div>
      <!-- a real form inside; submission works normally -->
      <form action="/profile" method="post" class=${formClass()}>…</form>
    </ui-dialog-content>
  </ui-dialog>
`
```

## Module map

```
packages/ui/
  bin/
    webjsui.js                    standalone binary entry
  src/
    index.js                      CLI entry (Commander program + dispatch)
    commands/
      init.js                     init, writes components.json, theme CSS, lib/utils.ts
      add.js                      add, resolve registry items + write into project + install deps
      list.js                     list, show all registry items
      view.js                     view, print a component's source
      diff.js                     diff, compare local vs registry
      info.js                     info, project diagnostics
      build.js                    build, compile a custom registry (for registry authors)
    registry/
      schema.js                   zod schemas (wire-compatible with shadcn's)
      fetcher.js                  HTTP GET + cache for registry items
      resolver.js                 walk registryDependencies transitively
    utils/
      get-config.js               read components.json
      detect-project.js           webjs / next / vite / astro / plain detection
      logger.js                   kleur-based logger
  test/
    schema.test.js                schema validation
    resolver.test.js              transitive deps + npm dedupe
    detect-project.test.js        project-type detection + defaults
    get-config.test.js            config read/write/round-trip

  packages/registry/              the registry (internal, not published)
    components/                   .ts files, one per component
    lib/utils.ts                  cn() helper + layout/typography helpers (Tier-2 components extend WebComponent from @webjsdev/core directly)
    themes/
      index.css                   @theme block + CSS variables (light + dark, neutral defaults)
      base-colors.js              per-base-colour overrides (stone/zinc/mauve/olive/mist/taupe) + mergeThemeCss
    registry.json                 manifest (item names + types + file paths + deps)

  packages/website/               the registry HTTP host + docs (internal)
    app/
      layout.ts, page.ts          docs site shell + home
      _components/                hand-written website-chrome custom elements (theme-toggle, …)
      _lib/registry.server.ts     composes registry JSON on demand from ../../registry/
      registry/route.ts                  GET /registry, full manifest (composed on demand)
      registry/index.json/route.ts       GET /registry/index.json, flat list
      registry/[name]/route.ts           GET /registry/<name>.json, single item (CLI fetches here)
      docs/page.ts                docs root
      docs/components/[name]/page.ts  per-component docs page
    components/                   GITIGNORED, auto-populated by webjs.dev.before / webjs.start.before (scripts/copy-registry.js, #550)
    lib/                          GITIGNORED, same as above (for utils.ts)
```

### ⚠️ ui-website footgun : do NOT write hand-written files into `packages/website/components/`

`packages/website/` is the publisher AND a consumer of the kit, so its
`components/` and `lib/` directories are wholesale gitignored , 
`scripts/copy-registry.js` regenerates them via `webjs.dev.before` /
`webjs.start.before` (#550) by mirroring
`../registry/` with each component's `'../lib/utils.ts'` import rewritten
to the website's depth. **Anything hand-written you put in
`packages/website/components/*` or `packages/website/lib/*` is invisible
to git, never reaches the deploy, and breaks SSR with a prod 500
(this has happened, see git log for the favicon / theme-toggle incidents).**

Hand-written components for the website go in
**`packages/website/app/_components/`** instead. The underscore prefix
keeps them out of the router, the directory is tracked normally, and
the `components/` mirror's gitignore can stay simple.

This trap exists ONLY in `packages/website/`. Scaffolded user apps,
`examples/blog`, and every other webjs app keep `components/ui/` as
normal tracked source, the standard shadcn "you own it" pattern.
See [`packages/website/AGENTS.md`](packages/website/AGENTS.md) for the
full per-directory breakdown.

## v1 component inventory (32 components)

| Tier | Component | Surface |
|---|---|---|
| 1a | `button` | `buttonClass({ variant, size })`, 6 variants × 8 sizes |
| 1a | `badge` | `badgeClass({ variant })`, 6 variants |
| 1a | `alert` | `alertClass({ variant })`, `alertTitleClass`, `alertDescriptionClass` |
| 1a | `card` | `cardClass`, `cardHeaderClass`, `cardTitleClass`, `cardDescriptionClass`, `cardActionClass`, `cardContentClass`, `cardFooterClass` |
| 1a | `input` / `textarea` / `label` | `inputClass`, `textareaClass`, `labelClass` |
| 1a | `checkbox` | `checkboxClass`, native `<input type="checkbox">` with SVG check on `:checked` |
| 1a | `radio-group` | `radioGroupClass`, `radioClass`, native `<input type="radio">` |
| 1a | `switch` | `switchInputClass`, `switchTrackClass({ size })`, hidden native checkbox + visible track |
| 1a | `native-select` | `nativeSelectWrapperClass`, `nativeSelectClass`, `nativeSelectIconClass`, `nativeSelectOptionClass`, `nativeSelectOptGroupClass` |
| 1a | `avatar` | `avatarClass`, `avatarImageClass`, `avatarFallbackClass`, `avatarBadgeClass`, `avatarGroupClass`, `avatarGroupCountClass` |
| 1a | `separator` | `separatorClass({ orientation })` |
| 1a | `skeleton` | `skeletonClass` |
| 1a | `aspect-ratio` | `aspectRatioClass`, use Tailwind `aspect-[16/9]` directly |
| 1a | `kbd` | `kbdClass`, `kbdGroupClass` |
| 1a | `table` | `tableContainerClass`, `tableClass`, `tableHeaderClass`, `tableBodyClass`, `tableFooterClass`, `tableRowClass`, `tableHeadClass`, `tableCellClass`, `tableCaptionClass` |
| 1a | `toggle` | `toggleClass({ variant, size })`, pair with native `<button>` |
| 1a | `breadcrumb` | `breadcrumbListClass`, `breadcrumbItemClass`, `breadcrumbLinkClass`, `breadcrumbPageClass`, `breadcrumbSeparatorClass`, `breadcrumbEllipsisClass` |
| 1a | `pagination` | `paginationClass`, `paginationContentClass`, `paginationLinkClass({ isActive, size })`, `paginationPreviousClass`, `paginationNextClass`, `paginationEllipsisClass` |
| 1b | `popover` | `popoverContentClass`, `popoverHeaderClass`, `popoverTitleClass`, `popoverDescriptionClass`. Compose with `<button popovertarget="id">` + `<div popover id="id">`; positioning via CSS anchor positioning or the exported `positionFloating` helper. |
| 1b | `accordion` | `accordionClass`, `accordionItemClass`, `accordionTriggerClass`, `accordionContentClass`. Compose with `<details name="...">` + `<summary>`; `name` provides exclusive-open behavior natively. |
| 1b | `collapsible` | `collapsibleClass`, `collapsibleTriggerClass`, `collapsibleContentClass`. Compose with `<details>` + `<summary>`. |
| 1b | `progress` | `progressClass()`, apply to native `<progress value max>`. Browser draws the bar via `::-webkit-progress-value` and `::-moz-progress-bar`. Omit `value` for the indeterminate / pulse state. |
| 2  | `toggle-group` | `<ui-toggle-group type value variant size>` + `<ui-toggle-group-item value>`. Roving tabindex (one Tab stop) with Arrow / Home / End navigation, plus `aria-pressed` per item. |
| 2  | `dialog` | `<ui-dialog>` + `<ui-dialog-trigger>` / `<ui-dialog-content>` / `<ui-dialog-close>`. Built on native `<dialog>.showModal()`, top-layer rendering, ::backdrop overlay, focus trap, Escape close, and focus restoration are all platform-provided. We add body-scroll lock + class helpers for `dialogHeader/Title/Description/Footer`. On open it wires `aria-labelledby` / `aria-describedby` to the `data-slot="dialog-title"` / `dialog-description` nodes (falling back to the first heading / paragraph). |
| 2  | `alert-dialog` | Like dialog, role=alertdialog. Native Escape close is cancelled via the `cancel` event; no backdrop-click dismissal. `<ui-alert-dialog-action>` / `<ui-alert-dialog-cancel>`. Wires `aria-labelledby` / `aria-describedby` to its `alert-dialog-title` / `alert-dialog-description` the same way. |
| 2  | `tooltip` | `<ui-tooltip delay-duration>`, hover/focus + delay. Content uses `popover="manual"` for top-layer rendering. The trigger references the tip via `aria-describedby` (APG tooltip wiring). |
| 2  | `hover-card` | `<ui-hover-card open-delay close-delay>`, hover with linger-keep-open. Content uses `popover="manual"` for top-layer rendering. The trigger (focusable, also opens on focus) gets `aria-haspopup` / `aria-expanded` / `aria-controls`. |
| 2  | `tabs` | `<ui-tabs value orientation>` + List / Trigger / Content. Arrow-key keyboard nav. Triggers carry `aria-controls`, panels `aria-labelledby` (cross-linked per group), the list `aria-orientation`, and an inactive panel is `inert`. |
| 2  | `dropdown-menu` | `<ui-dropdown-menu>` + Trigger / Content / Item (variant) / Label / Separator / Shortcut / Group. Content uses `popover="manual"` for top-layer rendering. ArrowUp/Down nav, Escape close. Menu declares `aria-orientation`, a `data-disabled` item reflects `aria-disabled`, and the trigger gets `aria-haspopup` / `aria-expanded` / `aria-controls`. |
| 2  | `sonner` | `<ui-sonner position>` + `toast()` / `toast.success` / `toast.error` / `toast.promise` API. The viewport is a persistent `aria-live` region so inserted toasts are announced (an `error` toast is `role=alert`). |

## Accessibility

The kit aims for 100% accessibility out of the box, but the responsibility
splits by tier, and an agent MUST know which half it owns.

**Tier-2 custom elements own their ARIA.** Because the element renders its own
markup, it wires the WAI-ARIA pattern itself, with zero author effort: tabs
cross-links triggers and panels (`aria-controls` / `aria-labelledby`), reports
`aria-orientation`, and marks an inactive panel `inert`; toggle-group uses
roving tabindex plus Arrow / Home / End; dropdown-menu declares
`aria-orientation`, reflects `aria-disabled` on a `data-disabled` item, and
gives the trigger `aria-haspopup` / `aria-expanded` / `aria-controls`; dialog
and alert-dialog name themselves from their title and description on open;
tooltip references its tip with `aria-describedby`; hover-card exposes the
popup relationship on its (focus-openable) trigger; sonner is a persistent
`aria-live` region. Do not hand-add these attributes; the element already has.

**Tier-1 class helpers push their ARIA to YOU.** A helper returns only Tailwind
classes, so the semantic element, role, and ARIA are the caller's job. Every
Tier-1 component's JSDoc carries an `A11y (required for accessible output)`
block stating exactly what to supply. The recurring obligations:

- `button`: an icon-only button needs `aria-label`; an overlay trigger needs `aria-haspopup` + `aria-expanded`.
- `alert`: choose `role="alert"` (urgent) or `role="status"` (polite).
- `separator`: `role="separator"` + `aria-orientation`, or `role="none"` when decorative.
- `skeleton`: `aria-hidden="true"` (or `aria-busy` on the region), since it is a placeholder.
- `avatar`: an `alt` that names the person, plus the text fallback.
- `table`: `scope="col"` / `scope="row"` on header cells, and a `<caption>`.
- `pagination` / `breadcrumb`: a labelled `<nav>`, `aria-current="page"`, and hidden separators / icon-only control names.
- `progress`: an `aria-label` (the native element supplies the role + value).

Browser tests for the Tier-2 guarantees live in
`test/components/browser/ui-a11y.test.js`.

## Public commands (binary: `webjsui`)

| Command | What it does |
|---|---|
| `webjsui init` | Initialize a project, writes `components.json`, copies `lib/utils.ts`, appends theme CSS |
| `webjsui add <names...>` | Resolve transitive deps, copy component sources, install npm deps |
| `webjsui list [filter]` | List components in the registry |
| `webjsui view <name>` | Print a component's source to stdout |
| `webjsui diff [name]` | Show diffs between local and registry |
| `webjsui info` | Print project type + config + registry URL |
| `webjsui build [file]` | Compile a custom registry (for registry authors) |

## Webjs‑CLI subcommand

`webjs ui <subcmd>` proxies to `@webjsdev/ui`. Implementation lives in
[`../cli/bin/webjs.js`](../cli/bin/webjs.js) under `case 'ui':`.

## Package-specific invariants

1. **`@webjsdev/ui` is a hard dependency of `@webjsdev/cli`.** Global
   `webjs` install ships with the UI CLI out of the box.

2. **No third-party runtime deps.** No clsx, no tailwind-merge, no
   class-variance-authority, no Radix, no `@floating-ui/dom`, no `sonner`.
   Hand-rolled `cn()` in `lib/utils.ts`, hand-rolled positioning in
   `popover.ts` (re-used by tooltip and hover-card via export),
   hand-rolled focus trap in `dialog.ts`, hand-rolled toast queue in
   `sonner.ts`.

3. **Registry wire format mirrors shadcn's `registryItemSchema`.**
   Same shape, so a shadcn-compatible client could in principle consume
   our registry (modulo TS vs TSX extensions).

4. **Light DOM + Tailwind everywhere.** Tier-2 custom elements extend
   `WebComponent` from `@webjsdev/core` and use Lit-shaped `render()` +
   `html` `` templates with declarative bindings. Light DOM means
   Tailwind utility classes apply directly to authored children that
   project through `<slot>`. No shadow root anywhere; full shadow-DOM
   slot parity in light DOM.

5. **API parity with shadcn.** Variant names, size names, subcomponent
   breakdown, `data-state` / `data-orientation` / `data-side` /
   `data-align` attribute conventions all match shadcn 1:1. An AI agent
   trained on shadcn maps its knowledge directly:
   - `<DialogContent>` → `<ui-dialog-content>`
   - `variant="destructive"` → `variant="destructive"` (same)
   - `onValueChange={fn}` → `addEventListener('ui-value-change', fn)`
   - `asChild` → drop the wrapper, apply the class helper directly

6. **Native form controls participate in `<form>` submission natively.**
   `<input type="checkbox" class=${checkboxClass()}>` is a real input , 
   no `ElementInternals`, no `setFormValue` proxying. Submission,
   autofill, browser autocomplete, native validation all work.

## Component tag convention (Tier 2)

Single `ui-` prefix; sub-components hyphenated. Matches shadcn's React tag
names mechanically:

```html
<ui-dialog>          <!-- = <Dialog> -->
  <ui-dialog-trigger>  <!-- = <DialogTrigger> -->
  <ui-dialog-content>  <!-- = <DialogContent> -->
```

## Class-helper conventions (Tier 1)

- Helpers with no parameters: `cardClass()`, `inputClass()`, etc.
- Helpers with variants: `buttonClass({ variant, size })`, object arg, all keys optional.
- All `.ts` files in `components/` export named functions. No default exports.
- Use `cn()` from `'../lib/utils.ts'` to merge a helper's output with
  user-supplied classes when needed: `<button class=${cn(buttonClass(), 'rounded-full')}>`.

## Layout + typography helpers (the design system)

These live in `lib/utils.ts` and are foundational, encode the spacing
and typography rhythm.

| Helper | Returns | Use for |
|---|---|---|
| `fieldClass()` | `grid gap-2` | Vertical rhythm: label ↔ input ↔ hint |
| `fieldRowClass()` | `flex items-center gap-3` | Horizontal label-and-input |
| `stackClass({ gap })` | `grid gap-{3\|6\|8}` | Multiple form fields stacked |
| `formClass()` | `grid gap-6` | `<form>` body rhythm |
| `sectionClass()` | `grid gap-8` | Page sections |
| `fieldLabelClass()` | label typography | `<label>` text style |
| `hintClass()` | `text-sm text-muted-foreground` | Helper text below input |
| `helpClass()` | `text-xs text-muted-foreground` | Tertiary muted text |
| `errorClass()` | `text-sm font-medium text-destructive` | Validation error text |

Change one helper to retune the entire app, every form field that uses
`fieldClass()` updates atomically.

## Tests

```sh
npm test --workspace=@webjsdev/ui    # schema + resolver + project-detect + config
```

Tests live in **`packages/ui/test/`** as flat files for the CLI
helpers (`schema.test.js`, `resolver.test.js`,
`detect-project.test.js`, etc.) plus `test/registry-contents.test.js`
which smoke-validates the component sources (reads
`components/*.ts` and verifies Tier-1/Tier-2 shape + hallmark
class strings).

Real-browser tests for the kit live under
`packages/ui/test/components/browser/`
(`ui-overlay.test.js`, `ui-stateful.test.js`) and run via the
top-level `npm run test:browser`. See
[`references/testing.md`](../../.agents/skills/webjs/references/testing.md) for
the overall layout.

## Building / running

```sh
npm run ui:dev                       # serve the registry website on :5003
```

**No registry build step.** Registry JSON is composed on demand by the
website's route handlers (see `app/_lib/registry.server.ts`). Source of
truth is `packages/registry/components/*.ts` + `registry.json` +
`themes/base-colors.js`. Cached in memory after first request.

Theme synthesis: only `theme-neutral` is declared in `registry.json`
(canonical CSS lives at `themes/index.css`). The other 6 base colours , 
`theme-stone`, `theme-zinc`, `theme-mauve`, `theme-olive`, `theme-mist`,
`theme-taupe`, are synthesized on demand by merging per-colour
overrides from `themes/base-colors.js` into the neutral CSS. All 7
themes return the same `files: [{ target: 'app/globals.css', content }]`
shape so `webjsui init --base-color <name>` works uniformly.

## Deferred to v2 (not in the registry)

These shadcn components are NOT shipped in v1, their old-pattern source
files have been **removed entirely** from `packages/registry/components/`.
When v2 starts, write fresh files following the Tier-1 / Tier-2 conventions
above:

button-group, calendar, carousel, chart, combobox, command, context-menu,
direction, drawer, empty, field, form, input-group, input-otp, item,
menubar, navigation-menu, resizable, scroll-area, select (rich), sheet,
sidebar, slider, spinner.

Each will get a "v2" docs page that explains the scope cut and a workaround
(native equivalent, or recommended alternative library) until shipped.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
