import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const messages: ChatMessage[] = [
  {
    id: 'command-activation',
    role: 'user',
    text: "We're seeing activation dip after workspace creation. Can you help me find the likely step?",
  },
  {
    id: 'command-activation-reply',
    role: 'assistant',
    text: 'The sharpest drop is between creating the workspace and inviting the first teammate.\n\nWorkspace creation is still healthy, but the invite step is where users pause. That suggests the product is asking for collaboration before the user has enough confidence in the workspace.',
  },
  {
    id: 'command-compare',
    role: 'user',
    text: 'What should I compare before we change the onboarding flow?',
  },
  {
    id: 'command-compare-reply',
    role: 'assistant',
    text: 'Compare three cohorts:\n\n1. Users who choose a template before inviting teammates.\n2. Users who start from a blank workspace.\n3. Users who skip invites and return within 24 hours.\n\nIf template users invite faster, the fix is probably better first-run guidance rather than a louder invite prompt.',
  },
  {
    id: 'command-experiment',
    role: 'user',
    text: 'Can you turn that into an experiment?',
  },
  {
    id: 'command-experiment-reply',
    role: 'assistant',
    text: 'Yes. Create a variant that shows a short checklist after workspace creation:\n\n- Pick a template.\n- Add one project detail.\n- Invite a teammate when the workspace has context.\n\nMeasure first invite completion, 24-hour return rate, and whether teams create a second project.',
  },
  {
    id: 'command-risk',
    role: 'user',
    text: "What's the risk if we delay the invite prompt?",
  },
  {
    id: 'command-risk-reply',
    role: 'assistant',
    text: 'The main risk is reducing team creation for accounts that already know who they want to invite.\n\nTo protect that path, keep the invite action visible in the header and only change the primary empty-state guidance. That gives confident teams a direct route without forcing uncertain users through the invite step too early.',
  },
];

const userMessages = messages.filter((m) => m.role === 'user');

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

// Each menu item names the message it jumps to. The jump itself is a call
// to the scroller: scroller.scrollToMessage(id, { align: 'start' }).
export default function MessageScrollerCommands() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Commands</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Drive the transcript from outside.
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-dropdown-menu>
              <ui-dropdown-menu-trigger>
                <button type="button" data-slot="button" data-variant="secondary" data-size="default" class=${buttonClass({ variant: 'secondary' })}>Jump to...</button>
              </ui-dropdown-menu-trigger>
              <ui-dropdown-menu-content align="end" side="bottom" class="w-64">
                <ui-dropdown-menu-label>Conversations</ui-dropdown-menu-label>
                ${userMessages.map((m) => html`
                  <ui-dropdown-menu-item data-message-id=${m.id}>
                    <span class="line-clamp-1 min-w-0">${trimmed(m.text)}</span>
                  </ui-dropdown-menu-item>
                `)}
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
          <ui-message-scroller default-scroll-position="end">
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="p-(--card-spacing)">
                ${messages.map(row)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-balance text-muted-foreground">
        Use the controls to jump to any message in the conversation.
      </div>
    </div>
  `;
}
