/**
 * Input OTP: a one-time code typed into a row of boxes. Tier-2. It ENHANCES
 * one real `<input>` (D13): you author the input, so without JavaScript the
 * page shows an ordinary text field that the form submits, autofills from an
 * SMS (`autocomplete="one-time-code"`) and pastes into. With JavaScript the
 * element lays that same input, transparent, over shadcn's slots and draws
 * each character in its box, so typing, pasting, autofill and the mobile
 * keyboard all still go to the real input.
 *
 * shadcn parity:
 *   InputOTP maxLength       → <ui-input-otp> around <input maxlength="6" ...>
 *   pattern                  → the input's `pattern` (a keystroke that would
 *                              make the value stop matching is refused)
 *   InputOTPGroup            → <ui-input-otp-group>
 *   InputOTPSlot index       → <ui-input-otp-slot index="0">
 *   InputOTPSeparator        → <ui-input-otp-separator>
 *   onChange                 → `ui-value-change` ({ detail: { value } }); the input fires `input`
 *   onComplete               → `ui-complete` ({ detail: { value } }) once every slot is filled
 *
 * A11y (handled by the element, plus your part): the real input is the only
 * thing assistive technology meets, so it keeps its own name, value and
 * focus. The slots, group and separator are drawn decoration, hidden from the
 * accessibility tree. An `aria-invalid` on the input reaches the slots for
 * the error styling. Your part: a `<label for>` (or `aria-label`) on the input,
 * and `inputmode="numeric"` for a numeric code so phones show the number pad.
 *
 * @example
 * ```html
 * <label for="otp" class=${labelClass()}>One-time code</label>
 * <ui-input-otp>
 *   <input id="otp" name="otp" class=${inputClass()} maxlength="6" pattern="[0-9]*"
 *     inputmode="numeric" autocomplete="one-time-code">
 *   <ui-input-otp-group>
 *     <ui-input-otp-slot index="0"></ui-input-otp-slot>
 *     <ui-input-otp-slot index="1"></ui-input-otp-slot>
 *     <ui-input-otp-slot index="2"></ui-input-otp-slot>
 *   </ui-input-otp-group>
 *   <ui-input-otp-separator></ui-input-otp-separator>
 *   <ui-input-otp-group>
 *     <ui-input-otp-slot index="3"></ui-input-otp-slot>
 *     <ui-input-otp-slot index="4"></ui-input-otp-slot>
 *     <ui-input-otp-slot index="5"></ui-input-otp-slot>
 *   </ui-input-otp-group>
 * </ui-input-otp>
 * ```
 */
import { WebComponent, html, signal } from '@webjsdev/core';
import { takeAuthoredClass } from '../lib/utils.ts';

/** The row's classes (the element applies them). */
export const inputOtpClass = (): string =>
  'cn-input-otp relative flex items-center has-disabled:opacity-50';
/** A group's classes (the element applies them). */
export const inputOtpGroupClass = (): string => 'cn-input-otp-group flex items-center';
/** A slot's classes (the element applies them, to the slot's own host). */
export const inputOtpSlotClass = (): string =>
  'cn-input-otp-slot relative flex items-center justify-center data-[active=true]:z-10';
/** The fake caret's box. */
export const inputOtpCaretClass = (): string =>
  'cn-input-otp-caret pointer-events-none absolute inset-0 flex items-center justify-center';
/** The fake caret's line. */
export const inputOtpCaretLineClass = (): string => 'cn-input-otp-caret-line';
/** The separator's classes (the element applies them). */
export const inputOtpSeparatorClass = (): string => 'cn-input-otp-separator flex items-center';

// The real input, laid transparent over the slots so it takes every click,
// keystroke, paste and autofill while the slots do the drawing.
const OVERLAY =
  'position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;outline:0;box-shadow:none;background:transparent;color:transparent;-webkit-text-fill-color:transparent;caret-color:transparent;font-size:1px;letter-spacing:-0.5em;z-index:20;';

const ROOT = 'ui-input-otp';

export class UiInputOtp extends WebComponent {
  readonly #enhanced = signal(false);
  _observer: MutationObserver | null = null;
  _waiting: MutationObserver | null = null;
  _form: HTMLFormElement | null = null;
  _savedStyle: string | null = null;
  _last = '';
  _focused = false;
  _disabled: boolean | null = null;

  constructor() {
    super();
  }

  /** The real input this element enhances. */
  get input(): HTMLInputElement | null {
    // The server renders the element with no DOM queries available.
    return typeof this.querySelector === 'function' ? this.querySelector('input') : null;
  }

  /** The code typed so far. */
  get value(): string {
    return this.input?.value ?? '';
  }

