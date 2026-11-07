/**
 * `<preview-03-chat>` plays a scripted conversation in a preview-03 card,
 * the part shadcn's demo gets from the AI SDK's useChat and a scripted
 * transport.
 *
 * The server renders the whole script up front, every message and event
 * `hidden` and tagged with its turn: `data-chat-turn="<n>"` and
 * `data-chat-kind` (`user`, `reply`, `event` or `typing`), plus
 * `data-chat-delay` (milliseconds after the turn starts) and, on a typing
 * notice, `data-chat-name`. The card opens empty with the first prompt in the
 * box, as shadcn's does. Send shows that turn's messages: a user message at
 * once, then each event after its delay, then, for a turn with a reply, the
 * "Thinking..." marker (`data-chat-thinking`) for the reply's delay before
 * the reply itself. The box then holds the next prompt. The start-over button
 * (`data-chat-reset`) hides everything again. The prompts, and who posts each
 * one, are the host's `data-prompts` JSON.
 *
 * With JavaScript off the card shows its first state, an empty conversation
 * and the queued prompt. Replace this element with your own once the card is
 * wired to a real chat endpoint.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/chat-player.ts`. Written for the WebJs port of
 * shadcn/ui's preview-03.
 */
import { WebComponent, html } from '@webjsdev/core';

interface Prompt {
  text: string;
  /** Who posts it, shown as "Posting as ..." in a group chat. */
  sender?: string;
}

type Scroller = HTMLElement & { scrollToEnd?: () => void };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Preview03Chat extends WebComponent {
  _turn = 0;
  _run = 0;
  _busy = false;
  _step = 0;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('submit', this._onSubmit);
    this.addEventListener('input', this._onInput);
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('submit', this._onSubmit);
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('click', this._onClick);
    this._run++;
    super.disconnectedCallback();
  }

  _prompts(): Prompt[] {
    try {
      const parsed: unknown = JSON.parse(this.getAttribute('data-prompts') ?? '[]');
      return Array.isArray(parsed) ? (parsed as Prompt[]) : [];
    } catch {
      return [];
    }
  }

  _items(turn: number, kind?: string): HTMLElement[] {
    const kinds = kind ? `[data-chat-kind="${kind}"]` : '';
    return Array.from(this.querySelectorAll<HTMLElement>(`[data-chat-turn="${turn}"]${kinds}`));
  }

  _show(el: Element | null, shown: boolean): void {
    if (!el) return;
    if (shown) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  _scrollToEnd(): void {
    const scroller = this.querySelector<Scroller>('ui-message-scroller');
    requestAnimationFrame(() => scroller?.scrollToEnd?.());
  }

  /** The box, the send button and the sender line, for the turn now queued. */
  _queue(): void {
    const prompt = this._prompts()[this._turn];
    const input = this.querySelector<HTMLTextAreaElement>('[data-chat-input]');
    if (input) input.value = this._busy ? '' : (prompt?.text ?? '');
    const sender = this.querySelector('[data-chat-sender]');
    if (sender) sender.textContent = prompt?.sender ?? 'You';
    this._sync();
  }

  _sync(): void {
    const input = this.querySelector<HTMLTextAreaElement>('[data-chat-input]');
    const send = this.querySelector<HTMLButtonElement>('[data-chat-send]');
    if (send) send.disabled = this._busy || !input?.value.trim();
  }

  async _play(): Promise<void> {
    const turn = this._turn;
    const prompt = this._prompts()[turn];
    if (!prompt || this._busy) return;
    const run = this._run;
    // A turn's notices still pending stop once the next turn is sent, as in
    // shadcn's (a typing notice must not land after that person has posted).
    const step = ++this._step;
    // A sender's own typing notice goes once their message lands.
    if (prompt.sender) {
      for (const el of this.querySelectorAll(`[data-chat-kind="typing"][data-chat-name="${prompt.sender}"]`)) this._show(el, false);
    }
    for (const el of this._items(turn, 'user')) this._show(el, true);
    this._turn++;
    this._busy = true;
    this._queue();
    this._scrollToEnd();

    let elapsed = 0;
    const later = [...this._items(turn, 'event'), ...this._items(turn, 'typing')]
      .sort((a, b) => Number(a.dataset.chatDelay ?? 0) - Number(b.dataset.chatDelay ?? 0));
    const replies = this._items(turn, 'reply');
    // The events run on their own clock, so a reply is not held up by them.
    const events = (async () => {
      for (const el of later) {
        const delay = Number(el.dataset.chatDelay ?? 0);
        await wait(Math.max(0, delay - elapsed));
        elapsed = delay;
        if (run !== this._run || step !== this._step) return;
        this._show(el, true);
        this._scrollToEnd();
      }
    })();

    if (replies.length) {
      const thinking = this.querySelector('[data-chat-thinking]');
      this._show(thinking, true);
      this._scrollToEnd();
      await wait(Number(replies[0].dataset.chatDelay ?? 1000));
      if (run !== this._run) return;
      this._show(thinking, false);
      for (const el of replies) this._show(el, true);
      this._scrollToEnd();
    }
    this._busy = false;
    this._queue();
    await events;
  }

  _reset(): void {
    this._run++;
    this._turn = 0;
    this._busy = false;
    for (const el of this.querySelectorAll('[data-chat-turn], [data-chat-thinking]')) this._show(el, false);
    this._queue();
  }

  _onSubmit = (e: Event): void => {
    e.preventDefault();
    void this._play();
  };

  _onInput = (e: Event): void => {
    if ((e.target as Element).matches?.('[data-chat-input]')) this._sync();
  };

  _onClick = (e: Event): void => {
    if ((e.target as Element).closest?.('[data-chat-reset]')) this._reset();
  };

  render() {
    return html`<slot></slot>`;
  }
}
Preview03Chat.register('preview-03-chat');
