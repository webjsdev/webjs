// Lit idiom: using a custom directive in a child hole.
import { WebComponent, html } from '@webjsdev/core';
import { shout } from '../lib/shout.ts';

export class ShoutText extends WebComponent {
  static properties = {
    text: { type: String },
  };

  declare text: string;

  constructor() {
    super();
    this.text = '';
  }

  render() {
    return html`<p>${shout(this.text)}</p>`;
  }
}

customElements.define('shout-text', ShoutText);
