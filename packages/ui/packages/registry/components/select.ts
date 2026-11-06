/**
 * Select: a styled single-choice picker that ENHANCES a native `<select>`.
 * Tier-2. You author an ordinary `<select>` with its options inside
 * `<ui-select>`. Without JavaScript that select is what the page shows and
 * what the form submits. With JavaScript the element hides it (visually only:
 * it still submits, validates and resets with its form) and draws shadcn's
 * trigger and listbox in its place, writing every choice back into it.
 *
 * shadcn parity:
 *   Select                   → <ui-select placeholder size position>
 *   SelectTrigger (size)     → drawn by the element (`size="sm" | "default"`)
 *   SelectValue placeholder  → the `placeholder` attribute, or a placeholder <option>
 *   SelectContent            → drawn by the element (`position="item-aligned"`, the
 *                              default, opens over the trigger on the chosen option;
 *                              `"popper"` opens below it)
 *   SelectGroup + SelectLabel→ <optgroup label="...">
 *   SelectItem               → <option value="...">
 *   SelectSeparator          → <hr> between options
 *   SelectScrollUp/DownButton→ drawn when the list overflows
 *   onValueChange            → `ui-value-change` ({ detail: { value } }); the
 *                              native select also fires `input` and `change`
 *
 * The options stay native elements because the HTML parser drops a custom
 * element inside a `<select>`. A placeholder option is one with `value=""`
 * that is `hidden` or `disabled`: it is not listed, and its text is the
 * placeholder unless the `placeholder` attribute names one.
 *
 * Keyboard (as Radix's): on the trigger, ArrowDown / ArrowUp, Enter or Space
 * open the list on the selected option, and typing selects the first option
 * starting with what was typed, as a native select does. In the open list,
 * ArrowDown / ArrowUp / Home / End move, typing jumps, Enter or Space choose,
 * Escape closes without a change, and Tab chooses the focused option and
 * moves on (the WAI-ARIA select-only combobox pattern). Every close returns
 * focus to the trigger.
 *
 * A11y (handled by the element, plus your part): the trigger is a
 * `role="combobox"` button with `aria-haspopup="listbox"`, `aria-expanded` and
 * `aria-controls`, named by the select's `<label>`s (a label click focuses the
 * trigger) or its `aria-label`, and it carries the select's
 * `aria-describedby` and `aria-invalid`. The list is a `role="listbox"` of
 * `role="option"` items with `aria-selected`, an `<optgroup>` is a named
 * `role="group"`, and a disabled option is skipped. When a `required` select
 * fails validation the trigger takes `aria-invalid="true"` and focus. Your
 * part: a real `<label for>` on the select, and the field's error text wired
 * through `aria-describedby` on the select as for any control.
 *
 * Style the native select for the no-JavaScript paint: `selectTriggerClass()`
 * gives it the trigger's look with the browser's own arrow.
 *
 * @example
 * ```html
 * <label for="fruit" class=${labelClass()}>Fruit</label>
 * <ui-select placeholder="Select a fruit">
 *   <select id="fruit" name="fruit" class=${selectTriggerClass()}>
 *     <option value="" disabled selected hidden>Select a fruit</option>
 *     <optgroup label="Fruits">
 *       <option value="apple">Apple</option>
 *       <option value="banana">Banana</option>
 *       <option value="grapes" disabled>Grapes</option>
 *     </optgroup>
 *     <hr>
 *     <option value="pineapple">Pineapple</option>
 *   </select>
 * </ui-select>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { ensureId } from '../lib/utils.ts';
import { positionFloating } from './popover.ts';

/** The trigger's classes: the element's drawn trigger, and the native select's no-JavaScript look. */
export const selectTriggerClass = (): string =>
  'cn-select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** The trigger's chevron. */
export const selectTriggerIconClass = (): string =>
  'cn-select-trigger-icon pointer-events-none';
/** The listbox panel's classes (the element applies them). */
export const selectContentClass = (): string =>
  'cn-select-content z-50 max-h-(--radix-select-content-available-height) overflow-x-hidden overflow-y-auto';
/** The listbox's inner viewport (the element applies them). */
export const selectViewportClass = (): string =>
  'cn-select-viewport data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)';
/** A group's classes (the element applies them). */
export const selectGroupClass = (): string => 'cn-select-group';
/** A group label's classes (the element applies them). */
export const selectLabelClass = (): string => 'cn-select-label';
/** An option's classes (the element applies them). */
export const selectItemClass = (): string =>
  'cn-select-item relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** The selected option's check mark slot. */
