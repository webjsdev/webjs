import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Native <select> with a chevron indicator. Slot in <option> elements directly.
 *
 *   <ui-native-select name="role">
 *     <option value="admin">Admin</option>
 *     <option value="user">User</option>
 *   </ui-native-select>
 */

export type NativeSelectSize = 'sm' | 'default';

export class UiNativeSelect extends WebComponent {
  static properties = {
    size: { type: String, reflect: true },
    value: { type: String },
    name: { type: String },
    id: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean },
  };
  declare size: NativeSelectSize;
  declare value: string;
  declare name: string;
  declare id: string;
  declare disabled: boolean;
  declare required: boolean;

  private _slot = '';

  constructor() {
    super();
    this.size = 'default';
    this.value = '';
    this.name = '';
    this.id = '';
    this.disabled = false;
    this.required = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="native-select-wrapper"
      class=${cn('group/native-select relative w-fit has-[select:disabled]:opacity-50')}
    >
      <select
        data-slot="native-select"
        data-size=${this.size}
        .value=${this.value}
        name=${this.name || null}
        id=${this.id || null}
        ?disabled=${this.disabled}
        ?required=${this.required}
        @change=${this._onChange}
        class=${cn(
          'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        )}
      >${unsafeHTML(this._slot)}</select>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        data-slot="native-select-icon"
        class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>`;
  }

  private _onChange = (e: Event) => {
    this.value = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
}
UiNativeSelect.register('ui-native-select');
