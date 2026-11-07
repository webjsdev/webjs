import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { ArrowUpIcon, RotateCwIcon } from '#lib/ui/lucide.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const messages: ChatMessage[] = [
  {
    id: 'animation-1',
    role: 'user',
    text: 'Can user messages pop in like iMessage without breaking anchoring?',
  },
  {
    id: 'animation-2',
    role: 'assistant',
    text: 'Yes. Animate the user row with transform and opacity, and let the assistant response stream normally below it.\n\nThat keeps the row measurement predictable while still giving the newly sent bubble a more tactile entrance.',
  },
  {
    id: 'animation-3',
    role: 'user',
    text: 'What makes the animation feel more like iMessage?',
  },
  {
    id: 'animation-4',
    role: 'assistant',
    text: 'Use a quick spring from the trailing edge: a little scale, a small upward move, and no layout animation.\n\nThe bubble feels tactile, but the measured row stays predictable, so anchoring and auto-scroll do not have to fight a changing layout.',
  },
  {
    id: 'animation-5',
    role: 'user',
    text: 'Can I switch between presets while testing the same thread?',
  },
  {
    id: 'animation-6',
    role: 'assistant',
    text: 'Yes. Keep the conversation in place while you change the preset, then send the next message to compare the new entrance against the same context.\n\nThat makes it easier to judge the difference between a subtle fade, a snappy pop, and a more dramatic 3D tilt without rebuilding the scenario each time.',
  },
];

// shadcn's entrance presets, by name.
const presets = [
  { id: 'fade', name: 'Fade' },
  { id: 'slide-up', name: 'Slide Up' },
  { id: 'slide-side', name: 'Slide Side' },
  { id: 'pop', name: 'Pop' },
  { id: 'spring-bounce', name: 'Spring Bounce' },
  { id: 'blur-fade', name: 'Blur Fade' },
  { id: 'scale-fade', name: 'Scale Fade' },
];

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

export default function MessageScrollerAnimation() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Animation</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            Choose how user messages are animated when they are added to the
            conversation.
          </div>
          <div data-slot="card-action" class=${cn(cardActionClass(), 'flex items-center gap-2')}>
            <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Reset animated messages" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
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
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'border-t')}>
          <ui-select position="popper">
            <select aria-label="Animation preset" class=${selectTriggerClass()}>
              ${presets.map((p) => html`<option value=${p.id} ?selected=${p.id === 'fade'}>${p.name}</option>`)}
            </select>
          </ui-select>
          <button type="button" data-slot="button" data-variant="default" data-size="icon" disabled class=${cn(buttonClass({ size: 'icon' }), 'ml-auto')}>
            ${ArrowUpIcon()}
            <span class="sr-only">Send Message</span>
          </button>
        </div>
      </div>
      <div class="mx-auto max-w-sm px-0.5 text-center text-xs text-balance text-muted-foreground">
        Select an animation then click send to see it in action.
      </div>
    </div>
  `;
}
