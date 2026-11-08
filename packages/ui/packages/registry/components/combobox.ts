/**
 * Combobox: a text input that filters a list of choices as you type, for one
 * value or, in chips mode, several. Tier-2. It follows Base UI's Combobox,
 * which shadcn builds on: typing filters the list, the arrow keys highlight
 * while focus stays in the input, Enter picks, and the choice lives in a real
 * form control, one `<input type="hidden" name>` per chosen value, so the
 * form submits it with or without JavaScript.
 *
 * shadcn parity:
 *   Combobox (multiple, value, disabled)
 *                            → <ui-combobox name multiple value disabled>
 *   ComboboxInput (showTrigger, showClear)
 *                            → <ui-combobox-input placeholder input-id show-trigger="false" show-clear>
 *   ComboboxContent (side, align, sideOffset)
 *                            → <ui-combobox-content side align side-offset>
 *   ComboboxList / ComboboxEmpty / ComboboxSeparator
 *                            → <ui-combobox-list> / <ui-combobox-empty> / <ui-combobox-separator>
 *   ComboboxGroup + ComboboxLabel
 *                            → <ui-combobox-group> + <ui-combobox-label>
 *   ComboboxItem value       → <ui-combobox-item value>
 *   ComboboxChips + ComboboxChip + ComboboxChipsInput
 *                            → <ui-combobox-chips> around <ui-combobox-chips-input>; the
 *                              chips are drawn from the chosen values
 *   onValueChange            → `ui-value-change` ({ detail: { value } }), a string, or a
 *                              string array with `multiple`
 *   onOpenChange             → `ui-open-change` ({ detail: { open } })
 *
 * `value` holds the initial choice: one value, or with `multiple` a comma
 * separated list. An item's label is its text. The list filters on labels,
 * case-insensitively, and the content carries `data-empty` when nothing
 * matches, which is what shows `<ui-combobox-empty>`.
 *
 * Keyboard (as Base UI's): ArrowDown / ArrowUp open the list and move the
 * highlight, Enter picks the highlighted item, Escape closes, Tab closes and
 * moves on. With `multiple`, picking toggles and keeps the list open, and
 * Backspace in an empty input removes the last chip. Leaving a single
 * combobox puts the chosen item's label back in the input.
 *
 * A11y (handled by the element, plus your part): the input is a
 * `role="combobox"` controlling a `role="listbox"` (multiselectable with
 * `multiple`), pointing at the highlighted `role="option"` through
 * `aria-activedescendant`; options carry `aria-selected`, a group is named by
 * its label, and each chip's remove button names the value it removes. Your
 * part: name the input, with `<label for>` matching `input-id`, or an
 * `aria-label` on the input part.
 *
 * @example
 * ```html
 * <label for="framework" class=${labelClass()}>Framework</label>
 * <ui-combobox name="framework">
 *   <ui-combobox-input input-id="framework" placeholder="Select a framework"></ui-combobox-input>
 *   <ui-combobox-content>
 *     <ui-combobox-empty>No items found.</ui-combobox-empty>
 *     <ui-combobox-list>
 *       <ui-combobox-item value="next">Next.js</ui-combobox-item>
 *       <ui-combobox-item value="sveltekit">SvelteKit</ui-combobox-item>
 *       <ui-combobox-item value="astro">Astro</ui-combobox-item>
 *     </ui-combobox-list>
 *   </ui-combobox-content>
 * </ui-combobox>
 * ```
 */
import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { positionFloating } from './floating.ts';
import type { PopoverSide, PopoverAlign } from './popover.ts';
import { buttonClass } from './button.ts';
import { inputGroupClass, inputGroupInputClass, inputGroupAddonClass, inputGroupButtonClass } from './input-group.ts';

