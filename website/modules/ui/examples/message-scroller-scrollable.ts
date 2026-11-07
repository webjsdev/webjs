import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';

const messages = Array.from({ length: 12 }, (_, index) => ({
  id: `scrollable-${index + 1}`,
  role: index % 2 === 0 ? 'user' : 'assistant',
  text:
    index % 2 === 0
      ? `Review scroll checkpoint ${index + 1}.`
      : `Checkpoint ${index + 1} is synced. The scrollable hook updates as the viewport moves.\n\nWhen the reader is at the first message, the footer should only point them down. Once they move into the middle of the transcript, it should explain that both directions are available.\n\nAt the latest message, the footer should switch again and only point them back up.`,
}));

// The footer's sentence for the edges the viewport can still scroll toward,
// as the scroller reports them in `scrollable` and ui-scrollable-change.
function scrollStatus({ start, end }: { start: boolean; end: boolean }) {
  if (start && end) return 'You can scroll both ways.';
  if (end) return 'You are at the top. You can only scroll down.';
  if (start) return 'You are at the bottom. You can only scroll up.';
  return 'All messages fit in the viewport.';
}

const row = (m: (typeof messages)[number]) => {
  const user = m.role === 'user';
  const paragraphs = m.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return html`
    <ui-message-scroller-item message-id=${m.id} ?scroll-anchor=${user}>
      <div data-slot="message" data-align=${user ? 'end' : 'start'} class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant=${user ? 'muted' : 'ghost'} class=${bubbleClass({ variant: user ? 'muted' : 'ghost' })}>
            <div data-slot="bubble-content" class=${cn(bubbleContentClass(), 'space-y-2')}>
              ${paragraphs.map((p) => html`<p class="whitespace-pre-wrap">${p}</p>`)}
            </div>
          </div>
        </div>
      </div>
    </ui-message-scroller-item>
  `;
};

export default function MessageScrollerScrollable() {
  return html`
    <div class="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'h-140 w-full gap-0 overflow-hidden')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Scroll Status</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Where the reader can go scroll to based on current scroll position.
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
          <ui-message-scroller default-scroll-position="start">
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="gap-4 p-(--card-spacing)">
                ${messages.map(row)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-center border-t text-center text-sm text-muted-foreground')}>
          ${scrollStatus({ start: false, end: true })}
        </div>
      </div>
      <div class="px-0.5 text-center text-xs text-muted-foreground">
        Scroll the transcript to see the footer update.
      </div>
    </div>
  `;
}
