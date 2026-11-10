import { html } from '@webjsdev/core';
import '#components/go-button.ts';

export default function Go() {
  return html`<p id="where">go</p><go-button></go-button>`;
}
