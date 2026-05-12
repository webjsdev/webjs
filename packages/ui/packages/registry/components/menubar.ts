import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Menubar — horizontal bar of dropdown-style menus.
 *
 *   <ui-menubar>
 *     <ui-menubar-menu>
 *       <ui-menubar-trigger>File</ui-menubar-trigger>
 *       <ui-menubar-content>
 *         <ui-menubar-item>New <ui-menubar-shortcut>⌘N</ui-menubar-shortcut></ui-menubar-item>
 *         <ui-menubar-separator></ui-menubar-separator>
 *         <ui-menubar-item>Quit</ui-menubar-item>
 *       </ui-menubar-content>
 *     </ui-menubar-menu>
 *     ...
 *   </ui-menubar>
 *
 * Only one menu open at a time. Hovering another trigger while one is
 * open switches to it.
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'bottom-start') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

export class UiMenubar extends WebComponent {
  private _slot = '';
  private _openMenu: HTMLElement | null = null;

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-menubar-menu-open', this._onMenuOpen as EventListener);
    this.addEventListener('ui-menubar-menu-close', this._onMenuClose as EventListener);
    this.addEventListener('ui-menubar-menu-hover', this._onMenuHover as EventListener);
    document.addEventListener('keydown', this._onKey);
    document.addEventListener('pointerdown', this._onOutside);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKey);
    document.removeEventListener('pointerdown', this._onOutside);
  }

  _onMenuOpen = (e: any) => { this._setOpen(e.target as HTMLElement); };
  _onMenuClose = () => { this._setOpen(null); };
  _onMenuHover = (e: any) => { if (this._openMenu && this._openMenu !== e.target) this._setOpen(e.target as HTMLElement); };

  _setOpen(target: HTMLElement | null) {
    if (this._openMenu === target) return;
    if (this._openMenu) (this._openMenu as any).setMenuOpen(false);
    this._openMenu = target;
    if (target) (target as any).setMenuOpen(true);
  }

  _onKey = (e: KeyboardEvent) => {
    if (!this._openMenu) return;
    if (e.key === 'Escape') { e.preventDefault(); this._setOpen(null); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const menus = Array.from(this.querySelectorAll<HTMLElement>('ui-menubar-menu'));
      const idx = menus.indexOf(this._openMenu);
      if (idx < 0) return;
      const next = e.key === 'ArrowRight' ? menus[(idx + 1) % menus.length] : menus[(idx - 1 + menus.length) % menus.length];
      e.preventDefault();
      this._setOpen(next);
    }
  };

  _onOutside = (e: PointerEvent) => {
    if (!this._openMenu) return;
    const path = e.composedPath();
    // close if click outside both the menubar and any open content portal
    const inMenubar = path.includes(this);
    const inContent = path.some((n) => (n as HTMLElement)?.getAttribute?.('data-slot') === 'menubar-content');
    if (!inMenubar && !inContent) this._setOpen(null);
  };

  render() {
    return html`<div data-slot="menubar" class=${cn('flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiMenubar.register('ui-menubar');

export class UiMenubarMenu extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  constructor() { super(); this.open = false; }

  setMenuOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-menubar-trigger, ui-menubar-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-menubar-trigger-click', () => {
      if (this.open) this.dispatchEvent(new CustomEvent('ui-menubar-menu-close', { bubbles: true }));
      else this.dispatchEvent(new CustomEvent('ui-menubar-menu-open', { bubbles: true }));
    });
    this.addEventListener('ui-menubar-trigger-hover', () => this.dispatchEvent(new CustomEvent('ui-menubar-menu-hover', { bubbles: true })));
  }

  render() { return html`<slot></slot>`; }
}
UiMenubarMenu.register('ui-menubar-menu');

export class UiMenubarTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-menubar-trigger-click', { bubbles: true })));
    this.addEventListener('pointerenter', () => this.dispatchEvent(new CustomEvent('ui-menubar-trigger-hover', { bubbles: true })));
  }
  render() {
    const cls = "flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground";
    return html`<button data-slot="menubar-trigger" data-state=${this.getAttribute('data-state') || 'closed'} class=${cn(cls)}>${unsafeHTML(this._slot)}</button>`;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiMenubarTrigger.register('ui-menubar-trigger');

export class UiMenubarContent extends WebComponent {
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
    const menu = this.closest('ui-menubar-menu') as HTMLElement | null;
    const trigger = menu?.querySelector('ui-menubar-trigger') as HTMLElement | null;
    if (!trigger) return;
    const el = document.createElement('div');
    el.setAttribute('role', 'menu');
    el.setAttribute('data-slot', 'menubar-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, 'bottom-start'));

    // Click an item → close
    el.addEventListener('click', (e) => {
      const path = e.composedPath() as HTMLElement[];
      if (path.some((n) => n?.getAttribute?.('data-slot') === 'menubar-item' || n?.getAttribute?.('data-slot') === 'menubar-checkbox-item' || n?.getAttribute?.('data-slot') === 'menubar-radio-item')) {
        menu?.dispatchEvent(new CustomEvent('ui-menubar-menu-close', { bubbles: true }));
      }
    });

    queueMicrotask(() => {
      const first = el.querySelector<HTMLElement>('[data-slot="menubar-item"]');
      first?.focus();
    });
  }

  _teardown() {
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiMenubarContent.register('ui-menubar-content');

const ITEM_CLS = "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

export class UiMenubarItem extends WebComponent {
  static properties = { inset: { type: Boolean }, variant: { type: String }, disabled: { type: Boolean } };
  declare inset: boolean; declare variant: string; declare disabled: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; this.variant = 'default'; this.disabled = false; }
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() {
    return html`<div data-slot="menubar-item" data-inset=${this.inset ? '' : null as any} data-variant=${this.variant} data-disabled=${this.disabled ? '' : null as any} tabindex="-1" role="menuitem" class=${cn(ITEM_CLS)}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiMenubarItem.register('ui-menubar-item');

export class UiMenubarCheckboxItem extends WebComponent {
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
    const cls = "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground";
    return html`
      <div data-slot="menubar-checkbox-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemcheckbox" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><polyline points="20 6 9 17 4 12"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiMenubarCheckboxItem.register('ui-menubar-checkbox-item');

export class UiMenubarRadioGroup extends WebComponent {
  static properties = { value: { type: String, reflect: true } };
  declare value: string;
  private _slot = '';
  constructor() { super(); this.value = ''; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-menubar-radio-change', (e: any) => { this.value = e.detail.value; this._sync(); });
    queueMicrotask(() => this._sync());
  }
  _sync() {
    this.querySelectorAll('ui-menubar-radio-item').forEach((it) => {
      const v = it.getAttribute('value') || '';
      (it as any).checked = v === this.value;
    });
  }
  render() { return html`<div data-slot="menubar-radio-group" role="group">${unsafeHTML(this._slot)}</div>`; }
}
UiMenubarRadioGroup.register('ui-menubar-radio-group');

export class UiMenubarRadioItem extends WebComponent {
  static properties = { value: { type: String }, checked: { type: Boolean, reflect: true } };
  declare value: string; declare checked: boolean;
  private _slot = '';
  constructor() { super(); this.value = ''; this.checked = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-menubar-radio-change', { detail: { value: this.value }, bubbles: true })));
  }
  render() {
    const cls = "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground";
    return html`
      <div data-slot="menubar-radio-item" data-state=${this.checked ? 'checked' : 'unchecked'} role="menuitemradio" tabindex="-1" class=${cn(cls)}>
        <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          ${this.checked ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-2"><circle cx="12" cy="12" r="10"/></svg>` : html``}
        </span>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
}
UiMenubarRadioItem.register('ui-menubar-radio-item');

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

export const UiMenubarLabel = makeChild('ui-menubar-label', 'menubar-label', 'px-2 py-1.5 text-sm font-medium data-[inset]:pl-8');
export const UiMenubarSeparator = makeChild('ui-menubar-separator', 'menubar-separator', '-mx-1 my-1 h-px bg-border', 'separator');
export const UiMenubarGroup = makeChild('ui-menubar-group', 'menubar-group', '', 'group');

export class UiMenubarShortcut extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() { return html`<span data-slot="menubar-shortcut" class=${cn('ml-auto text-xs tracking-widest text-muted-foreground')}>${unsafeHTML(this._slot)}</span>`; }
}
UiMenubarShortcut.register('ui-menubar-shortcut');

// Sub-menu support
export class UiMenubarSub extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  constructor() { super(); this.open = false; }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-menubar-sub-open', () => { this.open = true; this._sync(); });
    this.addEventListener('ui-menubar-sub-close', () => { this.open = false; this._sync(); });
  }
  _sync() {
    const state = this.open ? 'open' : 'closed';
    this.querySelectorAll('ui-menubar-sub-trigger, ui-menubar-sub-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }
  render() { return html`<slot></slot>`; }
}
UiMenubarSub.register('ui-menubar-sub');

export class UiMenubarSubTrigger extends WebComponent {
  static properties = { inset: { type: Boolean } };
  declare inset: boolean;
  private _slot = '';
  constructor() { super(); this.inset = false; }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', () => this.dispatchEvent(new CustomEvent('ui-menubar-sub-open', { bubbles: true })));
  }
  render() {
    const cls = "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground";
    return html`
      <div data-slot="menubar-sub-trigger" data-inset=${this.inset ? '' : null as any} data-state=${this.getAttribute('data-state') || 'closed'} tabindex="-1" class=${cn(cls)}>
        ${unsafeHTML(this._slot)}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto h-4 w-4"><path d="m9 18 6-6-6-6"/></svg>
      </div>
    `;
  }
}
UiMenubarSubTrigger.register('ui-menubar-sub-trigger');

export class UiMenubarSubContent extends WebComponent {
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
    const sub = this.closest('ui-menubar-sub') as HTMLElement | null;
    const trigger = sub?.querySelector('ui-menubar-sub-trigger') as HTMLElement | null;
    if (!trigger) return;
    const el = document.createElement('div');
    el.setAttribute('role', 'menu');
    el.setAttribute('data-slot', 'menubar-sub-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, 'right-start'));
  }

  _teardown() {
    this._cleanupAutoUpdate?.(); this._cleanupAutoUpdate = null;
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiMenubarSubContent.register('ui-menubar-sub-content');
