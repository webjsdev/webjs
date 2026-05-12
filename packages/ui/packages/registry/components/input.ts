import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Native input wrapped in a custom element. Forwards `value` to the inner
 * <input>. Dispatches an `input` and `change` event on this host so listeners
 * on `<ui-input>` work as if it were a real input.
 */
export class UiInput extends WebComponent {
  static properties = {
    type: { type: String },
    value: { type: String },
    placeholder: { type: String },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean },
    required: { type: Boolean },
    name: { type: String },
    id: { type: String, reflect: true },
    autocomplete: { type: String },
  };
  declare type: string;
  declare value: string;
  declare placeholder: string;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare name: string;
  declare id: string;
  declare autocomplete: string;

  constructor() {
    super();
    this.type = 'text';
    this.value = '';
    this.placeholder = '';
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.name = '';
    this.id = '';
    this.autocomplete = '';
  }

  render() {
    return html`<input
      data-slot="input"
      type=${this.type}
      .value=${this.value}
      placeholder=${this.placeholder || null}
      ?disabled=${this.disabled}
      ?readonly=${this.readonly}
      ?required=${this.required}
      name=${this.name || null}
      id=${this.id || null}
      autocomplete=${this.autocomplete || null}
      @input=${this._onInput}
      @change=${this._onChange}
      class=${cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      )}
    />`;
  }

  private _onInput = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };
  private _onChange = () => {
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
}
UiInput.register('ui-input');
