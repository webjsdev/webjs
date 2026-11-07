import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass, cardFooterClass, cardHeaderClass } from '#modules/ui/components/card.ts';
import { fieldGroupClass, fieldSeparatorClass } from '#modules/ui/components/field.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CheckIcon, CopyIcon } from '#lib/utils/icons.ts';
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
  initCommand,
  optionLabel,
  presetCode,
  shuffleConfig,
  themeNamesFor,
  type CreateField,
  type CreateParams,
  type Option,
} from './params.ts';
import { fontFamily, themeSwatch } from './design-system.ts';

/**
 * The /ui/create customizer, shadcn/ui's Customizer
 * (apps/v4/app/(app)/(create)/components/customizer.tsx and its pickers,
 * #1666), as server markup in the base-nova look the typeset builder uses.
 *
 * It is a real GET form on /ui/create, so it works with JavaScript off: each
 * picker is a button opening a native `popover` of radio inputs named after
 * the field, with an Apply button that submits. Shuffle and Reset are links.
 * The footer shows the preset code and the one command that installs it.
 *
 * <create-customizer> (components/create-customizer.ts) wraps this and adds
 * what a form cannot: a choice applies the moment it is made (the preview
 * frame repaints in place, the URL, the code and the command follow), the
 * theme lists follow the base color, and the copy buttons. The Apply buttons
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

// A function rather than a constant: a module-scope call is import-time
// work, which would ship the page that imports this module.
function footerButton() {
  return cn(
    buttonClass({ variant: 'outline' }),
    'min-w-0 flex-1 touch-manipulation bg-transparent! px-2! py-0! text-sm! no-underline transition-none select-none hover:bg-muted! md:w-full md:flex-none pointer-coarse:h-10!',
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

function copyButton(action: string, label: string) {
  return html`<button type="button" data-action=${action} aria-label=${label} title=${label} class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [create-customizer:not(:defined)_&]:hidden">
    <span class="contents [[data-copied]>&]:hidden">${CopyIcon('size-3.5')}</span>
    <span class="hidden [[data-copied]>&]:contents">${CheckIcon('size-3.5')}</span>
  </button>`;
}

export function customizer(params: CreateParams) {
  const separator = html`<div data-slot="field-separator" role="none" class=${cn(fieldSeparatorClass(), 'hidden md:block')}></div>`;
  const code = presetCode(params.config);
  return html`<form method="get" action="/ui/create" data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 [color-scheme:dark] backdrop-blur-xl md:w-(--customizer-width)')}>
      <input type="hidden" name="item" value=${params.item}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'hidden items-center justify-between gap-2 border-b md:flex')}>
        <h1 class="m-0 text-sm font-medium">Customize</h1>
        <a href="/ui/create" data-action="reset" data-prefetch="false" class="text-xs text-muted-foreground no-underline hover:text-foreground">Reset</a>
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
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex min-w-0 flex-col gap-2 border-t md:*:w-full')}>
        <div class="flex w-full items-center gap-1 rounded-lg px-2.5 py-1.5 ring-1 ring-foreground/10" data-copy-source="preset">
          <span class="text-xs text-muted-foreground">Preset</span>
          <code class="ml-auto font-mono text-sm" data-preset-code>${code}</code>
          ${copyButton('copy-preset', 'Copy preset code')}
        </div>
        <div class="flex w-full items-start gap-1 rounded-lg bg-muted/50 px-2.5 py-1.5" data-copy-source="command">
          <code class="min-w-0 flex-1 font-mono text-xs leading-5 break-all" data-init-command>${initCommand(params.config)}</code>
          ${copyButton('copy-command', 'Copy the init command')}
        </div>
        <div class="flex w-full gap-2">
          <a href=${createHref({ config: shuffleConfig(params.config), item: params.item })} data-action="shuffle" data-prefetch="false" data-slot="button" class=${footerButton()}>
            <span class="w-full truncate text-center font-medium">Shuffle</span>
          </a>
          <a href=${`/ui/init/md?preset=${code}`} data-init-md target="_blank" rel="noreferrer" data-slot="button" class=${footerButton()}>
            <span class="w-full truncate text-center font-medium">Instructions</span>
          </a>
        </div>
      </div>
    </form>`;
}
