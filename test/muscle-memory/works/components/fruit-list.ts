// Lit idiom: the lit-html directive set. Two-argument `repeat`, `when`,
// `choose`, the iterable helpers `map` / `join` / `range`, and `classMap`.
import { WebComponent, html } from '@webjsdev/core';
import { repeat, when, choose, map, join, range, classMap } from '@webjsdev/core/directives';

export class FruitList extends WebComponent {
  static properties = {
    items: { type: Array },
    mode: { type: String },
  };

  declare items: string[];
  declare mode: string;

  constructor() {
    super();
    this.items = [];
    this.mode = '';
  }

  render() {
    return html`
      <ul>${repeat(this.items, (fruit) => html`<li>${fruit}</li>`)}</ul>
      <p class="joined">${join(map(this.items, (fruit) => fruit.toUpperCase()), ', ')}</p>
      <p class="range">${map(range(3), (i) => html`<b>${i}</b>`)}</p>
      ${when(this.items.length > 0, () => html`<p>Has fruit</p>`, () => html`<p>No fruit</p>`)}
      ${choose(this.mode, [
        ['short', () => html`<p>Short mode</p>`],
        ['long', () => html`<p>Long mode</p>`],
      ], () => html`<p>Other mode</p>`)}
      <p class=${classMap({ active: this.mode === 'short' })}>Mode flag</p>
    `;
  }
}

customElements.define('fruit-list', FruitList);
