import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { repeat } from '@webjsdev/core/directives';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass, emptyDescriptionClass,
} from '#modules/ui/components/empty.ts';
import { inputGroupClass, inputGroupAddonClass, inputGroupButtonClass } from '#modules/ui/components/input-group.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/message-scroller.ts';
import '#modules/ui/components/tooltip.ts';
import {
  ArrowUpIcon, GlobeIcon, ImageIcon, MessageCircleDashedIcon, PaperclipIcon,
  PlusIcon, RotateCwIcon, TelescopeIcon,
} from '#lib/ui/lucide.ts';

/**
 * `<message-scroller-demo>` is shadcn's MessageScrollerDemo
 * (apps/v4/examples/radix/message-scroller-demo.tsx), the "New Chat" card on
 * the /ui home page.
 *
 * It opens on the empty state with the first question queued in the box.
 * Send adds that question, and after a pause the answer streams in a word
 * at a time, as shadcn's scripted chat transport does (a one second sleep,
 * then one word every 20ms). Reset goes back to the empty state. Nothing
 * leaves the page: the conversation is the script below.
 *
 * The whole card is the element because every part of it follows the
 * conversation: the body, the queued text, and both buttons' disabled state.
 * `think-ms` and `token-ms` set the two delays, which a test shortens.
 */

type Role = 'user' | 'assistant';
type ChatMessage = { id: string; role: Role; text: string };
type Status = 'ready' | 'submitted' | 'streaming';

