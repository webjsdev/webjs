# AGENTS.md : @webjsdev/ui

The webjs **AI-first component library + CLI**, `webjsui init` / `add` /
`list` / `view` / `diff` / `info` / `build` / `lint`. Ships 62 primitives across two
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
sheets, drawers, tabs, dropdowns, context menus, menubars, navigation menus,
tooltips, hover-cards, toggle / toggle-group, sonner, and the rich form
controls (select, combobox, command, input-otp, slider, calendar,
questionnaire), and the layout family (carousel, resizable, message-scroller,
sidebar).
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
      init.js                     init, writes components.json, theme CSS, lib/utils/cn.ts (defaults are fixed constants)
      add.js                      add, resolve registry items + write into project + install deps
      list.js                     list, show all registry items
      view.js                     view, print a component's source
      diff.js                     diff, compare local vs registry
      info.js                     info, project diagnostics
      build.js                    build, compile a custom registry (for registry authors)
      lint.js                     lint, the opt-in design-system linter (runLint() is the pure core the test calls)
    lint/
      index.js                    lintApp(): walks the D7 scope, runs the scanner, dispatches sites to the enabled rules (the one filesystem-touching module)
      grammar.js                  `webjsui lint` token grammar: parseToken() (arbitrary VALUE vs VARIANT), groupOf(), GROUP_CATEGORY (shadcn-ui/lint's taxonomy, verbatim)
      scan.js                     the class-site scanner (html-template attributes, cn() args, class=${} holes), pure over source
      rules/                      the three rules, each pure `(site, ctx) => violations`: no-raw-colors, no-arbitrary-values, no-restyle
      theme-tokens.js             READS the app's `--color-*` tokens from its @theme / @theme inline blocks (utils/theme.js WRITES them)
    registry/
      schema.js                   zod schemas (wire-compatible with shadcn's) + the opt-in `lint` block of components.json
      local.js                    LOCAL-FIRST composer: read the packaged registry from disk (no network)
      fetcher.js                  network GET + cache; local-vs-network dispatch (getRegistryItem/Index)
      example.js                  extract / strip the module-JSDoc @example block
      extract.js                  shared kit projector (view + MCP `ui` tool): inventory + per-component helpers/example/deps, plus extractHelperAxes() (the variant / size VALUES a `webjsui lint` no-restyle message names)
      style-bake.js               the style bake (#1666): createStyleMap() (a style file's @apply rules -> { 'cn-x': classes }), classSegments() (the one lexer that finds class strings), bakeSource() / bakeForStyle() (replace every cn-* name with the chosen style's classes)
      resolver.js                 walk registryDependencies transitively
    utils/
      get-config.js               read components.json
      theme.js                    ensureTheme(): install the design tokens (init hard-fails, add self-heals)
      logger.js                   kleur-based logger
  test/
    schema.test.js                schema validation
    resolver.test.js              transitive deps + npm dedupe
    init-command.test.js          the components.json init writes + its fixed defaults
    get-config.test.js            config read/write/round-trip

  packages/registry/              the registry (internal, not published)
    components/                   .ts files, one per component
    lib/utils.ts                  cn() helper + layout/typography helpers (Tier-2 components extend WebComponent from @webjsdev/core directly)
    styles/                       the styles the bake applies (#1666): style-new-york.css (the default), the eight ported shadcn styles + supplement.json, shadcn-tailwind.css and tw-animate.css (vendored)
    themes/
      index.css                   @theme block + CSS variables (light + dark, neutral defaults)
      base-colors.js              per-base-colour overrides (stone/zinc/mauve/olive/mist/taupe) + mergeThemeCss
    registry.json                 manifest (item names + types + file paths + deps)
```

The gallery and the registry API moved onto the marketing site in #1099. They
now live outside this package:

```
website/                          the marketing site, at the repo root
  app/ui/layout.ts                the minimal /ui layout: the .ui-site tokens + the /ui stylesheet link
  app/ui/(chrome)/layout.ts       the /ui header and footer, plus the sidebar shell shared with /docs
  app/ui/(chrome)/page.ts         /ui, the gallery introduction
  app/ui/(chrome)/[name]/page.ts  /ui/<name>, one page per component
  app/ui/registry/route.ts               GET /ui/registry, full manifest
  app/ui/registry/index.json/route.ts    GET /ui/registry/index.json, flat list
  app/ui/registry/[name]/route.ts        GET /ui/registry/<name>.json (the CLI fetches here)
  modules/ui/queries/registry.server.ts  composes registry JSON on demand from THIS package
  modules/ui/components/, lib/utils/{cn,dom}.ts   GITIGNORED mirror of ../registry/, written by scripts/copy-registry.mjs
```

### ⚠️ Mirror footgun : do NOT hand-write files into the marketing site's `modules/ui/components/`

The marketing site is a consumer of this kit (its `/ui` pages import the
components to render live previews), so `website/modules/ui/components/` and
`website/lib/utils/{cn,dom}.ts` are gitignored: `website/scripts/copy-registry.mjs`
regenerates them via `webjs.dev.before` / `webjs.start.before` (#550) by
mirroring `../registry/` with each component's `'../lib/utils.ts'` and
`'../lib/dom.ts'` import rewritten to `'../../../lib/utils/cn.ts'` and
`'../../../lib/utils/dom.ts'`. (`website/components/ui/` is gitignored too,
but it is kept EMPTY for `webjs ui add`, and `website/lib/ui/` is tracked,
hand-written site code.) **Anything hand-written you put in the mirrored paths
directories is invisible to git, never reaches the deploy, and breaks SSR with
a prod 500** (this has happened, see git log for the favicon / theme-toggle
incidents on the old ui site).

The scope narrowed with #1099: only the `ui/` SUBDIRECTORIES are generated, so
the site's own `components/*.ts` and `lib/*.ts` are ordinary tracked source and
a hand-written site component goes there the normal way. The old
`app/_components/` workaround is gone along with the app that needed it.

This trap exists ONLY in the marketing site. Scaffolded user apps,
`examples/blog`, and every other WebJs app keep `components/ui/` as normal
tracked source, the standard shadcn "you own it" pattern.

## Component inventory (62 components)

| Tier | Component | Surface |
|---|---|---|
| 1a | `button` | `buttonClass({ variant, size })`, 6 variants × 8 sizes; `buttonVariants` is the same helper under shadcn's name |
| 1a | `badge` | `badgeClass({ variant })`, 6 variants; `badgeVariants` is the same helper under shadcn's name |
| 1a | `alert` | `alertClass({ variant })`, `alertTitleClass`, `alertDescriptionClass` |
| 1a | `card` | `cardClass`, `cardHeaderClass`, `cardTitleClass`, `cardDescriptionClass`, `cardActionClass`, `cardContentClass`, `cardFooterClass` |
| 1a | `input` / `textarea` / `label` | `inputClass`, `textareaClass`, `labelClass` |
| 1a | `checkbox` | `checkboxClass`, native `<input type="checkbox">` with SVG check on `:checked`. REQUIRES `data-slot="checkbox"` on the input for the check to render. |
| 1a | `radio-group` | `radioGroupClass`, `radioClass`, native `<input type="radio">`. REQUIRES `data-slot="radio"` on the input for the dot to render. |
| 1a | `switch` | `switchInputClass`, `switchTrackClass({ size })`, hidden native checkbox + visible track |
| 1a | `native-select` | `nativeSelectWrapperClass`, `nativeSelectClass`, `nativeSelectIconClass`, `nativeSelectOptionClass`, `nativeSelectOptGroupClass`. The `<option>` / `<optgroup>` colours come from the theme block's `select option, select optgroup` rule, NOT from importing the module (#1320), so they are in the first paint and hold with JavaScript off. |
| 1a | `avatar` | `avatarClass`, `avatarImageClass`, `avatarFallbackClass`, `avatarBadgeClass`, `avatarGroupClass`, `avatarGroupCountClass` |
| 1a | `separator` | `separatorClass({ orientation })` |
| 1a | `skeleton` | `skeletonClass` |
| 1a | `spinner` | `spinnerClass`, plus `spinner({ class, label, decorative })`, which returns an `html` inline SVG (the Lucide loader-circle path) with `role="status"` + `aria-label="Loading"`. It imports `html` from `@webjsdev/core` but registers no element, so it stays Tier 1. |
| 1a | `empty` | `emptyClass`, `emptyHeaderClass`, `emptyMediaClass({ variant })`, `emptyTitleClass`, `emptyDescriptionClass`, `emptyContentClass`. The root has `border-dashed` but no width (shadcn parity), so add `border` for the outline. |
| 1a | `field` | `fieldSetClass`, `fieldLegendClass({ variant })`, `fieldGroupClass`, `fieldClass({ orientation })`, `fieldContentClass`, `fieldLabelClass`, `fieldTitleClass`, `fieldDescriptionClass`, `fieldErrorClass`, `fieldSeparatorClass`, `fieldSeparatorContentClass`. Invalid state is `data-invalid="true"` on the field plus `aria-invalid` on the control. `fieldClass` and `fieldLabelClass` share their names with the older rhythm helpers in `lib/utils.ts` (copied to `lib/utils/cn.ts`); both sets keep working from their own modules, so a file needing both aliases one. |
| 1a | `aspect-ratio` | `aspectRatioClass`, use Tailwind `aspect-[16/9]` directly |
| 1a | `kbd` | `kbdClass`, `kbdGroupClass` |
| 1a | `table` | `tableContainerClass`, `tableClass`, `tableHeaderClass`, `tableBodyClass`, `tableFooterClass`, `tableRowClass`, `tableHeadClass`, `tableCellClass`, `tableCaptionClass` |
| 1a/2 | `toggle` | Hybrid: exports `toggleClass({ variant, size })` (pair with a native `<button>`) AND registers `<ui-toggle>`. Because it registers an element, the kit tooling (`webjs ui view` / the MCP `ui` tool / the `add` strip) treats it as Tier-2 and keeps its file whole. |
| 1a | `breadcrumb` | `breadcrumbListClass`, `breadcrumbItemClass`, `breadcrumbLinkClass`, `breadcrumbPageClass`, `breadcrumbSeparatorClass`, `breadcrumbEllipsisClass` |
| 1a | `pagination` | `paginationClass`, `paginationContentClass`, `paginationLinkClass({ isActive, size })`, `paginationPreviousClass`, `paginationNextClass`, `paginationEllipsisClass` |
| 1b | `popover` | `popoverContentClass`, `popoverHeaderClass`, `popoverTitleClass`, `popoverDescriptionClass`. Compose with `<button popovertarget="id">` + `<div popover id="id">`; positioning via CSS anchor positioning or the exported `positionFloating` helper. |
| 1b | `accordion` | `accordionClass`, `accordionItemClass`, `accordionTriggerClass`, `accordionContentClass`. Compose with `<details name="...">` + `<summary>`; `name` provides exclusive-open behavior natively. |
| 1b | `collapsible` | `collapsibleClass`, `collapsibleTriggerClass`, `collapsibleContentClass`. Compose with `<details>` + `<summary>`. |
| 1b | `progress` | `progressClass()`, apply to native `<progress value max>`. Browser draws the bar via `::-webkit-progress-value` and `::-moz-progress-bar`. Omit `value` for the indeterminate / pulse state. |
| 2  | `toggle-group` | `<ui-toggle-group type value variant size>` + `<ui-toggle-group-item value disabled>`. Roving tabindex (one Tab stop) with Arrow / Home / End navigation, plus `aria-pressed` per item. A `disabled` item reports `aria-disabled`, refuses activation, and is skipped by navigation and by the tab stop. |
| 2  | `dialog` | `<ui-dialog>` + `<ui-dialog-trigger>` / `<ui-dialog-content>` / `<ui-dialog-close>`. Built on native `<dialog>.showModal()`, top-layer rendering, ::backdrop overlay, focus trap, Escape close, and focus restoration are all platform-provided. We add a scroll lock (refcounted, and shift-free for a `position: fixed` header, see invariant 5) + class helpers for `dialogHeader/Title/Description/Footer`. On open it wires `aria-labelledby` / `aria-describedby` to the `data-slot="dialog-title"` / `dialog-description` nodes (falling back to the first heading / paragraph), onto the native `<dialog>`, which is also where `role="dialog"` sits so exactly ONE dialog-family node is exposed. There is no `aria-modal`: a `showModal()`-opened native dialog is already exposed as modal by the platform. |
| 2  | `alert-dialog` | `alertDialogMediaClass()` for the header media slot (`data-slot="alert-dialog-media"`). Like dialog, `role=alertdialog` on the native `<dialog>`. Native Escape close is cancelled via the `cancel` event; no backdrop-click dismissal. `<ui-alert-dialog-action>` / `<ui-alert-dialog-cancel>`. Wires `aria-labelledby` / `aria-describedby` to its `alert-dialog-title` / `alert-dialog-description` the same way. |
| 2  | `tooltip` | `<ui-tooltip delay-duration>`, hover/focus + delay. Content uses `popover="manual"` for top-layer rendering. The trigger references the tip via `aria-describedby` (APG tooltip wiring). Escape dismisses a showing tip without moving focus; a closed tip never consumes Escape. |
| 2  | `hover-card` | `<ui-hover-card open-delay close-delay>`, hover with linger-keep-open, mirrored for focus so in-card content is Tab-reachable. Content uses `popover="manual"` for top-layer rendering. The trigger (focusable, also opens on focus) gets `aria-haspopup` / `aria-expanded` / `aria-controls`; the `role="dialog"` panel is always named (author name, then a title node, then the trigger) and Escape dismisses it, returning focus to the trigger. |
| 2  | `tabs` | `<ui-tabs value orientation>` + List / Trigger / Content. Arrow / Home / End move focus AND selection via a roving tabindex (one Tab stop). Triggers carry `aria-controls`, panels `aria-labelledby` (cross-linked per group), the list `aria-orientation`, and an inactive panel is `inert`. |
| 2  | `dropdown-menu` | `<ui-dropdown-menu>` + Trigger / Content / Item (variant, `type="checkbox"` / `type="radio"` + `checked` / `value`) / Label / Separator / Shortcut / Group. Content uses `popover="manual"` for top-layer rendering. ArrowUp/Down nav, Home/End, typeahead, and synthesized Enter / Space activation (a `div[role=menuitem]` gets none natively). Escape closes the menu holding focus (a submenu first) and Tab closes and moves on; both return focus to the trigger, as do item activation and an outside click that did not itself land focus. Each submenu panel is named by its sub-trigger. Menu declares `aria-orientation`, a `data-disabled` item reflects `aria-disabled`, a checkable item carries `menuitemcheckbox` / `menuitemradio` + `aria-checked`, and the trigger gets `aria-haspopup` / `aria-expanded` / `aria-controls`. Emits a cancelable `ui-item-select`. |
| 2  | `sonner` | `<ui-sonner position>` + `toast()` / `toast.success` / `toast.error` / `toast.promise` API, with `action` and `cancel` per toast. The viewport is a persistent polite `aria-live` region so inserted toasts are announced, and it is the ONLY live root an ordinary toast resolves under (an `error` toast additionally carries `role=alert`, which is the only way to make one item assertive inside a polite viewport, so it accepts a second live root; a non-error toast carries no role of its own). Every toast carries a labelled close button so even a never-auto-dismissing `toast.loading()` can be dismissed by hand. |
| 1a | `button-group` | `buttonGroupClass({ orientation })` (alias `buttonGroupVariants`), `buttonGroupTextClass`, `buttonGroupSeparatorClass`. Joins adjacent buttons into one control. Give the group `role="group"` and an `aria-label`. |
| 1a | `input-group` | `inputGroupClass`, `inputGroupAddonClass({ align })` (alias `inputGroupAddonVariants`), `inputGroupButtonClass({ size })` (alias `inputGroupButtonVariants`), `inputGroupTextClass`, `inputGroupInputClass`, `inputGroupTextareaClass`. An input or textarea with addons (icons, text, buttons) inside one border. |
| 1a | `item` | `itemGroupClass`, `itemSeparatorClass`, `itemClass({ variant, size })` (alias `itemVariants`), `itemMediaClass({ variant })` (alias `itemMediaVariants`), `itemContentClass`, `itemTitleClass`, `itemDescriptionClass`, `itemActionsClass`, `itemHeaderClass`, `itemFooterClass`. A list row with media, text and actions. |
| 1a | `scroll-area` | `scrollAreaClass`. A native scroll container with a thin themed scrollbar. |
| 1a | `direction` | `readDirection(el)`. RTL needs no provider: every component uses logical properties, so `dir="rtl"` on an ancestor flips it. `readDirection` is for code that branches on the direction (an arrow-key handler). |
| 1a | `marker` | `markerClass({ variant })` (alias `markerVariants`), `markerIconClass`, `markerContentClass`. |
| 1a | `message` | `messageGroupClass`, `messageClass`, `messageAvatarClass`, `messageContentClass`, `messageHeaderClass`, `messageFooterClass`. A chat message row. |
| 1a | `bubble` | `bubbleGroupClass`, `bubbleClass({ variant })` (alias `bubbleVariants`), `bubbleContentClass`, `bubbleReactionsClass({ side })` (alias `bubbleReactionsVariants`). |
| 1a | `attachment` | `attachmentClass` / `attachmentVariants`, `attachmentMediaClass` / `attachmentMediaVariants`, `attachmentContentClass`, `attachmentTitleClass`, `attachmentDescriptionClass`, `attachmentActionsClass`, `attachmentActionClass`, `attachmentTriggerClass`, `attachmentGroupClass`. A file chip. |
| 1a | `trace` | `traceClass`, `traceLineClass`, `traceIconClass`, `traceTitleClass`, `traceDescriptionClass`, `traceCollapsibleClass`, `traceCollapsibleTriggerClass`, `traceCollapsibleContentClass`. A step-by-step activity log, collapsible through native `<details>`. |
| 2  | `sheet` | `<ui-sheet open>` + Trigger / Content (`side="top" \| "right" \| "bottom" \| "left"`) / Close, plus `sheetHeaderClass`, `sheetFooterClass`, `sheetTitleClass`, `sheetDescriptionClass`. A subclass of the dialog elements, so it is the same native `<dialog>` with the same focus trap, Escape and backdrop close, focus return, scroll lock and label wiring (`sheet-title` / `sheet-description`). `side` is a physical edge, as in shadcn. |
| 2  | `drawer` | `<ui-drawer open>` + Trigger / Content (`direction`) / Close, plus the header, footer, title and description helpers. The dialog elements again, with a hidden drag handle and drag-to-dismiss on Pointer Events (a quarter of the panel or a flick closes it, a drag never starts on a control). The panel carries `data-vaul-drawer-direction`, which shadcn's styles key on. Put a visible close button in every drawer, since dragging is a pointer convenience only. |
| 2  | `context-menu` | `<ui-context-menu>` + Trigger (around the region) / Content and every dropdown-menu part under `ui-context-menu-*`. Opens on right-click at the pointer, and on Shift+F10 or the ContextMenu key below the focused element. A left click never opens it. The region gets no `aria-haspopup` / `aria-expanded`, the menu is named by the content's `aria-label` (else "Context menu"), and every close returns focus to what had it. Make the region focusable and put each command somewhere a keyboard or touch user reaches without a right-click. |
| 2  | `menubar` | `<ui-menubar>` + Menu / Trigger / Content and every dropdown-menu part under `ui-menubar-*`. `role="menubar"` with one tab stop over the triggers, ArrowLeft / ArrowRight / Home / End between them, ArrowDown / ArrowUp to open on the first / last item, ArrowLeft / ArrowRight in an open menu to the neighbouring menu, a pointer switch while one is open, and one open menu per bar. The trigger renders the `role="menuitem"` button with `aria-haspopup` served. |
| 2  | `navigation-menu` | `<ui-navigation-menu viewport delay-duration skip-delay-duration>` + List / Item / Trigger / Content / Link / Indicator, plus `navigationMenuLinkClass` and `navigationMenuTriggerStyle`. A set of disclosures in a `<nav>` (named "Main" by default), never an ARIA menu: a real `ul` / `li`, button triggers with `aria-expanded` / `aria-controls`, panels named by their trigger, and `<ui-navigation-menu-link active>` rendering a real `<a>` with `aria-current="page"`. The root renders the viewport frame and sizes it to the open panel instead of moving the panel into it, so the frame does not animate its size between panels. |
| 2  | `select` | `<ui-select placeholder size position>` around an authored native `<select>` (D13): with JavaScript off the select is the control. On upgrade it is hidden visually only (never `display: none`, so it still submits, resets and anchors a validation bubble) and a `role="combobox"` trigger plus a `role="listbox"` are drawn from its options (`<optgroup>` a named group, `<hr>` a separator, a placeholder option of `value=""` plus `hidden` or `disabled` left out). The trigger is named by the select's labels and carries its `aria-describedby` / `aria-invalid`, and a label click and a failed submit both land on it. Options take real focus, as in Radix, because every style highlights with `focus:`. `position="item-aligned"` (default) opens over the trigger on the chosen option, `"popper"` below it. `selectTriggerClass()` also styles the native select for the no-JavaScript paint. |
| 1a/2 | `slider` | `sliderClass()` styles one native `<input type="range">` with no JavaScript. `<ui-slider orientation>` enhances one authored range input per thumb (D13): focusable `role="slider"` thumbs named by their input's labels, Radix's keys (Left / Right swap under RTL), a press on the track moves the nearest thumb, and a thumb never passes its neighbour. `ui-value-change` per move, `ui-value-commit` (and `change`) per gesture. |
| 2  | `input-otp` | `<ui-input-otp>` around one real `<input autocomplete="one-time-code">` (D13) plus Group / Slot / Separator. The input is laid transparent over the slots and stays the control (label, paste, SMS autofill, the mobile keyboard), while the slots draw the characters and a blinking caret, and are `aria-hidden`. A keystroke that breaks the input's `pattern` or `maxlength` is refused, and `ui-complete` fires once every slot is filled. Each slot styles its own host, so shadcn's `first:` / `last:` corners see siblings. |
| 2  | `command` | `<ui-command label should-filter loop>` + Input / List / Empty / Group (`heading`) / Item (`value`, `keywords`, `disabled`) / Shortcut / Separator, on cmdk's model: the input is a `role="combobox"` keeping focus with `aria-activedescendant`, items carry `data-selected="true"`, typing ranks by value and keywords (prefix, word start, substring, then letters in order) through CSS `order`, empty groups and separators hide. Enter runs the item (`ui-select`) and follows a link inside it. `<ui-command-dialog>` puts a `<ui-command>` in a native modal dialog with a screen-reader title. |
| 2  | `combobox` | `<ui-combobox name multiple value>` + Input (`input-id`, `show-clear`) / Content / List / Item / Group / Label / Empty / Separator, and Chips + Chips Input for `multiple`. Base UI's model: the value rides one `<input type="hidden" name>` per choice, served at SSR; the input is a `role="combobox"` with `aria-activedescendant`, items carry `data-highlighted` / `data-selected`, and the content carries `data-empty` when nothing matches. Chips are drawn from the values, each with a remove button naming its value; Backspace in an empty input drops the last. From code, `removeValue(value)` drops one and `clear()` drops all (not `remove`, which is the native Element method). |
| 2  | `calendar` | `<ui-calendar mode value month number-of-months min max caption-layout name>`, a hand-rolled month grid on `Intl.DateTimeFormat`, rendered by the server. Single, multiple and range (`"from/to"`) modes, with the date maths on UTC calendar dates, exported and unit-tested. A `role="grid"` per month with named day buttons, one roving tab stop and the APG date-grid keys. `name` adds hidden inputs (`name[from]` / `name[to]` for a range). |
| 2  | `questionnaire` | `<ui-questionnaire shortcuts>` + Progress / Item (`name`, `required`, `multiple`, `disabled`) / Title / Description / Choices / Choice / Input / Error / Actions / Previous / Skip / Next / Submit, ported from `@shadcn/react`. A native `<form>` of `<fieldset>`s whose answers share the question's name. Without JavaScript every question shows and only Submit is offered. With it one question shows at a time, Next validates (an `aria-invalid` question and a `role="alert"` error), Skip clears an optional one, Enter steps forward, and letter or number shortcuts pick answers. |
| 2  | `carousel` | `<ui-carousel orientation loop>` + Content / Item / Previous / Next on CSS scroll snap, not Embla (D10), so the slides scroll and snap natively with JavaScript off. A slide carries its classes, `role="group"` and `aria-roledescription="slide"` on its own host and snaps on its content through a 1px marker (a zero-size snap area is ignored and mandatory snapping then has nowhere to land). The element is the `api`: `scrollPrev`, `scrollNext`, `scrollTo`, `selectedIndex`, `ui-slide-change`. Name the region with `aria-label`. |
| 2  | `resizable` | `<ui-resizable-panel-group orientation>` + Panel (`default-size`, `min-size`, `max-size`, percentages) / Handle (`with-handle`). Each panel is a flex share on its own host, served at its default size. The handle is the WAI-ARIA window splitter (`role="separator"` with `aria-valuenow` for the panel before it), moved by a drag or the arrows across the group, 10 points a step, and `ui-layout-change` reports the sizes. |
| 2  | `message-scroller` | `<ui-message-scroller auto-scroll default-scroll-position>` + Viewport / Content / Item (`message-id`, `scroll-anchor`) / Button, ported from `@shadcn/react`. Opens at the end, the start or the last anchored message with the viewport hidden until placed, follows new messages while the reader is at the end, and the content is a `role="log"`. The element is the api (`scrollToEnd`, `scrollToMessage`, `visibleMessageIds`). |
| 1a/2 | `code-block` | Class helpers for the frame (`codeBlockClass` / `codeBlockVariants`), header, title, actions, content, code, line (`codeBlockLineClass` / `codeBlockLineVariants`) and footer, plus `codeBlockLines(text, { variants })` for numbered and highlighted lines, and `<ui-code-block-copy-button value>`, which copies its block's code and announces "Copied". Keep `tabindex="0"` and `dir="ltr"` on the `<pre>`. |
| 2  | `sidebar` | `<ui-sidebar-provider default-open>` + Sidebar (`side`, `variant`, `collapsible`) / Trigger / Rail / Inset as elements, and class helpers for everything inside (header, footer, content, groups, menus, `sidebarMenuButtonClass` / `sidebarMenuButtonVariants`, actions, badges, `sidebarMenuSkeleton`, submenus). The open state rides the `sidebar_state` cookie and Ctrl / Cmd+B. The sidebar and the inset carry their state on their own hosts so `peer-data-*` and `group-data-*` reach them, and on a phone the sidebar is a `<ui-sheet>`. |

**shadcn's style-function names (#1666, D9).** shadcn exports a `cva`
function per component (`buttonVariants`, `badgeVariants`, `toggleVariants`,
`tabsListVariants`, and later `buttonGroupVariants`, `markerVariants`,
`navigationMenuTriggerStyle`). The kit exports each under the same name, beside
its own helper, so shadcn code ports verbatim. Each returns exactly what the
helper returns, and like `cva` it merges a `className` option into the result.

## Accessibility

The kit aims for 100% accessibility out of the box, but the responsibility
splits by tier, and an agent MUST know which half it owns.

**Tier-2 custom elements own their ARIA.** Because the element renders its own
markup, it wires the WAI-ARIA pattern itself, with zero author effort: tabs
cross-links triggers and panels (`aria-controls` / `aria-labelledby`), reports
`aria-orientation`, and marks an inactive panel `inert`; toggle-group uses
roving tabindex plus Arrow / Home / End and skips `disabled` items; toggle
forwards the host's `aria-label` onto the inner button it renders;
dropdown-menu declares `aria-orientation`, reflects `aria-disabled` on a
`data-disabled` item, gives the trigger `aria-haspopup` / `aria-expanded` /
`aria-controls`, returns focus to that trigger on EVERY close path (Escape, Tab, activation, and
an outside click that did not itself put focus somewhere), synthesizes Enter /
Space activation because a `div[role=menuitem]` gets none natively, names each
submenu panel from its sub-trigger, and
exposes `menuitemcheckbox` / `menuitemradio` + `aria-checked` for a
`type="checkbox"` / `type="radio"` item; dialog and alert-dialog carry their
role on the native `<dialog>` (so exactly one dialog-family node is exposed,
verified against the computed accessibility tree) and name themselves from
their title and description on open, falling back to a generic
`aria-label` so an unnamed modal is impossible; tooltip references its tip with
`aria-describedby` and dismisses on Escape; hover-card exposes the popup
relationship on its (focus-openable) trigger, always names its `role="dialog"`
panel, dismisses on Escape, and keeps itself open while focus is inside so its
content is Tab-reachable; sonner is a persistent polite `aria-live` region that
is the only live root an ordinary toast resolves under, and whose every
toast carries a labelled close button. sheet and drawer inherit all of the
dialog's wiring. context-menu, menubar and navigation-menu are described in
their inventory rows above, each with the ARIA it owns. Do not hand-add these
attributes, since the element already has them.

**The focusable element is the one that needs the ARIA.** The recurring bug
class in this kit (#1078, and finding 1 of #1080) is a Tier-2 element whose host
is NOT the control the browser focuses: the host renders an inner `<button>` or
`<div role="...">`, and ARIA put on the host never reaches it, because a name on
a generic-role element does not contribute to a descendant's name. When adding
or changing a Tier-2 component, ask which element actually takes focus and put
the role, the name, and the state THERE, forwarding from the host if that is
where the author writes it. A browser test asserting the attribute on the
FOCUSABLE node, not on the host, is what catches a regression.

**A popover panel needs its focus restored before it hides.** Every overlay here
renders `popover="manual"`, so hiding the panel while a descendant holds focus
drops focus to `<body>`. Move focus out FIRST, then hide, and do it on EVERY
close path, not just the keyboard one (a delayed hover-close and an outside tap
can both fire while the panel holds focus).

Guard the restore on focus still being inside the overlay, so a close that
deliberately moved focus elsewhere does not have it yanked back. For a
POINTER-driven dismiss that guard cannot be evaluated at click time: clicking a
non-focusable area has usually already blurred the panel's focused descendant to
`<body>` by then, so a check there cannot tell "clicked away from everything"
(restore) from "clicked another control" (leave it). Sample focus-inside on
`pointerdown` instead, before the browser moves focus, and read it at click time
(`dropdown-menu.ts` `_onDocPointerDown`).

**Tier-1 class helpers push their ARIA to YOU.** A helper returns only Tailwind
classes, so the semantic element, role, and ARIA are the caller's job. Every
component's JSDoc carries an `A11y` block stating exactly what to supply, and
`test/registry-contents.test.js` enforces that a block is PRESENT on every
component and sits above `@example` so the agent-facing projection does not drop
it (the claim used to be aspirational and was false for ten components). Most are
headed `A11y (required for accessible output)`; a component whose native
primitive already carries the pattern says so instead (accordion and collapsible
use `A11y (mostly handled by the native primitives)`), and a Tier-2 element's
block states what it OWNS rather than what you supply. The recurring
obligations:

- `button`: an icon-only button needs `aria-label`; an overlay trigger needs `aria-haspopup` + `aria-expanded`.
- `alert`: choose `role="alert"` (urgent) or `role="status"` (polite).
- `separator`: `role="separator"` + `aria-orientation`, or `role="none"` when decorative.
- `skeleton`: `aria-hidden="true"` (or `aria-busy` on the region), since it is a placeholder.
- `spinner`: `spinner()` is a named `role="status"`. Inside a busy button, mark the BUTTON `disabled` + `aria-busy="true"`, keep its visible text, and render `spinner({ decorative: true })` so a second live status is not nested in the button's name.
- `empty`: a real heading for `emptyTitleClass()`, `aria-hidden` on the decorative media, and `role="status"` on the root only when the empty state answers a user action (a search or filter that matched nothing).
- `field`: a real `<label for>` per control, `aria-describedby` listing the description id and, when invalid, the error id (only ids that exist), `aria-invalid` on the control, `role="alert"` on the error, and the typed values kept when the server re-renders the form with an error. A radio or checkbox set goes in a `<fieldset>` named by its `<legend>`.
- `avatar`: an `alt` that names the person, plus the text fallback.
- `table`: `scope="col"` / `scope="row"` on header cells, and a `<caption>`.
- `pagination` / `breadcrumb`: a labelled `<nav>`, `aria-current="page"`, and hidden separators / icon-only control names.
- `progress`: an `aria-label` (the native element supplies the role + value).
- **form controls** (`input` / `textarea` / `native-select` / `checkbox` / `radio-group` / `switch`): a real `<label for>` (or a wrapping `<label>`) is the accessible name, and a `placeholder` is not one. On failure, `aria-invalid="true"` plus an `aria-describedby` pointing at error text that EXISTS on the page. A standalone switch needs `aria-label`, since its visible track is a `<span>` and the real input is `sr-only`. Group radios by a shared `name` and NAME the group (`aria-labelledby` on the `role="radiogroup"`, or `<fieldset>` + `<legend>`).
- **`checkbox` / `radio-group` also need `data-slot`** on the input (`data-slot="checkbox"` / `data-slot="radio"`). The injected stylesheet keys the checkmark and the radio dot on it, and neither class carries a fallback fill, so without it the checked state reads as colour alone (WCAG 1.4.1). Source tests assert the examples keep the pairing. These two are the only Tier-1 parts whose appearance needs JavaScript, because they are the only ones whose stylesheet is injected rather than shipped in the theme block. `dialog` and `alert-dialog` inject one too, but from a lifecycle hook on a Tier-2 element that needs JavaScript regardless.
- **`native-select`'s `<option>` colours come from the theme block**, not from importing the module (#1320). A bare `<option>` paints transparent over the browser popup, so in dark mode the unselected options disappear, and the `select option, select optgroup` rule in `@layer base` forces Canvas / CanvasText back. An app whose theme block predates that rule keeps the browser default until it re-runs `init` or adds the rule by hand, since `ensureTheme` never rewrites an existing block. It is two ELEMENT selectors (specificity 0,0,2) with no wrapper requirement, so a bare `<select class=${nativeSelectClass()}>` is covered and any single class overrides it.
- `popover`: the biggest Tier-1 obligation, because the panel is a bare `<div popover>` with no role and no name. Supply `role="dialog"` + `aria-labelledby` to the `popoverTitleClass()` heading, `aria-haspopup="dialog"` + a `toggle`-event-synced `aria-expanded` on the trigger, and prefer `popover` (auto) over `popover="manual"` so the platform still gives you light-dismiss, Escape, and focus restoration.
- `card`: use a REAL heading for `cardTitleClass()`, at the level the surrounding document wants, and never wrap a whole card in one `<a>`.
- `kbd`: a symbol-only key (`⌘`) needs a spoken name, but NOT via `aria-label` on the `<kbd>`: that maps to `role=generic`, where a name is prohibited and ignored. Hide the glyph (`aria-hidden`) and put the spoken form in an `sr-only` sibling. For a chord, wrap the group in `role="img"` + `aria-label`, which supports a name AND makes children presentational, so it is announced once.
- `label`: put the classes on a real `<label>` linked by `for` / `id` or by nesting. The same classes on a `<span>` name nothing.
- `accordion` / `collapsible`: build on `<details>` + `<summary>` and put the trigger classes on the `<summary>` ITSELF. Nesting a `<button>` inside a `<summary>` is the #1078 bug class.
- `aspect-ratio`: layout only, so the obligations belong to the content (`alt`, `title`, captions).

Browser tests for the Tier-2 guarantees live in
`test/components/browser/ui-a11y.test.js`. Every behavioural fix there ships
with a counterfactual, an assertion that fails against the pre-fix code, so a
later change cannot quietly make the test non-discriminating.

## Public commands (binary: `webjsui`)

| Command | What it does |
|---|---|
| `webjsui init` | Initialize a project, writes `components.json`, copies the `cn()` helper to `lib/utils/cn.ts` (plus `lib/utils/dom.ts` beside it), installs the theme tokens. Its defaults are fixed constants, not derived from the host project (#1129). NON-DESTRUCTIVE on a re-run: an existing `components.json` keeps its settings (aliases, `tailwind.css`, base color, and any unknown keys) and an existing helper file is left alone, since both are yours; a config that cannot be parsed at all is a hard error rather than a silent replacement. `--overwrite` opts into replacing them. HARD-FAILS (non-zero exit) when the tokens cannot be written (an unstyled install with a clean exit code was the old trap). |
| `webjsui add <names...>` | Resolve transitive deps, copy component sources, install npm deps. Self-heals missing theme tokens. Leaves an existing `cn()` / dom helper alone (see the placement section), and `--overwrite` replaces it. For a Tier-1 helper it strips the worked `@example` and leaves a pointer (see Registry resolution). A `registry:block` item's files land at their own `target`s with every registry-relative import rewritten to where its file landed (`rewriteRegistryImports`), are never replaced without `--overwrite` (not even under `--yes`), and are listed when written. An item's `cssVars` are merged into the app's stylesheet, adding only tokens its `:root`, `.dark` or `@theme inline` block lacks (`mergeCssVars`). |
| `webjsui list [filter]` | List components in the registry |
| `webjsui view <name>` | Print a component's source to stdout (the human / offline path to the full example) |
| `webjsui diff [name]` | Show diffs between local and registry (against the LIVE upstream) |
| `webjsui info` | Print cwd + config + registry URL |
| `webjsui build [file]` | Compile a custom registry (for registry authors) |
| `webjsui lint` | Opt-in design-system linter over the app's own source (see the section below). Reports nothing and exits 0 with no `lint` block in `components.json`. `--json` emits `{ violations, summary }`, `--max-warnings <n>` caps warnings, exit is 1 on an error-level violation, an exceeded cap, or a config it cannot run against. |

### `webjsui lint`: the opt-in design-system linter (#1478)

The kit's styling guidance is prose, and prose is what an agent skips. The
linter fires at the exact line where an app drifts off its design system, with
a message built from the app's OWN tokens and helper variants (the
`@shadcn/lint` thesis: a diagnostic naming the real alternative converges an
agent in one correction round where rules text takes more). It is NOT part of
`webjs check`, which stays correctness-only (a sensible app can legitimately
want `bg-pink-500`), and it is off until an app opts in.

**Config.** A `lint` block at the top level of `components.json`, beside
`tailwind` and `aliases`. A rule value is a bare severity (`"off"` / `"warn"` /
`"error"`) or `{ severity, allow }`. A rule absent from `rules` is off. The
schema is strict (`lintConfigSchema` in `registry/schema.js`), so a typo is a
config error rather than a silent no-op.

```json
"lint": {
  "ignore": ["app/legacy/**"],
  "rules": {
    "no-raw-colors": "warn",
    "no-arbitrary-values": { "severity": "warn", "allow": ["layout"] },
    "no-restyle": { "severity": "error", "allow": ["layout", "rounded"] }
  }
}
```

**The three rules**, each pure `(site, ctx) => violations` in `src/lint/rules/`:

- `no-raw-colors`: a Tailwind palette utility (`text-red-600`) where the theme
  declares a role token. The message lists only utilities the app's configured
  `tailwind.css` declares (`--color-*` inside `@theme` OR `@theme inline`, both
  live in this repo) and adds a role match only where unambiguous (`red` /
  `rose` to `destructive`; the neutral families to `muted-foreground` under
  `text-`, `muted` otherwise) and only when that token exists. A role match
  also sets `fix` in the `--json` output, as a drop-in for the reported `class`
  (`hover:text-red-600/50` gets `hover:text-destructive/50`, keeping the
  variants, the opacity modifier and a `!`). CSS comments are stripped before
  the theme is read, so a commented-out token is never named. A theme file
  yielding no tokens turns the rule OFF for the run with one warning naming the
  path, because the rule's whole value is naming the alternative.
- `no-arbitrary-values`: a token whose UTILITY segment carries a `[`
  (`p-[13px]`, `ring-[3px]`, `[padding:13px]`). An arbitrary VARIANT
  (`[&_svg]:size-4`, `has-[>svg]:px-3`, `data-[state=open]:flex`) and the
  `(--var)` shorthand never fire. That single rule, in `grammar.js`
  `parseToken`, decides every case.
- `no-restyle`: a class composed beside a kit helper, in either shape an app
  writes (`cn(buttonClass(), 'rounded-full')`, or a `class` attribute holding a
  `${buttonClass()}` hole plus static text). The message names the helper's
  REAL variants and sizes through `extractHelperAxes` in `registry/extract.js`,
  read from the APP's copied `components/ui/*.ts` (an app may add or remove a
  variant), never from a second parser; a helper matching neither authored
  shape gets no value list rather than an invented one. Drift guard:
  `test/lint-message-drift.test.js`.

**`allow` is shadcn's category taxonomy, verbatim.** `grammar.js`
`GROUP_CATEGORY` transcribes `grammar/categories.ts` from `shadcn-ui/lint` in
upstream order so it diffs cleanly. Six named categories (`color`,
`typography`, `spacing`, `shape`, `effects`, `motion`) and everything else is
`layout`. Two placements are counterintuitive and both are kept: padding is
`spacing`, margin is `layout`. `allow` takes a category name OR a class-group
id, so `["layout", "rounded"]` admits `w-9 h-9 rounded-full` (the skill's
sanctioned icon-button one-off) without opening the whole `shape` category
(`border-2` still fires). Do NOT redefine the taxonomy locally. #1116 was
reverted for inventing vocabulary shadcn does not ship.

**Where it reads classes** (`src/lint/scan.js`, the three CLASS SITES, the
complete set): a `class=` attribute inside an OPEN TAG inside an `html` tagged
template (nested templates in holes recursed); every string literal inside a
recognized `cn(` call; every string literal inside a `class=${...}` hole. A
plain template literal counts as a string literal in both, read at its static
text and split at its holes. A
helper is recognized only by its IMPORT resolving inside `aliases.ui`, and `cn`
only when imported from `aliases.utils`, so a local `fooClass()` is never
mistaken for a kit helper. Recognition keys on the EXPORTED name, so an aliased
`buttonClass as bc` is still a helper and its axes are still found. The open-tag requirement is what keeps an
entity-escaped docs code sample (`&lt;p class="text-red-600"&gt;`) inert
without any docs-page heuristic, and commented-out markup (`<!-- ... -->`)
inside a template opens no tag either. A token touching a hole with no
whitespace between is dropped as a fragment (`class="text-${size} p-2"` yields
`p-2`). A literal that is a comparison operand (`kind === 'primary'`) or a
`case` label is not collected; any other literal in a class hole or `cn()` call
is read as a class, and an unknown token falls to `layout`, so a stray one is
admitted by the recommended config rather than reported. `no-restyle` names
every helper a site composes and reads the axes from the LAST one, which is
the argument `cn` lets win.

**Scope.** `app/**`, `components/**`, `modules/**`, `lib/**` over
`.ts .tsx .js .jsx .mts .mjs`, never `node_modules`, `.webjs`, `dist`,
`public`. **`components/ui/**` (the resolved `aliases.ui`) is skipped by
default**: a copied primitive legitimately owns structural values no variant
can express (the kit button's `focus-visible:ring-[3px]` and
`[&_svg:not([class*='size-'])]:size-4`), and it is what other files' variants
are measured against. This is also why the sonner raw palette colors
(`sonner.ts` success / info / warning icons) are LEFT ALONE. There is no token
to move them to, and inventing a `--success` is what got #1116 reverted. Widen
the scope with a negated entry, which un-ignores whatever it MATCHES
(`"ignore": ["!components/ui/**"]` for the whole dir,
`"!components/ui/button.ts"` for one file), narrow it with more globs.
Entries match the path relative to the app root, and an entry also covers its
own subtree, so a bare directory (`app/legacy`, `app/legacy/`, `./app/legacy`)
ignores everything under it.

**Phases.** Phase 1 (this) ships the command and the docs that DESCRIBE it.
Nothing tells an agent to run it in its loop, and nothing adds it to the
scaffold's generated `components.json` or a `webjs.ci` list, until the
three-arm eval in `test/evals/` (before, after with diagnostics, and a
rules-only control, run through the `claude` CLI on a scratch copy of
`gallery`) shows diagnostics converge in fewer rounds than rules text on two of
three models. That is the #1116 lesson: shipping the guidance before the gate
ran is what let it land measuring nothing.

### Where the shared helpers land (#1129)

`cn()` and the client-only `onBeforeCache()` follow the project's **`utils`
alias**, not the `target` the registry manifest pins on the `lib-utils` /
`lib-dom` items. `add` resolves them through one `helperTarget()` that reads
the same alias `rewriteUtilsImport` retargets component imports to, so the file
it writes and the file the components import are the same file by construction.
The DOM helper is always the utils file's SIBLING (`lib/utils/dom.ts` next to
`cn.ts`), which is the adjacency the rewrite assumes and the layout `init` and
`webjs create` both emit.

Honouring the manifest `target` instead is what produced the #1129 orphan bug:
`add` wrote `lib/utils.ts` while every component resolved to `lib/utils/cn.ts`,
so each install left a dead copy behind. The manifest `target` still governs
every OTHER registry item. It is deliberately NOT honoured for these two, in
any registry, including a custom one authored against the shadcn wire format
(invariant 3): the rewrite always points component imports at the alias, so a
write that went anywhere else would recreate the orphan. The two answers have
to agree, and the alias is the one that has consumers.

Both files are also treated as user-owned once they exist. `init` and `add`
leave them alone (`add`'s `--yes` suppresses prompts but does not license
replacing them); only an explicit `--overwrite` replaces one.

### Base form and the style bake (#1666)

shadcn authors each component once, in BASE FORM: semantic `cn-*` names
(`cn-button`, `cn-button-variant-default`) beside the layout classes it keeps
inline. A STYLE is a CSS file of nested rules, under one `.style-<name>`
wrapper, mapping each name to Tailwind through `@apply`. The kit is moving to
the same architecture so all of shadcn's styles apply to it.

`src/registry/style-bake.js` is the one bake. It is a port of shadcn's
`createStyleMap` and `transformStyle`, written without postcss or ts-morph so
the CLI gains no dependency:

- `createStyleMap(css)` reads a style file. Every rule with `@apply` gives its
  classes to the LAST `cn-*` class of each selector (with `&` removed), and a
  later rule for the same name is prepended, as in shadcn.
- `classSegments(src)` is the ONE lexer for "which strings carry classes":
  every string literal, plus the static runs of a `class="..."` attribute in an
  `html` template. The bake rewrites what it finds, and the fixture and the
  snapshot test enumerate with it, so the three cannot disagree. A `cn-*` name
  produced inside a `${...}` hole is never seen, so a name must always sit in
  static text.
- `bakeSource(src, map)` replaces each name with its classes, mapped classes
  FIRST so an inline layout class wins a conflict under `cn()` (the precedence
  `twMerge(mapped, original)` gives shadcn), drops exact duplicates, and keeps
  the five allowlisted hooks (`CN_ALLOWLIST`). Two departures from shadcn: every
  occurrence of a name is inlined (shadcn inlines only the first per file, but a
  Tier-2 template can render a part in two branches), and the merge is order
  plus exact-duplicate removal rather than tailwind-merge.

**Where the styles live** (`packages/registry/styles/`):

- `style-new-york.css` is the kit's own look, the classes each component used
  to carry inline. It is the default when `components.json` names no style
  (or `"default"`), so an app's installed files keep exactly the classes they
  had before the conversion.
- `style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css` are shadcn's eight
  styles, copied unchanged by `scripts/port-styles.mjs` plus one appended BASE
  SUPPLEMENT block. The kit's base form keeps inline only the classes shadcn's
  base form ALSO keeps, which is what lets `new-york` reproduce the old look;
  where shadcn keeps a layout utility the kit never had (`select-none` on the
  button), it is recorded in `supplement.json` and the port adds it to every
  shadcn style, so each renders as it does in shadcn/ui. Marker classes
  (`group/button`, `peer`) cannot ride `@apply`, so those stay inline in the
  component; they carry no CSS of their own, and the snapshot ignores one a
  base-form component added. Regenerate the eight with
  `node packages/ui/scripts/port-styles.mjs <shadcn>/apps/v4/registry/styles`.
- `shadcn-tailwind.css` (shadcn's `packages/shadcn/src/tailwind.css`: the
  `data-open` / `data-closed` / `data-checked` custom variants, the accordion
  keyframes, the `scroll-fade` and `shimmer` utilities) and `tw-animate.css`
  (tw-animate-css 1.4.0, the `animate-in` / `fade-in-0` / `zoom-in-95`
  utilities) are vendored as CSS, since the kit takes no third-party
  dependency. The shadcn styles use both, so a project baked with one of them
  needs both in its stylesheet. Notices in `THIRD_PARTY_NOTICES.md`.

A test that IMPORTS a component and asserts on the classes a helper returns
must import the baked copy, since the raw source returns `cn-*` names:
`test/helpers/baked-registry.js` writes a `new-york`-baked mirror of the
registry under the gitignored `test/.baked/` (inside the package, so a bare
`@webjsdev/core` import still resolves). Source-text assertions read the baked
text the same way (`readSource` in `registry-contents.test.js`).

The marketing site renders the components UNBAKED and loads the styles as CSS
in `layer(base)` instead, under a `.style-<name>` wrapper, the way shadcn's own
preview route does (see `website/public/ui-input.css`). One base-form module
styled by its wrapper is what lets two styles share a page session, since a
custom element tag can be defined only once.

The guard is `test/style-bake-snapshot.test.js`: baking each component with
`new-york` must equal, string by string and THROUGH the kit's real `cn()`, the
classes recorded in `test/fixtures/class-strings.json`, which was captured from
the components before the conversion started. Never regenerate that fixture
from base-form sources, which would compare the bake with itself.

### Registry resolution: LOCAL-FIRST (#983)

The registry sources ship inside this npm package (`package.json` `files`
includes `packages/registry`), so `init` / `add` / `list` / `view` resolve
components from disk with NO network round-trip. This makes an agent's install
deterministic and offline-safe. The network path (`fetcher.js`) is used ONLY
when the caller passes an explicit custom `--registry <url>`.

- `getRegistryItem(name, url)` / `getRegistryIndex(url)` in `fetcher.js` are the
  dispatch: local unless `url` is a custom (non-default) registry. `local.js` is
  the on-disk composer (the plain-JS twin of the marketing site's
  `modules/ui/queries/registry.server.ts`).
- **`webjsui diff` is the deliberate carve-out**: it compares local files
  against the LIVE upstream, so it stays on the network path (local-first would
  compare the package against itself). It also compares each local file against
  what `add` WOULD write (import-rewrite + example-strip via
  `transformForProject`, shared with `add`), so a pristine install diffs clean.
- **On-demand example delivery**: a Tier-1 helper file's accessible structure
  lives in its module-JSDoc `@example` block. That worked example is build-time
  guidance, so `add` STRIPS it from the copied file and leaves a one-line pointer
  (`example.js` `pointerLine`, the explicit `npx @webjsdev/ui view <name>` form
  every printed hint uses, per invariant 8); the full snippet is
  served on demand by `webjsui view` and the MCP `ui` tool. Tier-2
  custom-element files are left whole (the element IS the component). A
  version-skew note: local-first pins `add`/`view` to the INSTALLED ui version,
  and `diff` is how a user detects upstream drift. The scaffold no longer
  pre-copies ui components (it initialises the app for `webjs ui add` and the
  gallery cards style with plain Tailwind), so components are added on demand.

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

   **Deliberate divergence, dialog scroll lock (#1144).** shadcn (via Radix)
   compensates the hidden scrollbar by padding the body only, which leaves a
   `position: fixed` header sliding right by half the scrollbar width. Since
   WebJs recommends exactly that pinned-header pattern (#610), our lock instead
   reserves the scrollbar gutter (unless the page already declared its own), and
   where the engine ignores `scrollbar-gutter` (measured on WebKit, honoured on
   Chromium) it pads `<html>` by the measured residual and publishes it as
   `--wj-scrollbar-compensation` for a fixed element to opt into. Nothing branches
   on the engine: the residual is measured, so an engine nobody tested behaves
   correctly either way. The refcount is shared across both component copies via
   `globalThis`, because release order is not guaranteed to be LIFO. This is
   presentation and lifecycle, not API: every tag, variant, and data attribute
   still matches shadcn.

6. **Native form controls participate in `<form>` submission natively.**
   `<input type="checkbox" class=${checkboxClass()}>` is a real input , 
   no `ElementInternals`, no `setFormValue` proxying. Submission,
   autofill, browser autocomplete, native validation all work.

7. **The kit targets WebJs apps, and only WebJs apps (#1129).** There is no
   host-project detection and no per-framework branching anywhere in the
   package. `init` writes one fixed set of defaults (`styles/globals.css`, and
   the alias map whose `utils` entry is `lib/utils/cn`), which are the same
   values `webjs create` scaffolds, so `init` on a bare app and a scaffolded
   app land on the same layout. The output is plain Tailwind classes and
   standard custom elements, so it will render in a non-WebJs host, but that
   is not a supported, tested, or advertised path: point `--css` somewhere
   else and hand-edit `components.json` at your own risk. Do NOT reintroduce a
   `detectProject()` in any form. A switch that picks paths per framework buys
   about thirty lines of defaults in exchange for a cross-framework promise
   the rest of the package does not keep.

8. **A command a reader is told to RUN names `npx @webjsdev/ui <cmd>`, never a
   bare `webjsui <cmd>` (#1264).** `webjsui` is a bin declared inside this
   package, not a published package name, and the registry 404s on it, so `npx
   webjsui` resolves through a `node_modules/.bin/webjsui` link or not at all.
   Whether that link is where npx looks depends on the reader's tree, and the
   layouts vary (a global-only install with nothing local, a nested layout
   where the kit sits under `@webjsdev/cli`'s own `node_modules`). Do not try
   to enumerate them, which is how this invariant was wrong twice. The point is
   that a printed hint cannot know, while `npx @webjsdev/ui <cmd>` names a real
   published package and resolves either way. Every hint `init`, `add`, `diff`,
   `info`, and the registry fetcher print does this, asserted one per site in
   `init-command.test.js`, `add-command.test.js`, `diff-command.test.js`,
   `list-view-info.test.js`, and `local-registry.test.js`.

   The rule reaches an instruction, not a mention, so a line that NAMES the
   binary without telling anyone to type it keeps the bare form:
   `.name('webjsui')` in `index.js`, which is the bin's real identifier and
   what the commander banner echoes, the command tables here and in
   `README.md`, and prose describing what a command does. An instruction
   directly under an install that supplies the bin is the one place the bare
   form is still an instruction and still correct, as in `README.md`'s Option B
   and the root `README.md`'s UI bullet.

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
- **A registry module does NO work at module scope.** Not a call, not a `new`,
  not a `document` reference. The elision analyser reads any of those as client
  work, so the module pins every page that reaches it on a component-free path,
  and a Tier-1 helper registers no element, so the path-aware carve-out (#963)
  cannot save it. Because `cn` sits under essentially every helper, one such
  line costs page elision in every app that runs `webjsui init`. Two shapes
  caused it (#1320). A `...borderGroups()` spread inside a module-scope table is
  a real top-level call, fixed by memoising the table behind a function
  (`let _groups; function GROUPS() { return (_groups ??= [...]) }`). An
  `if (typeof document !== 'undefined') installFooStyles()` stylesheet
  injection is both a call and a browser-global reference, fixed by putting the
  CSS in the theme block instead, which also puts it in the first paint and
  makes it work with JavaScript off. `packages/ui/test/utils-purity.test.js`
  pins the flagged set as an EQUALITY, so a new offender fails immediately and
  the remaining entries can only be removed deliberately. Six are still on that
  list and DO pin an importing page today: `checkbox` and `radio-group` inject a
  stylesheet for real, and `pagination`, `progress`, `sonner` and `tabs` are an
  analyser precision gap, since an arrow with an expression body puts its call
  at brace depth 0 and reads as a top-level statement. The page ships either
  way, so do not treat the second group as harmless.
- **The kit is copy-on-add, so fixing the registry does not fix an app.** An
  existing app holds its own copy of every component and of `lib/utils/cn.ts`,
  and `npx @webjsdev/ui diff` is the discovery channel for the drift. The theme
  block is worse: `ensureTheme` keys the whole block on its `@webjsdev/ui theme`
  marker and returns early when it is present, so a later `add`, and even
  `init --overwrite` (whose overwrite flag reaches only `writeLibUtils`), leaves
  an existing block exactly as it was. An app that already ran `init` therefore
  does NOT receive a rule added to the theme, and the only routes are editing
  its stylesheet by hand or deleting the marker line and re-running `init`. A
  freshly scaffolded app is fine, since `webjs create` copies `themes/index.css`
  verbatim. Weigh that gap before moving CSS into the theme block: for the
  native `<option>` colours the app degrades to the browser default, which is a
  worse read rather than a broken control, and that asymmetry is why the
  checkbox and radio-group injections were left where they are.
- **A `cn()` conflict group is one CSS PROPERTY, never one class prefix.**
  Utilities that merely share a prefix must land in different groups, or the
  merger silently drops one of them. Two defects came from getting this wrong:
  `^flex(-|$)` lumped the `flex` DISPLAY value in with `flex-1` / `flex-row` /
  `flex-wrap` and dropped `display:flex` (#1072), and border colour had no
  group at all, so an override's winner was decided by compiled stylesheet
  order rather than class order (#1065). `bg-`, `shadow-` and `text-shadow-`
  then repeated it: `bg-clip-*` / `bg-origin-*` / `bg-blend-*` sat in
  `bg-color`, and a shadow size shared one group with its colour, so each pair
  evicted the other (#1265). When a value can mean two properties
  under one prefix, classify by parsing the VALUE (`border-[3px]` is a width,
  `border-[#fff]` is a colour), and give each side its own group with the
  shorthand subsumption declared in `CONFLICTS`, the way padding does.
- `lib/utils.ts` is the canonical copy, and the repo-root
  `examples/blog/lib/utils/cn.ts` is a hand-synced duplicate with no mechanical
  link, so any change here lands in both. The repo-root
  `test/ui/cn-copies-in-sync.test.mjs` (not this package's `test/`) merges a
  token battery through both copies and fails on drift. Those TWO are the whole
  inventory of hand-synced sources. Every OTHER `cn.ts` on disk is a copy of
  this one, produced by some generator (`website/lib/utils/cn.ts` via
  `website/scripts/copy-registry.mjs`; an app's copy via `webjs create`,
  `webjsui init`, or `webjsui add`, which pulls `lib-utils` as a transitive
  registry dependency). Never hand-edit one: a stale copy is a generator that
  has not been re-run, not drift, so there is nothing for the sync test to
  cover. Which sources a given generator reads, and when it goes to the
  network, is the registry-resolution question, answered by the LOCAL-FIRST
  section above, so do not restate it here.
- A variant prefix is split on the last colon at TOP LEVEL, meaning outside
  both square brackets and parentheses, because an arbitrary value carries
  colons of its own in either delimiter (`border-[length:2px]`,
  `bg-[url(https://x/y.png)]`, `shadow-(color:--x)`). Splitting on the last
  colon anywhere hands the group matcher a fragment like `2px]` or `--x)`, so
  the utility silently stops deduping. The two delimiters get SEPARATE
  counters; see the paren-spelling bullet below for why one shared counter is
  wrong.
- Once an arbitrary value reaches the matcher, in either spelling, its TYPE
  HINT names the property
  and picks the group, since the prefix alone cannot: `text-[length:14px]` is a
  font size and `bg-[url(...)]` is an image, so routing either by prefix would
  collapse it against a colour. That lives in `hintedGroup()` and the
  `HINTED_GROUPS` map, and it is deliberately CENTRAL rather than a pattern per
  prefix: handling only the prefixes that came to mind is how
  `shadow-[color:red]` was left evicting `shadow-lg` while `bg-` and `text-`
  were already correct. A `<prefix>:<hint>` pair the map does not cover gets a
  group of its own, so it collides only with the identical hint under the
  identical prefix and never with the prefix's default, which is the safe
  direction to fail (an extra class renders, a dropped one does not).
- The merger is coarse by design and does NOT claim full `tailwind-merge`
  fidelity, in two distinct ways, and BOTH belong in any doc you write about
  it rather than stating the property rule as absolute.
  - A neighbouring prefix it does not enumerate (`inset-shadow-*`,
    `drop-shadow-*`, `ring-*`, `inset-ring-*`, `mix-blend-*`) has no group at
    all, so both classes are emitted and the winner is left to compiled
    stylesheet order. That is the SAFE direction to fail: ungrouped never
    evicts.
  - Where one prefix carries two properties, the value is read against
    Tailwind's DEFAULT scales, so a `@theme`-extended name is invisible to it
    and can be misread. A custom `--shadow-card` makes `shadow-card` a
    box-shadow, but the table sees an unfamiliar bare name under a prefix
    whose bare names are usually colours and routes it to `shadow-color`, so
    it evicts a colour and is evicted by one. That is the UNSAFE direction,
    and it is the price of a table that cannot read the project's theme.
    Prefer the arbitrary form (`shadow-[var(--shadow-card)]`), which the table
    does classify correctly.
- When you DO add a group, split it by property from the start (a prefix-keyed
  group is the #1265 defect), and pick the catch-all's direction from what the
  prefix's values actually look like in real code rather than by analogy with
  another prefix: `border-[var(--x)]` is usually a colour, `shadow-[var(--x)]`
  is usually a shadow, so the same shape resolves opposite ways.
- A PAREN-hinted arbitrary value (`shadow-(color:--x)`, `bg-(image:--g)`, the
  Tailwind v4 shorthand for the bracket form) classifies exactly like its
  bracket sibling (#1338), because both spellings produce the identical
  `<prefix>:<hint>` key that `HINTED_GROUPS` is keyed on, so the map carries
  no paren-specific entries. Three pieces make that work, and all three are
  load-bearing. `variantPrefix` counts brackets and parens in SEPARATE
  counters and splits only where both are zero, never one shared counter: a
  shared one lets a stray `)` cancel a live `[` and reads `x-[y)-z:w` as
  having a top-level colon, which is the fragment bug it exists to prevent.
  `hintedGroup()`'s regex accepts `-(` alongside `-[`. And `borderGroups()`'s
  width fragment reads the length hint in both spellings. Teaching
  `variantPrefix` paren depth ALONE is actively harmful rather than a partial
  win: it hands an intact `bg-(image:--g)` to a matcher that cannot read the
  hint, which falls through to the `^bg-` catch-all and evicts a real
  background colour, the #1065 defect class. The closing delimiter is not
  validated, in either spelling, because the hint names the property and how
  the value terminates cannot change which property that is.

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
npm test --workspace=@webjsdev/ui    # schema + resolver + init defaults + config
```

Tests live in **`packages/ui/test/`** as flat files for the CLI
helpers (`schema.test.js`, `resolver.test.js`,
`init-command.test.js`, etc.) plus `test/registry-contents.test.js`
which smoke-validates the component sources (reads
`components/*.ts` and verifies Tier-1/Tier-2 shape + hallmark
class strings, that every component carries an `A11y` JSDoc block above
`@example`, and that the checkbox / radio examples keep the `data-slot`
their stylesheets key on).

**`test/ssr-aria.test.js` is the SSR layer, and it is not optional for an ARIA
change.** It renders Tier-2 components through `renderToString` and asserts the
ARIA in the SERVED markup. It exists because the browser suite runs only the
CLIENT renderer. Before #1573 the client removed a nullish attribute hole while
the server stringified it to `attr=""`, so a component that "omitted" ARIA via a
null hole passed every browser assertion while serving the empty attribute.
Three real defects shipped that way before this layer existed, and the
components still branch those templates so they render right on an older
`@webjsdev/core`. Both renderers now omit a nullish hole, but the served markup
is still what a screen reader meets first. Any conditional ARIA needs an assertion here, not just in the
browser suite.

Real-browser tests for the kit live under
`packages/ui/test/components/browser/`
(`ui-overlay.test.js`, `ui-stateful.test.js`, `ui-a11y.test.js` for the Tier-2
ARIA + keyboard guarantees) and run via the
top-level `npm run test:browser`. See
[`references/testing.md`](../../.agents/skills/webjs/references/testing.md) for
the overall layout.

## Building / running

```sh
npm run dev --workspace=@webjsdev/website   # the gallery at localhost:5001/ui
```

**No registry build step.** Registry JSON is composed on demand by the route
handlers on the marketing site (see its
`modules/ui/queries/registry.server.ts`, which reads the sources in this
package). Source of truth is `packages/registry/components/*.ts` +
`registry.json` + `themes/base-colors.js`. Cached in memory after first
request.

Theme synthesis: only `theme-neutral` is declared in `registry.json`
(canonical CSS lives at `themes/index.css`). The other 6 base colours , 
`theme-stone`, `theme-zinc`, `theme-mauve`, `theme-olive`, `theme-mist`,
`theme-taupe`, are synthesized on demand by merging per-colour
overrides from `themes/base-colors.js` into the neutral CSS. All 7
themes return the same `files: [{ target: 'app/globals.css', content }]`
shape so `webjsui init --base-color <name>` works uniformly.

## Not in the registry yet

#1666 is bringing the kit to shadcn's full set. These shadcn components are
not shipped yet, and land in later steps of that work, following the Tier-1 /
Tier-2 conventions above:

chart and form.

---

Framework-wide rules and full API reference:

@../../AGENTS.md