/** The input group around a single combobox's input (the element applies them). */
export const comboboxInputClass = (): string => 'cn-combobox-input w-auto';
/** The trigger button (the element applies them). */
export const comboboxTriggerClass = (): string => 'cn-combobox-trigger';
/** The trigger's chevron. */
export const comboboxTriggerIconClass = (): string => 'cn-combobox-trigger-icon pointer-events-none';
/** The clear button (the element applies them). */
export const comboboxClearClass = (): string => 'cn-combobox-clear';
/** The clear button's icon. */
export const comboboxClearIconClass = (): string => 'cn-combobox-clear-icon pointer-events-none';
/** The popup's classes (the element applies them). */
export const comboboxContentClass = (): string =>
  'cn-combobox-content group/combobox-content z-50 max-h-(--available-height) origin-(--transform-origin) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] data-[chips=true]:min-w-(--anchor-width) not-open:hidden';
/** The list's classes (the element applies them). */
export const comboboxListClass = (): string => 'cn-combobox-list overflow-y-auto overscroll-contain';
/** An item's classes (the element applies them). */
export const comboboxItemClass = (): string =>
  'cn-combobox-item relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A chosen item's check mark slot. */
export const comboboxItemIndicatorClass = (): string => 'cn-combobox-item-indicator';
/** A chosen item's check mark. */
export const comboboxItemIndicatorIconClass = (): string => 'cn-combobox-item-indicator-icon pointer-events-none';
/** A group's classes (the element applies them). */
export const comboboxGroupClass = (): string => 'cn-combobox-group';
/** A group label's classes (the element applies them). */
export const comboboxLabelClass = (): string => 'cn-combobox-label';
/** The empty state's classes (the element applies them). */
export const comboboxEmptyClass = (): string => 'cn-combobox-empty';
/** A separator's classes (the element applies them). */
export const comboboxSeparatorClass = (): string => 'cn-combobox-separator';
/** The chips box (the element applies them). */
export const comboboxChipsClass = (): string => 'cn-combobox-chips';
/** One chip (the element applies them). */
export const comboboxChipClass = (): string =>
  'cn-combobox-chip has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50';
/** A chip's remove button (the element applies them). */
export const comboboxChipRemoveClass = (): string => 'cn-combobox-chip-remove';
/** A chip's remove icon. */
export const comboboxChipIndicatorIconClass = (): string => 'cn-combobox-chip-indicator-icon pointer-events-none';
/** The input inside the chips box (the element applies them). */
export const comboboxChipInputClass = (): string => 'cn-combobox-chip-input min-w-16 flex-1 outline-none';

const ROOT = 'ui-combobox';
let uid = 0;

function X_ICON(cls: string) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${cls}><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
}

