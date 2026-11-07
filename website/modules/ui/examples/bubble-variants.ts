import { html } from '@webjsdev/core';
import {
  bubbleClass, bubbleContentClass, bubbleReactionsClass,
} from '#modules/ui/components/bubble.ts';

export default function BubbleVariantsDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-12 py-12">
      <div data-slot="bubble" data-variant="default" data-align="start" class=${bubbleClass()}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>This is the default primary bubble.</div>
      </div>
      <div data-slot="bubble" data-variant="secondary" data-align="end" class=${bubbleClass({ variant: 'secondary' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>This is the secondary variant.</div>
      </div>
      <div data-slot="bubble" data-variant="muted" data-align="start" class=${bubbleClass({ variant: 'muted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          This one is muted. It uses a lower emphasis color for the chat bubble.
        </div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" role="img" aria-label="Reaction: thumbs up" class=${bubbleReactionsClass()}>
          <span>👍</span>
        </div>
      </div>
      <div data-slot="bubble" data-variant="tinted" data-align="end" class=${bubbleClass({ variant: 'tinted' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          This one is tinted. The tint is a softer color derived from the
          primary color.
        </div>
      </div>
      <div data-slot="bubble" data-variant="outline" data-align="start" class=${bubbleClass({ variant: 'outline' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>We can also use an outlined variant.</div>
      </div>
      <div data-slot="bubble" data-variant="destructive" data-align="end" class=${bubbleClass({ variant: 'destructive' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>Or a destructive variant with a reaction.</div>
        <div data-slot="bubble-reactions" data-side="bottom" data-align="end" role="img" aria-label="Reaction: fire" class=${bubbleReactionsClass()}>
          <span>🔥</span>
        </div>
      </div>
      <div data-slot="bubble" data-variant="ghost" data-align="start" class=${bubbleClass({ variant: 'ghost' })}>
        <div data-slot="bubble-content" class=${bubbleContentClass()}>
          <div data-slot="markdown" class="w-full min-w-0 space-y-4 overflow-hidden">
            <p>
              Ghost bubbles work for assistant text, <strong>markdown</strong>,
              and other content that should not be framed.
            </p>
            <p>
              This is perfect for assistant messages that should not have a
              frame and can take the full width of the container. You can also
              render <code class="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">code</code> in it.
            </p>
            <p>Ghost bubbles are full width and can take the full width of the container.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
