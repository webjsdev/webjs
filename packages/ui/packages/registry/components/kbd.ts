import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Keyboard key indicator (`<kbd>`). Use `<ui-kbd>⌘K</ui-kbd>`.
 * `<ui-kbd-group>` groups multiple kbd elements with a small gap.
 */
export class UiKbd extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<kbd
      data-slot="kbd"
      class=${cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10',
      )}
    >${unsafeHTML(this._slot)}</kbd>`;
  }
}
UiKbd.register('ui-kbd');

export class UiKbdGroup extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<kbd
      data-slot="kbd-group"
      class=${cn('inline-flex items-center gap-1')}
    >${unsafeHTML(this._slot)}</kbd>`;
  }
}
UiKbdGroup.register('ui-kbd-group');
