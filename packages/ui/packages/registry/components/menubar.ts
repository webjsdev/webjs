/**
 * Menubar: a row of menus, like a desktop application's File / Edit / View.
 * Tier-2. As in shadcn, each menu is the dropdown menu under the
 * `ui-menubar-*` tags: the same items, checkbox and radio items, labels,
 * separators, shortcuts, groups and sub-menus, with the same keyboard model
 * inside an open menu. The bar adds what a row of menus needs on top.
 *
 * shadcn parity:
 *   Menubar                  → <ui-menubar>
 *   MenubarMenu              → <ui-menubar-menu>
 *   MenubarTrigger           → <ui-menubar-trigger>File</ui-menubar-trigger> (renders the button)
 *   MenubarContent           → <ui-menubar-content side align side-offset align-offset>
 *   MenubarItem              → <ui-menubar-item> (variant, inset, type="checkbox" | "radio", checked, value)
 *   MenubarLabel / Separator / Shortcut / Group
 *                            → <ui-menubar-label> / -separator / -shortcut / -group
 *   MenubarSub / SubTrigger / SubContent
 *                            → <ui-menubar-sub> / -sub-trigger / -sub-content
 *
 * Keyboard (WAI-ARIA menubar pattern):
 *   - The bar is one Tab stop. ArrowLeft / ArrowRight move between the
 *     triggers (wrapping), Home / End go to the first / last.
 *   - ArrowDown, Enter or Space opens a trigger's menu on its first item,
 *     ArrowUp on its last.
 *   - In an open menu, ArrowLeft / ArrowRight open the neighbouring menu,
 *     unless they open or close a sub-menu. Escape closes the menu and
 *     returns focus to its trigger, Tab closes it and leaves the bar.
 *   - While a menu is open, pointing at another trigger opens that one.
 *
 * Only one menu in a bar is open at a time.
 *
 * A11y (handled by the element): the bar is `role="menubar"`, each trigger is
 * a `role="menuitem"` button carrying `aria-haspopup`, `aria-expanded` and
 * `aria-controls`, and each menu is named by its trigger. Give the bar a name
 * when the page has more than one (`aria-label` on `<ui-menubar>`).
 *
 * @example
 * ```html
 * <ui-menubar aria-label="Editor">
 *   <ui-menubar-menu>
 *     <ui-menubar-trigger>File</ui-menubar-trigger>
 *     <ui-menubar-content>
 *       <ui-menubar-item>New Tab<ui-menubar-shortcut>⌘T</ui-menubar-shortcut></ui-menubar-item>
 *       <ui-menubar-separator></ui-menubar-separator>
 *       <ui-menubar-item>Print</ui-menubar-item>
 *     </ui-menubar-content>
 *   </ui-menubar-menu>
 *   <ui-menubar-menu>
 *     <ui-menubar-trigger>View</ui-menubar-trigger>
 *     <ui-menubar-content>
 *       <ui-menubar-item type="checkbox" checked>Show Status Bar</ui-menubar-item>
 *     </ui-menubar-content>
 *   </ui-menubar-menu>
 * </ui-menubar>
 * ```
 */
import { WebComponent, html } from '@webjsdev/core';
import {
  UiDropdownMenu,
  UiDropdownMenuTrigger,
  UiDropdownMenuContent,
  UiDropdownMenuItem,
  UiDropdownMenuLabel,
  UiDropdownMenuSeparator,
  UiDropdownMenuShortcut,
  UiDropdownMenuGroup,
  UiDropdownMenuSub,
  UiDropdownMenuSubTrigger,
  UiDropdownMenuSubContent,
  type MenuClasses,
} from './dropdown-menu.ts';

/** The bar's classes (the element applies them). */
export const menubarClass = (): string =>
  'cn-menubar flex items-center';
/** A trigger button's classes (the element applies them). */
export const menubarTriggerClass = (): string =>
  'cn-menubar-trigger flex items-center outline-hidden select-none';
/** A menu panel's classes (the element applies them). */
export const menubarContentClass = (): string =>
  'cn-menubar-content z-50 origin-(--radix-menubar-content-transform-origin) overflow-x-hidden overflow-y-auto not-open:hidden';
/** A menu item's classes (the element applies them). */
export const menubarItemClass = (): string =>
  'cn-menubar-item group/menubar-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A checkbox item's classes (the element applies them). */
export const menubarCheckboxItemClass = (): string =>
  'cn-menubar-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A radio item's classes (the element applies them). */
export const menubarRadioItemClass = (): string =>
  'cn-menubar-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A group label's classes. */
