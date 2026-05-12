import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Context menu — same shape as dropdown-menu but opens on right-click at the
 * cursor position. Uses floating-ui's virtual reference pattern.
 *
 *   <ui-context-menu>
 *     <ui-context-menu-trigger>Right-click me</ui-context-menu-trigger>
 *     <ui-context-menu-content>
 *       <ui-context-menu-item>Cut</ui-context-menu-item>
 *       <ui-context-menu-item>Copy</ui-context-menu-item>
 *     </ui-context-menu-content>
 *   </ui-context-menu>
 */

export class UiContextMenu extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _x = 0;
  private _y = 0;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-context-menu-open-at', this._onOpenAt as EventListener);
    this.addEventListener('ui-context-menu-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-context-menu-open-at', this._onOpenAt as EventListener);
    this.removeEventListener('ui-context-menu-close', this._onClose as EventListener);
  }

  _onOpenAt = (e: CustomEvent) => {
    this._x = e.detail.x;
    this._y = e.detail.y;
    this.setOpen(true);
  };
  _onClose = () => this.setOpen(false);

  // expose virtual reference rect
  getVirtualRect() {
    const x = this._x, y = this._y;
    return { x, y, width: 0, height: 0, top: y, left: x, right: x, bottom: y, toJSON() { return this; } };
  }

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-context-menu-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  render() { return html`<slot></slot>`; }
}
UiContextMenu.register('ui-context-menu');

export class UiContextMenuTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('contextmenu', this._onContext);
  }
  _onContext = (e: MouseEvent) => {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('ui-context-menu-open-at', { detail: { x: e.clientX, y: e.clientY }, bubbles: true }));
  };
  render() { return html`<div data-slot="context-menu-trigger">${unsafeHTML(this._slot)}</div>`; }
}
UiContextMenuTrigger.register('ui-context-menu-trigger');

