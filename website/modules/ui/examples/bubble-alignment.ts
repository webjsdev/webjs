import { html } from '@webjsdev/core';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';

export default function BubbleAlignmentDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          This bubble is aligned to the start. This is the default alignment.
        </div>
      </div>
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          This bubble is aligned to the end. Use this for user messages.
        </div>
      </div>
    </div>
  `;
}
