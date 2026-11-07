import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { ArrowUpIcon, RotateCwIcon } from '#lib/ui/lucide.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const messages: ChatMessage[] = [
  {
    id: 'anchor-1-user',
    role: 'user',
    text: 'Can you show me how anchoring behaves when a new prompt starts the turn?',
  },
  {
    id: 'anchor-1-assistant',
    role: 'assistant',
    text: 'Append the user prompt first, then append the assistant response. With User selected, the prompt settles near the top and the assistant response fills in below it.',
  },
  {
    id: 'anchor-2-user',
    role: 'user',
    text: 'What changes when assistant messages are the anchor?',
  },
  {
    id: 'anchor-2-assistant',
    role: 'assistant',
    text: 'Now each assistant response is the item `MessageScroller` keeps in view. This is useful when the reply is the moment you want readers to land on after each turn.',
  },
  {
    id: 'anchor-3-user',
    role: 'user',
    text: 'Can I switch roles and keep adding turns?',
  },
  {
    id: 'anchor-3-assistant',
    role: 'assistant',
    text: 'Yes. The next appended message with the selected role becomes the anchor, so you can compare user and assistant anchoring without resetting the demo.',
  },
];

// The role whose messages carry scroll-anchor.
const anchorRole = 'user';

const row = (m: ChatMessage) => {
  const user = m.role === 'user';
  return html`
    <ui-message-scroller-item message-id=${m.id} ?scroll-anchor=${m.role === anchorRole}>
      <div data-slot="message" data-align=${user ? 'end' : 'start'} class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant=${user ? 'muted' : 'ghost'} class=${bubbleClass({ variant: user ? 'muted' : 'ghost' })}>
            <div data-slot="bubble-content" class=${cn(bubbleContentClass(), 'space-y-2')}>
              <p class="whitespace-pre-wrap">${m.text}</p>
            </div>
          </div>
        </div>
      </div>
    </ui-message-scroller-item>
  `;
};

export default function MessageScrollerAnchoring() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Anchoring Turns</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Choose which role settles near the top edge.
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Reset anchored turns" disabled class=${buttonClass({ variant: 'outline', size: 'icon' })}>
              ${RotateCwIcon()}
            </button>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'min-h-0 flex-1 overflow-hidden p-0')}>
          <ui-message-scroller>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="p-(--card-spacing)">
                ${messages.map(row)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cardFooterClass()}>
          <ui-toggle-group type="single" value=${anchorRole} aria-label="Select scroll anchor role">
            <ui-toggle-group-item value="user" aria-label="Anchor user messages">User</ui-toggle-group-item>
            <ui-toggle-group-item value="assistant" aria-label="Anchor assistant messages">Assistant</ui-toggle-group-item>
          </ui-toggle-group>
          <button type="button" data-slot="button" data-variant="default" data-size="icon" disabled class=${cn(buttonClass({ size: 'icon' }), 'ml-auto')}>
            ${ArrowUpIcon()}
            <span class="sr-only">Send Message</span>
          </button>
        </div>
      </div>
      <div class="mx-auto max-w-xs px-0.5 text-center text-xs text-muted-foreground">
        Toggle the anchor role, then send messages to compare where turns
        settle.
      </div>
    </div>
  `;
}
