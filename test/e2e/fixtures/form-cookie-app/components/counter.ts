import { WebComponent, html, prop } from '@webjsdev/core';

/**
 * Interactive, so it ships and `@webjsdev/core` loads, which auto-enables the
 * client router. Its count lives on the INSTANCE, so it survives a navigation
 * only if the node itself was never re-created.
 */
class StateCounter extends WebComponent({ count: prop(Number) }) {
  constructor() { super(); this.count = 0; }
  render() {
    return html`<button id="bump" @click=${() => { this.count++; }}>count ${this.count}</button>`;
  }
}
StateCounter.register('state-counter');
