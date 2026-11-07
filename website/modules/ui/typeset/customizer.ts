import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass, cardFooterClass, cardHeaderClass } from '#modules/ui/components/card.ts';
import { fieldGroupClass, fieldSeparatorClass } from '#modules/ui/components/field.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { FONTS, findFont, fontStack } from './fonts.ts';
import {
  TYPESET_FLOWS,
  TYPESET_LEADINGS,
  TYPESET_MEASURES,
  TYPESET_SIZES,
  builderHref,
  shuffleParams,
  DEFAULTS,
  type DesignParam,
  type TypesetParams,
} from './params.ts';
import {
  ArrowHorizontalIcon,
  CheckIcon,
  LineHeightIcon,
  Menu09Icon,
  ParagraphSpacingIcon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  TextSmallcapsIcon,
} from './icons.ts';
import { getCodeDrawer } from './docs-panel.ts';

/**
 * The typeset builder's customizer, shadcn/ui's TypesetCustomizer
 * (apps/v4/app/(app)/(typeset)/components/customizer.tsx, font-picker.tsx,
 * option-picker.tsx, picker.tsx, main-menu.tsx, random-button.tsx, #1666), as
 * server markup. Its classes are shadcn's, in the base-nova look (our nova
 * style, `.style-nova` on the page).
 *
 * It is a real GET form on /ui/typeset, so it works with JavaScript off. Each
 * picker is a button that opens a `popover` (native, no script) holding radio
 * inputs named after the param, and an Apply button submits the form. Shuffle
 * and Reset are links, Shuffle's href a random design drawn here at render.
 * They opt out of prefetch, since with the element a click never loads them.
 *
 * <typeset-customizer> (components/typeset-customizer.ts) wraps this markup
 * and adds what a form cannot: a choice applies the moment it is made (the
 * preview, the URL and the docs all follow, with no reload), the popovers
 * sit beside their trigger as shadcn's menus do, the keyboard shortcuts, the
 * locks, undo and redo. The Apply buttons hide once it is defined.
 *
 * shadcn's popups are portalled out of the card. A popover is in the top
 * layer, which escapes the card's overflow and backdrop filter the same way.
 */

const TRIGGER =
  'relative w-36 shrink-0 cursor-default touch-manipulation rounded-xl p-3 text-left ring-1 ring-foreground/10 select-none hover:bg-muted focus-visible:ring-foreground/50 focus-visible:outline-none disabled:opacity-50 data-popup-open:bg-muted md:w-full md:rounded-lg md:px-2.5 md:py-2';

// The popup. `m-auto` centres it when no script places it (the popover's own
// default), and the element pins it beside the trigger when it is there.
const CONTENT =
  'no-scrollbar m-auto w-[calc(100vw-1.5rem)] min-w-32 overflow-x-hidden overflow-y-auto rounded-xl border-0 bg-neutral-950/80 p-1.5 text-neutral-100 ring-1 ring-neutral-950/80 backdrop-blur-xl outline-none md:w-52 dark:bg-neutral-800/90 dark:ring-neutral-700/50';

const ITEM_BASE =
  'relative flex cursor-default items-center gap-2 rounded-lg py-1.5 text-sm font-medium outline-hidden select-none text-neutral-100 hover:bg-neutral-600 has-focus-visible:bg-neutral-600 focus-visible:bg-neutral-600 aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-neutral-700/80 dark:has-focus-visible:bg-neutral-700/80 dark:focus-visible:bg-neutral-700/80 pointer-coarse:gap-3 pointer-coarse:py-2.5 pointer-coarse:pl-3 pointer-coarse:text-base';
const RADIO_ITEM = ITEM_BASE + ' pr-8 pl-2';
const MENU_ITEM = ITEM_BASE + ' w-full px-2 text-left no-underline';
const GROUP_LABEL = 'px-2 py-1.5 text-xs font-medium text-neutral-400';
const MENU_SEPARATOR = '-mx-1.5 my-1.5 h-px bg-neutral-600 dark:bg-neutral-700';
const SHORTCUT = 'ml-auto text-xs tracking-widest text-neutral-400';

// The no-JS submit, hidden once <typeset-customizer> is defined.
const APPLY =
  'mt-1.5 w-full rounded-lg bg-neutral-100 px-2 py-1.5 text-sm font-medium text-neutral-900 [typeset-customizer:defined_&]:hidden';

