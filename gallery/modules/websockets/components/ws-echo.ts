// connectWS() opens the socket, reconnects with backoff, JSON-encodes and
// queues sends while disconnected. Open it in connectedCallback (browser-only,
// never during SSR) and close it in disconnectedCallback; SSR renders the
// disconnected state.
import { WebComponent, signal, html, connectWS, renderStream } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { inputClass } from '#components/ui/input.ts';

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

  #streamN = 0;
  // renderStream() applies a <webjs-stream> payload with native DOM methods,
  // the same element-level applier an onMessage handler or a broadcast() push
  // uses for live updates. A button drives it here; a server would send the
  // HTML string over the channel.
  private applyStreamUpdate() {
    this.#streamN += 1;
    renderStream(
      `<webjs-stream action="append" target="ws-stream-log"><template><li class="px-3 py-2 rounded-xl bg-card border border-border text-[15px] text-foreground">streamed row #${this.#streamN}</li></template></webjs-stream>`,
    );
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
            class=${inputClass('flex-1 min-w-0')} />
          <button type="submit"
            class=${buttonClass({ size: 'sm' })}>Send</button>
        </form>
        <ul class="grid gap-1.5 list-none m-0 p-0">
          ${this.lines.get().map((line) => html`
            <li class="px-3 py-2 rounded-xl bg-card border border-border text-[15px] text-foreground font-mono">${line}</li>
          `)}
        </ul>
        <div class="grid gap-2 border-t border-border pt-4">
          <button @click=${() => this.applyStreamUpdate()}
            class="${buttonClass({ variant: 'secondary', size: 'sm' })} w-fit">renderStream() an element-level update</button>
          <ul id="ws-stream-log" class="grid gap-1.5 list-none m-0 p-0"></ul>
        </div>
      </div>
    `;
  }
}
WsEcho.register('ws-echo');
