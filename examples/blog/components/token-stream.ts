import { WebComponent, html, signal } from '@webjsdev/core';
import { streamTokens } from '#/modules/verbdemo/actions/stream-tokens.server.ts';

/**
 * `<token-stream>`: the streaming-RPC demo (#489). Clicking "start" calls the
 * `streamTokens` async-generator action and appends each token as it arrives, so
 * the list grows incrementally rather than all at once. This is the imperative
 * `for await` consumption pattern (the action returns an async iterable over RPC,
 * not a single buffered value). The e2e asserts the rendered count climbs.
 */
export class TokenStream extends WebComponent {
  private tokens = signal<string[]>([]);
  private streaming = signal(false);

  private async start() {
    this.tokens.set([]);
    this.streaming.set(true);
    try {
      for await (const tok of await streamTokens(8)) {
        this.tokens.set([...this.tokens.get(), tok]);
      }
    } finally {
      this.streaming.set(false);
    }
  }

  render() {
    const toks = this.tokens.get();
    return html`<div class="token-stream">
      <button class="ts-start" @click=${() => this.start()} ?disabled=${this.streaming.get()}>
        ${this.streaming.get() ? 'streaming…' : 'start'}
      </button>
      <span class="ts-count">count=${toks.length}</span>
      <ul class="ts-list">
        ${toks.map((t) => html`<li class="ts-item">${t}</li>`)}
      </ul>
    </div>`;
  }
}
TokenStream.register('token-stream');