// shadcn's LockButton. Without the element a lock would do nothing, so it
// only shows once the element is defined.
function lockButton(param: DesignParam) {
  return html`<button type="button" data-lock=${param} title="Lock" aria-label="Lock" aria-pressed="false" class="group/lock absolute top-1/2 right-8 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded opacity-0 ring-foreground/60 transition-opacity outline-none group-focus-within/picker:opacity-100 group-hover/picker:opacity-100 focus:opacity-100 focus-visible:ring-1 aria-pressed:opacity-100 max-md:hidden pointer-coarse:hidden [typeset-customizer:not(:defined)_&]:hidden">
    <span class="contents group-aria-pressed/lock:hidden">${SquareUnlock01Icon('size-5 text-foreground', 2)}</span>
    <span class="hidden group-aria-pressed/lock:contents">${SquareLock01Icon('size-5 text-foreground', 2)}</span>
  </button>`;
}

function radioItem(param: DesignParam, value: string, label: string, checked: boolean) {
  return html`<label class=${RADIO_ITEM} data-slot="dropdown-menu-radio-item">
    <input type="radio" name=${param} value=${value} ?checked=${checked} class="peer sr-only">
    <span class="pointer-events-none absolute right-2 hidden items-center justify-center peer-checked:flex" data-slot="dropdown-menu-radio-item-indicator">${CheckIcon('size-4 pointer-coarse:size-5')}</span>
    <span data-label>${label}</span>
  </label>`;
}

/** A picker's popup: the radio group and, with JS off, its Apply button. */
function pickerContent(param: DesignParam, label: string, items: unknown, extraClass = 'max-h-[calc(100svh-2rem)]') {
  return html`<div popover id=${`typeset-picker-${param}`} data-picker-content=${param} data-side="right" data-slot="dropdown-menu-content" class=${cn(CONTENT, extraClass)}>
    <div role="radiogroup" aria-label=${label}>${items}</div>
    <button type="submit" class=${APPLY}>Apply</button>
  </div>`;
}

/** shadcn's FontPicker: every font, grouped Sans / Serif / Mono, plus "inherit" for the heading. */
function fontPicker(label: string, param: 'heading' | 'body' | 'mono', params: TypesetParams) {
  const bodyFont = findFont(params.body) ?? FONTS[0];
  const value = params[param];
  const current = param === 'heading' && value === 'inherit' ? bodyFont : findFont(value) ?? bodyFont;
  const groups = [
    { label: 'Sans', fonts: FONTS.filter((font) => font.type === 'sans') },
    { label: 'Serif', fonts: FONTS.filter((font) => font.type === 'serif') },
    { label: 'Mono', fonts: FONTS.filter((font) => font.type === 'mono') },
  ];
  const items = html`
    ${param === 'heading'
      ? html`<div role="group" data-inherit>${radioItem('heading', 'inherit', bodyFont.name, value === 'inherit')}</div>
        <div role="separator" class=${MENU_SEPARATOR}></div>`
      : ''}
    ${groups.map((group) => html`<div role="group" aria-label=${group.label}>
      <div class=${GROUP_LABEL} aria-hidden="true">${group.label}</div>
      ${group.fonts.map((font) => radioItem(param, font.id, font.name, value === font.id))}
    </div>`)}`;

  return html`<div class="group/picker relative" data-picker=${param}>
    <button type="button" popovertarget=${`typeset-picker-${param}`} data-slot="dropdown-menu-trigger" class=${TRIGGER}>
      <div class="flex flex-col justify-start text-left">
        <div class="text-xs text-muted-foreground">${label}</div>
        <div class="line-clamp-1 max-w-[80%] truncate text-sm font-medium text-foreground" data-current>${current.name}</div>
      </div>
      <div class="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-base text-foreground select-none md:right-2.5" style=${`font-family: ${fontStack(current)}`} data-sample>Aa</div>
    </button>
    ${pickerContent(param, label, items, 'max-h-96')}
    ${lockButton(param)}
  </div>`;
}

/** shadcn's OptionPicker: a short list of labelled values, with an icon on the trigger. */
function optionPicker(
  label: string,
  param: DesignParam,
  options: readonly { value: string; label: string }[],
  params: TypesetParams,
  icon: unknown,
  className = '',
) {
  const value = params[param];
  const current = options.find((option) => option.value === value);
  return html`<div class=${cn('group/picker relative', className)} data-picker=${param}>
    <button type="button" popovertarget=${`typeset-picker-${param}`} data-slot="dropdown-menu-trigger" class=${TRIGGER}>
      <div class="flex min-w-0 flex-col justify-start pr-8 text-left">
        <div class="text-xs text-muted-foreground">${label}</div>
        <div class="line-clamp-1 text-sm font-medium text-foreground" data-current>${current?.label}</div>
      </div>
      <div class="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-foreground select-none md:right-2.5">${icon}</div>
    </button>
    ${pickerContent(param, label, options.map((option) => radioItem(param, option.value, option.label, option.value === value)))}
    ${lockButton(param)}
  </div>`;
}

