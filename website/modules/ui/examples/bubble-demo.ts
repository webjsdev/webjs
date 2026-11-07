import { html } from '@webjsdev/core';
import {
  bubbleGroupClass, bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';

export default function BubbleDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Hey there! what's up?</div>
      </div>
      <div data-slot="bubble-group" class=${bubbleGroupClass()}>
        <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>Hey! Want to see chat bubbles?</div>
        </div>
        <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
          <div data-slot="bubble-content" class=${bubbleContentClass()}>
            I can group messages, switch sides, and keep the whole thread easy
            to scan.
          </div>
          <div data-slot="bubble-reactions" data-align="end" data-side="bottom" role="img" aria-label="Reaction: thumbs up" class=${bubbleReactionsClass()}>
            <span>👍</span>
          </div>
        </div>
      </div>
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Sure. Hit me with your best demo.</div>
      </div>
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          Yes. You are reading a demo that is demoing itself. Very meta. Very
          on-brand.
        </div>
        <div data-slot="bubble-reactions" data-align="end" data-side="bottom" role="img" aria-label="Reactions: thumbs up, fire, eyes, and 2 more" class=${bubbleReactionsClass()}>
          <span>👍</span>
          <span>🔥</span>
          <span>👀</span>
          <span>+2</span>
        </div>
      </div>
    </div>
  `;
}
