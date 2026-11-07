import { html } from '@webjsdev/core';
import {
  bubbleGroupClass, bubbleClass, bubbleContentClass,
} from '#modules/ui/components/bubble.ts';

// The kit has no asChild: the content helper goes straight on the <button>
// (or an <a>). Wire each one's click to whatever it should do.
const reply = (text: string) => html`
  <div data-slot="bubble" data-variant="tinted" data-align="end" class=${bubbleClass({ variant: 'tinted' })}>
    <button type="button" data-slot="bubble-content" class=${bubbleContentClass()}>${text}</button>
  </div>
`;

export default function BubbleLinkButtonDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>How can I help you today?</div>
      </div>
      <div data-slot="bubble-group" class=${bubbleGroupClass()}>
        ${reply('I forgot my password')}
        ${reply('I need help with my subscription')}
        ${reply('Something else. Talk to a human.')}
      </div>
    </div>
  `;
}
