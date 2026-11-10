import { WebComponent, html } from '@webjsdev/core';

// A `static lazy` component, so the side-effect import of it in shell.ts is
// served as a same-line lazy-loader registration (#1524).
export class DisplayBadge extends WebComponent {
  static lazy = true;
  render() {
    return html`<span>badge</span>`;
  }
}
DisplayBadge.register('display-badge');
