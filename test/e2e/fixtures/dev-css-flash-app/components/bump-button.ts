import { WebComponent, html, prop } from '@webjsdev/core';

/**
 * Interactive, so it ships and `@webjsdev/core` loads, which auto-enables the
 * client router the in-place dev refresh runs through (#1398).
 */
class BumpButton extends WebComponent({ count: prop(Number) }) {
  constructor() { super(); this.count = 0; }
  render() {
    return html`<button @click=${() => { this.count++; }}>count ${this.count}</button>`;
  }
}
BumpButton.register('bump-button');
