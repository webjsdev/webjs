// Lit idiom: `static properties` with `declare` fields, defaults in the
// constructor, `updated(changed: PropertyValues<this>)`, an `@click` handler,
// and registration through `customElements.define`.
import { WebComponent, html } from '@webjsdev/core';
import type { PropertyValues } from '@webjsdev/core';

export class LitCounter extends WebComponent {
  static properties = {
    count: { type: Number },
    step: { type: Number },
  };

  declare count: number;
  declare step: number;

  constructor() {
    super();
    this.count = 0;
    this.step = 1;
  }

  updated(changed: PropertyValues<this>) {
    if (changed.has('count')) this.dataset.parity = this.count % 2 ? 'odd' : 'even';
  }

  render() {
    return html`<button @click=${() => { this.count += this.step; }}>Count: ${this.count}</button>`;
  }
}

customElements.define('lit-counter', LitCounter);
