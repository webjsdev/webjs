/**
 * DropdownMenu, popover-style menu of actions. Hand-rolled keyboard nav
 * and positioning.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 *
 * shadcn parity:
 *   DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
 *   DropdownMenuItem (variant: default | destructive, inset: bool),
 *   DropdownMenuCheckboxItem (checked), DropdownMenuRadioGroup,
 *   DropdownMenuRadioItem (value), DropdownMenuLabel, DropdownMenuSeparator,
 *   DropdownMenuShortcut, DropdownMenuGroup,
 *   DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent.
 *
 * Usage:
 *   <ui-dropdown-menu>
 *     <ui-dropdown-menu-trigger>
 *       <button class=${buttonClass({ variant: 'outline' })}>Options</button>
 *     </ui-dropdown-menu-trigger>
 *     <ui-dropdown-menu-content align="end">
 *       <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
 *       <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
 *       <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
 *       <ui-dropdown-menu-sub>
 *         <ui-dropdown-menu-sub-trigger>Invite users</ui-dropdown-menu-sub-trigger>
 *         <ui-dropdown-menu-sub-content>
 *           <ui-dropdown-menu-item>Email</ui-dropdown-menu-item>
 *           <ui-dropdown-menu-item>Message</ui-dropdown-menu-item>
 *         </ui-dropdown-menu-sub-content>
 *       </ui-dropdown-menu-sub>
 *       <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
 *       <ui-dropdown-menu-item variant="destructive">Sign out</ui-dropdown-menu-item>
 *     </ui-dropdown-menu-content>
 *   </ui-dropdown-menu>
 *
 * Keyboard: ArrowUp/Down to move, Enter to activate, Escape to close, Tab
 * cycles. ArrowRight on a sub-trigger opens its submenu and focuses its first
 * item; ArrowLeft inside a submenu closes it and returns focus to the
 * sub-trigger.
 *
 * Design tokens used: --popover, --popover-foreground, --accent,
 * --accent-foreground, --destructive, --muted-foreground, --border.
 */
import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

export const dropdownMenuContentClass = (): string =>
  'fixed z-50 max-h-[--available-height] min-w-[8rem] m-0 overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md';

export const dropdownMenuItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:hover:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 dark:data-[variant=destructive]:hover:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const dropdownMenuCheckboxItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const dropdownMenuRadioItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8";

export const dropdownMenuLabelClass = (): string =>
  'px-2 pt-2 pb-1.5 text-xs font-semibold text-muted-foreground data-[inset]:pl-8';

export const dropdownMenuSeparatorClass = (): string => '-mx-1 my-1 h-px bg-border';

export const dropdownMenuShortcutClass = (): string =>
  'ml-auto text-xs tracking-widest text-muted-foreground';

export const dropdownMenuSubTriggerClass = (): string =>
  "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm select-none outline-hidden focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:last-child]:ml-auto";

export const dropdownMenuSubContentClass = (): string =>
  'fixed z-50 min-w-[8rem] m-0 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg';

