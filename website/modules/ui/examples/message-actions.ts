import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass, messageFooterClass } from '#modules/ui/components/message.ts';
import { CopyIcon, RefreshCcwIcon, ThumbsDownIcon, ThumbsUpIcon } from '#lib/ui/lucide.ts';

export default function MessageActionsDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              The install failure is coming from the workspace package.
            </div>
          </div>
          <div data-slot="message-footer" class=${messageFooterClass()}>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon" aria-label="Copy" title="Copy" class=${buttonClass({ variant: 'ghost', size: 'icon' })}>
              ${CopyIcon()}
            </button>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon" aria-label="Like" title="Like" class=${buttonClass({ variant: 'ghost', size: 'icon' })}>
              ${ThumbsUpIcon()}
            </button>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon" aria-label="Dislike" title="Dislike" class=${buttonClass({ variant: 'ghost', size: 'icon' })}>
              ${ThumbsDownIcon()}
            </button>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Okay drop me a link. Taking a look...</div>
          </div>
          <div data-slot="message-footer" class=${cn(messageFooterClass(), 'gap-2')}>
            <span class="font-normal text-destructive">Failed to send</span>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon-xs" title="Retry" aria-label="Retry" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
              ${RefreshCcwIcon()}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
