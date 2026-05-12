import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Dropdown menu primitives.
 *
 *   <ui-dropdown-menu>
 *     <ui-dropdown-menu-trigger><ui-button>Open</ui-button></ui-dropdown-menu-trigger>
 *     <ui-dropdown-menu-content>
 *       <ui-dropdown-menu-label>Account</ui-dropdown-menu-label>
 *       <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
 *       <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
 *       <ui-dropdown-menu-item>Log out <ui-dropdown-menu-shortcut>⇧⌘Q</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
 *     </ui-dropdown-menu-content>
 *   </ui-dropdown-menu>
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'bottom-start') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

export class UiDropdownMenu extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-dropdown-menu-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-dropdown-menu-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-dropdown-menu-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-dropdown-menu-close', this._onClose as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-dropdown-menu-trigger, ui-dropdown-menu-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  render() { return html`<slot></slot>`; }
}
UiDropdownMenu.register('ui-dropdown-menu');

export class UiDropdownMenuTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-dropdown-menu-toggle', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDropdownMenuTrigger.register('ui-dropdown-menu-trigger');

export class UiDropdownMenuContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;
  private _cleanupOutside: (() => void) | null = null;
  private _onKey: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  disconnectedCallback() { super.disconnectedCallback(); this._teardown(); }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state === 'open') this._show();
    else this._teardown();
  }

  _show() {
    if (this._portal) return;
    const root = this.closest('ui-dropdown-menu') as HTMLElement | null;
    const trigger = root?.querySelector('ui-dropdown-menu-trigger') as HTMLElement | null;
    if (!root || !trigger) return;

    const el = document.createElement('div');
    el.setAttribute('role', 'menu');
    el.setAttribute('data-slot', 'dropdown-menu-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;

    const placement = this.getAttribute('placement') || 'bottom-start';
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, placement));

    // click-outside
    const outside = (e: PointerEvent) => {
      const path = e.composedPath();
      if (!path.includes(el) && !path.includes(trigger)) {
        root.dispatchEvent(new CustomEvent('ui-dropdown-menu-close', { bubbles: true }));
      }
    };
    document.addEventListener('pointerdown', outside);
    this._cleanupOutside = () => document.removeEventListener('pointerdown', outside);

    // close on item click + keyboard
    el.addEventListener('click', (e) => {
      const path = e.composedPath() as HTMLElement[];
      if (path.some((n) => n?.getAttribute?.('data-slot') === 'dropdown-menu-item' || n?.getAttribute?.('data-slot') === 'dropdown-menu-checkbox-item' || n?.getAttribute?.('data-slot') === 'dropdown-menu-radio-item')) {
        root.dispatchEvent(new CustomEvent('ui-dropdown-menu-close', { bubbles: true }));
      }
    });

    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { root.dispatchEvent(new CustomEvent('ui-dropdown-menu-close', { bubbles: true })); return; }
      const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-radio-item"], [data-slot="dropdown-menu-sub-trigger"]')).filter((i) => !i.hasAttribute('data-disabled'));
      if (!items.length) return;
      const current = document.activeElement as HTMLElement;
      let idx = items.indexOf(current);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; items[idx].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? items.length - 1 : idx - 1; items[idx].focus(); }
      else if (e.key === 'Enter') { (current as HTMLElement)?.click?.(); }
    };
    document.addEventListener('keydown', this._onKey);

    // focus first item next tick
    queueMicrotask(() => {
      const first = el.querySelector<HTMLElement>('[data-slot="dropdown-menu-item"], [data-slot="dropdown-menu-checkbox-item"], [data-slot="dropdown-menu-radio-item"]');
      first?.focus();
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
UiDropdownMenuContent.register('ui-dropdown-menu-content');

// Items, separators, labels, etc.
const ITEM_CLS = "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

/**
 * Close any *other* open submenu in the same menu portal when the pointer
 * enters this item. Prevents two sibling submenus being open at once when
 * the user slides from one row to the next.
 */
function closeSiblingSubmenus(el: HTMLElement) {
  const container = el.closest('[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]');
  if (!container) return;
  container.querySelectorAll('ui-dropdown-menu-sub[open]').forEach((sub) => {
    if (!sub.contains(el)) {
      sub.dispatchEvent(new CustomEvent('ui-dropdown-menu-sub-close', { bubbles: true }));
    }
  });
}

export class UiDropdownMenuItem extends WebComponent {
  static properties = { inset: { type: Boolean }, variant: { type: String }, disabled: { type: Boolean } };
  declare inset: boolean; declare variant: string; declare disabled: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; this.variant = 'default'; this.disabled = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.setAttribute('tabindex', '-1');
    this.setAttribute('role', 'menuitem');
    this.addEventListener('pointerenter', this._onPointerEnter);
  }
  _onPointerEnter = () => closeSiblingSubmenus(this);
  render() {
    return html`<div data-slot="dropdown-menu-item" data-inset=${this.inset ? '' : null as any} data-variant=${this.variant} data-disabled=${this.disabled ? '' : null as any} tabindex="-1" role="menuitem" class=${cn(ITEM_CLS)}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiDropdownMenuItem.register('ui-dropdown-menu-item');

export class UiDropdownMenuCheckboxItem extends WebComponent {
  static properties = { checked: { type: Boolean, reflect: true } };
  declare checked: boolean;
  private _slot = '';
  constructor() { super(); this.checked = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => { this.checked = !this.checked; this.dispatchEvent(new CustomEvent('change', { detail: { checked: this.checked }, bubbles: true })); });
  }
  render() {
    const cls = "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <div data-slot="dropdown-menu-checkbox-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemcheckbox" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="20 6 9 17 4 12"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiDropdownMenuCheckboxItem.register('ui-dropdown-menu-checkbox-item');

// Radio group + radio item. Group exposes a `value` attribute; items
// compare their `value` and render the dot when matching.
export class UiDropdownMenuRadioGroup extends WebComponent {
  static properties = { value: { type: String, reflect: true } };
  declare value: string;
  private _slot = '';
  constructor() { super(); this.value = ''; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-dropdown-menu-radio-change', (e: any) => { this.value = e.detail.value; this._syncItems(); });
    queueMicrotask(() => this._syncItems());
  }
  _syncItems() {
    this.querySelectorAll('ui-dropdown-menu-radio-item').forEach((it) => {
      const v = it.getAttribute('value') || '';
      (it as any).checked = v === this.value;
      it.setAttribute('data-state', v === this.value ? 'checked' : 'unchecked');
    });
  }
  render() { return html`<div data-slot="dropdown-menu-radio-group" role="group">${unsafeHTML(this._slot)}</div>`; }
}
UiDropdownMenuRadioGroup.register('ui-dropdown-menu-radio-group');

export class UiDropdownMenuRadioItem extends WebComponent {
  static properties = { value: { type: String }, checked: { type: Boolean, reflect: true } };
  declare value: string; declare checked: boolean;
  private _slot = '';
  constructor() { super(); this.value = ''; this.checked = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-dropdown-menu-radio-change', { detail: { value: this.value }, bubbles: true })));
  }
  render() {
    const cls = "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <div data-slot="dropdown-menu-radio-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemradio" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-2"><circle cx="12" cy="12" r="10"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiDropdownMenuRadioItem.register('ui-dropdown-menu-radio-item');

function makeChild(tag: string, slot: string, classes: string, role?: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() {
      return role
        ? html`<div data-slot=${slot} role=${role} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`
        : html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`;
    }
  }
  C.register(tag);
  return C;
}

