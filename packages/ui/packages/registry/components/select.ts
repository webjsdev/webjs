import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Select primitives.
 *
 *   <ui-select value="apple">
 *     <ui-select-trigger>
 *       <ui-select-value placeholder="Choose..."></ui-select-value>
 *     </ui-select-trigger>
 *     <ui-select-content>
 *       <ui-select-item value="apple">Apple</ui-select-item>
 *       <ui-select-item value="banana">Banana</ui-select-item>
 *     </ui-select-content>
 *   </ui-select>
 *
 * Root holds the `value` attribute. Items dispatch ui-select-change to set it
 * and close the menu. Items derive their label from their text content;
 * the value display ui-select-value reflects whichever item's label matches
 * the current value.
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'bottom-start') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed', minWidth: `${(anchor as HTMLElement).offsetWidth}px` });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

export class UiSelect extends WebComponent {
  static properties = { value: { type: String, reflect: true }, open: { type: Boolean, reflect: true } };
  declare value: string; declare open: boolean;

  constructor() { super(); this.value = ''; this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-select-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-select-close', this._onClose as EventListener);
    this.addEventListener('ui-select-change', this._onChange as EventListener);
    queueMicrotask(() => this._refreshValue());
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-select-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-select-close', this._onClose as EventListener);
    this.removeEventListener('ui-select-change', this._onChange as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);
  _onChange = (e: any) => {
    this.value = e.detail.value;
    this._refreshValue();
    this.setOpen(false);
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true }));
  };

  _refreshValue() {
    // Find item with matching value, get its label
    const item = this.querySelector(`ui-select-item[value="${CSS.escape(this.value)}"]`) as HTMLElement | null;
    const label = item ? item.textContent?.trim() ?? '' : '';
    this.querySelectorAll('ui-select-value').forEach((v) => {
      const ph = (v as HTMLElement).getAttribute('placeholder') || '';
      (v as HTMLElement).textContent = label || ph;
      if (label) (v as HTMLElement).removeAttribute('data-placeholder');
      else (v as HTMLElement).setAttribute('data-placeholder', '');
    });
    // Sync item indicator state
    this.querySelectorAll('ui-select-item').forEach((it) => {
      const v = it.getAttribute('value') || '';
      it.setAttribute('data-state', v === this.value ? 'checked' : 'unchecked');
    });
  }

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-select-trigger, ui-select-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
    this.querySelectorAll('ui-select-trigger button').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  }

  render() { return html`<slot></slot>`; }

  static get observedAttributes() { return ['value']; }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    if (name === 'value' && oldVal !== newVal) this._refreshValue();
  }
}
UiSelect.register('ui-select');

