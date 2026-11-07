import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';

export default function BubbleReactionsDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-12 py-12">
      <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          I don&apos;t need tests, I know my code works.
        </div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="start" role="img" aria-label="Reactions: thumbs up, surprised" class=${bubbleReactionsClass({ align: 'start' })}>
          <span>👍</span>
          <span>😮</span>
        </div>
      </div>
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          Bold. Fine I&apos;ll add some tests. I&apos;ll let you know when
          they&apos;re done.
        </div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" role="img" aria-label="Reactions: eyes, rocket, and 2 more" class=${bubbleReactionsClass()}>
          <span>👀</span>
          <span>🚀</span>
          <span>+2</span>
        </div>
      </div>
      <div data-slot="bubble" data-variant="default" data-align="end" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          Tests passed on the first try. All 142 of them. Looking good!
        </div>
        <div data-slot="bubble-reactions" data-side="top" data-align="start" role="img" aria-label="Reactions: party popper, clapping hands" class=${bubbleReactionsClass({ side: 'top', align: 'start' })}>
          <span>🎉</span>
          <span>👏</span>
        </div>
      </div>
      <div data-slot="bubble" data-variant="destructive" data-align="start" class=${bubbleClass({ variant: 'destructive' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Are you sure I can run this command?</div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" class=${bubbleReactionsClass()}>
          <button type="button" data-slot="button" data-variant="ghost" data-size="xs" class=${buttonClass({ variant: 'ghost', size: 'xs' })}>Yes, run it</button>
        </div>
      </div>
    </div>
  `;
}
