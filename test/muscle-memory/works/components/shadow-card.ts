// Lit idiom: composed `static styles` (a shared `css` result plus `unsafeCSS`),
// `static shadowRootOptions` spreading the base class's, and a `<slot>`. WebJs
// renders light DOM by default, so the one WebJs line is `static shadow = true`.
import { WebComponent, html, css, unsafeCSS } from '@webjsdev/core';

const accent = 'rgb(255, 0, 0)';
const base = css`:host { display: block; }`;

export class ShadowCard extends WebComponent {
  static shadow = true;
  static shadowRootOptions = { ...WebComponent.shadowRootOptions, delegatesFocus: true };
  static styles = [base, css`h2 { color: ${unsafeCSS(accent)}; }`];

  static properties = {
    heading: { type: String },
  };

  declare heading: string;

  constructor() {
    super();
    this.heading = '';
  }

  render() {
    return html`<h2>${this.heading}</h2><slot></slot><button>Focus me</button>`;
  }
}

customElements.define('shadow-card', ShadowCard);
