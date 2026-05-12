import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import Fuse from 'fuse.js';
import { cn } from '../lib/utils.ts';

/**
 * Combobox — searchable select. Built on the popover + filter pattern.
 *
 *   <ui-combobox value="apple">
 *     <ui-combobox-trigger>
 *       <!-- shows selected label or placeholder -->
 *       <span data-placeholder>Pick a fruit</span>
 *     </ui-combobox-trigger>
 *     <ui-combobox-content>
 *       <ui-combobox-input placeholder="Search..."></ui-combobox-input>
 *       <ui-combobox-list>
 *         <ui-combobox-empty>No results.</ui-combobox-empty>
 *         <ui-combobox-item value="apple">Apple</ui-combobox-item>
 *         <ui-combobox-item value="banana">Banana</ui-combobox-item>
 *       </ui-combobox-list>
 *     </ui-combobox-content>
 *   </ui-combobox>
 *
 * Filtering is a simple case-insensitive substring match against the
 * item's textContent.
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'bottom-start') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed', minWidth: `${(anchor as HTMLElement).offsetWidth}px` });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

export class UiCombobox extends WebComponent {
  static properties = { value: { type: String, reflect: true }, open: { type: Boolean, reflect: true } };
  declare value: string; declare open: boolean;
  private _portal: HTMLElement | null = null;
  private _query = '';

  constructor() { super(); this.value = ''; this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-combobox-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-combobox-close', this._onClose as EventListener);
    this.addEventListener('ui-combobox-change', this._onChange as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);
  _onChange = (e: any) => {
    this.value = e.detail.value;
    this.setOpen(false);
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true }));
  };

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-combobox-trigger, ui-combobox-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }

  // Called by the input on each keystroke.
  filter(query: string) {
    this._query = query.toLowerCase();
    const content = this.querySelector('ui-combobox-content') as any;
    if (!content) return;
    content.applyFilter?.(this._query);
  }

  render() { return html`<slot></slot>`; }
}
UiCombobox.register('ui-combobox');

export class UiComboboxTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-combobox-toggle', { bubbles: true })));
  }
  render() {
    const cls = "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 h-9 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <button type="button" data-slot="combobox-trigger" data-state=${this.getAttribute('data-state') || 'closed'} class=${cn(cls)}>
        <span>${unsafeHTML(this._slot)}</span>
        <svg data-slot="combobox-trigger-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none size-4 text-muted-foreground"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiComboboxTrigger.register('ui-combobox-trigger');

export class UiComboboxContent extends WebComponent {
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

  // Called by <ui-combobox> on keystroke. Fuzzy ranking via fuse.js;
  // reorder via CSS `order:` so DOM stays stable.
  applyFilter(query: string) {
    if (!this._portal) return;
    const items = Array.from(this._portal.querySelectorAll<HTMLElement>('ui-combobox-item'));
    const q = (query || '').trim();
    let visible = 0;
    if (!q) {
      for (const it of items) { it.style.display = ''; it.style.order = ''; visible++; }
    } else {
      const fuse = new Fuse(
        items.map((it) => (it.getAttribute('data-value') || it.textContent || '').trim()),
        { includeScore: true, threshold: 0.4, ignoreLocation: true, minMatchCharLength: 1 },
      );
      const matches = fuse.search(q);
      const rank = new Map<number, number>();
      matches.forEach((m, r) => rank.set(m.refIndex, r));
      for (let i = 0; i < items.length; i++) {
        const r = rank.get(i);
        const show = r !== undefined;
        items[i].style.display = show ? '' : 'none';
        items[i].style.order = show ? String(r) : '';
        if (show) visible++;
      }
    }
    const empty = this._portal.querySelector<HTMLElement>('ui-combobox-empty');
    if (empty) empty.style.display = visible === 0 ? '' : 'none';
  }

  _show() {
    if (this._portal) return;
    const root = this.closest('ui-combobox') as HTMLElement | null;
    const trigger = root?.querySelector('ui-combobox-trigger') as HTMLElement | null;
    if (!root || !trigger) return;

    const el = document.createElement('div');
    el.setAttribute('data-slot', 'combobox-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('relative z-50 max-h-96 overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;

    // Hide empty by default
    const empty = el.querySelector<HTMLElement>('ui-combobox-empty');
    if (empty) empty.style.display = 'none';

    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, 'bottom-start'));

    const outside = (e: PointerEvent) => {
      const path = e.composedPath();
      if (!path.includes(el) && !path.includes(trigger)) {
        root.dispatchEvent(new CustomEvent('ui-combobox-close', { bubbles: true }));
      }
    };
    document.addEventListener('pointerdown', outside);
    this._cleanupOutside = () => document.removeEventListener('pointerdown', outside);

    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { root.dispatchEvent(new CustomEvent('ui-combobox-close', { bubbles: true })); return; }
      const items = Array.from(el.querySelectorAll<HTMLElement>('ui-combobox-item')).filter((i) => i.style.display !== 'none');
      if (!items.length) return;
      const current = document.activeElement as HTMLElement;
      let idx = items.indexOf(current);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; items[idx].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? items.length - 1 : idx - 1; items[idx].focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); (current as HTMLElement)?.click?.(); }
    };
    document.addEventListener('keydown', this._onKey);

    queueMicrotask(() => {
      const input = el.querySelector<HTMLInputElement>('ui-combobox-input input');
      input?.focus();
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
UiComboboxContent.register('ui-combobox-content');

export class UiComboboxInput extends WebComponent {
  static properties = { placeholder: { type: String } };
  declare placeholder: string;
  constructor() { super(); this.placeholder = 'Search...'; }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('input', this._onInput);
  }
  _onInput = (e: any) => {
    const root = this.closest('ui-combobox') as any;
    root?.filter?.(e.target.value || '');
  };
  render() {
    return html`
      <div data-slot="combobox-input" class=${cn('flex items-center border-b px-3')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 size-4 shrink-0 opacity-50"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" placeholder=${this.placeholder} class=${cn('flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground')} />
      </div>
    `;
  }
}
UiComboboxInput.register('ui-combobox-input');

export class UiComboboxList extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() { return html`<div data-slot="combobox-list" class=${cn('max-h-[300px] overflow-y-auto p-1')}>${unsafeHTML(this._slot)}</div>`; }
}
UiComboboxList.register('ui-combobox-list');

export class UiComboboxItem extends WebComponent {
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
      this.dispatchEvent(new CustomEvent('ui-combobox-change', { detail: { value: this.value }, bubbles: true }));
    });
  }
  render() {
    const cls = "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`<div data-slot="combobox-item" data-disabled=${this.disabled ? '' : null as any} role="option" tabindex="-1" class=${cn(cls)}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiComboboxItem.register('ui-combobox-item');

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

export const UiComboboxEmpty = makeChild('ui-combobox-empty', 'combobox-empty', 'flex w-full justify-center py-2 text-center text-sm text-muted-foreground');
export const UiComboboxGroup = makeChild('ui-combobox-group', 'combobox-group', '', 'group');
export const UiComboboxLabel = makeChild('ui-combobox-label', 'combobox-label', 'px-2 py-1.5 text-xs text-muted-foreground');
export const UiComboboxSeparator = makeChild('ui-combobox-separator', 'combobox-separator', '-mx-1 my-1 h-px bg-border', 'separator');
