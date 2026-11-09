import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { PREVIEW_ITEMS, createHref, previewHref, type CreateParams } from './params.ts';
import type { ExplorerGroup } from '#modules/ui/queries/create-items.server.ts';

/**
 * The /ui/create preview, shadcn/ui's Preview and PreviewSwitcher
 * (apps/v4/app/(app)/(create)/components/preview.tsx and
 * preview-switcher.tsx, #1666): the frame of /ui/preview/<item>, which wears
 * the design system, and floating over it the preview switch and Open in New
 * Tab.
 *
 * Every control is a link carrying the current preset, so each works with
 * JavaScript off. <create-customizer> keeps their hrefs current, repaints the
 * frame in place when a choice changes (it is same-origin), and turns a
 * preview click into a frame swap with no page load.
 *
 * Items is shadcn's item explorer (its Navigate... menu, Cmd or Ctrl+P): every
 * block and component demo the frame can show, grouped, each a link that
 * shows it in the frame. A popover, so it opens with no script; the element
 * adds the filter field, the shortcut and the in-place swap.
 */

const BAR = 'flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl [color-scheme:dark] backdrop-blur-xl';
// A function rather than a constant, so importing this module does no work.
function pill(extra = '') {
  return cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'h-7 min-w-7 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground', extra);
}

const EXPLORER =
  'no-scrollbar m-auto max-h-[min(32rem,calc(100svh-2rem))] w-72 overflow-y-auto rounded-xl border-0 bg-neutral-950/80 p-1.5 text-neutral-100 ring-1 ring-neutral-950/80 backdrop-blur-xl outline-none dark:bg-neutral-800/90 dark:ring-neutral-700/50';
const EXPLORER_ITEM =
  'flex w-full items-center rounded-lg px-2 py-1.5 text-sm no-underline text-neutral-100 outline-hidden hover:bg-neutral-600 focus-visible:bg-neutral-600 data-[active=true]:bg-neutral-700 dark:hover:bg-neutral-700/80';

/** The item explorer's popover: a filter (with the element) and the grouped items. */
function itemExplorer(params: CreateParams, groups: readonly ExplorerGroup[]) {
  return html`<div popover id="create-explorer" data-explorer aria-label="Items" class=${EXPLORER}>
    <input type="search" data-explorer-filter placeholder="Search items..." aria-label="Search items" autocomplete="off" class="mb-1 h-8 w-full rounded-lg bg-neutral-900/60 px-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-500 [create-customizer:not(:defined)_&]:hidden">
    ${groups.map((group) => html`<div role="group" aria-label=${group.title} data-explorer-group>
      <div class="px-2 py-1.5 text-xs font-medium text-neutral-400">${group.title}</div>
      ${group.items.map((item) => html`<a
        href=${createHref({ ...params, item: item.name })}
        data-item=${item.name}
        data-explorer-item=${item.title.toLowerCase()}
        data-prefetch="false"
        data-active=${String(params.item === item.name)}
        class=${EXPLORER_ITEM}
      >${item.title}</a>`)}
    </div>`)}
  </div>`;
}

export function previewFrame(params: CreateParams, groups: readonly ExplorerGroup[] = []) {
  return html`<div data-slot="create-preview" class="relative isolate flex size-full min-h-[60svh] flex-1 overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10 md:min-h-0">
    <iframe src=${previewHref(params)} title="Design system preview" class="size-full border-0"></iframe>
    <div class="style-new-york absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-1.5">
      <nav aria-label="Previews" class=${BAR}>
        ${PREVIEW_ITEMS.map((item, index) => html`<a
          href=${createHref({ ...params, item: item.value })}
          data-item=${item.value}
          data-prefetch="false"
          data-active=${String(params.item === item.value)}
          aria-current=${params.item === item.value ? 'page' : nothing}
          title=${item.label}
          data-slot="button"
          class=${pill()}
        >${String(index + 1).padStart(2, '0')}<span class="sr-only"> ${item.label}</span></a>`)}
      </nav>
      <div class=${BAR}>
        ${groups.length ? html`<button type="button" popovertarget="create-explorer" data-explorer-trigger title="Browse items" class=${pill('px-2.5')}>Items</button>` : ''}
        <a href=${previewHref(params)} target="_blank" rel="noreferrer" data-open-preview data-slot="button" class=${pill('px-2.5')}>Open in New Tab</a>
      </div>
    </div>
    ${groups.length ? itemExplorer(params, groups) : ''}
  </div>`;
}
