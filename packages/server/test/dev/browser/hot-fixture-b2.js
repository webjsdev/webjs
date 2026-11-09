// Version 2 of <hot-b> for hot-swap.test.js (#1689), the module a `component`
// verdict re-imports after an edit to render().
import { WebComponent } from '../../../../core/src/component.js';
import { html } from '../../../../core/src/html.js';

class HotB extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  render() { return html`<p class="b">b2 ${this.count}</p>`; }
}
HotB.register('hot-b');
