import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { RotateCwIcon } from '#lib/ui/lucide.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

// The whole history, loaded.
const history: ChatMessage[] = [
  { id: 'history-1', role: 'user', text: 'Can you summarize the incident channel?' },
  {
    id: 'history-2',
    role: 'assistant',
    text: 'The first alert was a delayed export job. It started backing up around 09:42 UTC and triggered the warning once the retry queue crossed the threshold.\n\nNo customer-facing checkout paths were affected, but exports for larger workspaces were running about 12 minutes behind.',
  },
  { id: 'history-3', role: 'user', text: 'Was checkout affected?' },
  {
    id: 'history-4',
    role: 'assistant',
    text: 'No checkout errors were reported. Payment authorization, order creation, and confirmation emails stayed inside their normal latency bands.\n\nThe only elevated metric was export queue depth, which maps to analytics downloads instead of checkout.',
  },
  { id: 'history-5', role: 'user', text: 'What changed in the last deploy?' },
  {
    id: 'history-6',
    role: 'assistant',
    text: 'Only the export queue worker changed. The deploy moved large CSV jobs onto the shared retry policy, which made each failed attempt hold a worker slot longer than before.\n\nThe app deploy did not include checkout, pricing, or billing API changes.',
  },
  { id: 'history-7', role: 'user', text: 'Do we need to roll back?' },
  {
    id: 'history-8',
    role: 'assistant',
    text: 'Not yet. Queue depth is recovering after we reduced retry concurrency, and the oldest pending job is now under five minutes old.\n\nKeep rollback ready if the queue starts climbing again, but the current trend points toward recovery.',
  },
  { id: 'history-9', role: 'user', text: 'Keep watching for customer-visible issues.' },
  {
    id: 'history-10',
    role: 'assistant',
    text: 'I will watch the queue and support tags for another 15 minutes. I am tracking export failures, delayed download requests, and any support thread that mentions missing reports.\n\nIf those stay quiet through the next batch window, we can close this as an internal degradation.',
  },
];

const row = (m: ChatMessage) => {
  const user = m.role === 'user';
  const paragraphs = m.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return html`
    <ui-message-scroller-item message-id=${m.id}>
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

export default function MessageScrollerLoadHistory() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Load History</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Prepended messages keep your place.
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="tooltip-trigger" data-variant="outline" data-size="icon" aria-label="Reset loaded messages" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
                  ${RotateCwIcon()}
                </button>
              </ui-tooltip-trigger>
              <ui-tooltip-content><p>Reset</p></ui-tooltip-content>
            </ui-tooltip>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
          <ui-message-scroller>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Incident channel" class="p-(--card-spacing)">
                ${history.map(row)}
                <ui-message-scroller-item>
                  <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
                    <span data-slot="marker-content" class=${markerContentClass()}>End of Conversation</span>
                  </div>
                </ui-message-scroller-item>
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex flex-col items-center gap-2 border-t')}>
          <button type="button" data-slot="button" data-variant="secondary" data-size="default" disabled class=${cn(buttonClass({ variant: 'secondary' }), 'w-full')}>
            History Loaded
          </button>
          <p class="text-xs text-muted-foreground">
            Restore earlier messages while keeping your place.
          </p>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-balance text-muted-foreground">
        Click Load History to load the entire conversation
      </div>
    </div>
  `;
}
