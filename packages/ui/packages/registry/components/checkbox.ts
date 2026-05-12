import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Checkbox. Native `<button role="checkbox">`. Click toggles `checked`.
 * Renders a lucide CheckIcon when checked. Dispatches `change` on the host.
 *
 *   <ui-checkbox ?checked=${on} @change=${e => …}></ui-checkbox>
 */
export class UiCheckbox extends WebComponent {
  static properties = {
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    name: { type: String },
    value: { type: String },
    id: { type: String, reflect: true },
    required: { type: Boolean },
  };
  declare checked: boolean;
  declare disabled: boolean;
  declare name: string;
  declare value: string;
  declare id: string;
  declare required: boolean;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
    this.name = '';
    this.value = 'on';
    this.id = '';
    this.required = false;
  }

  render() {
    const state = this.checked ? 'checked' : 'unchecked';
    return html`
      <button
        type="button"
        role="checkbox"
        aria-checked=${this.checked ? 'true' : 'false'}
        ?disabled=${this.disabled}
        data-slot="checkbox"
        data-state=${state}
        class=${cn(
          'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary',
        )}
        @click=${this._onClick}
      >
        ${this.checked
          ? html`<span
              data-slot="checkbox-indicator"
              class="grid place-content-center text-current transition-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-3.5"
              ><path d="M20 6 9 17l-5-5"/></svg>
            </span>`
          : ''}
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
UiCheckbox.register('ui-checkbox');