const STYLES = `
ui-dropdown-menu:not([open]) ui-dropdown-menu-content,
ui-dropdown-menu-sub:not([open]) ui-dropdown-menu-sub-content {
  display: none !important;
}
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-dropdown-menu-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-dropdown-menu-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// <ui-dropdown-menu>
// --------------------------------------------------------------------------

export class UiDropdownMenu extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _lastOpen: boolean = false;
  _typeBuffer = '';
  _typeBufferTimer: number | undefined;

  _docClickHandler = (e: MouseEvent): void => this._onDocClick(e);
  _keyHandler = (e: KeyboardEvent): void => this._onKeyDown(e);
  _resizeHandler = (): void => this._reposition();

  constructor() {
    super();
    this.open = false;
  }

  connectedCallback(): void {
    installStyles();
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu');
  }

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    super.disconnectedCallback?.();
  }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    // <ui-dropdown-menu-content> is a descendant WebComponent; wait one
    // frame so its slot projection settles before _afterRender walks it.
    requestAnimationFrame(() => this._afterRender());
    return html`<slot></slot>`;
  }

  _afterRender(): void {
    const content = this.querySelector<HTMLElement>('ui-dropdown-menu-content');
    if (content) {
      content.setAttribute('data-state', this.open ? 'open' : 'closed');
      if (typeof (content as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
        const isPopoverOpen = (content as HTMLElement & { matches: (s: string) => boolean }).matches(':popover-open');
        if (this.open && !isPopoverOpen) {
          (content as HTMLElement & { showPopover: () => void }).showPopover();
        } else if (!this.open && isPopoverOpen) {
          (content as HTMLElement & { hidePopover: () => void }).hidePopover();
        }
      }
    }
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      if (this.open) this._setup();
      else this._teardown();
    }
  }

  toggle(): void { this.open = !this.open; }
  show(): void { this.open = true; }
  hide(): void { this.open = false; }

  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>('ui-dropdown-menu-trigger');
    const content = this.querySelector<HTMLElement>('ui-dropdown-menu-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (content.getAttribute('align') ?? 'start') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
      alignOffset: Number(content.getAttribute('align-offset') ?? 0),
    });
  }

  _setup(): void {
    queueMicrotask(() => {
      this._reposition();
      document.addEventListener('click', this._docClickHandler);
      document.addEventListener('keydown', this._keyHandler);
      window.addEventListener('resize', this._resizeHandler);
      window.addEventListener('scroll', this._resizeHandler, true);
      const first = this.querySelector<HTMLElement>('ui-dropdown-menu-item:not([data-disabled])');
      first?.focus();
    });
  }

  _teardown(): void {
    document.removeEventListener('click', this._docClickHandler);
    document.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('scroll', this._resizeHandler, true);
    this.querySelectorAll<UiDropdownMenuSub>('ui-dropdown-menu-sub[open]').forEach(
      (sub) => sub.hide(),
    );
  }

  _onDocClick(e: MouseEvent): void {
    if (!this.open) return;
    if (e.composedPath().some((n) => n === this)) return;
    this.hide();
  }

  _onKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
      return;
    }

    // Scope arrow nav to the "active context", the nearest content or
    // sub-content panel owning the focused element. Without this, pressing
    // ArrowDown while a sub-trigger is focused would walk into the
    // submenu's items as if they were siblings of the parent items.
    const active = document.activeElement as HTMLElement | null;
    const context = active?.closest(
      'ui-dropdown-menu-sub-content, ui-dropdown-menu-content',
    ) as HTMLElement | null;
    if (!context) return;

    const items = Array.from(
      context.querySelectorAll<HTMLElement>(
        ':scope ui-dropdown-menu-item:not([data-disabled]), :scope ui-dropdown-menu-sub-trigger:not([data-disabled])',
      ),
    ).filter(
      (it) =>
        it.closest('ui-dropdown-menu-sub-content, ui-dropdown-menu-content') === context,
    );
    if (items.length === 0) return;
    const idx = active ? items.indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'ArrowRight') {
      if (active?.tagName === 'UI-DROPDOWN-MENU-SUB-TRIGGER') {
        e.preventDefault();
        const sub = active.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
        if (sub) {
          sub.show();
          queueMicrotask(() => {
            const subContent = sub.querySelector<HTMLElement>('ui-dropdown-menu-sub-content');
            const firstSubItem = subContent?.querySelector<HTMLElement>(
              'ui-dropdown-menu-item:not([data-disabled]), ui-dropdown-menu-sub-trigger:not([data-disabled])',
            );
            firstSubItem?.focus();
          });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      if (context.tagName === 'UI-DROPDOWN-MENU-SUB-CONTENT') {
        e.preventDefault();
        const sub = context.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
        const trigger = sub?.querySelector<HTMLElement>('ui-dropdown-menu-sub-trigger');
        sub?.hide();
        trigger?.focus();
      }
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      this._typeahead(e, items);
    }
  }

  _typeahead(e: KeyboardEvent, items: HTMLElement[]): void {
    this._typeBuffer = (this._typeBuffer + e.key).toLowerCase();
    clearTimeout(this._typeBufferTimer);
    this._typeBufferTimer = window.setTimeout(() => { this._typeBuffer = ''; }, 500);
    const buffer = this._typeBuffer;
    const match = items.find((it) => {
      const text = (it.getAttribute('text-value') ?? it.textContent ?? '').trim().toLowerCase();
      return text.startsWith(buffer);
    });
    if (match) {
      e.preventDefault();
      match.focus();
    }
  }
}
UiDropdownMenu.register('ui-dropdown-menu');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-trigger>
// --------------------------------------------------------------------------

export class UiDropdownMenuTrigger extends WebComponent {
  connectedCallback(): void {
    this.addEventListener('click', this._onClick);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-trigger');
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _onClick = (): void => (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.toggle();
}
UiDropdownMenuTrigger.register('ui-dropdown-menu-trigger');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-content>
// --------------------------------------------------------------------------

export class UiDropdownMenuContent extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-content');
    this.setAttribute('role', 'menu');
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
  }

  render() {
    this.className = cn(dropdownMenuContentClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDropdownMenuContent.register('ui-dropdown-menu-content');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-item>
// --------------------------------------------------------------------------

export class UiDropdownMenuItem extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: 'default' | 'destructive';

  _userClass: string = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerenter', this._onPointerEnter);
    this.addEventListener('focus', this._onFocus);
    this.addEventListener('blur', this._onBlur);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-item');
    this.setAttribute('role', 'menuitem');
    this.setAttribute('tabindex', '-1');
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerenter', this._onPointerEnter);
    this.removeEventListener('focus', this._onFocus);
    this.removeEventListener('blur', this._onBlur);
    super.disconnectedCallback?.();
  }

  render() {
    this.setAttribute('data-variant', this.variant);
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
    this.className = cn(dropdownMenuItemClass(), this._userClass);
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.hide();
  };

  _onPointerEnter = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    this.focus();
  };

  _onFocus = (): void => {
    this.setAttribute('data-highlighted', '');
  };

  _onBlur = (): void => {
    this.removeAttribute('data-highlighted');
  };
}
UiDropdownMenuItem.register('ui-dropdown-menu-item');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-label>
// --------------------------------------------------------------------------

export class UiDropdownMenuLabel extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-label');
  }

  render() {
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
    this.className = cn(dropdownMenuLabelClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDropdownMenuLabel.register('ui-dropdown-menu-label');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-separator>
// --------------------------------------------------------------------------

export class UiDropdownMenuSeparator extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-separator');
    this.setAttribute('role', 'separator');
  }

  render() {
    this.className = cn(dropdownMenuSeparatorClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDropdownMenuSeparator.register('ui-dropdown-menu-separator');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-shortcut>
// --------------------------------------------------------------------------

export class UiDropdownMenuShortcut extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-shortcut');
  }

  render() {
    this.className = cn(dropdownMenuShortcutClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDropdownMenuShortcut.register('ui-dropdown-menu-shortcut');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-group>
// --------------------------------------------------------------------------

export class UiDropdownMenuGroup extends WebComponent {
  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-group');
    this.setAttribute('role', 'group');
  }

  render() {
    return html`<slot></slot>`;
  }
}
UiDropdownMenuGroup.register('ui-dropdown-menu-group');

// --------------------------------------------------------------------------
// Submenu, Sub / SubTrigger / SubContent (shadcn parity)
// --------------------------------------------------------------------------

const CHEVRON_RIGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto size-4" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

const SUB_CLOSE_DELAY = 200;

export class UiDropdownMenuSub extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _lastOpen: boolean = false;
  _closeTimer: number | undefined;
  _pointerEnterHandler = (): void => this._cancelClose();
  _pointerLeaveHandler = (): void => this._scheduleClose();

  constructor() {
    super();
    this.open = false;
  }

  connectedCallback(): void {
    this.addEventListener('pointerenter', this._pointerEnterHandler);
    this.addEventListener('pointerleave', this._pointerLeaveHandler);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub');
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointerenter', this._pointerEnterHandler);
    this.removeEventListener('pointerleave', this._pointerLeaveHandler);
    this._cancelClose();
    super.disconnectedCallback?.();
  }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    // Sub-trigger + sub-content are descendant WebComponents; wait one
    // frame so their slot projections settle before we walk for them.
    requestAnimationFrame(() => this._afterRender());
    return html`<slot></slot>`;
  }

  _afterRender(): void {
    const trigger = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-trigger');
    const content = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-content');
    trigger?.setAttribute('data-state', this.open ? 'open' : 'closed');
    if (content) {
      content.setAttribute('data-state', this.open ? 'open' : 'closed');
      if (typeof (content as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
        const isPopoverOpen = (content as HTMLElement & { matches: (s: string) => boolean }).matches(':popover-open');
        if (this.open && !isPopoverOpen) {
          (content as HTMLElement & { showPopover: () => void }).showPopover();
        } else if (!this.open && isPopoverOpen) {
          (content as HTMLElement & { hidePopover: () => void }).hidePopover();
        }
      }
    }
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      if (this.open) this._position();
    }
  }

  show(): void {
    this._cancelClose();
    this.open = true;
  }

  hide(): void {
    this._cancelClose();
    this.open = false;
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  _scheduleClose(): void {
    this._cancelClose();
    this._closeTimer = window.setTimeout(() => this.hide(), SUB_CLOSE_DELAY);
  }

  _cancelClose(): void {
    if (this._closeTimer !== undefined) {
      clearTimeout(this._closeTimer);
      this._closeTimer = undefined;
    }
  }

  _position(): void {
    queueMicrotask(() => {
      const trigger = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-trigger');
      const content = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-content');
      if (!trigger || !content) return;
      positionFloating(trigger, content, {
        side: (content.getAttribute('side') ?? 'right') as PopoverSide,
        align: (content.getAttribute('align') ?? 'start') as PopoverAlign,
        sideOffset: Number(content.getAttribute('side-offset') ?? -4),
        alignOffset: Number(content.getAttribute('align-offset') ?? 0),
      });
    });
  }
}
UiDropdownMenuSub.register('ui-dropdown-menu-sub');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-sub-trigger>
// --------------------------------------------------------------------------

export class UiDropdownMenuSubTrigger extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerenter', this._onPointerEnter);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub-trigger');
    this.setAttribute('role', 'menuitem');
    this.setAttribute('tabindex', '-1');
    this.setAttribute('aria-haspopup', 'menu');
    if (!this.querySelector(':scope > svg:last-child')) {
      const tmp = document.createElement('div');
      tmp.innerHTML = CHEVRON_RIGHT_SVG;
      const svg = tmp.firstChild;
      if (svg) this.appendChild(svg);
    }
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerenter', this._onPointerEnter);
    super.disconnectedCallback?.();
  }

  render() {
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
    this.className = cn(dropdownMenuSubTriggerClass(), this._userClass);
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    const sub = this.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
    sub?.toggle();
  };

  _onPointerEnter = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    this.focus();
    const sub = this.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
    sub?.show();
  };
}
UiDropdownMenuSubTrigger.register('ui-dropdown-menu-sub-trigger');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-sub-content>
// --------------------------------------------------------------------------

export class UiDropdownMenuSubContent extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub-content');
    this.setAttribute('role', 'menu');
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
  }

  render() {
    this.className = cn(dropdownMenuSubContentClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDropdownMenuSubContent.register('ui-dropdown-menu-sub-content');
