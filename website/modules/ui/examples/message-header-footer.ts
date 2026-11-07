import { html } from '@webjsdev/core';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import {
  messageClass, messageContentClass, messageFooterClass, messageHeaderClass,
} from '#modules/ui/components/message.ts';

export default function MessageHeaderFooterDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="message-header" class=${messageHeaderClass()}>Olivia</div>
          <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>I already checked the logs.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              Send the report to the team. Ping @shadcn if you need help.
            </div>
          </div>
          <div data-slot="message-footer" class=${messageFooterClass()}>
            <div>
              Read <span class="font-normal">Yesterday</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
