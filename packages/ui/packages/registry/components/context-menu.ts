/**
 * Context menu: the menu a right-click (or the keyboard's menu key, or
 * Shift+F10) opens at the pointer, over a region of the page. Tier-2. It is
 * the dropdown menu opened a different way, as in shadcn, so every part is a
 * dropdown element under the `ui-context-menu-*` tags: the same items,
 * checkbox and radio items, labels, separators, shortcuts, groups and
 * sub-menus, the same keyboard model (arrows, Home / End, typeahead, Enter /
 * Space, Escape, Tab) and the same focus care on every close path.
 *
 * shadcn parity:
 *   ContextMenu              → <ui-context-menu>
 *   ContextMenuTrigger       → <ui-context-menu-trigger> around the region; a class
 *                              written on it lands on the region box it renders
 *   ContextMenuContent       → <ui-context-menu-content>
 *   ContextMenuItem          → <ui-context-menu-item> (variant, type="checkbox" | "radio", checked, value)
 *   ContextMenuLabel / Separator / Shortcut / Group
 *                            → <ui-context-menu-label> / -separator / -shortcut / -group
 *   ContextMenuSub / SubTrigger / SubContent
 *                            → <ui-context-menu-sub> / -sub-trigger / -sub-content
 *
 * The menu opens at the pointer for a right-click, and below the focused
 * element when the keyboard opened it. A left click never opens it, and a
 * click outside the panel (in the region or anywhere else) or Escape closes it.
 *
 * A11y (handled by the element, plus one obligation): the panel is a
 * `role="menu"` named "Context menu" unless you name it (`aria-label` on
 * `<ui-context-menu-content>`), items are menuitems with roving focus, and
 * closing returns focus to whatever had it before the menu opened. A context
 * menu is a shortcut, never the only way to reach an action: put each of its
 * commands somewhere a keyboard or touch user finds without a right-click
 * (a toolbar, a dropdown, a button), and make the region itself focusable
 * (`tabindex="0"` or a focusable child) so the keyboard can open the menu.
 *
 * @example
 * ```html
 * <ui-context-menu>
 *   <ui-context-menu-trigger>
 *     <div tabindex="0" class="flex h-36 items-center justify-center rounded-md border border-dashed">Right-click here</div>
 *   </ui-context-menu-trigger>
 *   <ui-context-menu-content aria-label="File actions">
 *     <ui-context-menu-item>Rename</ui-context-menu-item>
 *     <ui-context-menu-item variant="destructive">Delete</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 * ```
 */
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
import { html } from '@webjsdev/core';
import { cn, takeAuthoredClass } from '../lib/utils.ts';
import { positionFloating } from './popover.ts';

/** The trigger region's classes (the element applies them). */
export const contextMenuTriggerClass = (): string => 'cn-context-menu-trigger select-none';

/** The menu panel's classes (the element applies them). */
export const contextMenuContentClass = (): string =>
  'cn-context-menu-content z-50 origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto';
/** A menu item's classes (the element applies them). */
export const contextMenuItemClass = (): string =>
  'cn-context-menu-item group/context-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A checkbox item's classes (the element applies them). */
export const contextMenuCheckboxItemClass = (): string =>
  'cn-context-menu-checkbox-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A radio item's classes (the element applies them). */
export const contextMenuRadioItemClass = (): string =>
  'cn-context-menu-radio-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A group label's classes. */
export const contextMenuLabelClass = (): string =>
  'cn-context-menu-label';
/** A separator's classes. */
export const contextMenuSeparatorClass = (): string => 'cn-context-menu-separator';
/** A keyboard shortcut hint's classes. */
export const contextMenuShortcutClass = (): string =>
  'cn-context-menu-shortcut';
/** A sub-menu trigger's classes (the element applies them). */
export const contextMenuSubTriggerClass = (): string =>
  'cn-context-menu-sub-trigger flex cursor-default items-center select-none outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** A sub-menu panel's classes (the element applies them). */
export const contextMenuSubContentClass = (): string =>
  'cn-context-menu-sub-content z-50 origin-(--radix-context-menu-content-transform-origin) overflow-hidden';

const contextMenuItemIndicatorClass = (): string =>
  'cn-context-menu-item-indicator pointer-events-none';

// The dropdown elements paint each part through this table, so every part
// carries a cn-context-menu-* name, the one shadcn's styles give it.
const CONTEXT_MENU_CLASSES: MenuClasses = {
  content: contextMenuContentClass,
  item: contextMenuItemClass,
  checkboxItem: contextMenuCheckboxItemClass,
  radioItem: contextMenuRadioItemClass,
  itemIndicator: contextMenuItemIndicatorClass,
  label: contextMenuLabelClass,
  separator: contextMenuSeparatorClass,
  shortcut: contextMenuShortcutClass,
  subTrigger: contextMenuSubTriggerClass,
  subContent: contextMenuSubContentClass,
};

const FAMILY = 'ui-context-menu';

export class UiContextMenu extends UiDropdownMenu {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;

  // Where the menu opens, and who gets focus back when it closes.
  _point: { x: number; y: number } | null = null;
  _returnFocus: HTMLElement | null = null;

  /** Open the menu with its corner at (x, y), returning focus to `returnTo` on close. */
  openAt(x: number, y: number, returnTo: HTMLElement | null): void {
    this._point = { x, y };
    this._returnFocus = returnTo;
    if (this.open) this._reposition();
    else this.show();
  }

