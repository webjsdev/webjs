import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Radio group. Composition:
 *
 *   <ui-radio-group value="banana">
 *     <ui-radio-group-item value="apple"></ui-radio-group-item>
 *     <ui-radio-group-item value="banana"></ui-radio-group-item>
 *   </ui-radio-group>
 *
 * The group owns `value`; items derive their checked state by matching their
 * own `value` against the group's. Clicking an item updates the group's
 * `value` and dispatches `change` on the group host.
 */
export class UiRadioGroup extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    name: { type: String },
    disabled: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare name: string;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.value = '';
    this.name = '';
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-radio-select', this._onSelect as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-radio-select', this._onSelect as EventListener);
  }

  _onSelect = (e: CustomEvent) => {
    const next = e.detail?.value;
    if (next == null || next === this.value) return;
    this.value = next;
    this._syncChildren();
    this.dispatchEvent(new CustomEvent('change', { detail: { value: next }, bubbles: true, composed: true }));
  };

  _syncChildren() {
    this.querySelectorAll('ui-radio-group-item').forEach((el) => {
      (el as HTMLElement).setAttribute('data-group-value', this.value || '');
    });
  }

  static get observedAttributes() {
    return ['value'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'value') this._syncChildren();
  }

  render() {
    return html`<div
      data-slot="radio-group"
      role="radiogroup"
      class=${cn('grid gap-3')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiRadioGroup.register('ui-radio-group');

export class UiRadioGroupItem extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    id: { type: String, reflect: true },
  };
  declare value: string;
  declare disabled: boolean;
  declare id: string;

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
    this.id = '';
  }

  static get observedAttributes() {
    return ['data-group-value', 'value', 'disabled'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'data-group-value') this.requestUpdate();
  }

  private get _groupValue() {
    return this.getAttribute('data-group-value') ?? this._lookupGroupValue();
  }

  private _lookupGroupValue(): string {
    const group = this.closest('ui-radio-group') as UiRadioGroup | null;
    return group?.value ?? '';
  }

  private get _checked() {
    return this._groupValue === this.value && this.value !== '';
  }

  render() {
    const state = this._checked ? 'checked' : 'unchecked';
    return html`
      <button
        type="button"
        role="radio"
        aria-checked=${this._checked ? 'true' : 'false'}
        ?disabled=${this.disabled}
        data-slot="radio-group-item"
        data-state=${state}
        class=${cn(
          'aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
        )}
        @click=${this._onClick}
      >
        ${this._checked
          ? html`<span
              data-slot="radio-group-indicator"
              class="relative flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary"
              ><circle cx="12" cy="12" r="6"/></svg>
            </span>`
          : ''}
      </button>
    `;
  }

  private _onClick = () => {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('ui-radio-select', { detail: { value: this.value }, bubbles: true }));
  };
}
UiRadioGroupItem.register('ui-radio-group-item');
