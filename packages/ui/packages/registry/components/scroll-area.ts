import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Scroll area — a scrolling container around slotted children.
 *
 * TODO(v2): port the Radix custom-scrollbar UI. v1 uses the native scrollbar
 * via `overflow-auto` for simplicity. Set a `height`/`max-height` on the
 * element (e.g. `<ui-scroll-area style="height:200px">`) so it actually scrolls.
 */
export class UiScrollArea extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="scroll-area"
      class=${cn('relative overflow-hidden')}
    >
      <div
        data-slot="scroll-area-viewport"
        class=${cn(
          'size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
        )}
      >${unsafeHTML(this._slot)}</div>
    </div>`;
  }
}
UiScrollArea.register('ui-scroll-area');
