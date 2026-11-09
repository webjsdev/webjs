// Lit idiom: `createRenderRoot() { return this; }` to render into light DOM,
// then `this.renderRoot.querySelector(...)` in `firstUpdated`.
import { WebComponent, html } from '@webjsdev/core';

export class LightRoot extends WebComponent {
  createRenderRoot() {
    return this;
  }

  firstUpdated() {
    const p = this.renderRoot.querySelector('p');
    if (p) p.dataset.found = 'yes';
  }

  render() {
    return html`<p>Light root</p>`;
  }
}

customElements.define('light-root', LightRoot);
