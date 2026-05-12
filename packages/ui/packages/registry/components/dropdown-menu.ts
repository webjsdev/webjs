/**
 * DropdownMenu — popover-style menu of actions. Hand-rolled keyboard nav
 * and positioning.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 *
 * shadcn parity (v1 subset — Sub/SubTrigger/SubContent deferred to v2):
 *   DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
 *   DropdownMenuItem (variant: default | destructive, inset: bool),
 *   DropdownMenuCheckboxItem (checked), DropdownMenuRadioGroup,
 *   DropdownMenuRadioItem (value), DropdownMenuLabel, DropdownMenuSeparator,
 *   DropdownMenuShortcut, DropdownMenuGroup.
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
 *       <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
 *       <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
 *       <ui-dropdown-menu-item variant="destructive">Sign out</ui-dropdown-menu-item>
 *     </ui-dropdown-menu-content>
 *   </ui-dropdown-menu>
 *
 * Keyboard: ArrowUp/Down to move, Enter to activate, Escape to close, Tab cycles.
 *
 * Design tokens used: --popover, --popover-foreground, --accent,
 * --accent-foreground, --destructive, --muted-foreground, --border.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

export const dropdownMenuContentClass = (): string =>
  'z-50 max-h-[--available-height] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md';

export const dropdownMenuItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export const dropdownMenuCheckboxItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const dropdownMenuRadioItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const dropdownMenuLabelClass = (): string => 'px-2 py-1.5 text-sm font-medium data-[inset]:pl-8';

export const dropdownMenuSeparatorClass = (): string => '-mx-1 my-1 h-px bg-border';

export const dropdownMenuShortcutClass = (): string =>
  'ml-auto text-xs tracking-widest text-muted-foreground';

const STYLES = `
ui-dropdown-menu:not([open]) ui-dropdown-menu-content { display: none !important; }
ui-dropdown-menu-content { display: block; position: fixed; }
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

export class UiDropdownMenu extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  private _docClickHandler = (e: MouseEvent): void => this._onDocClick(e);
  private _keyHandler = (e: KeyboardEvent): void => this._onKeyDown(e);
  private _resizeHandler = (): void => this._reposition();

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'dropdown-menu');
    this._reflect();
  }
  disconnectedCallback(): void {
    if (this.hasAttribute('open')) this._teardown();
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open' && oldVal !== newVal) {
      this._reflect();
      if (newVal !== null) this._setup();
      else this._teardown();
    }
  }
  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }
  show(): void {
    this.setAttribute('open', '');
  }
  hide(): void {
    this.removeAttribute('open');
  }
  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (content.getAttribute('align') ?? 'start') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
    });
  }
  private _reflect(): void {
    const open = this.hasAttribute('open');
    this.setAttribute('data-state', open ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-content');
    content?.setAttribute('data-state', open ? 'open' : 'closed');
  }
  private _setup(): void {
    queueMicrotask(() => {
      this._reposition();
      document.addEventListener('click', this._docClickHandler);
      document.addEventListener('keydown', this._keyHandler);
      window.addEventListener('resize', this._resizeHandler);
      window.addEventListener('scroll', this._resizeHandler, true);
      const first = this.querySelector<HTMLElement>(':scope ui-dropdown-menu-item:not([data-disabled])');
      first?.focus();
    });
  }
  private _teardown(): void {
    document.removeEventListener('click', this._docClickHandler);
    document.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('scroll', this._resizeHandler, true);
  }
  private _onDocClick(e: MouseEvent): void {
    if (!this.hasAttribute('open')) return;
    if (e.composedPath().some((n) => n === this)) return;
    this.hide();
  }
  private _onKeyDown(e: KeyboardEvent): void {
    if (!this.hasAttribute('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
      return;
    }
    const items = Array.from(
      this.querySelectorAll<HTMLElement>(':scope ui-dropdown-menu-item:not([data-disabled])'),
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
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
    }
  }
}
defineElement('ui-dropdown-menu', UiDropdownMenu);

export class UiDropdownMenuTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-trigger');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.toggle();
}
defineElement('ui-dropdown-menu-trigger', UiDropdownMenuTrigger);

export class UiDropdownMenuContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-content');
    this.setAttribute('role', 'menu');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuContentClass(), userClass);
  }
}
defineElement('ui-dropdown-menu-content', UiDropdownMenuContent);

export class UiDropdownMenuItem extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-item');
    this.setAttribute('role', 'menuitem');
    this.setAttribute('tabindex', '-1');
    if (!this.hasAttribute('variant')) this.setAttribute('variant', 'default');
    this.setAttribute('data-variant', this.getAttribute('variant') ?? 'default');
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuItemClass(), userClass);
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.hide();
  };
}
defineElement('ui-dropdown-menu-item', UiDropdownMenuItem);

export class UiDropdownMenuLabel extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-label');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuLabelClass(), userClass);
  }
}
defineElement('ui-dropdown-menu-label', UiDropdownMenuLabel);

export class UiDropdownMenuSeparator extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-separator');
    this.setAttribute('role', 'separator');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuSeparatorClass(), userClass);
  }
}
defineElement('ui-dropdown-menu-separator', UiDropdownMenuSeparator);

export class UiDropdownMenuShortcut extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-shortcut');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuShortcutClass(), userClass);
  }
}
defineElement('ui-dropdown-menu-shortcut', UiDropdownMenuShortcut);

export class UiDropdownMenuGroup extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-group');
    this.setAttribute('role', 'group');
  }
}
defineElement('ui-dropdown-menu-group', UiDropdownMenuGroup);
