import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * One-time-passcode input. A row of single-char inputs that auto-advance.
 *
 *   <ui-input-otp maxlength="6" @change=${e => …}></ui-input-otp>
 *
 * Or compose explicitly with groups/slots/separator:
 *
 *   <ui-input-otp maxlength="6">
 *     <ui-input-otp-group>
 *       <ui-input-otp-slot index="0"></ui-input-otp-slot>
 *       <ui-input-otp-slot index="1"></ui-input-otp-slot>
 *       <ui-input-otp-slot index="2"></ui-input-otp-slot>
 *     </ui-input-otp-group>
 *     <ui-input-otp-separator></ui-input-otp-separator>
 *     <ui-input-otp-group>
 *       <ui-input-otp-slot index="3"></ui-input-otp-slot>
 *       <ui-input-otp-slot index="4"></ui-input-otp-slot>
 *       <ui-input-otp-slot index="5"></ui-input-otp-slot>
 *     </ui-input-otp-group>
 *   </ui-input-otp>
 *
 * The root manages a single `value` string of length `maxlength`. Each slot
 * displays the character at its index. When children are provided the root
 * preserves the composition; otherwise it auto-renders `maxlength` slots.
 */
export class UiInputOtp extends WebComponent {
  static properties = {
    maxlength: { type: Number, reflect: true },
    value: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    name: { type: String },
    autocomplete: { type: String },
  };
  declare maxlength: number;
  declare value: string;
  declare disabled: boolean;
  declare name: string;
  declare autocomplete: string;

  private _slot = '';
  private _hasComposition = false;

  constructor() {
    super();
    this.maxlength = 6;
    this.value = '';
    this.disabled = false;
    this.name = '';
    this.autocomplete = 'one-time-code';
  }

  connectedCallback() {
    if (!this._slot) {
      this._slot = this.getSourceChildren();
      this._hasComposition = !!this._slot.trim();
    }
    super.connectedCallback();
    this.addEventListener('ui-otp-input', this._onSlotInput as EventListener);
    this.addEventListener('ui-otp-keydown', this._onSlotKey as EventListener);
    this.addEventListener('ui-otp-paste', this._onSlotPaste as EventListener);
    queueMicrotask(() => this._syncSlots());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-otp-input', this._onSlotInput as EventListener);
    this.removeEventListener('ui-otp-keydown', this._onSlotKey as EventListener);
    this.removeEventListener('ui-otp-paste', this._onSlotPaste as EventListener);
  }

  // Paste a multi-char string starting at the focused slot, filling the
  // subsequent slots and focusing the next-empty (or last) slot.
  _onSlotPaste = (e: CustomEvent) => {
    const { index, text, numericOnly } = e.detail as { index: number; text: string; numericOnly: boolean };
    let pasted = String(text || '');
    if (numericOnly) pasted = pasted.replace(/\D/g, '');
    if (!pasted) return;
    const max = this.maxlength;
    const chars = (this.value || '').padEnd(max, ' ').split('');
    let writeAt = index;
    let written = 0;
    for (const c of pasted) {
      if (writeAt >= max) break;
      chars[writeAt++] = c;
      written++;
    }
    this.value = chars.join('').replace(/ +$/, '');
    this._syncSlots();
    const slots = this._allSlots();
    const focusIdx = Math.min(index + written, max - 1);
    slots[focusIdx]?.querySelector<HTMLInputElement>('input')?.focus();
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }));
    if (this.value.length >= max) {
      this.dispatchEvent(new CustomEvent('complete', { detail: { value: this.value }, bubbles: true, composed: true }));
    }
  };

  static get observedAttributes() {
    return ['value', 'maxlength', 'disabled'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'value' || name === 'maxlength' || name === 'disabled') this._syncSlots();
  }

  _onSlotInput = (e: CustomEvent) => {
    const { index, char } = e.detail as { index: number; char: string };
    const chars = (this.value || '').padEnd(this.maxlength, ' ').split('');
    chars[index] = char || ' ';
    this.value = chars.join('').replace(/ +$/, '');
    this._syncSlots();
    // auto-advance
    if (char) {
      const slots = this._allSlots();
      const next = slots[index + 1];
      next?.querySelector<HTMLInputElement>('input')?.focus();
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }));
    if (this.value.length >= this.maxlength) {
      this.dispatchEvent(new CustomEvent('complete', { detail: { value: this.value }, bubbles: true, composed: true }));
    }
  };

  _onSlotKey = (e: CustomEvent) => {
    const { index, key } = e.detail as { index: number; key: string };
    const slots = this._allSlots();
    if (key === 'Backspace') {
      const chars = (this.value || '').padEnd(this.maxlength, ' ').split('');
      if (chars[index] && chars[index] !== ' ') {
        chars[index] = ' ';
      } else if (index > 0) {
        chars[index - 1] = ' ';
        slots[index - 1]?.querySelector<HTMLInputElement>('input')?.focus();
      }
      this.value = chars.join('').replace(/ +$/, '');
      this._syncSlots();
      this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }));
    } else if (key === 'ArrowLeft') {
      slots[index - 1]?.querySelector<HTMLInputElement>('input')?.focus();
    } else if (key === 'ArrowRight') {
      slots[index + 1]?.querySelector<HTMLInputElement>('input')?.focus();
    }
  };

  private _allSlots(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('ui-input-otp-slot'));
  }

  _syncSlots() {
    const value = this.value || '';
    this._allSlots().forEach((s) => {
      const idx = Number(s.getAttribute('index') ?? -1);
      const ch = value[idx] ?? '';
      s.setAttribute('data-char', ch);
      s.setAttribute('data-active', String(idx === value.length));
      s.setAttribute('data-disabled', String(this.disabled));
    });
  }

  render() {
    if (this._hasComposition) {
      return html`<div
        data-slot="input-otp"
        class=${cn('flex items-center gap-2 has-disabled:opacity-50')}
      >${unsafeHTML(this._slot)}</div>`;
    }
    // Auto-render: a single group with `maxlength` slots.
    const slots: string[] = [];
    for (let i = 0; i < this.maxlength; i++) {
      slots.push(`<ui-input-otp-slot index="${i}"></ui-input-otp-slot>`);
    }
    return html`<div
      data-slot="input-otp"
      class=${cn('flex items-center gap-2 has-disabled:opacity-50')}
    >
      <ui-input-otp-group>${unsafeHTML(slots.join(''))}</ui-input-otp-group>
    </div>`;
  }
}
UiInputOtp.register('ui-input-otp');