export class UiContextMenuContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupOutside: (() => void) | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;
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
    const root = this.closest('ui-context-menu') as any;
    if (!root) return;

    const el = document.createElement('div');
    el.setAttribute('role', 'menu');
    el.setAttribute('data-slot', 'context-menu-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;

    const virtualEl: any = { getBoundingClientRect: () => root.getVirtualRect() };
    const place = () => computePosition(virtualEl, el, {
      placement: 'bottom-start',
      middleware: [offset(2), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' }));
    place();
    // autoUpdate won't trigger from a virtual element on its own — single
    // initial placement is sufficient since the cursor doesn't move under
    // the open context menu.

    const outside = (e: PointerEvent) => {
      if (!e.composedPath().includes(el)) root.dispatchEvent(new CustomEvent('ui-context-menu-close', { bubbles: true }));
    };
    document.addEventListener('pointerdown', outside);
    this._cleanupOutside = () => document.removeEventListener('pointerdown', outside);

    el.addEventListener('click', (e) => {
      const path = e.composedPath() as HTMLElement[];
      if (path.some((n) => n?.getAttribute?.('data-slot')?.startsWith?.('context-menu-') && n.getAttribute('data-slot') !== 'context-menu-content')) {
        root.dispatchEvent(new CustomEvent('ui-context-menu-close', { bubbles: true }));
      }
    });

    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { root.dispatchEvent(new CustomEvent('ui-context-menu-close', { bubbles: true })); return; }
      const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slot="context-menu-item"], [data-slot="context-menu-checkbox-item"], [data-slot="context-menu-radio-item"]')).filter((i) => !i.hasAttribute('data-disabled'));
      if (!items.length) return;
      const current = document.activeElement as HTMLElement;
      let idx = items.indexOf(current);
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; items[idx].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = idx <= 0 ? items.length - 1 : idx - 1; items[idx].focus(); }
      else if (e.key === 'Enter') { (current as HTMLElement)?.click?.(); }
    };
    document.addEventListener('keydown', this._onKey);

    queueMicrotask(() => {
      const first = el.querySelector<HTMLElement>('[data-slot="context-menu-item"]');
      first?.focus();
    });
  }

  _teardown() {
    this._cleanupOutside?.(); this._cleanupOutside = null;
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiContextMenuContent.register('ui-context-menu-content');

const ITEM_CLS = "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

/**
 * Close any *other* open submenu in the same menu portal when the pointer
 * enters this item. Prevents two sibling submenus being open at once.
 */
function closeSiblingSubmenus(el: HTMLElement) {
  const container = el.closest('[data-slot="context-menu-content"], [data-slot="context-menu-sub-content"]');
  if (!container) return;
  container.querySelectorAll('ui-context-menu-sub[open]').forEach((sub) => {
    if (!sub.contains(el)) {
      sub.dispatchEvent(new CustomEvent('ui-context-menu-sub-close', { bubbles: true }));
    }
  });
}

export class UiContextMenuItem extends WebComponent {
  static properties = { inset: { type: Boolean }, variant: { type: String }, disabled: { type: Boolean } };
  declare inset: boolean; declare variant: string; declare disabled: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; this.variant = 'default'; this.disabled = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', this._onPointerEnter);
  }
  _onPointerEnter = () => closeSiblingSubmenus(this);
  render() {
    return html`<div data-slot="context-menu-item" data-inset=${this.inset ? '' : null as any} data-variant=${this.variant} data-disabled=${this.disabled ? '' : null as any} tabindex="-1" role="menuitem" class=${cn(ITEM_CLS)}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiContextMenuItem.register('ui-context-menu-item');

export class UiContextMenuCheckboxItem extends WebComponent {
  static properties = { checked: { type: Boolean, reflect: true } };
  declare checked: boolean;
  private _slot = '';
  constructor() { super(); this.checked = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => { this.checked = !this.checked; });
  }
  render() {
    const cls = "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <div data-slot="context-menu-checkbox-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemcheckbox" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="20 6 9 17 4 12"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiContextMenuCheckboxItem.register('ui-context-menu-checkbox-item');

export class UiContextMenuRadioGroup extends WebComponent {
  static properties = { value: { type: String, reflect: true } };
  declare value: string;
  private _slot = '';
  constructor() { super(); this.value = ''; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-context-menu-radio-change', (e: any) => { this.value = e.detail.value; this._sync(); });
    queueMicrotask(() => this._sync());
  }
  _sync() {
    this.querySelectorAll('ui-context-menu-radio-item').forEach((it) => {
      const v = it.getAttribute('value') || '';
      (it as any).checked = v === this.value;
    });
  }
  render() { return html`<div data-slot="context-menu-radio-group" role="group">${unsafeHTML(this._slot)}</div>`; }
}
UiContextMenuRadioGroup.register('ui-context-menu-radio-group');

export class UiContextMenuRadioItem extends WebComponent {
  static properties = { value: { type: String }, checked: { type: Boolean, reflect: true } };
  declare value: string; declare checked: boolean;
  private _slot = '';
  constructor() { super(); this.value = ''; this.checked = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-context-menu-radio-change', { detail: { value: this.value }, bubbles: true })));
  }
  render() {
    const cls = "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
    return html`
      <div data-slot="context-menu-radio-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemradio" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-2"><circle cx="12" cy="12" r="10"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiContextMenuRadioItem.register('ui-context-menu-radio-item');

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

export const UiContextMenuLabel = makeChild('ui-context-menu-label', 'context-menu-label', 'px-2 py-1.5 text-sm font-medium text-foreground data-[inset]:pl-8');
export const UiContextMenuSeparator = makeChild('ui-context-menu-separator', 'context-menu-separator', '-mx-1 my-1 h-px bg-border', 'separator');
export const UiContextMenuGroup = makeChild('ui-context-menu-group', 'context-menu-group', '', 'group');

export class UiContextMenuShortcut extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() { return html`<span data-slot="context-menu-shortcut" class=${cn('ml-auto text-xs tracking-widest text-muted-foreground')}>${unsafeHTML(this._slot)}</span>`; }
}
UiContextMenuShortcut.register('ui-context-menu-shortcut');

// Submenu — TODO: same pattern as dropdown-menu sub. For v1 omit for brevity.
export class UiContextMenuSub extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  constructor() { super(); this.open = false; }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-context-menu-sub-open', () => { this.open = true; this._sync(); });
    this.addEventListener('ui-context-menu-sub-close', () => { this.open = false; this._sync(); });
  }
  _sync() {
    const state = this.open ? 'open' : 'closed';
    this.querySelectorAll('ui-context-menu-sub-trigger, ui-context-menu-sub-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }
  render() { return html`<slot></slot>`; }
}
UiContextMenuSub.register('ui-context-menu-sub');

export class UiContextMenuSubTrigger extends WebComponent {
  static properties = { inset: { type: Boolean } };
  declare inset: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', this._onPointerEnter);
  }
  _onPointerEnter = () => {
    closeSiblingSubmenus(this);
    this.dispatchEvent(new CustomEvent('ui-context-menu-sub-open', { bubbles: true }));
  };
  render() {
    const cls = "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground";
    return html`
      <div data-slot="context-menu-sub-trigger" data-inset=${this.inset ? '' : null as any} data-state=${this.getAttribute('data-state') || 'closed'} tabindex="-1" class=${cn(cls)}>
        ${unsafeHTML(this._slot)}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto size-4"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    `;
  }
}
UiContextMenuSubTrigger.register('ui-context-menu-sub-trigger');

export class UiContextMenuSubContent extends WebComponent {
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
    const sub = this.closest('ui-context-menu-sub') as HTMLElement | null;
    const trigger = sub?.querySelector('ui-context-menu-sub-trigger') as HTMLElement | null;
    if (!trigger) return;
    const el = document.createElement('div');
    el.setAttribute('role', 'menu');
    el.setAttribute('data-slot', 'context-menu-sub-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => computePosition(trigger, el, { placement: 'right-start', middleware: [offset(4), flip(), shift({ padding: 8 })] }).then(({ x, y, placement: p }) => { Object.assign(el.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' }); el.setAttribute('data-side', p.split('-')[0]); }));
  }
  _teardown() {
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }
  render() { return html``; }
}
UiContextMenuSubContent.register('ui-context-menu-sub-content');
