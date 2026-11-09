import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const messages: ChatMessage[] = [
  {
    id: 'vis-brief',
    role: 'user',
    text: 'Review the incident handoff and tell me what to read first.',
  },
  {
    id: 'vis-brief-reply',
    role: 'assistant',
    text: 'Start with the summary and the impact section. The regression affected the upload queue, but the recovery path completed for every queued job.',
  },
  { id: 'vis-impact', role: 'user', text: 'What was the customer impact?' },
  {
    id: 'vis-impact-reply',
    role: 'assistant',
    text: 'Impact was limited to delayed processing.\n\nNo records were dropped, and the reconciliation worker confirmed each retry batch. Support saw confusion from two customers, but there were no checkout or billing errors.',
  },
  { id: 'vis-actions', role: 'user', text: 'What actions are open?' },
  {
    id: 'vis-actions-reply',
    role: 'assistant',
    text: 'Keep the retry window enabled until the next deploy, then add a queue-depth alert as the long-term fix.\n\nThe alert should fire on sustained queue growth, not a single short spike.',
  },
  { id: 'vis-checklist', role: 'user', text: 'Give me the follow-up checklist.' },
  {
    id: 'vis-checklist-reply',
    role: 'assistant',
    text: 'After that, compare the queue recovery graph with the deploy timeline so the handoff shows exactly when processing returned to baseline. That makes it easier for support and engineering to answer the same customer questions without re-reading the whole incident thread.\n\nI would also add a short owner note beside each follow-up item. The checklist is small, but ownership keeps the retry-window decision, alert tuning, and support macro from drifting into separate follow-up conversations.\n\nKeep the retry window enabled until the next deploy, then add a queue-depth alert as the long-term fix.\n\nThe alert should fire on sustained queue growth, not a single short spike.',
  },
];

const userMessages = messages.filter((m) => m.role === 'user');

// The anchored turn the reader is in. The scroller reports what is on
// screen through visibleMessageIds and the ui-visibility-change event.
const currentAnchorId = userMessages[0].id;

const trimmed = (text: string) => (text.length > 42 ? `${text.slice(0, 39)}...` : text);

const row = (m: ChatMessage) => {
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

export default function MessageScrollerVisibility() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div class="relative mx-auto w-full max-w-sm">
        <div data-slot="card" data-size="default" class=${cn(cardClass(), 'h-140 w-full gap-0')}>
          <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
            <div data-slot="card-title" class=${cardTitleClass()}>Transcript Outline</div>
            <div data-slot="card-description" class=${cardDescriptionClass()}>
              Track the current anchored turn.
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
            <ui-message-scroller>
              <ui-message-scroller-viewport>
                <ui-message-scroller-content aria-label="Incident handoff" class="p-(--card-spacing)">
                  ${messages.map(row)}
                </ui-message-scroller-content>
              </ui-message-scroller-viewport>
              <ui-message-scroller-button></ui-message-scroller-button>
            </ui-message-scroller>
          </div>
        </div>
        <div class="absolute top-1/2 -right-12 -translate-y-1/2">
          <ui-hover-card open-delay="0" close-delay="0">
            <ui-hover-card-trigger>
              <button type="button" aria-label="Open transcript outline" class="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                ${userMessages.map((m) => html`
                  <span data-current=${m.id === currentAnchorId ? 'true' : 'false'} class="h-0.5 w-4 rounded-full bg-muted-foreground/40 data-[current=true]:bg-foreground"></span>
                `)}
              </button>
            </ui-hover-card-trigger>
            <ui-hover-card-content align="center" side="left" side-offset="-28" class="flex w-64 flex-col gap-1 rounded-2xl p-1">
              ${userMessages.map((m) => html`
                <button type="button" aria-current=${m.id === currentAnchorId ? 'location' : nothing} class="flex min-h-7 items-center rounded-xl px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground aria-current:bg-accent aria-current:text-accent-foreground">
                  <span class="line-clamp-1 min-w-0">${trimmed(m.text)}</span>
                </button>
              `)}
            </ui-hover-card-content>
          </ui-hover-card>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-muted-foreground">
        Open the outline to jump between anchored turns as you read.
      </div>
    </div>
  `;
}
