import { WebComponent, html } from '@webjsdev/core';
import './typed.ts';
import './plain.ts';
import './badge.ts';

// A shipping component (@click) whose served source carries the three
// same-line transforms: the badge import is elided, the other two relative
// imports are versioned. A page never ships (#1686), so this is the served
// module the line-number assertion reads. It does not render the badge's tag,
// which would force the badge to ship.
export class ShellComp extends WebComponent {
  render() {
    return html`<button @click=${() => {}}>shell</button>`;
  }
}
ShellComp.register('shell-comp');