export class UiCombobox extends WebComponent({
  name: String,
  multiple: Boolean,
  disabled: Boolean,
  value: String,
  open: prop(Boolean, { reflect: true }),
}) {
  // The chosen values (the form's view of `value`).
  #values = signal<string[]>([]);
  get values() { return this.#values.get(); }
  set values(v) { this.#values.set(v); }
  #query = signal('');
  get query() { return this.#query.get(); }
  set query(v) { this.#query.set(v); }
  #highlighted = signal('');
  get highlighted() { return this.#highlighted.get(); }
  set highlighted(v) { this.#highlighted.set(v); }
  _id = '';
  _parsed = false;

  constructor() {
    super();
    this.name = '';
    this.multiple = false;
    this.disabled = false;
    this.value = '';
    this.open = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-combobox-${++uid}`;
  }

  // Empty before connect (the server never connects an element), so the
  // served markup carries no `-list` id that every combobox would share.
  get listId(): string | null {
    return this._id ? `${this._id}-list` : null;
  }

  // The initial choice, read from the attribute once.
  _initial(): string[] {
    const v = this.value ?? '';
    if (!v) return [];
    return this.multiple ? v.split(',').map((s) => s.trim()).filter(Boolean) : [v];
  }

  willUpdate(changedProperties: Map<string, unknown>): void {
    super.willUpdate?.(changedProperties);
    if (!this._parsed) {
      this._parsed = true;
      this.values = this._initial();
    }
  }

  render() {
    const name = this.name;
    return html`<div data-slot="combobox" class="relative" @keydown=${this._onKeyDown} @focusout=${this._onFocusOut}><slot></slot>${name
      ? (this.values ?? []).map((v) => html`<input type="hidden" name=${name} value=${v}>`)
      : ''}</div>`;
  }

  _own<T extends Element>(selector: string): T[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<T>(selector)).filter((el) => el.closest(ROOT) === this);
  }

  _items(): UiComboboxItem[] {
    return this._own<UiComboboxItem>(`${ROOT}-item`);
  }

  /** The text field: the single input, or the input inside the chips box. */
  _input(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('input[data-slot="input-group-control"], input[data-slot="combobox-chip-input"]');
  }

  /**
   * What the popup sits against: the chips box, else the text field itself, as
   * Base UI's popup anchors to Combobox.Input. Its width is --anchor-width, so
   * the styles' `min-w-[calc(var(--anchor-width)+--spacing(7))]` adds back the
   * trigger button and the list spans the input group, as shadcn's does. (The
   * group as the anchor made the list a button's width wider than the field.)
   */
  _anchor(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="combobox-chips"]')
      ?? this.querySelector<HTMLElement>('input[data-slot="input-group-control"]')
      ?? this.querySelector<HTMLElement>('[data-slot="input-group"]');
  }

  _panel(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="combobox-content"]');
  }

  /** The label of the item with `value`, else the value itself. */
  labelOf(value: string): string {
    return this._items().find((i) => i.itemValue === value)?.label ?? value;
  }

  /** The items that match the typed text, in order. */
  visibleItems(): UiComboboxItem[] {
    const q = (this.query ?? '').trim().toLowerCase();
    return this._items().filter((i) => !q || i.label.toLowerCase().includes(q));
  }

  _emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  }

  show(): void {
    if (this.disabled || this.open) return;
    this.open = true;
    this._emit('ui-open-change', { open: true });
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this._emit('ui-open-change', { open: false });
  }

  /** Choose (or, with `multiple`, toggle) the item with `value`. */
  choose(value: string): void {
    const item = this._items().find((i) => i.itemValue === value);
    if (!item || item.disabled) return;
    const input = this._input();
    if (this.multiple) {
      const has = this.values.includes(value);
      this.values = has ? this.values.filter((v) => v !== value) : [...this.values, value];
      this.query = '';
      if (input) input.value = '';
    } else {
      this.values = [value];
      this.query = '';
      if (input) input.value = item.label;
      this.hide();
    }
    this._emit('ui-value-change', { value: this.multiple ? [...this.values] : value });
  }

  /**
   * Remove one chosen value. Not named `remove`: that would override the
   * native Element.remove(), so taking the element out of the page would
   * silently do nothing instead.
   */
  removeValue(value: string): void {
    if (!this.values.includes(value)) return;
    this.values = this.values.filter((v) => v !== value);
    this._emit('ui-value-change', { value: this.multiple ? [...this.values] : '' });
  }

  /** Clear every chosen value and the typed text. */
  clear(): void {
    const input = this._input();
    if (input) input.value = '';
    this.query = '';
    this.values = [];
    this._emit('ui-value-change', { value: this.multiple ? [] : '' });
    input?.focus();
  }

  _setQuery(text: string): void {
    this.query = text;
    this.show();
    // A new filter highlights its first match.
    const first = this.visibleItems().find((i) => !i.disabled);
    this.highlighted = first?.itemValue ?? '';
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    this._syncParts();
    if (changedProperties.has('open') && changedProperties.get('open') !== undefined) {
      queueMicrotask(() => (this.open ? this._afterOpen() : this._afterClose()));
    }
  }

  // Push the state into every part.
  _syncParts(): void {
    const visible = new Set(this.visibleItems());
    for (const item of this._items()) {
      item.state = {
        visible: visible.has(item),
        selected: this.values.includes(item.itemValue),
        highlighted: this.open && item.itemValue === this.highlighted && visible.has(item),
      };
    }
    for (const g of this._own<UiComboboxGroup>(`${ROOT}-group`)) {
      g.shown = this._items().some((i) => i.closest(`${ROOT}-group`) === g && visible.has(i));
    }
    const empty = visible.size === 0;
    for (const part of this._own<UiComboboxContent | UiComboboxList>(`${ROOT}-content, ${ROOT}-list`)) part.empty = empty;
    for (const content of this._own<UiComboboxContent>(`${ROOT}-content`)) content.open = this.open;
    for (const field of this._own<UiComboboxInput | UiComboboxChipsInput>(`${ROOT}-input, ${ROOT}-chips-input`)) {
      const h = this._items().find((i) => i.itemValue === this.highlighted && visible.has(i));
      field.state = { open: this.open, activeId: this.open && h ? h.optionId : '', hasValue: this.values.length > 0 };
    }
    for (const chips of this._own<UiComboboxChips>(`${ROOT}-chips`)) chips.chips = this.values.map((v) => ({ value: v, label: this.labelOf(v) }));
    // A single combobox shows its choice in the input until the user types.
    const input = this._input();
    if (input && !this.multiple && !this.open && !this.query) {
      const label = this.values[0] ? this.labelOf(this.values[0]) : '';
      if (input.value !== label && document.activeElement !== input) input.value = label;
    }
  }

  _afterOpen(): void {
    const panel = this._panel() as (HTMLElement & { showPopover?: () => void }) | null;
    const anchor = this._anchor();
    if (!panel || !anchor) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    this._reposition();
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    window.addEventListener('resize', this._reposition);
    if (!this.highlighted) {
      const start = this._items().find((i) => this.values.includes(i.itemValue) && !i.disabled)
        ?? this.visibleItems().find((i) => !i.disabled);
      this.highlighted = start?.itemValue ?? '';
    }
  }

  _afterClose(): void {
    const panel = this._panel() as (HTMLElement & { hidePopover?: () => void }) | null;
    if (panel && typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    window.removeEventListener('resize', this._reposition);
    this.highlighted = '';
    if (!this.multiple) this.query = '';
  }

  _reposition = (): void => {
    const panel = this._panel();
    const anchor = this._anchor();
    const host = this.querySelector(`${ROOT}-content`);
    if (!panel || !anchor || !host) return;
    const a = anchor.getBoundingClientRect();
    panel.style.setProperty('--anchor-width', `${a.width}px`);
    panel.style.setProperty('--available-width', `${window.innerWidth - 16}px`);
    panel.style.setProperty('--available-height', `${Math.max(window.innerHeight - a.bottom, a.top) - 12}px`);
    positionFloating(anchor, panel, {
      side: (host.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (host.getAttribute('align') ?? 'start') as PopoverAlign,
      sideOffset: Number(host.getAttribute('side-offset') ?? 6),
      alignOffset: Number(host.getAttribute('align-offset') ?? 0),
    });
  };

  _move(by: number): void {
    const enabled = this.visibleItems().filter((i) => !i.disabled);
    if (!enabled.length) return;
    const at = enabled.findIndex((i) => i.itemValue === this.highlighted);
    const next = at < 0 ? (by > 0 ? 0 : enabled.length - 1) : Math.max(0, Math.min(enabled.length - 1, at + by));
    this.highlighted = enabled[next].itemValue;
    enabled[next].scrollIntoViewIfShown();
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    const input = this._input();
    if (!input || e.target !== input || e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.open) { this.show(); return; }
      this._move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      if (!this.open || !this.highlighted) return;
      e.preventDefault();
      this.choose(this.highlighted);
    } else if (e.key === 'Escape') {
      if (!this.open) return;
      e.preventDefault();
      this.hide();
    } else if (e.key === 'Tab') {
      this.hide();
    } else if (e.key === 'Backspace' && this.multiple && !input.value && this.values.length) {
      this.removeValue(this.values[this.values.length - 1]);
    }
  };

  _onInput(text: string): void {
    this._setQuery(text);
  }

  _onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    this.hide();
    // Leaving a single combobox puts its choice back in the input.
    if (!this.multiple) {
      this.query = '';
      const input = this._input();
      if (input) input.value = this.values[0] ? this.labelOf(this.values[0]) : '';
    }
  };

  _onDocPointerDown = (e: Event): void => {
    if (e.composedPath().includes(this)) return;
    this.hide();
  };
}
UiCombobox.register('ui-combobox');

type FieldState = { open: boolean; activeId: string; hasValue: boolean };

function rootOf(el: Element): UiCombobox | null {
  return (typeof el.closest === 'function' ? el.closest(ROOT) : null) as UiCombobox | null;
}

// A part connected after the root's first update (a client render appends
// children in order) asks the root to push its state again.
function announce(el: Element): void {
  const root = rootOf(el);
  if (root) queueMicrotask(() => root.requestUpdate?.());
}

// --------------------------------------------------------------------------
// <ui-combobox-input>
// --------------------------------------------------------------------------

export class UiComboboxInput extends WebComponent({
  placeholder: String,
  inputId: prop(String, { attribute: 'input-id' }),
  showTrigger: prop(String, { attribute: 'show-trigger' }),
  showClear: prop(Boolean, { attribute: 'show-clear' }),
  // The field state an author writes on the host belongs on the input, the
  // focusable control, as shadcn passes ComboboxInput's props to its input:
  // `aria-invalid` for the error look and the announcement, and
  // `aria-describedby` for the error text. Observed, so a re-validation that
  // changes them reaches the input.
  invalid: prop(String, { attribute: 'aria-invalid' }),
  describedBy: prop(String, { attribute: 'aria-describedby' }),
}) {
  #state = signal<FieldState>({ open: false, activeId: '', hasValue: false });
  get state() { return this.#state.get(); }
  set state(v) { this.#state.set(v); }
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  constructor() {
    super();
    this.placeholder = '';
    this.inputId = '';
    this.invalid = '';
    this.describedBy = '';
    this.showTrigger = 'true';
    this.showClear = false;
  }

  render() {
    const root = rootOf(this);
    const s = this.state;
    const disabled = !!root?.disabled;
    return html`<div data-slot="input-group" class=${cn(inputGroupClass(), comboboxInputClass())}><input
      data-slot="input-group-control"
      id=${this.inputId || null}
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded=${s.open ? 'true' : 'false'}
      aria-controls=${root?.listId || null}
      aria-activedescendant=${s.activeId || null}
      aria-label=${this.getAttribute?.('aria-label') || null}
      aria-invalid=${this.invalid === 'true' ? 'true' : null}
      aria-describedby=${this.describedBy || null}
      placeholder=${this.placeholder || null}
      ?disabled=${disabled}
      class=${inputGroupInputClass()}
      @input=${(e: Event) => rootOf(this)?._onInput((e.target as HTMLInputElement).value)}
      @click=${() => rootOf(this)?.show()}
    ><div data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>${this.showTrigger !== 'false'
      ? html`<button
          type="button"
          data-slot="input-group-button"
          tabindex="-1"
          aria-label="Open"
          ?disabled=${disabled}
          class=${cn(buttonClass({ variant: 'ghost' }), inputGroupButtonClass({ size: 'icon-xs' }), 'group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent', comboboxTriggerClass())}
          @click=${this._onTrigger}
        ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${comboboxTriggerIconClass()}><path d="m6 9 6 6 6-6"></path></svg></button>`
      : ''}${this.showClear && s.hasValue
      ? html`<button
          type="button"
          data-slot="combobox-clear"
          aria-label="Clear"
          ?disabled=${disabled}
          class=${cn(buttonClass({ variant: 'ghost' }), inputGroupButtonClass({ size: 'icon-xs' }), comboboxClearClass())}
          @click=${() => rootOf(this)?.clear()}
        >${X_ICON(comboboxClearIconClass())}</button>`
      : ''}</div></div>`;
  }

  _onTrigger = (): void => {
    const root = rootOf(this);
    if (!root) return;
    root._input()?.focus();
    if (root.open) root.hide();
    else root.show();
  };
}
UiComboboxInput.register('ui-combobox-input');

// --------------------------------------------------------------------------
// <ui-combobox-content> and <ui-combobox-list>
// --------------------------------------------------------------------------

export class UiComboboxContent extends WebComponent {
  #open = signal(false);
  get open() { return this.#open.get(); }
  set open(v) { this.#open.set(v); }
  #empty = signal(false);
  get empty() { return this.#empty.get(); }
  set empty(v) { this.#empty.set(v); }
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  constructor() {
    super();
  }

  render() {
    const chips = !!rootOf(this)?.querySelector?.('[data-slot="combobox-chips"]');
    return html`<div
      data-slot="combobox-content"
      popover="manual"
      data-state=${this.open ? 'open' : 'closed'}
      ?data-empty=${this.empty}
      data-chips=${chips ? 'true' : 'false'}
      class=${comboboxContentClass()}
      @pointerdown=${(e: PointerEvent) => { if (!(e.target as Element).closest('input')) e.preventDefault(); }}
    ><slot></slot></div>`;
  }
}
UiComboboxContent.register('ui-combobox-content');

export class UiComboboxList extends WebComponent {
  #empty = signal(false);
  get empty() { return this.#empty.get(); }
  set empty(v) { this.#empty.set(v); }
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  constructor() {
    super();
  }

  render() {
    const root = rootOf(this);
    return html`<div
      data-slot="combobox-list"
      role="listbox"
      id=${root?.listId || null}
      aria-multiselectable=${root?.multiple ? 'true' : null}
      ?data-empty=${this.empty}
      class=${comboboxListClass()}
    ><slot></slot></div>`;
  }
}
UiComboboxList.register('ui-combobox-list');

// --------------------------------------------------------------------------
// <ui-combobox-item>
// --------------------------------------------------------------------------

type ItemState = { visible: boolean; selected: boolean; highlighted: boolean };

export class UiComboboxItem extends WebComponent({
  value: String,
  disabled: Boolean,
}) {
  #state = signal<ItemState>({ visible: true, selected: false, highlighted: false });
  get state() { return this.#state.get(); }
  set state(v) { this.#state.set(v); }
  _id = '';

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-combobox-item-${++uid}`;
    announce(this);
  }

  get optionId(): string {
    return `${this._id}-option`;
  }

  /** The item's label: its text. */
  get label(): string {
    const text = this.querySelector?.('[data-slot="combobox-item-text"]')?.textContent ?? this.textContent ?? '';
    return text.trim();
  }

  /** The item's value: its `value` attribute, else its label. */
  get itemValue(): string {
    return this.value || this.label;
  }

  scrollIntoViewIfShown(): void {
    const option = this.querySelector?.<HTMLElement>('[role="option"]');
    if (option && typeof option.scrollIntoView === 'function') option.scrollIntoView({ block: 'nearest' });
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    this.hidden = !this.state.visible;
  }

  render() {
    const s = this.state;
    return html`<div
      data-slot="combobox-item"
      role="option"
      id=${this._id ? this.optionId : null}
      aria-selected=${s.selected ? 'true' : 'false'}
      ?data-selected=${s.selected}
      ?data-highlighted=${s.highlighted}
      aria-disabled=${this.disabled ? 'true' : null}
      ?data-disabled=${this.disabled}
      class=${comboboxItemClass()}
      @pointermove=${this._onPointerMove}
      @click=${this._onClick}
    ><span data-slot="combobox-item-text" class="cn-combobox-item-text"><slot></slot></span><span class=${comboboxItemIndicatorClass()}>${s.selected
      ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${comboboxItemIndicatorIconClass()}><path d="M20 6 9 17l-5-5"></path></svg>`
      : ''}</span></div>`;
  }

  _onPointerMove = (): void => {
    const root = rootOf(this);
    if (!root || this.disabled || this.state.highlighted) return;
    root.highlighted = this.itemValue;
  };

  _onClick = (): void => {
    rootOf(this)?.choose(this.itemValue);
  };
}
UiComboboxItem.register('ui-combobox-item');

// --------------------------------------------------------------------------
// <ui-combobox-group>, <ui-combobox-label>, <ui-combobox-empty>, <ui-combobox-separator>
// --------------------------------------------------------------------------

export class UiComboboxGroup extends WebComponent {
  #shown = signal(true);
  get shown() { return this.#shown.get(); }
  set shown(v) { this.#shown.set(v); }
  constructor() {
    super();
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    this.hidden = !this.shown;
  }

  /** The group's label, or null on the server, where there is no DOM to query. */
  _label(): Element | null {
    return typeof this.querySelector === 'function' ? this.querySelector('ui-combobox-label [data-slot="combobox-label"]') : null;
  }

  render() {
    const label = this._label();
    return html`<div data-slot="combobox-group" role="group" aria-labelledby=${label?.id || null} class=${comboboxGroupClass()}><slot></slot></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    // The label renders after the group, so name the group once it has.
    queueMicrotask(() => this.requestUpdate?.());
    announce(this);
  }
}
UiComboboxGroup.register('ui-combobox-group');

export class UiComboboxLabel extends WebComponent {
  _id = '';

  connectedCallback(): void {
    this._id ||= `ui-combobox-label-${++uid}`;
    super.connectedCallback?.();
  }

  render() {
    return html`<div data-slot="combobox-label" id=${this._id || null} class=${comboboxLabelClass()}><slot></slot></div>`;
  }
}
UiComboboxLabel.register('ui-combobox-label');

export class UiComboboxEmpty extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    return html`<div data-slot="combobox-empty" class=${comboboxEmptyClass()}><slot></slot></div>`;
  }
}
UiComboboxEmpty.register('ui-combobox-empty');

export class UiComboboxSeparator extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    return html`<div data-slot="combobox-separator" role="separator" class=${comboboxSeparatorClass()}></div>`;
  }
}
UiComboboxSeparator.register('ui-combobox-separator');

// --------------------------------------------------------------------------
// <ui-combobox-chips> and <ui-combobox-chips-input>
// --------------------------------------------------------------------------

export class UiComboboxChips extends WebComponent {
  #chips = signal<{ value: string; label: string }[]>([]);
  get chips() { return this.#chips.get(); }
  set chips(v) { this.#chips.set(v); }
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  constructor() {
    super();
  }

  render() {
    const root = rootOf(this);
    const disabled = !!root?.disabled;
    return html`<div data-slot="combobox-chips" class=${comboboxChipsClass()} @click=${this._focusInput}>${(this.chips ?? []).map((c) => html`<div
      data-slot="combobox-chip" class=${comboboxChipClass()}
    >${c.label}<button
      type="button"
      data-slot="combobox-chip-remove"
      aria-label=${`Remove ${c.label}`}
      ?disabled=${disabled}
      class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), comboboxChipRemoveClass())}
      @click=${(e: Event) => { e.stopPropagation(); rootOf(this)?.removeValue(c.value); rootOf(this)?._input()?.focus(); }}
    >${X_ICON(comboboxChipIndicatorIconClass())}</button></div>`)}<slot></slot></div>`;
  }

  _focusInput = (e: Event): void => {
    if ((e.target as Element).closest('button')) return;
    rootOf(this)?._input()?.focus();
  };
}
UiComboboxChips.register('ui-combobox-chips');

export class UiComboboxChipsInput extends WebComponent({
  placeholder: String,
  inputId: prop(String, { attribute: 'input-id' }),
}) {
  #state = signal<FieldState>({ open: false, activeId: '', hasValue: false });
  get state() { return this.#state.get(); }
  set state(v) { this.#state.set(v); }
  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  constructor() {
    super();
    this.placeholder = '';
    this.inputId = '';
  }

  render() {
    const root = rootOf(this);
    const s = this.state;
    return html`<input
      data-slot="combobox-chip-input"
      id=${this.inputId || null}
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded=${s.open ? 'true' : 'false'}
      aria-controls=${root?.listId || null}
      aria-activedescendant=${s.activeId || null}
      aria-label=${this.getAttribute?.('aria-label') || null}
      placeholder=${this.placeholder || null}
      ?disabled=${!!root?.disabled}
      class=${comboboxChipInputClass()}
      @input=${(e: Event) => rootOf(this)?._onInput((e.target as HTMLInputElement).value)}
      @click=${() => rootOf(this)?.show()}
    >`;
  }
}
UiComboboxChipsInput.register('ui-combobox-chips-input');
