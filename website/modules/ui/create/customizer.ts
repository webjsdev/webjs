import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass, cardFooterClass, cardHeaderClass } from '#modules/ui/components/card.ts';
import { fieldGroupClass, fieldSeparatorClass } from '#modules/ui/components/field.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CheckIcon } from '#lib/utils/icons.ts';
import {
  MENU_ACCENT_OPTIONS,
  MENU_COLOR_OPTIONS,
  STYLE_OPTIONS,
  baseColorOptions,
  fontOptions,
  iconLibraryOptions,
  radiusOptions,
  themeOptions,
  createHref,
  optionLabel,
  presetCode,
  shuffleConfig,
  themeNamesFor,
  type CreateField,
  type CreateParams,
  type Option,
} from './params.ts';
import { fontFamily, themeSwatch } from './design-system.ts';
import { Menu09Icon, SquareLock01Icon, SquareUnlock01Icon } from '#modules/ui/typeset/icons.ts';

/**
 * The /ui/create customizer, shadcn/ui's Customizer
 * (apps/v4/app/(app)/(create)/components/customizer.tsx and its pickers,
 * #1666), as server markup in the base-nova look the typeset builder uses.
 *
 * It is a real GET form on /ui/create, so it works with JavaScript off: each
 * picker is a button opening a native `popover` of radio inputs named after
 * the field, with an Apply button that submits. Shuffle and Reset are links.
 * The footer is shadcn's: the preset code as a copyable `--preset` flag, Open
 * Preset (a GET form in a dialog, ./open-preset.ts), Shuffle and Get Code.
 *
 * <create-customizer> (components/create-customizer.ts) wraps this and adds
 * what a form cannot: a choice applies the moment it is made (the preview
 * frame repaints in place, the URL and the code follow), the theme lists
 * follow the base color, and the copy button. The Apply buttons
 * hide once it is defined.
 */

const TRIGGER =
  'relative w-36 shrink-0 cursor-default touch-manipulation rounded-xl p-3 text-left ring-1 ring-foreground/10 select-none hover:bg-muted focus-visible:ring-foreground/50 focus-visible:outline-none md:w-full md:rounded-lg md:px-2.5 md:py-2';

const CONTENT =
  'no-scrollbar m-auto max-h-[calc(100svh-2rem)] w-[calc(100vw-1.5rem)] min-w-32 overflow-x-hidden overflow-y-auto rounded-xl border-0 bg-neutral-950/80 p-1.5 text-neutral-100 ring-1 ring-neutral-950/80 backdrop-blur-xl outline-none md:w-56 dark:bg-neutral-800/90 dark:ring-neutral-700/50';

const ITEM =
  'relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm font-medium outline-hidden select-none text-neutral-100 hover:bg-neutral-600 has-focus-visible:bg-neutral-600 dark:hover:bg-neutral-700/80 dark:has-focus-visible:bg-neutral-700/80 pointer-coarse:gap-3 pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base';
const GROUP_LABEL = 'px-2 py-1.5 text-xs font-medium text-neutral-400';
const SEPARATOR = '-mx-1.5 my-1.5 h-px bg-neutral-600 dark:bg-neutral-700';

// The no-JS submit, hidden once <create-customizer> is defined.
const APPLY =
  'mt-1.5 w-full rounded-lg bg-neutral-100 px-2 py-1.5 text-sm font-medium text-neutral-900 [create-customizer:defined_&]:hidden';

const SWATCH = 'pointer-events-none size-4 shrink-0 rounded-full bg-(--color) select-none';

const MENU_ITEM =
  'relative flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium no-underline text-neutral-100 outline-hidden select-none hover:bg-neutral-600 focus-visible:bg-neutral-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-neutral-700/80 dark:focus-visible:bg-neutral-700/80';
const SHORTCUT = 'ml-auto text-xs tracking-widest text-neutral-400';

/**
 * shadcn's LockButton: a lock that keeps its field through a shuffle. Locks
 * are page state that only Shuffle reads, and Shuffle with JavaScript off is
 * a link, so the button shows once the element is defined.
 */
function lockButton(field: CreateField) {
  return html`<button type="button" data-lock=${field} title="Lock" aria-label=${`Lock ${field}`} aria-pressed="false" class="group/lock absolute top-1/2 right-8 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded opacity-0 ring-foreground/60 transition-opacity outline-none group-focus-within/picker:opacity-100 group-hover/picker:opacity-100 focus:opacity-100 focus-visible:ring-1 aria-pressed:opacity-100 max-md:hidden pointer-coarse:hidden [create-customizer:not(:defined)_&]:hidden">
    <span class="contents group-aria-pressed/lock:hidden">${SquareUnlock01Icon('size-5 text-foreground', 2)}</span>
    <span class="hidden group-aria-pressed/lock:contents">${SquareLock01Icon('size-5 text-foreground', 2)}</span>
  </button>`;
}

/**
 * shadcn's MainMenu: Navigate (the item explorer), Open Preset, Shuffle,
 * Light/Dark, Undo, Redo, Reset. Shuffle and Reset are links, so they work with JavaScript off;
 * the rest need the element and are disabled until it enables them.
 */
