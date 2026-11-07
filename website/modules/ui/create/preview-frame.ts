import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { PREVIEW_ITEMS, createHref, previewHref, type CreateParams } from './params.ts';

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
 */

const BAR = 'flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl [color-scheme:dark] backdrop-blur-xl';
// A function rather than a constant, so importing this module does no work.
function pill(extra = '') {
  return cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'h-7 min-w-7 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground', extra);
}

export function previewFrame(params: CreateParams) {
  return html`<div data-slot="create-preview" class="relative isolate flex size-full min-h-[60svh] flex-1 overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10 md:min-h-0">
    <iframe src=${previewHref(params)} title="Design system preview" class="size-full border-0"></iframe>
    <div class="style-new-york absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-1.5">
      <nav aria-label="Previews" class=${BAR}>
        ${PREVIEW_ITEMS.map((item, index) => html`<a
          href=${createHref({ ...params, item: item.value })}
          data-item=${item.value}
          data-prefetch="false"
          data-active=${String(params.item === item.value)}
          aria-current=${params.item === item.value ? 'page' : null}
          title=${item.label}
          data-slot="button"
          class=${pill()}
        >${String(index + 1).padStart(2, '0')}<span class="sr-only"> ${item.label}</span></a>`)}
      </nav>
      <div class=${BAR}>
        <a href=${previewHref(params)} target="_blank" rel="noreferrer" data-open-preview data-slot="button" class=${pill('px-2.5')}>Open in New Tab</a>
      </div>
    </div>
  </div>`;
}
