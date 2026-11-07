import { html } from '@webjsdev/core';
import {
  bubbleGroupClass, bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';

export default function BubbleGroupDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Can you tell me what&apos;s the issue?</div>
      </div>
      <div data-slot="bubble-group" class=${bubbleGroupClass()}>
        <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>You tell me!</div>
        </div>
        <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>It worked yesterday. You broke it!</div>
        </div>
        <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>Find the bug and fix it.</div>
          <div data-slot="bubble-reactions" data-side="bottom" data-align="start" aria-label="Reactions: eyes" class=${bubbleReactionsClass({ align: 'start' })}>
            <span>👀</span>
          </div>
        </div>
      </div>
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          Want me to diff yesterday&apos;s you against today&apos;s you?
          It&apos;s a bit embarrassing.
        </div>
      </div>
    </div>
  `;
}
