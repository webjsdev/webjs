/**
 * The preview-03 chat card: the frame every chat card shares, shadcn's
 * Example wrapper (a caption over the card), a card with a title, a
 * description and a start-over button, the transcript in the kit's
 * `<ui-message-scroller>`, and the prompt input in the footer, all inside
 * `<preview-03-chat>`, which plays the scripted turns. Plus the two helpers
 * a card builds its transcript from. Fragment helpers, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/chat-card.ts`. Ported from shadcn/ui's preview-03,
 * where each card repeats this frame inline.
 */
import { html, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { markerClass, markerContentClass, markerIconClass } from '../../../components/marker.ts';
import { messageClass, messageContentClass } from '../../../components/message.ts';
import { spinner } from '../../../components/spinner.ts';
import '../../../components/message-scroller.ts';
import { promptInput } from './prompt-input.ts';
import './chat-player.ts';
import { PlusIcon } from '../../../lib/icons.ts';

export interface ChatPrompt {
  text: string;
  sender?: string;
}

/**
 * One scripted item of a transcript, hidden until `<preview-03-chat>` plays
 * its turn. `delay` is milliseconds after the turn starts (for a reply, how
 * long the "Thinking..." marker shows first).
 */
export function chatItem(opts: {
  turn: number;
  kind: 'user' | 'reply' | 'event' | 'typing';
  content: unknown;
  id?: string;
  delay?: number;
  name?: string;
  anchor?: boolean;
}) {
  return html`<ui-message-scroller-item
    hidden
    message-id=${opts.id ?? nothing}
    ?scroll-anchor=${!!opts.anchor}
    data-chat-turn=${opts.turn}
    data-chat-kind=${opts.kind}
    data-chat-delay=${opts.delay ?? nothing}
    data-chat-name=${opts.name ?? nothing}
  >${opts.content}</ui-message-scroller-item>`;
}

/** A message, shadcn's Message and MessageContent. */
export function chatMessage(opts: { role: 'user' | 'assistant'; align: 'start' | 'end'; header?: unknown; contentClass?: string; content: unknown }) {
  return html`<div data-slot="message" data-align=${opts.align} data-role=${opts.role} class=${messageClass()}>
    ${opts.header ?? ''}
    <div data-slot="message-content" class=${cn(messageContentClass(), opts.contentClass)}>${opts.content}</div>
  </div>`;
}

/** A marker in the transcript, a join or leave notice or a typing line. */
export function chatMarker(opts: { text: string; variant?: 'default' | 'separator'; status?: boolean; icon?: unknown }) {
  const variant = opts.variant ?? 'default';
  return html`<div data-slot="marker" data-variant=${variant} role=${opts.status ? 'status' : nothing} class=${markerClass({ variant })}>
    ${opts.icon ? html`<span data-slot="marker-icon" class=${markerIconClass()}>${opts.icon}</span>` : ''}
    <span data-slot="marker-content" class=${markerContentClass()}>${opts.text}</span>
  </div>`;
}

export function chatCard(opts: {
  /** Unique on the page: the textarea's id and the menu button's derive from it. */
  id: string;
  caption: string;
  title: string;
  description: string;
  descriptionClass?: string;
  prompts: ChatPrompt[];
  transcript: unknown;
  /** Shown above the prompt input (the group chat's "Posting as" line). */
  footerTop?: unknown;
  footerClass?: string;
}) {
  return html`<preview-03-chat data-prompts=${JSON.stringify(opts.prompts)} class="flex min-h-0 flex-1 flex-col">
    <div data-slot="example" class="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col gap-1 self-stretch lg:max-w-none">
      <div class="px-1.5 py-2 text-xs font-medium text-muted-foreground">${opts.caption}</div>
      <div data-slot="example-content" class="flex min-w-0 flex-1 flex-col items-start gap-6 rounded-xl bg-transparent p-0 text-foreground style-lyra:rounded-none style-sera:rounded-none *:[div:not([class*='w-'])]:w-full">
        <div data-slot="card" data-size="default" class=${cn(cardClass(), 'max-h-140 min-h-0 flex-1')}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-title" class=${cardTitleClass()}>${opts.title}</div>
            <div data-slot="card-description" class=${cn(cardDescriptionClass(), opts.descriptionClass)}>${opts.description}</div>
            <div data-slot="card-action" class=${cardActionClass()}>
              <button type="button" data-chat-reset data-slot="button" data-variant="outline" data-size="icon" aria-label="Start over" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${PlusIcon()}</button>
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
            <ui-message-scroller>
              <ui-message-scroller-viewport>
                <ui-message-scroller-content aria-label=${`${opts.title} conversation`} class="p-[var(--card-spacing,1.5rem)]">
                  ${opts.transcript}
                  <ui-message-scroller-item hidden data-chat-thinking>
                    ${chatMarker({ text: 'Thinking...', status: true, icon: spinner({ decorative: true }) })}
                  </ui-message-scroller-item>
                </ui-message-scroller-content>
              </ui-message-scroller-viewport>
              <ui-message-scroller-button></ui-message-scroller-button>
            </ui-message-scroller>
          </div>
          <div data-slot="card-footer" class=${cn(cardFooterClass(), opts.footerClass)}>
            ${opts.footerTop ?? ''}
            ${promptInput({ id: opts.id, value: opts.prompts[0]?.text })}
          </div>
        </div>
      </div>
    </div>
  </preview-03-chat>`;
}
