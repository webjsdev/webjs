import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';
import { toggleClasses, type ToggleVariant, type ToggleSize } from './toggle.ts';

/**
 * Toggle group. Single- or multi-select group of toggle buttons.
 *
 *   <ui-toggle-group type="single" value="bold">
 *     <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
 *     <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
 *   </ui-toggle-group>
 *
 * In multiple mode `value` is a comma-separated list.
 */
export class UiToggleGroup extends WebComponent {
  static properties = {
    type: { type: String, reflect: true },
    value: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    spacing: { type: Number, reflect: true },
  };
  declare type: 'single' | 'multiple';
  declare value: string;
  declare variant: ToggleVariant;
  declare size: ToggleSize;
  declare disabled: boolean;
  declare spacing: number;

  private _slot = '';

  constructor() {
    super();
    this.type = 'single';
    this.value = '';
    this.variant = 'default';
    this.size = 'default';
    this.disabled = false;
    this.spacing = 0;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-toggle-group-select', this._onSelect as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-toggle-group-select', this._onSelect as EventListener);
  }

  _onSelect = (e: CustomEvent) => {
    const v = e.detail?.value as string | undefined;
    if (v == null) return;
    if (this.type === 'multiple') {
      const set = new Set((this.value || '').split(',').filter(Boolean));
      if (set.has(v)) set.delete(v);
      else set.add(v);
      this.value = Array.from(set).join(',');
    } else {
      this.value = this.value === v ? '' : v;
    }
    this._syncChildren();
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }));
  };

  _syncChildren() {
    this.querySelectorAll('ui-toggle-group-item').forEach((el) => {
      const target = el as HTMLElement;
      target.setAttribute('data-group-value', this.value || '');
      target.setAttribute('data-group-type', this.type);
      target.setAttribute('data-group-variant', this.variant);
      target.setAttribute('data-group-size', this.size);
      target.setAttribute('data-group-spacing', String(this.spacing));
    });
  }

  static get observedAttributes() {
    return ['value', 'type', 'variant', 'size', 'spacing'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    this._syncChildren();
  }

  render() {
    return html`<div
      data-slot="toggle-group"
      data-variant=${this.variant}
      data-size=${this.size}
      data-spacing=${this.spacing}
      role="group"
      class=${cn(
        'group/toggle-group flex w-fit items-center rounded-md data-[spacing=0]:gap-0 data-[spacing=default]:data-[variant=outline]:shadow-xs',
      )}
      style=${`gap: ${this.spacing * 0.25}rem`}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiToggleGroup.register('ui-toggle-group');

export class UiToggleGroupItem extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  static get observedAttributes() {
    return ['data-group-value', 'data-group-type', 'data-group-variant', 'data-group-size', 'data-group-spacing', 'value', 'disabled'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name.startsWith('data-group-')) this.requestUpdate();
  }

  private get _group(): UiToggleGroup | null {
    return this.closest('ui-toggle-group') as UiToggleGroup | null;
  }

  private get _variant(): ToggleVariant {
    return (this.getAttribute('data-group-variant') as ToggleVariant) || this._group?.variant || 'default';
  }
  private get _size(): ToggleSize {
    return (this.getAttribute('data-group-size') as ToggleSize) || this._group?.size || 'default';
  }
  private get _type(): 'single' | 'multiple' {
    return (this.getAttribute('data-group-type') as 'single' | 'multiple') || this._group?.type || 'single';
  }
  private get _pressed(): boolean {
    if (!this.value) return false;
    const gv = this.getAttribute('data-group-value') ?? this._group?.value ?? '';
    if (this._type === 'multiple') return gv.split(',').includes(this.value);
    return gv === this.value;
  }

  render() {
    const state = this._pressed ? 'on' : 'off';
    const spacing = this.getAttribute('data-group-spacing') || '0';
    return html`
      <button
        type="button"
        aria-pressed=${this._pressed ? 'true' : 'false'}
        ?disabled=${this.disabled}
        data-slot="toggle-group-item"
        data-state=${state}
        data-variant=${this._variant}
        data-size=${this._size}
        data-spacing=${spacing}
        class=${cn(
          toggleClasses(this._variant, this._size),
          'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
          'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l',
        )}
        @click=${this._onClick}
      >${unsafeHTML(this._slot)}</button>
    `;
  }

  private _onClick = () => {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('ui-toggle-group-select', { detail: { value: this.value }, bubbles: true }));
  };
}
UiToggleGroupItem.register('ui-toggle-group-item');