export class UiInputOtpGroup extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="input-otp-group"
      class=${cn('flex items-center')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiInputOtpGroup.register('ui-input-otp-group');

export class UiInputOtpSlot extends WebComponent {
  static properties = {
    index: { type: Number, reflect: true },
  };
  declare index: number;

  constructor() {
    super();
    this.index = 0;
  }

  static get observedAttributes() {
    return ['data-char', 'data-active', 'data-disabled', 'index'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    this.requestUpdate();
  }

  render() {
    const char = this.getAttribute('data-char') || '';
    const active = this.getAttribute('data-active') === 'true';
    const disabled = this.getAttribute('data-disabled') === 'true';
    return html`<div
      data-slot="input-otp-slot"
      data-active=${active ? 'true' : 'false'}
      class=${cn(
        'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40',
      )}
    >
      <input
        type="text"
        inputmode="numeric"
        maxlength="1"
        .value=${char}
        ?disabled=${disabled}
        class="absolute inset-0 size-full bg-transparent text-center outline-none disabled:cursor-not-allowed"
        @input=${this._onInput}
        @keydown=${this._onKeyDown}
        @focus=${this._onFocus}
        @paste=${this._onPaste}
      />
      ${char ? html`<span aria-hidden="true">${char}</span>` : ''}
    </div>`;
  }

  private _onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const raw = input.value || '';
    const char = raw.slice(-1); // take last typed char
    input.value = char;
    this.dispatchEvent(
      new CustomEvent('ui-otp-input', { detail: { index: this.index, char }, bubbles: true }),
    );
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this.dispatchEvent(
        new CustomEvent('ui-otp-keydown', { detail: { index: this.index, key: e.key }, bubbles: true }),
      );
    }
  };

  private _onFocus = () => {
    this.setAttribute('data-active', 'true');
  };

  private _onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text || text.length <= 1) return; // single-char paste falls through to input handler
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const numericOnly = input.getAttribute('inputmode') === 'numeric';
    this.dispatchEvent(
      new CustomEvent('ui-otp-paste', {
        detail: { index: this.index, text, numericOnly },
        bubbles: true,
      }),
    );
  };
}
UiInputOtpSlot.register('ui-input-otp-slot');

export class UiInputOtpSeparator extends WebComponent {
  render() {
    return html`<div data-slot="input-otp-separator" role="separator">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M5 12h14"/></svg>
    </div>`;
  }
}
UiInputOtpSeparator.register('ui-input-otp-separator');