  /** How many characters the code has: the input's maxlength, else the slots. */
  get maxLength(): number {
    const m = this.input?.maxLength ?? -1;
    return m > 0 ? m : this._slots().length;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    queueMicrotask(() => {
      if (this._enhance() || this._waiting) return;
      this._waiting = new MutationObserver(() => {
        if (this._enhance()) { this._waiting?.disconnect(); this._waiting = null; }
      });
      this._waiting.observe(this, { childList: true, subtree: true });
    });
  }

  disconnectedCallback(): void {
    this._waiting?.disconnect();
    this._observer?.disconnect();
    const input = this.input;
    if (input) {
      input.removeEventListener('input', this._onInput);
      input.removeEventListener('focus', this._onFocus);
      input.removeEventListener('blur', this._onBlur);
      input.removeEventListener('keyup', this._sync);
      input.removeEventListener('click', this._sync);
      input.removeEventListener('select', this._sync);
      if (this._savedStyle !== null) input.setAttribute('style', this._savedStyle);
      else input.removeAttribute('style');
    }
    document.removeEventListener('selectionchange', this._sync);
    this._form?.removeEventListener('reset', this._onReset);
    super.disconnectedCallback?.();
  }

  /** Take over from the plain input. True once it has (or already had). */
  _enhance(): boolean {
    if (this.#enhanced.get()) return true;
    const input = this.input;
    if (!input) return false;
    this._savedStyle = input.getAttribute('style');
    input.setAttribute('style', (this._savedStyle ?? '') + OVERLAY);
    input.addEventListener('input', this._onInput);
    input.addEventListener('focus', this._onFocus);
    input.addEventListener('blur', this._onBlur);
    input.addEventListener('keyup', this._sync);
    input.addEventListener('click', this._sync);
    input.addEventListener('select', this._sync);
    this._form = input.form;
    this._form?.addEventListener('reset', this._onReset);
    this._observer = new MutationObserver(() => this._sync());
    this._observer.observe(input, { attributes: true });
    this._last = input.value;
    this.#enhanced.set(true);
    this._sync();
    return true;
  }

  // A part connected after the input (a client render appends children in
  // order) asks to be drawn.
  _partConnected(): void {
    if (this.#enhanced.get()) queueMicrotask(() => this._sync());
  }

  render() {
    const disabled = !!this.input?.disabled;
    return html`<div data-slot="input-otp" ?data-disabled=${disabled} class=${inputOtpClass()}><slot></slot></div>`;
  }

  _slots(): UiInputOtpSlot[] {
    return Array.from(this.querySelectorAll<UiInputOtpSlot>(`${ROOT}-slot`));
  }

  _pattern(): RegExp | null {
    const p = this.input?.getAttribute('pattern');
    if (!p) return null;
    // HTML compiles `pattern` with the v flag; an engine without it gets u.
    for (const flags of ['v', 'u']) {
      try { return new RegExp(`^(?:${p})$`, flags); } catch { /* next */ }
    }
    return null;
  }

  // Refuse an edit that breaks the pattern or the length, as input-otp does.
  _onInput = (): void => {
    const input = this.input;
    if (!input) return;
    const re = this._pattern();
    const v = input.value;
    if ((re && v && !re.test(v)) || v.length > this.maxLength) {
      const at = Math.max(0, (input.selectionStart ?? this._last.length) - (v.length - this._last.length));
      input.value = this._last;
      input.setSelectionRange(at, at);
      this._sync();
      return;
    }
    if (v !== this._last) {
      this._last = v;
      this.dispatchEvent(new CustomEvent('ui-value-change', { bubbles: true, detail: { value: v } }));
      if (v.length === this.maxLength) {
        this.dispatchEvent(new CustomEvent('ui-complete', { bubbles: true, detail: { value: v } }));
      }
    }
    this._sync();
  };

  _onFocus = (): void => {
    this._focused = true;
    document.addEventListener('selectionchange', this._sync);
    // Typing continues the code, so the caret starts at its end.
    const input = this.input;
    if (input) {
      queueMicrotask(() => {
        const end = input.value.length;
        input.setSelectionRange(end, end);
        this._sync();
      });
    }
    this._sync();
  };

  _onBlur = (): void => {
    this._focused = false;
    document.removeEventListener('selectionchange', this._sync);
    this._sync();
  };

  _onReset = (): void => {
    queueMicrotask(() => { this._last = this.input?.value ?? ''; this._sync(); });
  };

  // Push the value, the caret and the state into every drawn part. It runs
  // several times per keystroke (input, keyup, each selectionchange), so it
  // hands a part new state only when something it draws changed: every
  // attribute write re-checks the page's :has() rules, and a page carrying
  // the kit's styles has hundreds of them, which made each keystroke wait on
  // style recalculation.
  _sync = (): void => {
    const input = this.input;
    if (!input || !this.#enhanced.get()) return;
    const value = input.value;
    const max = this.maxLength;
    const start = Math.min(input.selectionStart ?? value.length, max - 1);
    const end = input.selectionEnd ?? start;
    const invalid = input.getAttribute('aria-invalid') === 'true';
    this._slots().forEach((slot) => {
      const i = Number(slot.index);
      const char = value[i] ?? '';
      const active = this._focused && (end > start ? i >= start && i < end : i === start);
      const next = { shown: true, char, active, caret: active && !char, invalid };
      // A slot not upgraded yet has no state signal; the next sync reaches it.
      const s = slot.state?.get();
      if (s && (s.shown !== next.shown || s.char !== next.char || s.active !== next.active || s.caret !== next.caret || s.invalid !== next.invalid)) {
        slot.state?.set(next);
      }
    });
    this.querySelectorAll<UiInputOtpGroup | UiInputOtpSeparator>(`${ROOT}-group, ${ROOT}-separator`).forEach((part) => {
      if (!part.shown?.get()) part.shown?.set(true);
    });
    const disabled = !!input.disabled;
    if (disabled !== this._disabled) {
      this._disabled = disabled;
      this.requestUpdate();
    }
  };
}
UiInputOtp.register('ui-input-otp');

// --------------------------------------------------------------------------
// <ui-input-otp-group>
// --------------------------------------------------------------------------

export class UiInputOtpGroup extends WebComponent {
  readonly shown = signal(false);
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    (this.closest(ROOT) as UiInputOtp | null)?._partConnected();
  }

  render() {
    return html`<div data-slot="input-otp-group" ?hidden=${!this.shown.get()} class=${inputOtpGroupClass()}><slot></slot></div>`;
  }
}
UiInputOtpGroup.register('ui-input-otp-group');

// --------------------------------------------------------------------------
// <ui-input-otp-slot>
// --------------------------------------------------------------------------

type SlotState = { shown: boolean; char: string; active: boolean; caret: boolean; invalid: boolean };

export class UiInputOtpSlot extends WebComponent({
  index: Number,
}) {
  readonly state = signal<SlotState>({ shown: false, char: '', active: false, caret: false, invalid: false });
  _authored: string | null = null;

  constructor() {
    super();
    this.index = 0;
  }

  connectedCallback(): void {
    // The author's own classes, read once: later the host carries ours too.
    this._authored = takeAuthoredClass(this);
    super.connectedCallback?.();
    (this.closest(ROOT) as UiInputOtp | null)?._partConnected();
  }

  // shadcn's slot classes use first: / last: for the joined corners, which
  // only work on the elements that are siblings in the group: the slot hosts
  // themselves, not a box inside each. So the slot styles its own host.
  // Each write is guarded: an attribute set to the value it already has still
  // invalidates style, and the page re-checks its :has() rules for it.
  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    const s = this.state.get();
    const set = (name: string, value: string | null) => {
      if (this.getAttribute(name) === value) return;
      if (value === null) this.removeAttribute(name);
      else this.setAttribute(name, value);
    };
    set('class', [inputOtpSlotClass(), this._authored].filter(Boolean).join(' '));
    set('data-slot', 'input-otp-slot');
    set('data-active', s.active ? 'true' : 'false');
    set('aria-hidden', 'true');
    set('aria-invalid', s.invalid ? 'true' : null);
    if (this.hidden !== !s.shown) this.hidden = !s.shown;
  }

  // The caret is always in the slot and only its class changes. Inserting or
  // removing an element makes the browser re-check every :has() rule on the
  // page, which on a page carrying the kit's styles took longer than a frame
  // on each keystroke; a class change on a leaf is nearly free.
  render() {
    const s = this.state.get();
    return html`${s.char}<div class=${s.caret ? inputOtpCaretClass() : 'hidden'}><div class=${inputOtpCaretLineClass()}></div></div>`;
  }
}
UiInputOtpSlot.register('ui-input-otp-slot');

// --------------------------------------------------------------------------
// <ui-input-otp-separator>
// --------------------------------------------------------------------------

export class UiInputOtpSeparator extends WebComponent {
  readonly shown = signal(false);
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    (this.closest(ROOT) as UiInputOtp | null)?._partConnected();
  }

  render() {
    return html`<div data-slot="input-otp-separator" role="separator" aria-hidden="true" ?hidden=${!this.shown.get()} class=${inputOtpSeparatorClass()}><svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    ><path d="M5 12h14"></path></svg></div>`;
  }
}
UiInputOtpSeparator.register('ui-input-otp-separator');
