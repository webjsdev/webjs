import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { collapsibleClass, collapsibleTriggerClass } from '#modules/ui/components/collapsible.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

const text = `The accessibility review found two focus states that were visually too subtle in dark mode.

I checked the dialog, menu, and drawer paths because each one renders focusable controls inside a layered surface.

The dialog and drawer are fine. The menu needs the hover and focus tokens split so keyboard focus stays visible when the pointer is not involved.

I also recommend keeping the change in the style file instead of the primitive so the other themes can choose their own focus treatment later.`;

const previewLength = 180;

// A native <details> is the collapsible, so it opens and closes with no
// script. The preview and the full text sit above it, and the wrapper's
// :has(details[open]) picks which one shows.
export default function BubbleCollapsible() {
  const isLong = text.length > previewLength;
  const preview = `${text.slice(0, previewLength)}...`;
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>How can I help you today?</div>
      </div>
      <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${cn(bubbleContentClass(), 'group/text')}>
          ${isLong
            ? html`
              <div class="whitespace-pre-line group-has-[details[open]]/text:hidden">${preview}</div>
              <div class="hidden whitespace-pre-line group-has-[details[open]]/text:block">${text}</div>
              <details data-slot="collapsible" class=${collapsibleClass()}>
                <summary data-slot="collapsible-trigger" class=${cn(collapsibleTriggerClass(), buttonClass({ variant: 'link' }), 'w-fit justify-start gap-1 p-0 text-muted-foreground')}>
                  <span class="group-open:hidden">Show more</span>
                  <span class="hidden group-open:inline">Show less</span>
                  ${ChevronDownIcon('group-open:rotate-180')}
                </summary>
              </details>`
            : html`<div class="whitespace-pre-line">${text}</div>`}
        </div>
      </div>
    </div>
  `;
}