function mainMenu(params: CreateParams) {
  const button = (label: string, action: string, shortcut: string) => html`<button type="button" role="menuitem" disabled data-action=${action} class=${MENU_ITEM}>${label} <span class=${SHORTCUT} data-shortcut=${action}>${shortcut}</span></button>`;
  const link = (label: string, action: string, shortcut: string, href: string) => html`<a role="menuitem" href=${href} data-action=${action} data-prefetch="false" class=${MENU_ITEM}>${label} <span class=${SHORTCUT}>${shortcut}</span></a>`;
  return html`
    <button type="button" popovertarget="create-menu" data-slot="dropdown-menu-trigger" class=${cn(TRIGGER, 'flex items-center justify-between gap-2 rounded-lg px-1.75 ring-1 ring-foreground/10 focus-visible:ring-1')}>
      <span class="font-medium">Menu</span>
      ${Menu09Icon('size-5', 2)}
    </button>
    <div popover id="create-menu" role="menu" aria-label="Menu" data-picker-content="menu" data-align-offset="-8" data-slot="dropdown-menu-content" class=${CONTENT}>
      ${button('Navigate...', 'navigate', 'Ctrl+P')}
      ${button('Open Preset...', 'open-preset', 'O')}
      ${link('Shuffle', 'shuffle', 'R', createHref({ config: shuffleConfig(params.config), item: params.item }))}
      ${button('Light/Dark', 'theme', 'D')}
      <div role="separator" class=${SEPARATOR}></div>
      ${button('Undo', 'undo', 'Ctrl+Z')}
      ${button('Redo', 'redo', 'Ctrl+Shift+Z')}
      <div role="separator" class=${SEPARATOR}></div>
      ${link('Reset', 'reset', '\u21E7R', '/ui/create')}
    </div>`;
}

// A function rather than a constant: a module-scope call is import-time
// work, which would ship the page that imports this module.
function footerButton() {
  return cn(
    buttonClass({ variant: 'outline' }),
    'min-w-0 flex-1 touch-manipulation bg-transparent! px-2! py-0! text-sm! no-underline transition-none select-none hover:bg-muted! pointer-coarse:h-10!',
  );
}

function radioItem(field: CreateField, option: Option, checked: boolean, extra: { swatch?: string; family?: string; hidden?: boolean } = {}) {
  return html`<label class=${ITEM} data-option=${option.value} ?hidden=${extra.hidden}>
    <input type="radio" name=${field} value=${option.value} ?checked=${checked} ?disabled=${extra.hidden} class="peer sr-only">
    ${extra.swatch ? html`<span class=${SWATCH} style=${`--color: ${extra.swatch}`}></span>` : ''}
    <span class="flex min-w-0 flex-col" style=${extra.family ? `font-family: ${extra.family}` : null}>
      <span data-label>${option.label}</span>
      ${option.description ? html`<span class="text-xs font-normal text-neutral-400">${option.description}</span>` : ''}
    </span>
    <span class="pointer-events-none absolute right-2 hidden items-center justify-center peer-checked:flex">${CheckIcon('size-4')}</span>
  </label>`;
}

function picker(field: CreateField, label: string, current: string, trailing: unknown, items: unknown) {
  return html`<div class="group/picker relative" data-picker=${field}>
    <button type="button" popovertarget=${`create-picker-${field}`} data-slot="dropdown-menu-trigger" class=${TRIGGER}>
      <div class="flex min-w-0 flex-col justify-start pr-8 text-left">
        <div class="text-xs text-muted-foreground">${label}</div>
        <div class="line-clamp-1 text-sm font-medium text-foreground" data-current>${current}</div>
      </div>
      <div class="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-foreground select-none md:right-2.5">${trailing}</div>
    </button>
    <div popover id=${`create-picker-${field}`} data-picker-content=${field} data-slot="dropdown-menu-content" class=${CONTENT}>
      <div role="radiogroup" aria-label=${label}>${items}</div>
      <button type="submit" class=${APPLY}>Apply</button>
    </div>
    ${lockButton(field)}
  </div>`;
}

function optionPicker(field: CreateField, label: string, options: readonly Option[], params: CreateParams) {
  const value = params.config[field];
  return picker(field, label, optionLabel(field, value, params.config), '', options.map((o) => radioItem(field, o, o.value === value)));
}

/** Base color, theme and chart color: a list with swatches, the themes filtered by the base. */
function swatchPicker(field: 'baseColor' | 'theme' | 'chartColor', label: string, options: readonly Option[], params: CreateParams) {
  const value = params.config[field];
  const wearable = field === 'baseColor' ? null : themeNamesFor(params.config.baseColor);
  return picker(
    field,
    label,
    optionLabel(field, value, params.config),
    html`<span class=${SWATCH} data-swatch style=${`--color: ${themeSwatch(value)}`}></span>`,
    options.map((o) => radioItem(field, o, o.value === value, { swatch: themeSwatch(o.value), hidden: wearable ? !wearable.includes(o.value) : false })),
  );
}

