import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Toggle switch. Native `<button role="switch">` with a thumb child.
 * Click toggles `checked`. Dispatches a `change` event on the host.
 *
 *   <ui-switch ?checked=${on} @change=${e => …}></ui-switch>
 */
export class UiSwitch extends WebComponent {
  static properties = {
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    size: { type: String, reflect: true },
    name: { type: String },
    value: { type: String },
    id: { type: String, reflect: true },
  };
  declare checked: boolean;
  declare disabled: boolean;
  declare size: 'sm' | 'default';
  declare name: string;
  declare value: string;
  declare id: string;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
    this.size = 'default';
    this.name = '';
    this.value = 'on';
    this.id = '';
  }

  render() {
    const state = this.checked ? 'checked' : 'unchecked';
    return html`
      <button
        type="button"
        role="switch"
        aria-checked=${this.checked ? 'true' : 'false'}
        ?disabled=${this.disabled}
        data-slot="switch"
        data-state=${state}
        data-size=${this.size}
        class=${cn(
          'peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80',
        )}
        @click=${this._onClick}
      >
        <span
          data-slot="switch-thumb"
          data-state=${state}
          class=${cn(
            'pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground',
          )}
        ></span>
      </button>
    `;
  }

  private _onClick = () => {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { checked: this.checked }, bubbles: true, composed: true }),
    );
  };
}
UiSwitch.register('ui-switch');
