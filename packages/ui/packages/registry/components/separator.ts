import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

export class UiSeparator extends WebComponent {
  static properties = {
    orientation: { type: String, reflect: true },
    decorative: { type: Boolean, reflect: true },
  };
  declare orientation: 'horizontal' | 'vertical';
  declare decorative: boolean;

  constructor() {
    super();
    this.orientation = 'horizontal';
    this.decorative = true;
  }

  render() {
    return html`<div
      data-slot="separator-root"
      data-orientation=${this.orientation}
      role=${this.decorative ? 'none' : 'separator'}
      aria-orientation=${this.orientation === 'vertical' ? 'vertical' : 'horizontal'}
      class=${cn(
        'bg-border shrink-0',
        this.orientation === 'horizontal' ? 'data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full' : 'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
      )}
    ></div>`;
  }
}
UiSeparator.register('ui-separator');
