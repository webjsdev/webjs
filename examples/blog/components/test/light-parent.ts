import { WebComponent, html } from '@webjsdev/core';
import './shadow-inner.ts';
import './light-inner.ts';

/**
 * Light DOM parent that nests both shadow and light DOM children.
 * Used in nested DSD e2e tests.
 */
export class LightParent extends WebComponent({ child: String }) {
  constructor() {
    super();
    this.child = 'shadow';
  }

  render() {
    return this.child === 'light'
      ? html`<div data-testid="light-parent"><light-inner></light-inner></div>`
      : html`<div data-testid="light-parent"><shadow-inner></shadow-inner></div>`;
  }
}
LightParent.register('light-parent');
