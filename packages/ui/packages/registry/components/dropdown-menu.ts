/**
 * DropdownMenu — popover-style menu of actions. Hand-rolled keyboard nav
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
import { cn, Base, defineElement } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

export const dropdownMenuContentClass = (): string =>
  'z-50 max-h-[--available-height] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md';

// Each item class adds `:hover` variants of every `:focus` rule so the
// accent highlight paints under the cursor regardless of focus state.
// Shadcn's React build doesn't need this because Radix moves keyboard
// focus to whatever item the cursor is over (roving focus), so `:focus`
// alone covers both keyboard nav AND hover. We mimic that for the
// custom-element item (UiDropdownMenuItem.connectedCallback wires a
// pointerenter -> focus() handler below), but the checkbox-item /
// radio-item class helpers are applied to raw markup that we don't
// control, so the only way to guarantee a hover highlight there is to
// stamp `hover:bg-accent hover:text-accent-foreground` directly into
// the class string. Doing the same for the regular item is harmless
// (the focus path also applies, identical colours, no visual diff)
// and keeps the three classes consistent.

export const dropdownMenuItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:hover:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 dark:data-[variant=destructive]:hover:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

// Inset is universal across shadcn's radix-* style families on these
// two helpers — same boolean already plumbed on Item / Label /
// SubTrigger as full custom elements above. CheckboxItem and
// RadioItem are class-helper functions applied to user-authored
// markup, so there's no JS to mirror `inset` to data-inset; the user
// adds the `data-inset` attribute themselves on the element. The
// helper includes `data-[inset]:pl-8` in the class string so the
// rule fires when the user opts in. CheckboxItem already has pl-8
// baseline (to reserve room for the indicator); inset is a no-op
// for the inset case visually — kept for shadcn parity so a future
// indicator-less subitem keeps lining up with sibling Items that
// have leading icons.
export const dropdownMenuCheckboxItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const dropdownMenuRadioItemClass = (): string =>
  "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8";

// Label reads as a section header above a group of items. Shadcn's
// default (text-sm font-medium, same as items minus font-weight) was
// too subtle: at 14px, a 500-vs-400 weight difference is barely
// perceptible, so "My Account" looked like just another item with
// slightly bolder text. Tighten the typography hierarchy:
//   text-xs        — shrink relative to items so the label registers
//                    as supplementary metadata, not content
//   font-semibold  — recover the visual weight lost by going smaller
//   text-muted-foreground — different colour role from items, which
//                    is the strongest cue available for "this is not
//                    a clickable row, it's a label". Combined with
//                    the trailing <separator> already shipped in the
//                    docs example, the items group reads cleanly.
// pt-2 (vs py-1.5) adds a touch of top breathing room — labels feel
// off-balance flush against the menu's top edge.
export const dropdownMenuLabelClass = (): string =>
  'px-2 pt-2 pb-1.5 text-xs font-semibold text-muted-foreground data-[inset]:pl-8';

export const dropdownMenuSeparatorClass = (): string => '-mx-1 my-1 h-px bg-border';

export const dropdownMenuShortcutClass = (): string =>
  'ml-auto text-xs tracking-widest text-muted-foreground';

// Sub-trigger styling mirrors the regular item but adds:
//   - data-[state=open] highlight so the sub-trigger stays styled-as-hovered
//     while its submenu is open (matches Radix exactly)
//   - [&>svg:last-child]:ml-auto so the auto-injected chevron pushes to the
//     right edge of the trigger, after the label children
export const dropdownMenuSubTriggerClass = (): string =>
  "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm select-none outline-hidden focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:last-child]:ml-auto";

// Sub-content uses shadow-lg (vs the root content's shadow-md) so submenus
// visually stack above their parent — matches shadcn.
export const dropdownMenuSubContentClass = (): string =>
  'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg';

const STYLES = `
ui-dropdown-menu:not([open]) ui-dropdown-menu-content { display: none !important; }
ui-dropdown-menu-content { display: block; position: fixed; }
ui-dropdown-menu-sub:not([open]) ui-dropdown-menu-sub-content { display: none !important; }
ui-dropdown-menu-sub-content { display: block; position: fixed; }
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
    // Close any open submenus when the root closes — otherwise on re-open
    // they'd still carry their `[open]` attribute and re-appear.
    this.querySelectorAll<UiDropdownMenuSub>(':scope ui-dropdown-menu-sub[open]').forEach(
      (sub) => sub.hide(),
    );
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

    // Scope arrow nav to the "active context" — the nearest content or
    // sub-content panel owning the focused element. Without this, pressing
    // ArrowDown while a sub-trigger is focused would walk into the
    // submenu's items as if they were siblings of the parent items, since
    // querySelectorAll(':scope ui-dropdown-menu-item') returns all
    // descendants regardless of submenu boundaries.
    const active = document.activeElement as HTMLElement | null;
    const context = active?.closest(
      'ui-dropdown-menu-sub-content, ui-dropdown-menu-content',
    ) as HTMLElement | null;
    if (!context) return;

    // Items in this context = direct/indirect children that aren't deeper
    // inside another sub-content. closest() back up to the nearest panel
    // must equal the current context to be considered "ours".
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
      // Open the submenu owned by the focused sub-trigger and move
      // focus to its first item — matches Radix/shadcn.
      if (active?.tagName === 'UI-DROPDOWN-MENU-SUB-TRIGGER') {
        e.preventDefault();
        const sub = active.parentElement as UiDropdownMenuSub | null;
        if (sub?.tagName === 'UI-DROPDOWN-MENU-SUB') {
          sub.show();
          queueMicrotask(() => {
            const subContent = sub.querySelector<HTMLElement>(
              ':scope > ui-dropdown-menu-sub-content',
            );
            const firstSubItem = subContent?.querySelector<HTMLElement>(
              'ui-dropdown-menu-item:not([data-disabled]), ui-dropdown-menu-sub-trigger:not([data-disabled])',
            );
            firstSubItem?.focus();
          });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      // Inside a sub-content: close the submenu and refocus its trigger.
      if (context.tagName === 'UI-DROPDOWN-MENU-SUB-CONTENT') {
        e.preventDefault();
        const sub = context.parentElement as UiDropdownMenuSub | null;
        const trigger = sub?.querySelector<HTMLElement>(
          ':scope > ui-dropdown-menu-sub-trigger',
        );
        sub?.hide();
        trigger?.focus();
      }
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
    // Move keyboard focus to whichever item the cursor is over —
    // matches Radix's roving-focus pattern. Without this the menu has
    // two parallel cursors (arrow-key focus + mouse hover) that drift
    // apart: a user who arrow-navigated to item B then mouse-hovers
    // item D sees BOTH highlighted (B via :focus, D via :hover). With
    // pointerenter -> focus(), the two converge and arrow keys
    // continue from wherever the mouse last pointed.
    this.addEventListener('pointerenter', this._onPointerEnter);
    // Mirror native :focus to a data-highlighted attribute so shadcn
    // class strings using `data-[highlighted]:bg-accent` (Radix's
    // roving-focus marker) work verbatim on our items. Our own
    // styling already uses :focus + :hover for the highlight (see
    // dropdownMenuItemClass) — this attr is purely for shadcn
    // selector portability.
    this.addEventListener('focus', this._onFocus);
    this.addEventListener('blur', this._onBlur);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerenter', this._onPointerEnter);
    this.removeEventListener('focus', this._onFocus);
    this.removeEventListener('blur', this._onBlur);
  }
  private _onClick = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    (this.closest('ui-dropdown-menu') as UiDropdownMenu | null)?.hide();
  };
  private _onPointerEnter = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    this.focus();
  };
  private _onFocus = (): void => {
    this.setAttribute('data-highlighted', '');
  };
  private _onBlur = (): void => {
    this.removeAttribute('data-highlighted');
  };
}
defineElement('ui-dropdown-menu-item', UiDropdownMenuItem);

export class UiDropdownMenuLabel extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-label');
    // `inset` mirrors the existing item behaviour — shadcn exposes the
    // same boolean on Label so the indent column for icon-aligned items
    // stays consistent. The label class already includes
    // data-[inset]:pl-8 so only the attribute reflection is missing.
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
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

// --------------------------------------------------------------------------
// Submenu — Sub / SubTrigger / SubContent (shadcn parity)
// --------------------------------------------------------------------------

// Right-chevron auto-injected on every <ui-dropdown-menu-sub-trigger> if the
// user didn't supply a trailing icon themselves. Shadcn's React component
// hard-appends a <ChevronRightIcon> after children; we do the same on
// connectedCallback so authors can write
// `<ui-dropdown-menu-sub-trigger>Invite</ui-dropdown-menu-sub-trigger>`
// without remembering to include the chevron markup.
const CHEVRON_RIGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto size-4" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

// Delay before closing a submenu on pointerleave. Without it, any small
// horizontal gap between trigger and content (or any momentary cursor
// dip outside the panel) instantly closes the menu. 200ms matches Radix.
const SUB_CLOSE_DELAY = 200;

export class UiDropdownMenuSub extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  private _closeTimer: number | undefined;
  private _pointerEnterHandler = (): void => this._cancelClose();
  private _pointerLeaveHandler = (): void => this._scheduleClose();

  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub');
    this._reflect();
    // pointerleave fires once when the cursor leaves the element AND all
    // its descendants — so moving from trigger to sub-content (both
    // children of <ui-dropdown-menu-sub>) doesn't trigger a close, but
    // moving off the whole submenu does. position: fixed on the sub-
    // content doesn't change DOM lineage; events still bubble correctly.
    this.addEventListener('pointerenter', this._pointerEnterHandler);
    this.addEventListener('pointerleave', this._pointerLeaveHandler);
  }
  disconnectedCallback(): void {
    this.removeEventListener('pointerenter', this._pointerEnterHandler);
    this.removeEventListener('pointerleave', this._pointerLeaveHandler);
    this._cancelClose();
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open' && oldVal !== newVal) {
      this._reflect();
      if (newVal !== null) this._position();
    }
  }

  show(): void {
    this._cancelClose();
    this.setAttribute('open', '');
  }
  hide(): void {
    this._cancelClose();
    this.removeAttribute('open');
  }
  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }

  private _scheduleClose(): void {
    this._cancelClose();
    this._closeTimer = window.setTimeout(() => this.hide(), SUB_CLOSE_DELAY);
  }
  private _cancelClose(): void {
    if (this._closeTimer !== undefined) {
      clearTimeout(this._closeTimer);
      this._closeTimer = undefined;
    }
  }

  private _reflect(): void {
    const open = this.hasAttribute('open');
    this.setAttribute('data-state', open ? 'open' : 'closed');
    const trigger = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-sub-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-sub-content');
    trigger?.setAttribute('data-state', open ? 'open' : 'closed');
    content?.setAttribute('data-state', open ? 'open' : 'closed');
  }

  _position(): void {
    // Same positionFloating used by the root content + popover. Side
    // defaults to 'right' (submenus open beside their trigger);
    // align: 'start' lines the submenu top with the trigger top.
    // sideOffset defaults to -4 — a slight inward overlap bridges the
    // mouse-travel gap between trigger and panel so the cursor doesn't
    // trigger pointerleave by passing through a 1px seam.
    queueMicrotask(() => {
      const trigger = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-sub-trigger');
      const content = this.querySelector<HTMLElement>(':scope > ui-dropdown-menu-sub-content');
      if (!trigger || !content) return;
      positionFloating(trigger, content, {
        side: (content.getAttribute('side') ?? 'right') as PopoverSide,
        align: (content.getAttribute('align') ?? 'start') as PopoverAlign,
        sideOffset: Number(content.getAttribute('side-offset') ?? -4),
      });
    });
  }
}
defineElement('ui-dropdown-menu-sub', UiDropdownMenuSub);

export class UiDropdownMenuSubTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub-trigger');
    this.setAttribute('role', 'menuitem');
    this.setAttribute('tabindex', '-1');
    this.setAttribute('aria-haspopup', 'menu');
    // `inset` is already reflected here (and is the only of the three
    // inset-aware elements that had it before this change — see
    // UiDropdownMenuItem + UiDropdownMenuLabel above for the other two).
    if (this.hasAttribute('inset')) this.setAttribute('data-inset', '');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuSubTriggerClass(), userClass);
    // Auto-inject right-chevron unless user already supplied a trailing svg.
    if (!this.querySelector(':scope > svg:last-child')) {
      const tmp = document.createElement('div');
      tmp.innerHTML = CHEVRON_RIGHT_SVG;
      const svg = tmp.firstChild;
      if (svg) this.appendChild(svg);
    }
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerenter', this._onPointerEnter);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerenter', this._onPointerEnter);
  }
  private _onClick = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    const sub = this.parentElement as UiDropdownMenuSub | null;
    if (sub?.tagName === 'UI-DROPDOWN-MENU-SUB') sub.toggle();
  };
  private _onPointerEnter = (): void => {
    if (this.hasAttribute('data-disabled')) return;
    this.focus();
    const sub = this.parentElement as UiDropdownMenuSub | null;
    if (sub?.tagName === 'UI-DROPDOWN-MENU-SUB') sub.show();
  };
}
defineElement('ui-dropdown-menu-sub-trigger', UiDropdownMenuSubTrigger);

export class UiDropdownMenuSubContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dropdown-menu-sub-content');
    this.setAttribute('role', 'menu');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dropdownMenuSubContentClass(), userClass);
  }
}
defineElement('ui-dropdown-menu-sub-content', UiDropdownMenuSubContent);