export const UiDropdownMenuLabel = makeChild('ui-dropdown-menu-label', 'dropdown-menu-label', 'px-2 py-1.5 text-sm font-medium data-[inset]:pl-8');
export const UiDropdownMenuSeparator = makeChild('ui-dropdown-menu-separator', 'dropdown-menu-separator', '-mx-1 my-1 h-px bg-border', 'separator');
export const UiDropdownMenuGroup = makeChild('ui-dropdown-menu-group', 'dropdown-menu-group', '', 'group');

export class UiDropdownMenuShortcut extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() { return html`<span data-slot="dropdown-menu-shortcut" class=${cn('ml-auto text-xs tracking-widest text-muted-foreground')}>${unsafeHTML(this._slot)}</span>`; }
}
UiDropdownMenuShortcut.register('ui-dropdown-menu-shortcut');

// Sub-menu (nested). Sub-trigger on hover/focus opens sub-content positioned to its right.
export class UiDropdownMenuSub extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  constructor() { super(); this.open = false; }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-dropdown-menu-sub-open', () => { this.open = true; this._sync(); });
    this.addEventListener('ui-dropdown-menu-sub-close', () => { this.open = false; this._sync(); });
  }
  _sync() {
    const state = this.open ? 'open' : 'closed';
    this.querySelectorAll('ui-dropdown-menu-sub-trigger, ui-dropdown-menu-sub-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }
  render() { return html`<slot></slot>`; }
}
UiDropdownMenuSub.register('ui-dropdown-menu-sub');

export class UiDropdownMenuSubTrigger extends WebComponent {
  static properties = { inset: { type: Boolean } };
  declare inset: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', this._onPointerEnter);
    this.addEventListener('click', (e) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('ui-dropdown-menu-sub-open', { bubbles: true })); });
  }
  // Close any sibling submenu first, then request our own open. This keeps
  // exactly one submenu open per parent menu when the pointer slides between
  // sub-trigger rows.
  _onPointerEnter = () => {
    closeSiblingSubmenus(this);
    this.dispatchEvent(new CustomEvent('ui-dropdown-menu-sub-open', { bubbles: true }));
  };
  render() {
    const cls = "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <div data-slot="dropdown-menu-sub-trigger" data-inset=${this.inset ? '' : null as any} data-state=${this.getAttribute('data-state') || 'closed'} tabindex="-1" class=${cn(cls)}>
        ${unsafeHTML(this._slot)}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto size-4"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    `;
  }
}
UiDropdownMenuSubTrigger.register('ui-dropdown-menu-sub-trigger');

export class UiDropdownMenuSubContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;

  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  disconnectedCallback() { super.disconnectedCallback(); this._teardown(); }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state === 'open') this._show(); else this._teardown();
  }

  _show() {
    if (this._portal) return;
    const sub = this.closest('ui-dropdown-menu-sub') as HTMLElement | null;
    const trigger = sub?.querySelector('ui-dropdown-menu-sub-trigger') as HTMLElement | null;
    if (!trigger) return;

    const el = document.createElement('div');
    el.setAttribute('data-slot', 'dropdown-menu-sub-content');
    el.setAttribute('data-state', 'open');
    el.setAttribute('role', 'menu');
    el.className = cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;

    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, 'right-start'));

    // Close on leave (return to parent)
    el.addEventListener('pointerleave', () => sub?.dispatchEvent(new CustomEvent('ui-dropdown-menu-sub-close', { bubbles: true })));
  }

  _teardown() {
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiDropdownMenuSubContent.register('ui-dropdown-menu-sub-content');
