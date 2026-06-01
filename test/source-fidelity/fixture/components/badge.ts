import { WebComponent, html } from '@webjsdev/core';

// Display-only (no interactivity signal), so the framework elides it: the
// side-effect import in app/page.ts is swapped for a same-line comment.
export class DisplayBadge extends WebComponent {
  render() {
    return html`<span>badge</span>`;
  }
}
DisplayBadge.register('display-badge');