export const selectItemIndicatorClass = (): string => 'cn-select-item-indicator';
/** The selected option's check mark. */
export const selectItemIndicatorIconClass = (): string =>
  'cn-select-item-indicator-icon pointer-events-none';
/** A separator's classes (the element applies them). */
export const selectSeparatorClass = (): string =>
  'cn-select-separator pointer-events-none';
/** The scroll-up affordance, shown when the list overflows above. */
export const selectScrollUpButtonClass = (): string =>
  'cn-select-scroll-up-button sticky top-0 z-10 bg-inherit';
/** The scroll-down affordance, shown when the list overflows below. */
export const selectScrollDownButtonClass = (): string =>
  'cn-select-scroll-down-button sticky bottom-0 z-10 bg-inherit';

type Entry =
  | { kind: 'option'; index: number; value: string; label: string; disabled: boolean }
  | { kind: 'group'; label: string; options: Entry[] }
  | { kind: 'separator' };

// The visual-only hide Radix uses for its form control: still focusable for a
// validation bubble, still submitted and reset with the form.
const HIDDEN_CONTROL =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;opacity:0;pointer-events:none;overflow:hidden;';

let uid = 0;

export class UiSelect extends WebComponent({
  placeholder: String,
  size: prop<'default' | 'sm'>(String),
  position: prop<'popper' | 'item-aligned'>(String),
  open: prop(Boolean, { reflect: true }),
  // Set once the element has taken over from the native select.
  enhanced: prop<boolean>({ state: true }),
  // Bumped whenever the native select changes under the element.
  revision: prop<number>({ state: true }),
  // A failed constraint check, until the value is valid again.
  invalid: prop<boolean>({ state: true }),
}) {
  _id = '';
  _observer: MutationObserver | null = null;
  _waiting: MutationObserver | null = null;
  _form: HTMLFormElement | null = null;
  _savedStyle: string | null = null;
  _focusLast = false;
  _typeBuffer = '';
  _typeTimer = 0;
  _scrollTimer = 0;

  constructor() {
    super();
    this.placeholder = '';
    this.size = 'default';
    this.position = 'item-aligned';
    this.open = false;
    this.enhanced = false;
    this.revision = 0;
    this.invalid = false;
  }

  /** The native select this element enhances. */
  get select(): HTMLSelectElement | null {
    return this.querySelector('select');
  }

  /** The chosen value, as the native select holds it. */
  get value(): string {
    return this.select?.value ?? '';
  }

  set value(v: string) {
    const select = this.select;
    if (!select) return;
    select.value = v;
    this.revision++;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-select-${++uid}`;
    // A client render can connect the element before appending the authored
    // select, so wait for it to arrive.
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
    this._waiting = null;
    this._observer?.disconnect();
    this._observer = null;
    const select = this.select;
    if (select) {
      select.removeEventListener('change', this._onNativeChange);
      select.removeEventListener('focus', this._onNativeFocus);
      select.removeEventListener('invalid', this._onInvalid);
      if (this._savedStyle !== null) select.setAttribute('style', this._savedStyle);
      else select.removeAttribute('style');
      select.removeAttribute('aria-hidden');
      select.removeAttribute('tabindex');
    }
    this._form?.removeEventListener('reset', this._onReset);
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    clearInterval(this._scrollTimer);
    super.disconnectedCallback?.();
  }

  /** Take over from the native select. True once it has (or already had). */
  _enhance(): boolean {
    if (this.enhanced) return true;
    const select = this.select;
    if (!select) return false;
    this._savedStyle = select.getAttribute('style');
    select.setAttribute('style', (this._savedStyle ?? '') + HIDDEN_CONTROL);
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.addEventListener('change', this._onNativeChange);
    select.addEventListener('focus', this._onNativeFocus);
    select.addEventListener('invalid', this._onInvalid);
    this._form = select.form;
    this._form?.addEventListener('reset', this._onReset);
    this._observer = new MutationObserver(() => { this.revision++; });
    this._observer.observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
    this.enhanced = true;
    return true;
  }

  // The select changed under the element: an option edit, a form reset, or a
  // script setting its value.
  _onNativeChange = (): void => {
    if (this.invalid && this.select?.checkValidity()) this.invalid = false;
    this.revision++;
  };

  // A reset restores the value AFTER its event, so read it a tick later.
  _onReset = (): void => {
    queueMicrotask(() => { this.invalid = false; this.revision++; });
  };

  // The hidden select takes focus from its label and from a failed submit;
  // either way the user means the trigger.
  _onNativeFocus = (): void => {
    this._trigger()?.focus();
  };

  _onInvalid = (): void => {
    this.invalid = true;
    this._trigger()?.focus();
  };

  _trigger(): HTMLButtonElement | null {
    return this.querySelector('[data-slot="select-trigger"]');
  }

  _panel(): HTMLElement | null {
    return this.querySelector('[data-slot="select-content"]');
  }

  _optionEls(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[data-slot="select-item"]'));
  }

  _enabledOptionEls(): HTMLElement[] {
    return this._optionEls().filter((o) => !o.hasAttribute('data-disabled'));
  }

  static _isPlaceholder(o: HTMLOptionElement): boolean {
    return o.value === '' && (!!o.hidden || o.disabled);
  }

  _entries(): Entry[] {
    const select = this.select;
    if (!select) return [];
    const options = Array.from(select.options);
    const toOption = (o: HTMLOptionElement): Entry | null =>
      UiSelect._isPlaceholder(o)
        ? null
        : { kind: 'option', index: options.indexOf(o), value: o.value, label: o.label || o.text, disabled: o.disabled || !!(o.parentElement as HTMLOptGroupElement | null)?.disabled };
    const out: Entry[] = [];
    for (const child of Array.from(select.children)) {
      if (child instanceof HTMLOptionElement) {
        const e = toOption(child);
        if (e) out.push(e);
      } else if (child instanceof HTMLOptGroupElement) {
        const opts = Array.from(child.children)
          .filter((c): c is HTMLOptionElement => c instanceof HTMLOptionElement)
          .map(toOption)
          .filter((e): e is Entry => !!e);
        out.push({ kind: 'group', label: child.label, options: opts });
      } else if (child.tagName === 'HR') {
        out.push({ kind: 'separator' });
      }
    }
    return out;
  }

  _placeholderText(): string {
    if (this.placeholder) return this.placeholder;
    const select = this.select;
    const p = select ? Array.from(select.options).find((o) => UiSelect._isPlaceholder(o)) : undefined;
    return p?.text ?? '';
  }

  render() {
    if (!this.enhanced) {
      return html`<div data-slot="select" class="relative"><slot></slot></div>`;
    }
    void this.revision;
    const select = this.select;
    const current = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    const shown = current && !UiSelect._isPlaceholder(current) ? current : null;
    const labels = select?.labels ? Array.from(select.labels).map((l) => ensureId(l, 'ui-select-label')) : [];
    const invalid = this.invalid || select?.getAttribute('aria-invalid') === 'true';
    const listId = `${this._id}-listbox`;
    const renderEntry = (e: Entry): unknown => {
      if (e.kind === 'separator') {
        return html`<div data-slot="select-separator" aria-hidden="true" class=${selectSeparatorClass()}></div>`;
      }
      if (e.kind === 'group') {
        const labelId = `${this._id}-group-${e.label.replace(/\W+/g, '-')}`;
        return html`<div data-slot="select-group" role="group" aria-labelledby=${labelId} class=${selectGroupClass()}><div
          data-slot="select-label" id=${labelId} class=${selectLabelClass()}>${e.label}</div>${e.options.map(renderEntry)}</div>`;
      }
      const selected = !!shown && shown.index === e.index;
      return html`<div
        data-slot="select-item"
        role="option"
        id=${`${this._id}-option-${e.index}`}
        tabindex="-1"
        data-value=${e.value}
        aria-selected=${selected ? 'true' : 'false'}
        data-state=${selected ? 'checked' : 'unchecked'}
        aria-disabled=${e.disabled ? 'true' : null}
        ?data-disabled=${e.disabled}
        class=${selectItemClass()}
        @click=${() => this._choose(e.index)}
        @pointermove=${this._onOptionPointerMove}
      ><span data-slot="select-item-indicator" class=${selectItemIndicatorClass()}>${selected
        ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${selectItemIndicatorIconClass()}><path d="M20 6 9 17l-5-5"></path></svg>`
        : ''}</span><span>${e.label}</span></div>`;
    };
    return html`<div data-slot="select" class="relative"><slot></slot><button
      type="button"
      data-slot="select-trigger"
      role="combobox"
      data-size=${this.size || 'default'}
      ?data-placeholder=${!shown}
      aria-haspopup="listbox"
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-controls=${listId}
      aria-labelledby=${labels.length ? labels.join(' ') : null}
      aria-label=${!labels.length && select?.getAttribute('aria-label') ? select.getAttribute('aria-label') : null}
      aria-describedby=${select?.getAttribute('aria-describedby') || null}
      aria-invalid=${invalid ? 'true' : null}
      aria-required=${select?.required ? 'true' : null}
      ?disabled=${!!select?.disabled}
      class=${selectTriggerClass()}
      @click=${this._onTriggerClick}
      @keydown=${this._onTriggerKeyDown}
    ><span data-slot="select-value">${shown ? shown.label || shown.text : this._placeholderText()}</span><svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      class=${selectTriggerIconClass()}
    ><path d="m6 9 6 6 6-6"></path></svg></button><div
      data-slot="select-content"
      id=${listId}
      role="listbox"
      popover="manual"
      aria-labelledby=${labels.length ? labels.join(' ') : null}
      data-state=${this.open ? 'open' : 'closed'}
      data-position=${this.position || 'item-aligned'}
      class=${selectContentClass()}
      @keydown=${this._onListKeyDown}
      @pointerdown=${this._onListPointerDown}
      @scroll=${this._syncScrollButtons}
    ><div data-slot="select-scroll-up-button" aria-hidden="true" hidden class=${selectScrollUpButtonClass()}
        @pointerenter=${() => this._autoScroll(-1)} @pointerleave=${this._stopScroll}
      ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"></path></svg></div><div
      data-slot="select-viewport" data-position=${this.position || 'item-aligned'} class=${selectViewportClass()}
    >${this._entries().map(renderEntry)}</div><div data-slot="select-scroll-down-button" aria-hidden="true" hidden class=${selectScrollDownButtonClass()}
        @pointerenter=${() => this._autoScroll(1)} @pointerleave=${this._stopScroll}
      ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></div></div></div>`;
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    if (!changedProperties.has('open') || changedProperties.get('open') === undefined) return;
    queueMicrotask(() => (this.open ? this._afterOpen() : this._afterClose()));
  }

  /** Open the list. */
  show(): void {
    if (this.select?.disabled) return;
    this.open = true;
  }

  /** Close the list, returning focus to the trigger if it was in the list. */
  hide(): void {
    const panel = this._panel();
    const active = document.activeElement;
    // Focus leaves the panel BEFORE it hides, or the engine drops it to <body>.
    if (panel && active && panel.contains(active)) this._trigger()?.focus();
    this.open = false;
  }

  _afterOpen(): void {
    const panel = this._panel() as (HTMLElement & { showPopover?: () => void }) | null;
    const trigger = this._trigger();
    if (!panel || !trigger) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    this._reposition();
    document.addEventListener('pointerdown', this._onDocPointerDown, true);
    window.addEventListener('resize', this._reposition);
    const enabled = this._enabledOptionEls();
    const selected = enabled.find((o) => o.getAttribute('aria-selected') === 'true');
    const target = selected ?? (this._focusLast ? enabled[enabled.length - 1] : enabled[0]);
    this._focusLast = false;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
    this._syncScrollButtons();
  }

  _afterClose(): void {
    const panel = this._panel() as (HTMLElement & { hidePopover?: () => void }) | null;
    if (panel && typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    window.removeEventListener('resize', this._reposition);
    this._stopScroll();
  }

  _reposition = (): void => {
    const panel = this._panel();
    const trigger = this._trigger();
    if (!panel || !trigger) return;
    const t = trigger.getBoundingClientRect();
    panel.style.setProperty('--radix-select-trigger-width', `${t.width}px`);
    panel.style.setProperty('--radix-select-trigger-height', `${t.height}px`);
    const room = Math.max(window.innerHeight - t.bottom, t.top) - 12;
    panel.style.setProperty('--radix-select-content-available-height', `${Math.max(room, 120)}px`);
    panel.style.minWidth = `${t.width}px`;
    if (this.position === 'popper') {
      positionFloating(trigger, panel, { side: 'bottom', align: 'start', sideOffset: 4 });
      return;
    }
    // item-aligned: open OVER the trigger, the chosen option's text lying on
    // the trigger's value text, as Radix does, kept inside the viewport.
    const option =
      this._optionEls().find((o) => o.getAttribute('aria-selected') === 'true') ??
      this._enabledOptionEls()[0];
    const valueEl = trigger.querySelector<HTMLElement>('[data-slot="select-value"]');
    if (!option || !valueEl) {
      positionFloating(trigger, panel, { side: 'bottom', align: 'start', sideOffset: 4 });
      return;
    }
    const p = panel.getBoundingClientRect();
    const o = option.getBoundingClientRect();
    const text = (option.lastElementChild as HTMLElement | null)?.getBoundingClientRect() ?? o;
    const v = valueEl.getBoundingClientRect();
    const margin = 10;
    let top = t.top + t.height / 2 - (o.top - p.top + o.height / 2);
    let left = v.left - (text.left - p.left);
    top = Math.max(margin, Math.min(top, window.innerHeight - p.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.setAttribute('data-side', 'none');
  };

  /** Choose the option at `index` in the native select, then close. */
  _choose(index: number): void {
    const select = this.select;
    if (!select) return;
    const option = select.options[index];
    if (!option || option.disabled) return;
    const changed = select.selectedIndex !== index;
    if (changed) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      this.dispatchEvent(new CustomEvent('ui-value-change', { bubbles: true, detail: { value: select.value } }));
    }
    this.revision++;
    if (this.open) this.hide();
  }

  _indexOf(optionEl: Element | null): number {
    const id = optionEl?.id ?? '';
    const m = /-option-(\d+)$/.exec(id);
    return m ? Number(m[1]) : -1;
  }

  _onTriggerClick = (): void => {
    if (this.open) this.hide();
    else this.show();
  };

  _onTriggerKeyDown = (e: KeyboardEvent): void => {
    if (this.open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this._focusLast = e.key === 'ArrowUp';
      this.show();
      return;
    }
    // Typing on a closed select picks, as the native control does.
    if (e.key.length === 1 && e.key !== ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const match = this._typeahead(e.key);
      if (match) this._choose(this._indexOf(match));
    }
  };

  _onListKeyDown = (e: KeyboardEvent): void => {
    const enabled = this._enabledOptionEls();
    const active = (document.activeElement as HTMLElement | null)?.closest('[data-slot="select-item"]') as HTMLElement | null;
    const i = active ? enabled.indexOf(active) : -1;
    const focus = (el: HTMLElement | undefined) => {
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); focus(enabled[Math.min(i + 1, enabled.length - 1)]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focus(enabled[Math.max(i - 1, 0)]); }
    else if (e.key === 'Home') { e.preventDefault(); focus(enabled[0]); }
    else if (e.key === 'End') { e.preventDefault(); focus(enabled[enabled.length - 1]); }
    else if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
    else if (e.key === 'Enter' || (e.key === ' ' && !this._typeBuffer)) {
      e.preventDefault();
      if (active) this._choose(this._indexOf(active));
    } else if (e.key === 'Tab') {
      // Choose and move on: focus goes back to the trigger here, then the
      // browser's own Tab advances from it.
      if (active) this._choose(this._indexOf(active));
      else this.hide();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const match = this._typeahead(e.key);
      if (match) { e.preventDefault(); focus(match); }
    }
  };

  _typeahead(key: string): HTMLElement | null {
    this._typeBuffer = (this._typeBuffer + key).toLowerCase();
    clearTimeout(this._typeTimer);
    this._typeTimer = window.setTimeout(() => { this._typeBuffer = ''; }, 500);
    const buffer = this._typeBuffer;
    return this._enabledOptionEls().find((o) => (o.textContent ?? '').trim().toLowerCase().startsWith(buffer)) ?? null;
  }

  // Pointing at an option focuses it, which is what highlights it.
  _onOptionPointerMove = (e: PointerEvent): void => {
    const option = e.currentTarget as HTMLElement;
    if (option.hasAttribute('data-disabled') || document.activeElement === option) return;
    option.focus({ preventScroll: true });
  };

  // A press inside the list must not blur the focused option first.
  _onListPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
  };

  _onDocPointerDown = (e: Event): void => {
    if (e.composedPath().includes(this)) return;
    this.hide();
  };

  _syncScrollButtons = (): void => {
    const panel = this._panel();
    if (!panel) return;
    const up = panel.querySelector<HTMLElement>('[data-slot="select-scroll-up-button"]');
    const down = panel.querySelector<HTMLElement>('[data-slot="select-scroll-down-button"]');
    if (up) up.hidden = panel.scrollTop <= 0;
    if (down) down.hidden = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
  };

  _autoScroll(dir: number): void {
    this._stopScroll();
    this._scrollTimer = window.setInterval(() => {
      const panel = this._panel();
      if (!panel) return;
      panel.scrollTop += dir * 16;
      this._syncScrollButtons();
    }, 30);
  }

  _stopScroll = (): void => {
    clearInterval(this._scrollTimer);
  };
}
UiSelect.register('ui-select');
