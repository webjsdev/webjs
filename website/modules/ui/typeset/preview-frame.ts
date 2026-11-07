import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CONTENT_OPTIONS, builderHref, previewHref, type TypesetParams } from './params.ts';
import { LinkSquare02Icon } from './icons.ts';

/**
 * The typeset builder's preview, shadcn/ui's TypesetPreview and
 * TypesetToolbar (apps/v4/app/(app)/(typeset)/components/preview.tsx and
 * toolbar.tsx, #1666): the iframe of /ui/preview/typeset/<item> and, floating
 * over it, the 01 to 05 specimen switch and Open in New Tab.
 *
 * Every control is a link carrying the current params, so each works with
 * JavaScript off. The specimen links opt out of prefetch: with the element
 * a click never loads them, so a hover would fetch a page for nothing. <typeset-customizer> keeps their hrefs current and turns a
 * specimen click into a frame swap with no page load. The pills are shadcn's
 * new-york-v4 ghost `sm` buttons (`.style-new-york` here), and the label
 * shadcn puts in a tooltip is the link's title, and its screen-reader text.
 */

const BAR = 'flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl [color-scheme:dark] backdrop-blur-xl';

export function previewFrame(params: TypesetParams) {
  return html`<div data-slot="typeset-preview" class="relative isolate flex size-full min-h-0 flex-1 overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10">
    <iframe src=${previewHref(params)} title="typeset preview" class="size-full border-0"></iframe>
    <div class="style-new-york absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-1.5">
      <nav aria-label="Specimens" class=${BAR}>
        ${CONTENT_OPTIONS.map((option, index) => html`<a
          href=${builderHref({ ...params, item: option.value })}
          data-item=${option.value}
          data-prefetch="false"
          data-active=${String(params.item === option.value)}
          aria-current=${params.item === option.value ? 'page' : null}
          title=${option.label}
          data-slot="button"
          class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'h-7 min-w-7 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground')}
        >${String(index + 1).padStart(2, '0')}<span class="sr-only"> ${option.label}</span></a>`)}
      </nav>
      <div class=${BAR}>
        <a href=${previewHref(params)} target="_blank" rel="noreferrer" data-open-preview data-slot="button" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'h-7 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground')}>
          ${LinkSquare02Icon('size-3.5 md:hidden', 2)}
          <span class="max-md:sr-only">Open in New Tab</span>
        </a>
      </div>
    </div>
  </div>`;
}
