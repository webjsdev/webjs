// Version 1 of <hot-b> for hot-swap.test.js (#1689), the module a page loaded.
import { WebComponent } from '../../../../core/src/component.js';
import { html } from '../../../../core/src/html.js';

class HotB extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html`<p class="b">b1 ${this.count}</p>`; }
}
HotB.register('hot-b');
