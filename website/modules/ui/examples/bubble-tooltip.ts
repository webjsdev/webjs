import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';
import { CheckIcon } from '#lib/ui/lucide.ts';

export default function BubbleTooltipDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-4 py-12">
      <div data-slot="bubble" data-variant="secondary" data-align="start" class=${bubbleClass({ variant: 'secondary' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Did you remove the stale route?</div>
      </div>
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Yes, removed it from the registry.</div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" class=${cn(bubbleReactionsClass(), 'p-0')}>
          <ui-tooltip>
            <ui-tooltip-trigger>
              <button type="button" data-slot="button" data-variant="ghost" data-size="icon-xs" aria-label="Read receipt" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
                ${CheckIcon()}
              </button>
            </ui-tooltip-trigger>
            <ui-tooltip-content>Read on Jan 5, 2026 at 4:32 PM</ui-tooltip-content>
          </ui-tooltip>
        </div>
      </div>
    </div>
  `;
}
