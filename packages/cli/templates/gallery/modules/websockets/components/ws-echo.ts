// A WebSocket echo client. connectWS() (from '@webjsdev/core') opens the socket,
// auto-reconnects with backoff, JSON-encodes/decodes, and queues sends while
// disconnected. The connection is opened in connectedCallback (browser-only, so
// it never runs during SSR) and closed in disconnectedCallback. At SSR the
// component renders its disconnected state, so with JS off the page still reads
// (a live socket has no no-JS equivalent, which is the honest fallback here).
import { WebComponent, signal, html, connectWS } from '@webjsdev/core';

export class WsEcho extends WebComponent {
  private connected = signal(false);
  private lines = signal<string[]>([]);
  #conn: ReturnType<typeof connectWS> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.#conn = connectWS('/features/websockets/echo', {
      onOpen: () => this.connected.set(true),
      onClose: () => this.connected.set(false),
      onMessage: (msg: unknown) => this.lines.set([...this.lines.get(), String(msg)]),
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#conn?.close();
    this.#conn = null;
  }

  private send(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('msg') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    this.#conn?.send(text);
    input.value = '';
  }

  render() {
    const on = this.connected.get();
    return html`
      <div class="grid gap-4 max-w-[420px]">
        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full ${on ? 'bg-primary' : 'bg-muted-foreground/40'}"></span>
          <span class="text-muted-foreground">${on ? 'connected' : 'connecting (live echo needs JavaScript)'}</span>
        </div>
        <form @submit=${(e: SubmitEvent) => this.send(e)} class="flex gap-2">
          <input name="msg" autocomplete="off" placeholder="Say something"
            class="flex-1 px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm outline-none focus:border-border-strong" />
          <button type="submit"
            class="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Send</button>
        </form>
        <ul class="grid gap-1.5 list-none m-0 p-0">
          ${this.lines.get().map((line) => html`
            <li class="px-3 py-2 rounded-xl bg-card border border-border text-[15px] text-foreground font-mono">${line}</li>
          `)}
        </ul>
      </div>
    `;
  }
}
WsEcho.register('ws-echo');