export const menubarLabelClass = (): string =>
  'cn-menubar-label';
/** A separator's classes. */
export const menubarSeparatorClass = (): string => 'cn-menubar-separator -mx-1 my-1 h-px';
/** A keyboard shortcut hint's classes. */
export const menubarShortcutClass = (): string =>
  'cn-menubar-shortcut ms-auto';
/** A sub-menu trigger's classes (the element applies them). */
export const menubarSubTriggerClass = (): string =>
  'cn-menubar-sub-trigger flex cursor-default items-center select-none outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A sub-menu panel's classes (the element applies them). */
export const menubarSubContentClass = (): string =>
  'cn-menubar-sub-content z-50 origin-(--radix-menubar-content-transform-origin) overflow-hidden not-open:hidden';

const menubarItemIndicatorClass = (type?: 'checkbox' | 'radio'): string =>
  type === 'radio'
    ? 'cn-menubar-radio-item-indicator pointer-events-none absolute flex items-center justify-center'
    : 'cn-menubar-checkbox-item-indicator pointer-events-none absolute flex items-center justify-center';

// The dropdown elements paint each part through this table, so every part
// carries a cn-menubar-* name, the one shadcn's styles give it.
const MENUBAR_CLASSES: MenuClasses = {
  content: menubarContentClass,
  item: menubarItemClass,
  checkboxItem: menubarCheckboxItemClass,
  radioItem: menubarRadioItemClass,
  itemIndicator: menubarItemIndicatorClass,
  label: menubarLabelClass,
  separator: menubarSeparatorClass,
  shortcut: menubarShortcutClass,
  subTrigger: menubarSubTriggerClass,
  subContent: menubarSubContentClass,
};

const FAMILY = 'ui-menubar';
const MENU = 'ui-menubar-menu';

// --------------------------------------------------------------------------
// <ui-menubar>
// --------------------------------------------------------------------------

export class UiMenubar extends WebComponent {
  render() {
    return html`<div
      data-slot="menubar"
      role="menubar"
      aria-label=${this.getAttribute?.('aria-label') ?? null}
      class=${menubarClass()}
      @keydown=${this._onKeyDown}
      @focusin=${this._onFocusIn}
    ><slot></slot></div>`;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    // The triggers are slotted in a pass after the first render, so the tab
    // stop is set once they are in place.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this._roving());
    }
  }

  /** The menus in this bar, in order. */
  menus(): UiMenubarMenu[] {
    return Array.from(this.querySelectorAll<UiMenubarMenu>(MENU)).filter(
      (m) => m.closest(FAMILY) === this,
    );
  }

  /** The bar's open menu, if any. */
  openMenu(): UiMenubarMenu | null {
    return this.menus().find((m) => m.open) ?? null;
  }

  _buttons(): HTMLElement[] {
    return this.menus()
      .map((m) => m._triggerControl())
      .filter((b): b is HTMLElement => !!b);
  }

  // One trigger is in the tab order: the focused one, else the one that was,
  // else the first.
  _roving(current?: HTMLElement | null): void {
    const buttons = this._buttons();
    if (!buttons.length) return;
    const keep = current ?? buttons.find((b) => b.tabIndex === 0) ?? buttons[0];
    buttons.forEach((b) => { b.tabIndex = b === keep ? 0 : -1; });
  }

  _onFocusIn = (e: FocusEvent): void => {
    const button = this._buttons().find((b) => b === e.target);
    if (button) this._roving(button);
  };

  /** Open `menu`, closing whichever other menu in the bar is open. */
  switchTo(menu: UiMenubarMenu, focusLast = false): void {
    const current = this.openMenu();
    const target = menu._triggerControl();
    this._roving(target);
    if (current && current !== menu) {
      // Focus leaves the closing panel BEFORE it hides, or the engine drops
      // it to <body> (the popover="manual" rule every overlay here follows).
      target?.focus();
      current.hide();
    }
    menu._focusLastOnOpen = focusLast;
    menu.show();
  }

  // Keys on a trigger button. Keys inside an open menu are the menu's (the
  // dropdown root listens on the document while it is open).
  _onKeyDown = (e: KeyboardEvent): void => {
    const buttons = this._buttons();
    const i = buttons.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    const menus = this.menus();
    const go = (j: number) => {
      e.preventDefault();
      const b = buttons[(j + buttons.length) % buttons.length];
      this._roving(b);
      b.focus();
    };
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(buttons.length - 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.switchTo(menus[i], e.key === 'ArrowUp');
    }
  };
}
UiMenubar.register('ui-menubar');

