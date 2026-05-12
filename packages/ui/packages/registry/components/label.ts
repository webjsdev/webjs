import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

export class UiLabel extends WebComponent {
  static properties = { htmlFor: { type: String, attribute: 'for' } };
  declare htmlFor: string;
  private _slot = '';

  constructor() { super(); this.htmlFor = ''; }
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }

  render() {
    return html`<label
      data-slot="label"
      for=${this.htmlFor || null}
      class=${cn('flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50')}
    >${unsafeHTML(this._slot)}</label>`;
  }
}
UiLabel.register('ui-label');
