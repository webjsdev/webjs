import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';

/**
 * Direction provider — sets text direction (`ltr` / `rtl`) on a wrapper div.
 * Equivalent of Radix `DirectionProvider`. The `dir` attribute on a DOM
 * ancestor is the web-native equivalent of a React context for direction,
 * so descendants pick it up via CSS `:dir(rtl)` and inherited writing mode.
 *
 *   <ui-direction-provider dir="rtl">
 *     ...descendant components...
 *   </ui-direction-provider>
 */
export class UiDirectionProvider extends WebComponent {
  static properties = {
    dir: { type: String, reflect: true },
    direction: { type: String },
  };
  declare dir: 'ltr' | 'rtl';
  declare direction: 'ltr' | 'rtl' | '';

  private _slot = '';

  constructor() {
    super();
    this.dir = 'ltr';
    this.direction = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const resolved = this.direction || this.dir || 'ltr';
    return html`<div
      data-slot="direction-provider"
      dir=${resolved}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiDirectionProvider.register('ui-direction-provider');
