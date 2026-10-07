// `await streamTokens()` resolves to an async iterable whose chunks arrive as
// the server yields them; each one is appended to an instance signal, which
// re-renders. With JS off the button is inert and the first paint is intact.
import { WebComponent, signal, html } from '@webjsdev/core';
import { cardClass } from '#components/ui/card.ts';
import { buttonClass } from '#components/ui/button.ts';
import { streamTokens } from '../actions/stream-tokens.server.ts';

export class TokenStream extends WebComponent {
  // Instance signals, not reactive props, so class fields are fine.
  private output = signal('');
  private busy = signal(false);

  private async run() {
    this.output.set('');
    this.busy.set(true);
    try {
      // `for await` pulls each token as it arrives.
      for await (const chunk of await streamTokens('webjs')) {
        this.output.set(this.output.get() + chunk);
      }
    } finally {
      this.busy.set(false);
    }
  }

  render() {
    const busy = this.busy.get();
    const output = this.output.get();
    // The output area appears once streaming starts, so an idle demo has no empty box.
    return html`
      <div class="${cardClass()} p-5">
        <button
          @click=${() => this.run()}
          ?disabled=${busy}
          class=${buttonClass()}
        >
          ${busy ? 'streaming…' : 'Stream tokens'}
        </button>
        ${busy || output
          ? html`<pre class="mt-4 whitespace-pre-wrap font-mono text-sm text-foreground">${output}</pre>`
          : ''}
      </div>
    `;
  }
}
TokenStream.register('token-stream');
