import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';
import { messageClass, messageContentClass, messageHeaderClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { RotateCwIcon } from '#lib/ui/lucide.ts';

const currentUser = 'Grace';

type GroupChatItem =
  | { id: string; type: 'event'; text: string; scrollAnchor?: boolean }
  | {
      id: string;
      type: 'message';
      sender: string;
      role: 'assistant' | 'participant';
      text: string;
      scrollAnchor?: boolean;
    };

// The conversation once Rocky has joined and replied.
const items: GroupChatItem[] = [
  {
    id: 'group-1',
    type: 'message',
    sender: 'Grace',
    role: 'participant',
    text: '@mary, the astrophage line keeps matching Venus energy output. Can you check my math?',
  },
  {
    id: 'group-2',
    type: 'message',
    sender: 'Mary (Agent)',
    role: 'assistant',
    text: 'Yes. Confirmed. The curve points to a microorganism harvesting stellar energy and breeding near carbon dioxide. If @rocky agrees, this is the clue we need.',
  },
  {
    id: 'group-3',
    type: 'message',
    sender: 'Grace',
    role: 'participant',
    text: 'ping @rocky',
    scrollAnchor: true,
  },
  {
    id: 'group-4',
    type: 'event',
    text: 'Rocky has joined the chat',
    scrollAnchor: true,
  },
  {
    id: 'group-5',
    type: 'message',
    sender: 'Rocky',
    role: 'participant',
    text: 'Amaze. Astrophage eats light, makes heat, goes to carbon dioxide. Rocky has fuel model. Grace is smart.',
  },
];

const message = (item: Extract<GroupChatItem, { type: 'message' }>) => {
  const isCurrentUser = item.sender === currentUser;
  const variant = isCurrentUser ? 'muted' : item.role === 'assistant' ? 'ghost' : 'tinted';
  return html`
    <ui-message-scroller-item message-id=${item.id} ?scroll-anchor=${!!item.scrollAnchor}>
      <div data-slot="message" data-align=${isCurrentUser ? 'end' : 'start'} class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          ${isCurrentUser ? '' : html`<div data-slot="message-header" class=${messageHeaderClass()}>${item.sender}</div>`}
          <div data-slot="bubble" data-variant=${variant} class=${bubbleClass({ variant })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${item.text}</div>
          </div>
        </div>
      </div>
    </ui-message-scroller-item>
  `;
};

const marker = (item: Extract<GroupChatItem, { type: 'event' }>) => html`
  <ui-message-scroller-item message-id=${item.id} ?scroll-anchor=${!!item.scrollAnchor}>
    <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
      <span data-slot="marker-content" class=${markerContentClass()}>${item.text}</span>
    </div>
  </ui-message-scroller-item>
`;

export default function MessageScrollerGroupChat() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Group Chat</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            A group chat with several participants and an assistant. The
            Marker is marked as a turn.
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="tooltip-trigger" data-variant="outline" data-size="icon" aria-label="Reset conversation" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
                  ${RotateCwIcon()}
                </button>
              </ui-tooltip-trigger>
              <ui-tooltip-content><p>Reset</p></ui-tooltip-content>
            </ui-tooltip>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'min-h-0 flex-1 p-0')}>
          <ui-message-scroller>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Group chat" class="p-(--card-spacing)">
                ${items.map((item) => (item.type === 'message' ? message(item) : marker(item)))}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex flex-col items-center gap-2 border-t')}>
          <button type="button" data-slot="button" data-variant="secondary" data-size="default" disabled class=${cn(buttonClass({ variant: 'secondary' }), 'w-full')}>
            Send Message as Rocky
          </button>
          <p class="text-xs text-muted-foreground">
            Now send Rocky's reply into the conversation
          </p>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-balance text-muted-foreground">
        When a user joins, a marker is created. scrollAnchor on the marker
        marks it as the next turn
      </div>
    </div>
  `;
}
