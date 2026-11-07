import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  popoverContentClass, popoverHeaderClass, popoverTitleClass, popoverDescriptionClass,
} from '#modules/ui/components/popover.ts';
import {
  bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';
import { InfoIcon } from '#lib/ui/lucide.ts';

export default function BubblePopoverDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-4 py-12">
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Run the build script.</div>
      </div>
      <div data-slot="bubble" data-variant="destructive" data-align="start" class=${bubbleClass({ variant: 'destructive' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Failed to run the command.</div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" class=${bubbleReactionsClass()}>
          <button type="button" popovertarget="bubble-popover-details" aria-haspopup="dialog" aria-label="Show error details" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), 'aria-expanded:text-destructive')}>
            ${InfoIcon()}
          </button>
        </div>
        <div id="bubble-popover-details" popover role="dialog" aria-labelledby="bubble-popover-title" data-slot="popover-content" data-side="bottom" data-align="center" class=${popoverContentClass()}>
          <div data-slot="popover-header" class=${popoverHeaderClass()}>
            <h4 id="bubble-popover-title" data-slot="popover-title" class=${cn(popoverTitleClass(), 'text-sm')}>Command failed with exit code 1</h4>
            <p data-slot="popover-description" class=${cn(popoverDescriptionClass(), 'text-sm')}>
              ENOENT: no such file or directory, open pnpm-lock.yaml
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}
