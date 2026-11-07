import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { inputGroupClass, inputGroupAddonClass, inputGroupButtonClass } from '#modules/ui/components/input-group.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';
import {
  ArrowUpIcon, GlobeIcon, ImageIcon, PaperclipIcon, PlusIcon, RotateCwIcon, TelescopeIcon,
} from '#lib/ui/lucide.ts';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

// The whole script, every turn sent. The kit keeps 64px of the previous
// turn above a new anchored one.
const messages: ChatMessage[] = [
  {
    id: 'context-1',
    role: 'user',
    text: "I'm building a chat for our app and the scroll behavior is driving me nuts. Every time the AI streams a reply, the whole thread jumps around.",
  },
  {
    id: 'context-2',
    role: 'assistant',
    text: "That's the classic streaming scroll problem. Wrap your message list in `MessageScroller` and turn on `autoScroll`: the viewport pins to the bottom as tokens arrive, so users always see the latest text land in place.\n\nThe important part: it only auto-scrolls while the reader is already at the bottom. The moment they scroll up to read something earlier, auto-scroll backs off and their position is preserved. You get smooth streaming without fighting the user's intent.",
  },
  {
    id: 'context-3',
    role: 'user',
    text: 'Okay, but when someone sends a new message the view still feels jarring, like the whole conversation reloads from the top.',
  },
  {
    id: 'context-4',
    role: 'assistant',
    text: "MessageScrollerItem fixes that with turn anchoring. Set `scrollAnchor` on the turn that should settle near the top instead of blindly snapping to the document bottom.\n\nIt also leaves a small peek of the previous exchange visible above the anchor, so context isn't lost. The reply starts in view without that disorienting jump you get from a plain overflow container.",
  },
  {
    id: 'context-5',
    role: 'user',
    text: "And if they've scrolled up to re-read an older answer? I don't want to yank them back down.",
  },
  {
    id: 'context-6',
    role: 'assistant',
    text: "You won't. Auto-scroll only runs when the viewport is already pinned to the bottom, so scrolling up is a deliberate opt-out: their place in the thread stays put even as new tokens keep arriving below.\n\nWhen there is content they haven't seen yet, `MessageScrollerButton` appears at the bottom of the viewport. One tap jumps them back to the newest message and re-engages auto-scroll. Same pattern as Slack or iMessage: quiet when you're caught up, helpful when you're not.",
  },
  {
    id: 'context-7',
    role: 'user',
    text: 'Last one: does this work with assistive tech?',
  },
  {
    id: 'context-8',
    role: 'assistant',
    text: '`MessageScrollerContent` sets `role="log"` and `aria-relevant="additions"` by default, so screen readers announce new messages as they stream in.\n\nThe scroll button is a real `<button>` with an sr-only label, and it\'s removed from the tab order when you\'re already at the bottom, no ghost focus stops.',
  },
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

export default function MessageScrollerPreviousContext() {
  return html`
    <div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>Keeping Context Visible</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            New turns keep part of the previous reply in view.
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="tooltip-trigger" data-variant="outline" data-size="icon" aria-label="Reset context example" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
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
              <div class="h-14 w-full px-3 py-2.5">
                <span class="line-clamp-2 opacity-60 data-[status=ready]:opacity-100" data-status="ready">
                  <span class="text-muted-foreground">No messages queued. Reset the context.</span>
                </span>
              </div>
              <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'pt-1')}>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" data-slot="input-group-button" data-variant="outline" data-size="icon-sm" aria-label="Add files" class=${inputGroupButtonClass({ size: 'icon-sm', variant: 'outline' })}>${PlusIcon()}</button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content align="start" side="top" class="w-44">
                    <ui-dropdown-menu-item>${PaperclipIcon()}Add Photos &amp; Files</ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item>${ImageIcon()}Create Image</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${TelescopeIcon()}Deep Research</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${GlobeIcon()}Web Search</ui-dropdown-menu-item>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
                <div class="flex w-28 items-center gap-2">
                  <span class="text-xs text-muted-foreground tabular-nums">64px</span>
                  <ui-slider class="w-full">
                    <input type="range" min="64" max="128" step="1" value="64" disabled aria-label="Previous context peek" class=${sliderClass()}>
                  </ui-slider>
                </div>
                <button type="submit" data-slot="input-group-button" data-variant="default" data-size="icon-sm" disabled class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'default' }), 'ml-auto')}>
                  ${ArrowUpIcon()}<span class="sr-only">Send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="px-0.5 text-center text-xs text-muted-foreground">
        Adjust the slider and send. Observe the previous message peak
      </div>
    </div>
  `;
}
