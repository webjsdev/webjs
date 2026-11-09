// Lit idiom (@lit-labs/signals): a module-scope signal rendered BARE in a hole,
// with no `watch()` wrapper, and written with `.set()`.
import { WebComponent, html, signal } from '@webjsdev/core';

const clicks = signal(0);

export class ClickTally extends WebComponent {
  render() {
    return html`<button @click=${() => clicks.set(clicks.get() + 1)}>Clicks: ${clicks}</button>`;
  }
}

customElements.define('click-tally', ClickTally);
