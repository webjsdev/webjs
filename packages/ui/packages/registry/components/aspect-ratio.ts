import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Aspect-ratio container. Set the `ratio` attribute to a number
 * (e.g. `1.7777` for 16:9 or `1` for square). Slotted children fill the box.
 */
export class UiAspectRatio extends WebComponent {
  static properties = {
    ratio: { type: Number },
  };
  declare ratio: number;

  private _slot = '';

  constructor() {
    super();
    this.ratio = 1;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="aspect-ratio"
      style="aspect-ratio: ${this.ratio};"
      class=${cn('w-full')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAspectRatio.register('ui-aspect-ratio');