// shadcn's script, word for word, except that the three em-dashes in it are
// written as a comma or a colon (the repo's prose rule bans the dash).
const SCRIPT: ReadonlyArray<{ user: string; assistant: string }> = [
  {
    user: "I'm building a chat for our app and the scroll behavior is driving me nuts. Every time the AI streams a reply, the whole thread jumps around.",
    assistant: "That's the classic streaming scroll problem. Wrap your message list in `MessageScroller` and turn on `autoScroll`: the viewport pins to the bottom as tokens arrive, so users always see the latest text land in place.\n\nThe important part: it only auto-scrolls while the reader is already at the bottom. The moment they scroll up to read something earlier, auto-scroll backs off and their position is preserved. You get smooth streaming without fighting the user's intent.",
  },
  {
    user: 'Okay, but when someone sends a new message the view still feels jarring, like the whole conversation reloads from the top.',
    assistant: "MessageScrollerItem fixes that with turn anchoring. Set `scrollAnchor` on the turn that should settle near the top instead of blindly snapping to the document bottom.\n\nIt also leaves a small peek of the previous exchange visible above the anchor, so context isn't lost. The reply starts in view without that disorienting jump you get from a plain overflow container.",
  },
  {
    user: "And if they've scrolled up to re-read an older answer? I don't want to yank them back down.",
    assistant: "You won't. Auto-scroll only runs when the viewport is already pinned to the bottom, so scrolling up is a deliberate opt-out: their place in the thread stays put even as new tokens keep arriving below.\n\nWhen there is content they haven't seen yet, `MessageScrollerButton` appears at the bottom of the viewport. One tap jumps them back to the newest message and re-engages auto-scroll. Same pattern as Slack or iMessage: quiet when you're caught up, helpful when you're not.",
  },
  {
    user: 'Last one: does this work with assistive tech?',
    assistant: '`MessageScrollerContent` sets `role="log"` and `aria-relevant="additions"` by default, so screen readers announce new messages as they stream in.\n\nThe scroll button is a real `<button>` with an sr-only label, and it\'s removed from the tab order when you\'re already at the bottom, no ghost focus stops.',
  },
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Word-plus-whitespace deltas, the split shadcn's transport streams. */
const deltas = (text: string): string[] => text.match(/\S+\s*/g) ?? [text];

export class MessageScrollerDemo extends WebComponent({
  thinkMs: prop(Number, { attribute: 'think-ms' }),
  tokenMs: prop(Number, { attribute: 'token-ms' }),
}) {
  readonly #messages = signal<ChatMessage[]>([]);
  readonly #status = signal<Status>('ready');
  // Bumped by a reset, so a reply still streaming stops writing.
  _run = 0;
  // The user turns that have already played their entrance.
  _entered = new Set<string>();

  constructor() {
    super();
    this.thinkMs = 1000;
    this.tokenMs = 20;
  }

  /** The next question in the script, or null once all have been asked. */
  next(): string | null {
    const asked = this.#messages.get().filter((m) => m.role === 'user').length;
    return SCRIPT[asked]?.user ?? null;
  }

  busy(): boolean {
    return this.#status.get() !== 'ready';
  }

  async send(): Promise<void> {
    const question = this.next();
    if (!question || this.busy()) return;
    const run = this._run;
    const turn = this.#messages.get().filter((m) => m.role === 'user').length;
    this.#messages.set([...this.#messages.get(), { id: `u${turn}`, role: 'user', text: question }]);
    this.#status.set('submitted');
    await wait(this.thinkMs);
    if (run !== this._run) return;
    const id = `a${turn}`;
    this.#messages.set([...this.#messages.get(), { id, role: 'assistant', text: '' }]);
    this.#status.set('streaming');
    for (const delta of deltas(SCRIPT[turn].assistant)) {
      await wait(this.tokenMs);
      if (run !== this._run) return;
      this.#messages.set(this.#messages.get().map((m) => (m.id === id ? { ...m, text: m.text + delta } : m)));
    }
    this.#status.set('ready');
  }

  reset(): void {
    this._run++;
    this._entered.clear();
    this.#messages.set([]);
    this.#status.set('ready');
  }

  // shadcn's MessageAnimated slides a user turn up as it arrives with motion's
  // "slide-up" preset (opacity 0 and 10px down, 260ms, ease [0.16, 1, 0.3, 1])
  // and shows an assistant turn in place. motion animates from script, once,
  // on mount, so this does too: a CSS animation would restart each time the
  // transcript's slot re-inserts the item.
  updated(changed: Map<string, unknown>): void {
    super.updated?.(changed);
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const m of this.#messages.get()) {
      if (m.role !== 'user' || this._entered.has(m.id)) continue;
      this._entered.add(m.id);
      if (still) continue;
      // The transcript's slot places a new item once it has rendered, so the
      // item is looked up a frame later.
      requestAnimationFrame(() => {
        const item = this.querySelector<HTMLElement>(`ui-message-scroller-item[message-id="${m.id}"]`);
        item?.animate?.(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
      });
    }
  }

  _onSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    void this.send();
  };

  _message(m: ChatMessage) {
    const user = m.role === 'user';
    const paragraphs = m.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return html`<ui-message-scroller-item message-id=${m.id} ?scroll-anchor=${user}>
      <div data-slot="message" data-align=${user ? 'end' : 'start'} class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant=${user ? 'muted' : 'ghost'} class=${bubbleClass({ variant: user ? 'muted' : 'ghost' })}>
            <div data-slot="bubble-content" class=${cn(bubbleContentClass(), 'space-y-2')}>
              ${paragraphs.map((p) => html`<p class="whitespace-pre-wrap">${p}</p>`)}
            </div>
          </div>
        </div>
      </div>
    </ui-message-scroller-item>`;
  }

  _body() {
    if (this.#messages.get().length === 0) {
      return html`<div data-slot="empty" class=${cn(emptyClass(), 'h-full')}>
        <div data-slot="empty-header" class=${emptyHeaderClass()}>
          <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>${MessageCircleDashedIcon()}</div>
          <div data-slot="empty-title" class=${emptyTitleClass()}>Morning, webjs!</div>
          <div data-slot="empty-description" class=${emptyDescriptionClass()}>What are we working on today? Press send to start a new conversation</div>
        </div>
      </div>`;
    }
    return html`<ui-message-scroller>
      <ui-message-scroller-viewport>
        <ui-message-scroller-content aria-label="Conversation" aria-busy=${this.busy() ? 'true' : 'false'} class="p-(--card-spacing)">
          ${repeat(this.#messages.get(), (m) => m.id, (m) => this._message(m))}
        </ui-message-scroller-content>
      </ui-message-scroller-viewport>
      <ui-message-scroller-button></ui-message-scroller-button>
    </ui-message-scroller>`;
  }

  render() {
    const next = this.next();
    const busy = this.busy();
    const addId = `${this.getAttribute?.('id') || 'message-scroller-demo'}-add`;
    return html`<div class="relative flex flex-col gap-4">
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto h-140 w-full max-w-sm gap-0')}>
        <div data-slot="card-header" class=${cn(cardHeaderClass(), 'gap-1 border-b')}>
          <div data-slot="card-title" class=${cardTitleClass()}>New Chat</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>How can I help you today?</div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="tooltip-trigger" data-variant="outline" data-size="icon" aria-label="Reset conversation" ?disabled=${busy} class=${buttonClass({ variant: 'outline', size: 'icon' })} @click=${() => this.reset()}>${RotateCwIcon()}</button>
              </ui-tooltip-trigger>
              <ui-tooltip-content><p>Reset</p></ui-tooltip-content>
            </ui-tooltip>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 overflow-hidden p-0')}>${this._body()}</div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
          <form class="w-full" @submit=${this._onSubmit}>
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <div class="h-14 w-full px-3 py-2.5">
                <span class="line-clamp-2 opacity-60 data-[status=ready]:opacity-100" data-status=${this.#status.get()}>${next ?? html`<span class="text-muted-foreground">No messages queued. Reset the conversation.</span>`}</span>
              </div>
              <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'pt-1')}>
                <button type="button" id=${addId} data-slot="dropdown-menu-trigger" data-variant="outline" data-size="icon-sm" aria-label="Add files" class=${inputGroupButtonClass({ size: 'icon-sm', variant: 'outline' })}>${PlusIcon()}</button>
                <button type="submit" data-slot="button" data-variant="default" data-size="icon-sm" ?disabled=${!next || busy} class=${cn(inputGroupButtonClass({ size: 'icon-sm', variant: 'default' }), 'ml-auto')}>${ArrowUpIcon()}<span class="sr-only">Send</span></button>
              </div>
            </div>
            <ui-dropdown-menu trigger=${addId} class="absolute">
              <ui-dropdown-menu-content align="start" side="top" class="w-44">
                <ui-dropdown-menu-item>${PaperclipIcon()}Add Photos &amp; Files</ui-dropdown-menu-item>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-item>${ImageIcon()}Create Image</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${TelescopeIcon()}Deep Research</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${GlobeIcon()}Web Search</ui-dropdown-menu-item>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
          </form>
        </div>
      </div>
      <div class="px-0.5 text-center text-xs text-muted-foreground">Demo is read only. Press send to send messages.</div>
    </div>`;
  }
}
MessageScrollerDemo.register('message-scroller-demo');
