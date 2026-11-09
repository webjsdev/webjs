// Version 3 of <hot-b> for hot-swap.test.js (#1689), an edit that adds a
// reactive property, which the hot client refuses.
import { WebComponent } from '../../../../core/src/component.js';
import { html } from '../../../../core/src/html.js';

class HotB extends WebComponent({ count: Number, extra: String }) {
  constructor() { super(); this.count = 0; }
  render() { return html`<p class="b">b3 ${this.count}</p>`; }
}
HotB.register('hot-b');