/** shadcn's FontPicker: the fonts grouped Sans / Serif / Mono, and Inherit for the heading. */
function fontPicker(field: 'font' | 'fontHeading', label: string, params: CreateParams) {
  const value = params.config[field];
  const shown = field === 'fontHeading' && value === 'inherit' ? params.config.font : value;
  const groups = [
    { label: 'Sans', type: 'sans' },
    { label: 'Serif', type: 'serif' },
    { label: 'Mono', type: 'mono' },
  ];
  const items = html`
    ${field === 'fontHeading'
      ? html`${radioItem('fontHeading', { value: 'inherit', label: 'Inherit' }, value === 'inherit')}<div role="separator" class=${SEPARATOR}></div>`
      : ''}
    ${groups.map((g) => html`<div role="group" aria-label=${g.label}>
      <div class=${GROUP_LABEL} aria-hidden="true">${g.label}</div>
      ${fontOptions().filter((f) => f.type === g.type).map((f) => radioItem(field, f, value === f.value, { family: f.family }))}
    </div>`)}`;
  return picker(
    field,
    label,
    optionLabel(field, value, params.config),
    html`<span class="text-base" data-sample style=${`font-family: ${fontFamily(shown)}`}>Aa</span>`,
    items,
  );
}

export function customizer(params: CreateParams) {
  const separator = html`<div data-slot="field-separator" role="none" class=${cn(fieldSeparatorClass(), 'hidden md:block')}></div>`;
  const code = presetCode(params.config);
  return html`<form method="get" action="/ui/create" data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 [color-scheme:dark] backdrop-blur-xl md:w-(--customizer-width)')}>
      <input type="hidden" name="item" value=${params.item}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'hidden items-center justify-between gap-2 border-b md:flex')}>
        <h1 class="sr-only">Customize your design system</h1>
        ${mainMenu(params)}
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto')}>
        <div data-slot="field-group" class=${cn(fieldGroupClass(), 'flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto max-md:px-3 md:flex-col md:gap-3.25')}>
          ${optionPicker('style', 'Style', STYLE_OPTIONS, params)}
          ${separator}
          ${swatchPicker('baseColor', 'Base Color', baseColorOptions(), params)}
          ${swatchPicker('theme', 'Theme', themeOptions(), params)}
          ${swatchPicker('chartColor', 'Chart Color', themeOptions(), params)}
          ${separator}
          ${fontPicker('fontHeading', 'Heading', params)}
          ${fontPicker('font', 'Font', params)}
          ${separator}
          ${optionPicker('iconLibrary', 'Icon Library', iconLibraryOptions(), params)}
          ${optionPicker('radius', 'Radius', radiusOptions(), params)}
          ${separator}
          ${optionPicker('menuColor', 'Menu', MENU_COLOR_OPTIONS, params)}
          ${optionPicker('menuAccent', 'Menu Accent', MENU_ACCENT_OPTIONS, params)}
          <div aria-hidden="true" class="w-0.5 shrink-0 md:hidden"></div>
        </div>
      </div>
      <!-- shadcn's footer: Copy Preset (the code as a --preset flag), Open
           Preset (./open-preset.ts) and Shuffle in one row on a phone, a
           column from md, then Get Code (from md; on a phone shadcn has none). -->
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex min-w-0 gap-2 border-t md:flex-col md:rounded-b-none md:**:[button,a]:w-full')}>
        <button type="button" data-action="copy-preset" data-slot="button" title=${`--preset ${code}`} class=${cn(footerButton(), 'min-w-0 flex-1 md:flex-none')}>
          <span class="block min-w-0 truncate [[data-copied]>&]:hidden">--preset <span data-preset-code>${code}</span></span>
          <span class="hidden [[data-copied]>&]:block">Copied</span>
        </button>
        <button type="button" commandfor="create-open-preset" command="show-modal" data-action="open-preset" data-slot="button" class=${cn(footerButton(), 'max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none')}>
          <span class="w-full truncate text-center font-medium"><span class="md:hidden">Open</span><span class="hidden md:inline">Open Preset</span></span>
        </button>
        <a href=${createHref({ config: shuffleConfig(params.config), item: params.item })} data-action="shuffle" data-prefetch="false" data-slot="button" class=${cn(footerButton(), 'max-w-20 min-w-0 flex-1 sm:max-w-none md:flex-none')}>
          <span class="w-full truncate text-center font-medium">Shuffle</span>
        </a>
      </div>
      <!-- shadcn's Get Code: the project dialog (modules/ui/create/project-form.ts).
           The invoker command opens it with no script where the browser
           supports one, and the element opens it everywhere else. -->
      <div data-slot="card-footer" class=${cn(cardFooterClass(), '-mt-3 hidden min-w-0 gap-2 md:flex md:flex-col md:**:[button,a]:w-full')}>
        <button type="button" commandfor="create-project" command="show-modal" data-action="get-code" data-slot="button" class=${cn(buttonClass(), 'h-9 w-full')}>Get Code</button>
      </div>
    </form>`;
}
