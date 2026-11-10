import { WebComponent, html } from '@webjsdev/core';
import './typed.ts';
import './plain.ts';
import './badge.ts';

// A shipping component (@click) whose served source carries the three
// same-line transforms: the lazy badge import is deferred to the lazy loader,
// the other two relative imports are versioned. A page never ships (#1686), so
// this is the served module the line-number assertion reads.
export class ShellComp extends WebComponent {
  render() {
    return html`<button @click=${() => {}}>shell</button>`;
  }
}
ShellComp.register('shell-comp');
