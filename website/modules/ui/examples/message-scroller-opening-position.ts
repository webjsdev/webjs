import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const messages: ChatMessage[] = [
  {
    id: 'open-1',
    role: 'user',
    text: 'This is the first message the user sent in the conversation.',
  },
  {
    id: 'open-2',
    role: 'assistant',
    text: 'Workspace creation rose 8%, but first invite completion only rose 2%.',
  },
  {
    id: 'open-3',
    role: 'user',
    text: 'This is the last message the user sent in the conversation.',
  },
  {
    id: 'open-4',
    role: 'assistant',
    text: 'Start with the invite step. Teams are creating workspaces but waiting to add collaborators.\n\nRecommended follow-up:\n\n1. Compare invite drop-off by account size.\n2. Check whether users who skip invites still return within 24 hours.\n3. Review the empty-state copy on the first project screen.\n4. Segment activation by template, since template users may not need invites right away.\n\nIf that pattern holds, the next experiment should make collaboration useful earlier instead of prompting for invites harder.',
  },
];

const positions = ['start', 'end', 'last-anchor'] as const;
const position: (typeof positions)[number] = 'last-anchor';

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

export default function MessageScrollerOpeningPosition() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Opening Position</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Choose where a saved transcript opens.
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
          <ui-message-scroller default-scroll-position=${position}>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="p-(--card-spacing)">
                ${messages.map(row)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex items-center justify-center border-t')}>
          <ui-tabs value=${position} class="w-full">
            <ui-tabs-list class="w-full">
              ${positions.map((p) => html`<ui-tabs-trigger value=${p}>${p}</ui-tabs-trigger>`)}
            </ui-tabs-list>
          </ui-tabs>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-muted-foreground">
        Toggle the defaultScrollPosition to see where the transcript starts when
        you open the thread
      </div>
    </div>
  `;
}