// --------------------------------------------------------------------------
// <ui-menubar-menu>
// --------------------------------------------------------------------------

export class UiMenubarMenu extends UiDropdownMenu {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
  static placement = { sideOffset: 8, alignOffset: -4 };

  // ArrowUp on a trigger opens on the LAST item.
  _focusLastOnOpen = false;

  _bar(): UiMenubar | null {
    return this.closest(FAMILY) as UiMenubar | null;
  }

  // The dropdown opens on its first item. ArrowUp asks for the last.
  _setup(): void {
    super._setup();
    if (!this._focusLastOnOpen) return;
    this._focusLastOnOpen = false;
    queueMicrotask(() => {
      const items = this.querySelectorAll<HTMLElement>(
        `${FAMILY}-content [role^="menuitem"]:not([data-disabled])`,
      );
      const own = Array.from(items).filter((it) => !it.closest(`${FAMILY}-sub-content`));
      own[own.length - 1]?.focus();
    });
  }

  // Opening one menu closes the others: one open menu per bar.
  updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (!changedProperties.has('open') || !this.open) return;
    this._bar()?.menus().forEach((m) => { if (m !== this && m.open) m.hide(); });
  }

  // The dropdown wires aria-haspopup, aria-expanded and aria-controls. The
  // trigger's open styling keys on data-state, so that follows too.
  _wireAria(): void {
    super._wireAria();
    this._triggerControl()?.setAttribute('data-state', this.open ? 'open' : 'closed');
  }

  // ArrowLeft / ArrowRight the dropdown did not take (it takes them only to
  // open or close a sub-menu) move to the neighbouring menu.
  _onKeyDown(e: KeyboardEvent): void {
    super._onKeyDown(e);
    if (!this.open || e.defaultPrevented) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const bar = this._bar();
    const menus = bar?.menus() ?? [];
    const i = menus.indexOf(this);
    if (!bar || i < 0 || menus.length < 2) return;
    e.preventDefault();
    const next = menus[(i + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length];
    bar.switchTo(next);
  }
}
UiMenubarMenu.register('ui-menubar-menu');

// --------------------------------------------------------------------------
// <ui-menubar-trigger>
// --------------------------------------------------------------------------

export class UiMenubarTrigger extends UiDropdownMenuTrigger {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;

  // shadcn's MenubarTrigger IS the button, so the trigger renders it, with the
  // role and the popup relationship on the element that takes focus.
  render() {
    return html`<button
      type="button"
      data-slot="menubar-trigger"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded="false"
      data-state="closed"
      class=${menubarTriggerClass()}
      @click=${this._onClick}
      @pointerenter=${this._onPointerEnter}
    ><slot></slot></button>`;
  }

  _menu(): UiMenubarMenu | null {
    return this.closest(MENU) as UiMenubarMenu | null;
  }

  _onClick = (): void => {
    const menu = this._menu();
    if (!menu) return;
    const bar = menu._bar();
    if (menu.open) menu.hide();
    else if (bar) bar.switchTo(menu);
    else menu.show();
  };

  // While one menu is open, pointing at another trigger opens that one.
  _onPointerEnter = (): void => {
    const menu = this._menu();
    const bar = menu?._bar();
    if (!menu || !bar || menu.open || !bar.openMenu()) return;
    bar.switchTo(menu);
  };
}
UiMenubarTrigger.register('ui-menubar-trigger');

export class UiMenubarContent extends UiDropdownMenuContent {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarContent.register('ui-menubar-content');
export class UiMenubarItem extends UiDropdownMenuItem {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarItem.register('ui-menubar-item');
export class UiMenubarLabel extends UiDropdownMenuLabel {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarLabel.register('ui-menubar-label');
export class UiMenubarSeparator extends UiDropdownMenuSeparator {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarSeparator.register('ui-menubar-separator');
export class UiMenubarShortcut extends UiDropdownMenuShortcut {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarShortcut.register('ui-menubar-shortcut');
export class UiMenubarGroup extends UiDropdownMenuGroup {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarGroup.register('ui-menubar-group');
export class UiMenubarSub extends UiDropdownMenuSub {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarSub.register('ui-menubar-sub');
export class UiMenubarSubTrigger extends UiDropdownMenuSubTrigger {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarSubTrigger.register('ui-menubar-sub-trigger');
export class UiMenubarSubContent extends UiDropdownMenuSubContent {
  static family = FAMILY;
  static rootTag = MENU;
  static classes = MENUBAR_CLASSES;
}
UiMenubarSubContent.register('ui-menubar-sub-content');
