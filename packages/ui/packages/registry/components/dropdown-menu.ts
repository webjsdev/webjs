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
 *         </ui-dropdown-menu-sub-content>
 *       </ui-dropdown-menu-sub>
 *       <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
 *       <ui-dropdown-menu-item variant="destructive">Sign out</ui-dropdown-menu-item>
 *     </ui-dropdown-menu-content>
 *   </ui-dropdown-menu>
 *
 * Keyboard: ArrowUp/Down to move, Enter to activate, Escape to close, Tab
 * cycles. ArrowRight on a sub-trigger opens its submenu and focuses its
 * first item; ArrowLeft inside a submenu closes it and refocuses the
 * sub-trigger.
 *
 * Design tokens used: --popover, --popover-foreground, --accent,
 * --accent-foreground, --destructive, --muted-foreground, --border.
 */
import { WebComponent, html, unsafeHTML } from '@webjskit/core';
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

const CHEVRON_RIGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto size-4" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

const SUB_CLOSE_DELAY = 200;

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

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    super.disconnectedCallback?.();
  }

  toggle(): void { this.open = !this.open; }
  show(): void { this.open = true; }
  hide(): void { this.open = false; }

  render() {
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      requestAnimationFrame(() => this._afterRender());
    }
    return html`<div data-slot="dropdown-menu" data-state=${this.open ? 'open' : 'closed'}>
      <slot></slot>
    </div>`;
  }

  _afterRender(): void {
    const content = this._content();
    if (content) {
      this._syncContentPopover(content);
    }
    if (this.open) this._setup();
    else this._teardown();
  }

  _content(): HTMLElement | null {
    return this.querySelector('ui-dropdown-menu-content [popover]');
  }

  _syncContentPopover(content: HTMLElement): void {
    const p = content as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
      matches: (s: string) => boolean;
    };
    if (typeof p.showPopover !== 'function') return;
    if (this.open && !p.matches(':popover-open')) p.showPopover();
    else if (!this.open && p.matches(':popover-open')) p.hidePopover();
  }

  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>('ui-dropdown-menu-trigger');
    const content = this._content();
    const host = this.querySelector<HTMLElement>('ui-dropdown-menu-content');
    if (!trigger || !content || !host) return;
    positionFloating(trigger, content, {
      side: (host.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (host.getAttribute('align') ?? 'start') as PopoverAlign,
      sideOffset: Number(host.getAttribute('side-offset') ?? 4),
      alignOffset: Number(host.getAttribute('align-offset') ?? 0),
    });
  }

  _setup(): void {
    this._reposition();
    document.addEventListener('click', this._docClickHandler);
    document.addEventListener('keydown', this._keyHandler);
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._resizeHandler, true);
    queueMicrotask(() => {
      const first = this.querySelector<HTMLElement>(
        'ui-dropdown-menu-item:not([data-disabled]) [role="menuitem"]',
      );
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

    // Active context = nearest content / sub-content panel owning focus.
    // Scoping arrow nav avoids walking into siblings of a different submenu.
    const active = document.activeElement as HTMLElement | null;
    const context = active?.closest('[role="menu"]') as HTMLElement | null;
    if (!context) return;

    const items = Array.from(
      context.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'),
    ).filter((it) => it.closest('[role="menu"]') === context);
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
      // Open submenu owned by the focused sub-trigger and move focus into it.
      const subTrigger = active?.closest('ui-dropdown-menu-sub-trigger');
      if (subTrigger) {
        e.preventDefault();
        const sub = subTrigger.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
        if (sub) {
          sub.show();
          queueMicrotask(() => {
            const firstSubItem = sub.querySelector<HTMLElement>(
              'ui-dropdown-menu-sub-content [role="menuitem"]:not([data-disabled])',
            );
            firstSubItem?.focus();
          });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      // Inside a sub-content: close the submenu and refocus its trigger.
      if (context.closest('ui-dropdown-menu-sub-content')) {
        e.preventDefault();
        const sub = context.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
        const trigger = sub?.querySelector<HTMLElement>(
          'ui-dropdown-menu-sub-trigger [role="menuitem"]',
        );
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
  render() {
    return html`<div
      data-slot="dropdown-menu-trigger"
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  _onClick = (): void => (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.toggle();
}
UiDropdownMenuTrigger.register('ui-dropdown-menu-trigger');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-content>
// --------------------------------------------------------------------------

export class UiDropdownMenuContent extends WebComponent {
  render() {
    return html`<div
      data-slot="dropdown-menu-content"
      role="menu"
      popover="manual"
      class=${dropdownMenuContentClass()}
    ><slot></slot></div>`;
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

  constructor() {
    super();
    this.variant = 'default';
  }

  render() {
    const inset = this.hasAttribute('inset');
    return html`<div
      data-slot="dropdown-menu-item"
      role="menuitem"
      tabindex="-1"
      data-variant=${this.variant}
      ?data-inset=${inset}
      class=${dropdownMenuItemClass()}
      @click=${this._onClick}
      @pointerenter=${this._onPointerEnter}
      @focus=${this._onFocus}
      @blur=${this._onBlur}
    ><slot></slot></div>`;
  }

  _onClick = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasAttribute('data-disabled')) return;
    (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.hide();
  };

  _onPointerEnter = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasAttribute('data-disabled')) return;
    el.focus();
  };

  _onFocus = (e: Event): void => {
    (e.currentTarget as HTMLElement).setAttribute('data-highlighted', '');
  };

  _onBlur = (e: Event): void => {
    (e.currentTarget as HTMLElement).removeAttribute('data-highlighted');
  };
}
UiDropdownMenuItem.register('ui-dropdown-menu-item');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-label>
// --------------------------------------------------------------------------

export class UiDropdownMenuLabel extends WebComponent {
  render() {
    const inset = this.hasAttribute('inset');
    return html`<div
      data-slot="dropdown-menu-label"
      ?data-inset=${inset}
      class=${dropdownMenuLabelClass()}
    ><slot></slot></div>`;
  }
}
UiDropdownMenuLabel.register('ui-dropdown-menu-label');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-separator>
// --------------------------------------------------------------------------

export class UiDropdownMenuSeparator extends WebComponent {
  render() {
    return html`<div
      data-slot="dropdown-menu-separator"
      role="separator"
      class=${dropdownMenuSeparatorClass()}
    ></div>`;
  }
}
UiDropdownMenuSeparator.register('ui-dropdown-menu-separator');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-shortcut>
// --------------------------------------------------------------------------

export class UiDropdownMenuShortcut extends WebComponent {
  render() {
    return html`<span
      data-slot="dropdown-menu-shortcut"
      class=${dropdownMenuShortcutClass()}
    ><slot></slot></span>`;
  }
}
UiDropdownMenuShortcut.register('ui-dropdown-menu-shortcut');

// --------------------------------------------------------------------------
// <ui-dropdown-menu-group>
// --------------------------------------------------------------------------

export class UiDropdownMenuGroup extends WebComponent {
  render() {
    return html`<div
      data-slot="dropdown-menu-group"
      role="group"
    ><slot></slot></div>`;
  }
}
UiDropdownMenuGroup.register('ui-dropdown-menu-group');

// --------------------------------------------------------------------------
// Submenu: Sub / SubTrigger / SubContent
// --------------------------------------------------------------------------

export class UiDropdownMenuSub extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _lastOpen: boolean = false;
  _closeTimer: number | undefined;

  constructor() {
    super();
    this.open = false;
  }

  disconnectedCallback(): void {
    this._cancelClose();
    super.disconnectedCallback?.();
  }

  show(): void { this._cancelClose(); this.open = true; }
  hide(): void { this._cancelClose(); this.open = false; }
  toggle(): void { if (this.open) this.hide(); else this.show(); }

  render() {
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      requestAnimationFrame(() => this._afterRender());
    }
    return html`<div
      data-slot="dropdown-menu-sub"
      data-state=${this.open ? 'open' : 'closed'}
      @pointerenter=${this._cancelCloseHandler}
      @pointerleave=${this._scheduleCloseHandler}
    ><slot></slot></div>`;
  }

  _afterRender(): void {
    const subContent = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-content [popover]');
    if (subContent) {
      const p = subContent as HTMLElement & {
        showPopover?: () => void;
        hidePopover?: () => void;
        matches: (s: string) => boolean;
      };
      if (typeof p.showPopover === 'function') {
        if (this.open && !p.matches(':popover-open')) p.showPopover();
        else if (!this.open && p.matches(':popover-open')) p.hidePopover();
      }
    }
    if (this.open) this._position();
  }

  _cancelCloseHandler = (): void => this._cancelClose();
  _scheduleCloseHandler = (): void => this._scheduleClose();

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
    const trigger = this.querySelector<HTMLElement>(
      'ui-dropdown-menu-sub-trigger [role="menuitem"]',
    );
    const content = this.querySelector<HTMLElement>(
      'ui-dropdown-menu-sub-content [popover]',
    );
    const contentHost = this.querySelector<HTMLElement>('ui-dropdown-menu-sub-content');
    if (!trigger || !content || !contentHost) return;
    positionFloating(trigger, content, {
      side: (contentHost.getAttribute('side') ?? 'right') as PopoverSide,
      align: (contentHost.getAttribute('align') ?? 'start') as PopoverAlign,
      sideOffset: Number(contentHost.getAttribute('side-offset') ?? -4),
      alignOffset: Number(contentHost.getAttribute('align-offset') ?? 0),
    });
  }
}
UiDropdownMenuSub.register('ui-dropdown-menu-sub');

export class UiDropdownMenuSubTrigger extends WebComponent {
  _sub(): UiDropdownMenuSub | null {
    return this.closest('ui-dropdown-menu-sub') as UiDropdownMenuSub | null;
  }

  render() {
    const inset = this.hasAttribute('inset');
    const open = !!this._sub()?.open;
    return html`<div
      data-slot="dropdown-menu-sub-trigger"
      role="menuitem"
      tabindex="-1"
      aria-haspopup="menu"
      aria-expanded=${String(open)}
      data-state=${open ? 'open' : 'closed'}
      ?data-inset=${inset}
      class=${dropdownMenuSubTriggerClass()}
      @click=${this._onClick}
      @pointerenter=${this._onPointerEnter}
    ><slot></slot>${unsafeHTML(CHEVRON_RIGHT_SVG)}</div>`;
  }

  _onClick = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasAttribute('data-disabled')) return;
    this._sub()?.toggle();
  };

  _onPointerEnter = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    if (el.hasAttribute('data-disabled')) return;
    el.focus();
    this._sub()?.show();
  };
}
UiDropdownMenuSubTrigger.register('ui-dropdown-menu-sub-trigger');

export class UiDropdownMenuSubContent extends WebComponent {
  render() {
    return html`<div
      data-slot="dropdown-menu-sub-content"
      role="menu"
      popover="manual"
      class=${dropdownMenuSubContentClass()}
    ><slot></slot></div>`;
  }
}
UiDropdownMenuSubContent.register('ui-dropdown-menu-sub-content');
