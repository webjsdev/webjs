import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  ArrowUpIcon, BrainIcon, GlobeIcon, ImageIcon, PaperclipIcon, PlusIcon,
  RotateCwIcon, TelescopeIcon,
} from '#lib/ui/lucide.ts';

type Part = { type: 'reasoning' | 'text'; paragraphs: unknown[] };
type ChatMessage = { id: string; role: 'user' | 'assistant'; parts: Part[] };

const code = (text: string) => html`<code class="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]">${text}</code>`;
const text = (...paragraphs: unknown[]): Part => ({ type: 'text', paragraphs });

// shadcn's scripted conversation, once every turn has been sent. In a real
// chat these messages are what a streaming 'use server' action yielded (see
// the AI SDK helper page). The replies name the scroller's API, which on this
// site is the kit's element and attributes.
const messages: ChatMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    parts: [text("I'm building a chat for our app and the scroll behavior is driving me nuts. Every time the AI streams a reply, the whole thread jumps around.")],
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    parts: [
      { type: 'reasoning', paragraphs: ['They are describing a streaming transcript that keeps taking control of the viewport. I should explain when auto-scroll follows and when it stops.'] },
      text(
        html`That's the classic streaming scroll problem. Wrap your message list in ${code('ui-message-scroller')} and turn on ${code('auto-scroll')}. The viewport pins to the bottom as tokens arrive, so users always see the latest text land in place.`,
        "The important part: it only auto-scrolls while the reader is already at the bottom. The moment they scroll up to read something earlier, auto-scroll backs off and their position is preserved. You get smooth streaming without fighting the user's intent.",
      ),
    ],
  },
  {
    id: 'user-2',
    role: 'user',
    parts: [text('Okay, but when someone sends a new message the view still feels jarring, like the whole conversation reloads from the top.')],
  },
  {
    id: 'assistant-2',
    role: 'assistant',
    parts: [text(
      html`${code('ui-message-scroller-item')} fixes that with turn anchoring. Set ${code('scroll-anchor')} on the turn that should settle near the top instead of blindly snapping to the document bottom.`,
      "It also leaves a small peek of the previous exchange visible above the anchor, so context isn't lost. The reply starts in view without that disorienting jump you get from a plain overflow container.",
    )],
  },
  {
    id: 'user-3',
    role: 'user',
    parts: [text("And if they've scrolled up to re-read an older answer? I don't want to yank them back down.")],
  },
  {
    id: 'assistant-3',
    role: 'assistant',
    parts: [text(
      "You won't. Auto-scroll only runs when the viewport is already pinned to the bottom, so scrolling up is a deliberate opt-out. Their place in the thread stays put even as new tokens keep arriving below.",
      html`When there is content they haven't seen yet, ${code('ui-message-scroller-button')} appears at the bottom of the viewport. One tap jumps them back to the newest message and re-engages auto-scroll. Same pattern as Slack or iMessage: quiet when you're caught up, helpful when you're not.`,
    )],
  },
  {
    id: 'user-4',
    role: 'user',
    parts: [text('Last one: does this work with assistive tech?')],
  },
  {
    id: 'assistant-4',
    role: 'assistant',
    parts: [text(
      html`${code('ui-message-scroller-content')} sets ${code('role="log"')} and ${code('aria-relevant="additions"')} by default, so screen readers announce new messages as they stream in.`,
      html`The scroll button is a real ${code('<button>')} with an sr-only label, and it's removed from the tab order when you're already at the bottom, so there are no ghost focus stops.`,
    )],
  },
];

function part(p: Part, user: boolean) {
  if (p.type === 'reasoning') {
    return html`
      <div class="w-full border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
        <div class="mb-1 flex items-center gap-1.5 text-xs font-medium">${BrainIcon('size-3.5')}Reasoning</div>
        <div class="space-y-1.5 text-sm">${p.paragraphs.map((t) => html`<p class="whitespace-pre-wrap">${t}</p>`)}</div>
      </div>`;
  }
  const variant = user ? 'muted' : 'ghost';
  return html`
    <div data-slot="bubble" data-variant=${variant} class=${bubbleClass({ variant })}>
      <div data-slot="bubble-content" class=${cn(bubbleContentClass(), 'space-y-2')}>
        ${p.paragraphs.map((t) => html`<p class="whitespace-pre-wrap">${t}</p>`)}
      </div>
    </div>`;
}

const row = (m: ChatMessage) => {
  const user = m.role === 'user';
  return html`
    <ui-message-scroller-item message-id=${m.id} ?scroll-anchor=${user}>
      <div data-slot="message" data-align=${user ? 'end' : 'start'} class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          ${m.parts.map((p) => part(p, user))}
        </div>
      </div>
    </ui-message-scroller-item>`;
};

// Sending and Reset are the reader's to wire: the AI SDK helper page streams
// each reply from a 'use server' action into a component like this one.
export default function AiSdkHelperDemo() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>New Chat</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>How can I help you today?</div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Reset conversation" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${RotateCwIcon()}</button>
              </ui-tooltip-trigger>
              <ui-tooltip-content><p>Reset</p></ui-tooltip-content>
            </ui-tooltip>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>
          <ui-message-scroller>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="p-(--card-spacing)">
                ${messages.map(row)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
          <form class="w-full">
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <textarea data-slot="input-group-control" aria-label="Next predefined message" data-status="ready" placeholder="No messages queued. Reset the conversation." readonly class=${cn(inputGroupTextareaClass(), 'h-14 min-h-14 overflow-hidden px-3 py-2.5 opacity-60 data-[status=ready]:opacity-100')}></textarea>
              <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'pt-1')}>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" aria-label="Add files" data-slot="button" data-variant="outline" data-size="icon-sm" class=${inputGroupButtonClass({ variant: 'outline', size: 'icon-sm' })}>${PlusIcon()}</button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content align="start" side="top" class="w-44">
                    <ui-dropdown-menu-item>${PaperclipIcon()}Add Photos &amp; Files</ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item>${ImageIcon()}Create Image</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${TelescopeIcon()}Deep Research</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${GlobeIcon()}Web Search</ui-dropdown-menu-item>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
                <button type="submit" disabled data-slot="button" data-variant="default" data-size="icon-sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-sm' }), 'ml-auto')}>
                  ${ArrowUpIcon()}<span class="sr-only">Send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="px-0.5 text-center text-xs text-muted-foreground">
        Demo is read only. Press send to send messages.
      </div>
    </div>
  `;
}