export class UiSelectTrigger extends WebComponent {
  static properties = { size: { type: String } };
  declare size: string;
  private _slot = '';
  constructor() { super(); this.size = 'default'; }
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-select-toggle', { bubbles: true })));
  }
  render() {
    const cls = "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";
    return html`
      <button type="button" data-slot="select-trigger" data-size=${this.size} data-state=${this.getAttribute('data-state') || 'closed'} aria-haspopup="listbox" class=${cn(cls)}>
        ${unsafeHTML(this._slot)}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 opacity-50"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiSelectTrigger.register('ui-select-trigger');

export class UiSelectValue extends WebComponent {
  static properties = { placeholder: { type: String } };
  declare placeholder: string;
  constructor() { super(); this.placeholder = ''; }
  connectedCallback() {
    super.connectedCallback();
    // initial render shows placeholder; <ui-select> overwrites textContent
    if (!this.textContent) this.textContent = this.placeholder;
  }
  render() { return html`<span data-slot="select-value" data-placeholder=""><slot></slot></span>`; }
}
UiSelectValue.register('ui-select-value');

export class UiSelectContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;
  private _cleanupOutside: (() => void) | null = null;
  private _onKey: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  disconnectedCallback() { super.disconnectedCallback(); this._teardown(); }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state === 'open') this._show(); else this._teardown();
  }

  _show() {
    if (this._portal) return;
    const root = this.closest('ui-select') as HTMLElement | null;
    const trigger = root?.querySelector('ui-select-trigger') as HTMLElement | null;
    if (!root || !trigger) return;

    const el = document.createElement('div');
    el.setAttribute('role', 'listbox');
    el.setAttribute('data-slot', 'select-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('relative z-50 max-h-96 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    // Wrap items in a viewport pad
    el.innerHTML = `<div class="p-1" data-slot="select-viewport">${this._slot}</div>`;
    document.body.appendChild(el);
    this._portal = el;
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, 'bottom-start'));

    // sync indicator state from root.value
    const rootValue = (root as any).value as string;
    el.querySelectorAll('ui-select-item').forEach((it) => {
      const v = it.getAttribute('value') || '';
      it.setAttribute('data-state', v === rootValue ? 'checked' : 'unchecked');
    });

    const outside = (e: PointerEvent) => {
      const path = e.composedPath();
      if (!path.includes(el) && !path.includes(trigger)) {
        root.dispatchEvent(new CustomEvent('ui-select-close', { bubbles: true }));
      }
    };
    document.addEventListener('pointerdown', outside);
    this._cleanupOutside = () => document.removeEventListener('pointerdown', outside);

    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { root.dispatchEvent(new CustomEvent('ui-select-close', { bubbles: true })); return; }
      const items = Array.from(el.querySelectorAll<HTMLElement>('ui-select-item'));
      if (!items.length) return;
      const current = document.activeElement as HTMLElement;
      let idx = items.indexOf(current);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; items[idx].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? items.length - 1 : idx - 1; items[idx].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (current as HTMLElement)?.click?.(); }
    };
    document.addEventListener('keydown', this._onKey);

    queueMicrotask(() => {
      const selected = el.querySelector<HTMLElement>('ui-select-item[data-state="checked"]') || el.querySelector<HTMLElement>('ui-select-item');
      selected?.focus();
    });
  }

  _teardown() {
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    this._cleanupOutside?.(); this._cleanupOutside = null;
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiSelectContent.register('ui-select-content');

export class UiSelectItem extends WebComponent {
  static properties = { value: { type: String }, disabled: { type: Boolean } };
  declare value: string; declare disabled: boolean;
  private _slot = '';
  constructor() { super(); this.value = ''; this.disabled = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
    this.setAttribute('tabindex', '-1');
    this.addEventListener('click', () => {
      if (this.disabled) return;
      this.dispatchEvent(new CustomEvent('ui-select-change', { detail: { value: this.value }, bubbles: true }));
    });
  }
  render() {
    const cls = "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";
    const checked = this.getAttribute('data-state') === 'checked';
    return html`
      <div data-slot="select-item" data-state=${this.getAttribute('data-state') || 'unchecked'} data-disabled=${this.disabled ? '' : null as any} role="option" aria-selected=${String(checked)} tabindex="-1" class=${cn(cls)}>
        <span data-slot="select-item-indicator" class="absolute right-2 flex size-3.5 items-center justify-center">
          ${checked ? html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="20 6 9 17 4 12"/></svg>` : html``}
        </span>
        <span>${unsafeHTML(this._slot)}</span>
      </div>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiSelectItem.register('ui-select-item');

function makeChild(tag: string, slot: string, classes: string, role?: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
    render() {
      return role
        ? html`<div data-slot=${slot} role=${role} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`
        : html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`;
    }
  }
  C.register(tag);
  return C;
}

export const UiSelectGroup = makeChild('ui-select-group', 'select-group', '', 'group');
export const UiSelectLabel = makeChild('ui-select-label', 'select-label', 'px-2 py-1.5 text-xs text-muted-foreground');
export const UiSelectSeparator = makeChild('ui-select-separator', 'select-separator', 'pointer-events-none -mx-1 my-1 h-px bg-border', 'separator');

// Scroll buttons — v1 stubs (no actual virtual scrolling).
export class UiSelectScrollUpButton extends WebComponent {
  render() { return html`<div data-slot="select-scroll-up-button" class=${cn('flex cursor-default items-center justify-center py-1')}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m18 15-6-6-6 6"/></svg></div>`; }
}
UiSelectScrollUpButton.register('ui-select-scroll-up-button');

export class UiSelectScrollDownButton extends WebComponent {
  render() { return html`<div data-slot="select-scroll-down-button" class=${cn('flex cursor-default items-center justify-center py-1')}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6"/></svg></div>`; }
}
UiSelectScrollDownButton.register('ui-select-scroll-down-button');
