import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Native textarea wrapped in a custom element. Forwards `value` to the inner
 * <textarea>. Dispatches `input` and `change` events on this host so listeners
 * on `<ui-textarea>` work as if it were a real textarea.
 */
export class UiTextarea extends WebComponent {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean },
    required: { type: Boolean },
    name: { type: String },
    id: { type: String, reflect: true },
    rows: { type: Number },
    cols: { type: Number },
    autocomplete: { type: String },
  };
  declare value: string;
  declare placeholder: string;
  declare disabled: boolean;
  declare readonly: boolean;
  declare required: boolean;
  declare name: string;
  declare id: string;
  declare rows: number;
  declare cols: number;
  declare autocomplete: string;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.disabled = false;
    this.readonly = false;
    this.required = false;
    this.name = '';
    this.id = '';
    this.rows = 0;
    this.cols = 0;
    this.autocomplete = '';
  }

  render() {
    return html`<textarea
      data-slot="textarea"
      .value=${this.value}
      placeholder=${this.placeholder || null}
      ?disabled=${this.disabled}
      ?readonly=${this.readonly}
      ?required=${this.required}
      name=${this.name || null}
      id=${this.id || null}
      rows=${this.rows || null}
      cols=${this.cols || null}
      autocomplete=${this.autocomplete || null}
      @input=${this._onInput}
      @change=${this._onChange}
      class=${cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
      )}
    ></textarea>`;
  }

  private _onInput = (e: Event) => {
    this.value = (e.target as HTMLTextAreaElement).value;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };
  private _onChange = () => {
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
}
UiTextarea.register('ui-textarea');
