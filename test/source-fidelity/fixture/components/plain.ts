import { WebComponent, html } from '@webjsdev/core';

// Interactive (@click) so it ships, and carries NO type annotations, so the
// strip is a no-op and the served bytes must equal the authored file exactly.
export class PlainComp extends WebComponent {
  render() {
    return html`<button @click=${() => this.dispatchEvent(new CustomEvent('ping'))}>plain</button>`;
  }
}
PlainComp.register('plain-comp');