  // A context menu has no trigger button to sit against, so it is placed at
  // the pointer through a zero-size virtual anchor.
  _reposition(): void {
    const content = this._content();
    if (!content) return;
    const p = this._point ?? { x: 0, y: 0 };
    const anchor = { getBoundingClientRect: () => new DOMRect(p.x, p.y, 0, 0) } as unknown as HTMLElement;
    positionFloating(anchor, content, { side: 'bottom', align: 'start', sideOffset: 0, alignOffset: 0, radix: this.localName.slice(3) });
  }

  // Every close path returns focus through this: to the element that had focus
  // when the menu opened, else the region.
  _triggerControl(): HTMLElement | null {
    if (this._returnFocus?.isConnected) return this._returnFocus;
    return this.querySelector<HTMLElement>(`${FAMILY}-trigger`);
  }

  // The region is not a button, so it gets no aria-haspopup / aria-expanded.
  // The menu still needs a name, and a sub-menu is named by its sub-trigger.
  _wireAria(): void {
    const menu = this._menuEl();
    if (menu && !menu.hasAttribute('aria-label') && !menu.hasAttribute('aria-labelledby')) {
      const authored = this.querySelector(`${FAMILY}-content`)?.getAttribute('aria-label');
      menu.setAttribute('aria-label', authored || 'Context menu');
    }
    this._wireSubmenuAria();
  }

  /** Close, returning focus only when it was in the panel (a click in the region keeps its own focus). */
  _dismiss(): void {
    const panel = this.querySelector(`${FAMILY}-content`);
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && panel?.contains(active)) this._triggerControl()?.focus();
    this.hide();
  }

  // A right-click elsewhere fires no click, so the outside dismiss has to
  // happen on its pointerdown, or the menu would stay open beside the native
  // one the browser then shows.
  _onDocPointerDown(e: Event): void {
    super._onDocPointerDown(e);
    if (!this.open || (e as PointerEvent).button !== 2) return;
    if (e.composedPath().some((n) => n === this)) return;
    this._dismiss();
  }
}
UiContextMenu.register('ui-context-menu');

export class UiContextMenuTrigger extends UiDropdownMenuTrigger {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
  _authored: string | null = null;

  // shadcn's className on ContextMenuTrigger styles the region itself (its
  // size, the dashed border), so the class written on this host moves to the
  // box it renders and the host becomes `display: contents`. The host's box is
  // turned off through its style, which the server serves, so the first paint
  // has one region, not a host and a region both carrying the class.
  render() {
    this._authored = takeAuthoredClass(this, null);
    if (!this.getAttribute?.('style')) this.setAttribute?.('style', 'display: contents');
    return html`<div
      data-slot="context-menu-trigger"
      class=${cn(contextMenuTriggerClass(), this._authored)}
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  // A left click on the region never opens the menu. It closes an open one,
  // as a click anywhere outside the panel does.
  _onClick = (): void => {
    const root = this._root();
    if (root?.open) root._dismiss();
  };

  connectedCallback(): void {
    super.connectedCallback?.();
    this.addEventListener('contextmenu', this._onContextMenu);
    this.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('contextmenu', this._onContextMenu);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback?.();
  }

  _root(): UiContextMenu | null {
    return this.closest(FAMILY) as UiContextMenu | null;
  }

  // The element focus returns to: what had it, when that is in the region,
  // else the region's first focusable.
  _returnTarget(): HTMLElement | null {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    if (active && this.contains(active)) return active;
    return this.querySelector<HTMLElement>('[tabindex], button, a[href], input, select, textarea');
  }

  // Below the focused element's start corner, where a keyboard-opened menu goes.
  _openFromFocus(): void {
    const returnTo = this._returnTarget();
    // The host is display: contents and has no box of its own.
    const r = (returnTo ?? this.querySelector<HTMLElement>('[data-slot="context-menu-trigger"]') ?? this).getBoundingClientRect();
    this._root()?.openAt(r.left, r.bottom, returnTo);
  }

  _onContextMenu = (e: MouseEvent): void => {
    const root = this._root();
    if (!root) return;
    e.preventDefault();
    // A keyboard-fired contextmenu can report (0, 0) instead of a pointer.
    if (e.clientX === 0 && e.clientY === 0) this._openFromFocus();
    else root.openAt(e.clientX, e.clientY, this._returnTarget());
  };

  // The menu key and Shift+F10 are handled here rather than left to the
  // contextmenu they fire, which some engines place at (0, 0) and none fire
  // for a synthetic key event.
  _onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
    e.preventDefault();
    this._openFromFocus();
  };
}
UiContextMenuTrigger.register('ui-context-menu-trigger');

export class UiContextMenuContent extends UiDropdownMenuContent {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuContent.register('ui-context-menu-content');
export class UiContextMenuItem extends UiDropdownMenuItem {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuItem.register('ui-context-menu-item');
export class UiContextMenuLabel extends UiDropdownMenuLabel {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuLabel.register('ui-context-menu-label');
export class UiContextMenuSeparator extends UiDropdownMenuSeparator {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuSeparator.register('ui-context-menu-separator');
export class UiContextMenuShortcut extends UiDropdownMenuShortcut {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuShortcut.register('ui-context-menu-shortcut');
export class UiContextMenuGroup extends UiDropdownMenuGroup {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuGroup.register('ui-context-menu-group');
export class UiContextMenuSub extends UiDropdownMenuSub {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuSub.register('ui-context-menu-sub');
export class UiContextMenuSubTrigger extends UiDropdownMenuSubTrigger {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuSubTrigger.register('ui-context-menu-sub-trigger');
export class UiContextMenuSubContent extends UiDropdownMenuSubContent {
  static family = FAMILY;
  static classes = CONTEXT_MENU_CLASSES;
}
UiContextMenuSubContent.register('ui-context-menu-sub-content');