/**
 * shadcn's TypesetMainMenu. Shuffle and Reset are links, so they work with
 * JavaScript off. The rest need the element and are disabled until it
 * enables them. Copy Link is not in shadcn's menu: the URL is the whole
 * typeset here, so it is the one way to share one.
 */
function mainMenu(params: TypesetParams) {
  const item = (label: string, shortcut: string, attrs: { href?: string; action?: string }) => attrs.href
    ? html`<a role="menuitem" href=${attrs.href} data-action=${attrs.action} data-prefetch="false" class=${MENU_ITEM}>${label} <span class=${SHORTCUT}>${shortcut}</span></a>`
    : html`<button type="button" role="menuitem" disabled data-action=${attrs.action} class=${MENU_ITEM}>${label} <span class=${SHORTCUT} data-shortcut=${attrs.action}>${shortcut}</span></button>`;
  return html`
    <button type="button" popovertarget="typeset-menu" data-slot="dropdown-menu-trigger" class=${cn(TRIGGER, 'flex items-center justify-between gap-2 rounded-lg px-1.75 ring-1 ring-foreground/10 focus-visible:ring-1')}>
      <span class="font-medium">Menu</span>
      ${Menu09Icon('size-5', 2)}
    </button>
    <div popover id="typeset-menu" role="menu" aria-label="Menu" data-picker-content="menu" data-side="right" data-align-offset="-8" data-slot="dropdown-menu-content" class=${cn(CONTENT, 'max-h-[calc(100svh-2rem)]')}>
      ${item('Shuffle', 'R', { href: builderHref(shuffleParams(params)), action: 'shuffle' })}
      ${item('Light/Dark', 'D', { action: 'theme' })}
      <div role="separator" class=${MENU_SEPARATOR}></div>
      ${item('Undo', 'Ctrl+Z', { action: 'undo' })}
      ${item('Redo', 'Ctrl+Shift+Z', { action: 'redo' })}
      <div role="separator" class=${MENU_SEPARATOR}></div>
      ${item('Reset', '⇧R', { href: builderHref(DEFAULTS), action: 'reset' })}
      ${item('Copy Link', '', { action: 'copy-link' })}
    </div>`;
}

export function customizer(params: TypesetParams, origin: string) {
  const separator = html`<div data-slot="field-separator" role="none" class=${cn(fieldSeparatorClass(), 'hidden md:block')}></div>`;
  return html`<form method="get" action="/ui/typeset" data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 [color-scheme:dark] backdrop-blur-xl md:w-(--customizer-width)')}>
      <input type="hidden" name="item" value=${params.item}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'hidden items-center justify-between gap-2 border-b md:flex')}>
        ${mainMenu(params)}
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto')}>
        <div data-slot="field-group" class=${cn(fieldGroupClass(), 'flex-row gap-2.5 py-px **:data-[slot=field-separator]:-mx-4 **:data-[slot=field-separator]:w-auto max-md:px-3 md:flex-col md:gap-3.25')}>
          ${optionPicker('Measure', 'measure', TYPESET_MEASURES, params, ArrowHorizontalIcon('size-4.5', 2), 'max-[28rem]:hidden')}
          ${separator}
          ${fontPicker('Heading', 'heading', params)}
          ${fontPicker('Body', 'body', params)}
          ${fontPicker('Mono', 'mono', params)}
          ${separator}
          ${optionPicker('Size', 'scale', TYPESET_SIZES, params, TextSmallcapsIcon('size-4.5', 2))}
          ${optionPicker('Leading', 'leading', TYPESET_LEADINGS, params, LineHeightIcon('size-4.5', 2))}
          ${optionPicker('Flow', 'flow', TYPESET_FLOWS, params, ParagraphSpacingIcon('size-4.5', 2))}
          <div aria-hidden="true" class="w-0.5 shrink-0 md:hidden"></div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex min-w-0 flex-row-reverse gap-2 border-t md:flex-col md:*:w-full')}>
        <a href=${builderHref(shuffleParams(params))} data-action="shuffle" data-prefetch="false" data-slot="button" class=${cn(buttonClass({ variant: 'outline' }), 'min-w-0 flex-1 touch-manipulation bg-transparent! px-2! py-0! text-sm! no-underline transition-none select-none hover:bg-muted! md:flex-none pointer-coarse:h-10!')}>
          <span class="w-full truncate text-center font-medium">Shuffle</span>
        </a>
        ${getCodeDrawer(params, origin, cn(buttonClass({ variant: 'outline' }), 'min-w-0 flex-1 touch-manipulation bg-transparent! px-2! py-0! text-sm! transition-none select-none hover:bg-muted! md:w-full md:flex-none xl:hidden pointer-coarse:h-10!'))}
      </div>
    </form>`;
}
