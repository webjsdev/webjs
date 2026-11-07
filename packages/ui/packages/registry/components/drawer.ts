/**
 * Drawer: a panel that slides up from the bottom (or in from another edge)
 * and can be dragged away, the mobile pattern shadcn builds on vaul. Tier-2.
 * Like the sheet it IS a dialog: the native `<dialog>` opened with
 * `showModal()`, its focus trap, Escape and backdrop close, focus
 * restoration, scroll lock and label wiring. What the drawer adds is the
 * drag handle and drag-to-dismiss on Pointer Events, with no library.
 *
 * shadcn parity:
 *   Drawer               → <ui-drawer open>
 *   DrawerTrigger        → <ui-drawer-trigger>
 *   DrawerContent (direction: bottom | top | left | right)
 *                        → <ui-drawer-content direction="bottom">
 *   DrawerClose          → <ui-drawer-close>
 *   DrawerHeader / DrawerFooter
 *                        → <div class=${drawerHeaderClass()}> / <div class=${drawerFooterClass()}>
 *   DrawerTitle / DrawerDescription
 *                        → <h2 data-slot="drawer-title" class=${drawerTitleClass()}> /
 *                          <p data-slot="drawer-description" class=${drawerDescriptionClass()}>
 *
 * The panel carries `data-vaul-drawer-direction`, the attribute shadcn's
 * drawer styles key on, so every ported style applies to it unchanged.
 *
 * Dragging the panel toward its edge moves it with the pointer; releasing it
 * past a quarter of its size, or with a quick flick, closes the drawer, and
 * anything less snaps it back. A drag never starts on a control inside the
 * panel (a button, a field, a link), so those keep working.
 *
 * A11y (handled by the element, plus one obligation): the native `<dialog>`
 * carries `role="dialog"`, is named by the `drawer-title` node and described
 * by the `drawer-description` node, traps focus while open and returns it to
 * the trigger. Dragging is a pointer convenience only; Escape, the backdrop
 * and a close control are the ways everyone else closes it, so put a visible
 * close button (a `<ui-drawer-close>` around a real `<button>`) in every
 * drawer. The drag handle is decorative and hidden from assistive technology.
 *
 * @example
 * ```html
 * <ui-drawer>
 *   <ui-drawer-trigger><button class=${buttonClass({ variant: 'outline' })} type="button">Share</button></ui-drawer-trigger>
 *   <ui-drawer-content>
 *     <div class=${drawerHeaderClass()}>
 *       <h2 data-slot="drawer-title" class=${drawerTitleClass()}>Share this page</h2>
 *     </div>
 *     <div class=${drawerFooterClass()}>
 *       <ui-drawer-close><button class=${buttonClass({ variant: 'outline' })} type="button">Done</button></ui-drawer-close>
 *     </div>
 *   </ui-drawer-content>
 * </ui-drawer>
 * ```
 */
import { html } from '@webjsdev/core';
import { UiDialog, UiDialogTrigger, UiDialogContent, UiDialogClose } from './dialog.ts';

export type DrawerDirection = 'bottom' | 'top' | 'left' | 'right';

/** The visible panel. The element applies it; exported for a custom shell. */
export function drawerContentClass(): string {
  return 'cn-drawer-content group/drawer-content fixed z-50 data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm';
}

/** The drag handle at the top of a bottom drawer. The element renders it. */
/** The overlay behind the panel, which each style dims in its own way. */
export function drawerOverlayClass(): string {
  return 'cn-drawer-overlay fixed inset-0 z-50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0';
}

export function drawerHandleClass(): string {
  return 'cn-drawer-handle mx-auto hidden shrink-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:block';
}

/** The title and description block. */
export function drawerHeaderClass(): string {
  return 'cn-drawer-header flex flex-col group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center';
}

/** The actions block, pushed to the bottom. */
export function drawerFooterClass(): string {
  return 'cn-drawer-footer mt-auto flex flex-col';
}

/** The drawer's title. Mark it `data-slot="drawer-title"` so the drawer is named by it. */
export function drawerTitleClass(): string {
  return 'cn-drawer-title cn-font-heading';
}

/** The drawer's description. Mark it `data-slot="drawer-description"`. */
export function drawerDescriptionClass(): string {
  return 'cn-drawer-description';
}

export class UiDrawer extends UiDialog {
  static rootTag = 'ui-drawer';
  static contentTag = 'ui-drawer-content';
  static slotPrefix = 'drawer';
}
UiDrawer.register('ui-drawer');

export class UiDrawerTrigger extends UiDialogTrigger {
  static rootTag = 'ui-drawer';
  static slotPrefix = 'drawer';
}
UiDrawerTrigger.register('ui-drawer-trigger');

export class UiDrawerClose extends UiDialogClose {
  static rootTag = 'ui-drawer';
  static slotPrefix = 'drawer';
}
UiDrawerClose.register('ui-drawer-close');

// A drag past this share of the panel's size closes the drawer, as does a
// release faster than FLICK pixels per millisecond toward the edge.
const CLOSE_RATIO = 0.25;
const FLICK = 0.5;
const NO_DRAG = 'button, a[href], input, select, textarea, [contenteditable=""], [contenteditable="true"], [role="button"], [role="slider"]';

export class UiDrawerContent extends UiDialogContent {
  static rootTag = 'ui-drawer';
  static slotPrefix = 'drawer';

  #drag: { id: number; start: number; at: number; delta: number; panel: HTMLElement } | null = null;

  // `direction` is read straight from the attribute, like the sheet's side:
  // the element is built on the dialog's factory base and an author writes it
  // once. Attribute reads work during server rendering, so the first paint
  // already carries the direction.
  _direction(): DrawerDirection {
    const d = this.getAttribute?.('direction');
    return d === 'top' || d === 'left' || d === 'right' ? d : 'bottom';
  }

  _drawerDirection(): DrawerDirection {
    return this._direction();
  }

  _panelClass(): string {
    return drawerContentClass();
  }

  _overlayClass(): string {
    return drawerOverlayClass();
  }

  _panelLead(): unknown {
    return html`<div data-slot="drawer-handle" aria-hidden="true" class=${drawerHandleClass()}></div>`;
  }

  // The drawer has no corner X: its handle, a close control the author places
  // and Escape do that job, as in shadcn. Set in the constructor, which also
  // runs during server rendering, so the first paint has no X to remove; an
  // authored show-close-button attribute is applied after it and still wins.
  constructor() {
    super();
    this.showCloseButton = 'false';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this.addEventListener('pointerdown', this._onPointerDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointerdown', this._onPointerDown);
    super.disconnectedCallback?.();
  }

  /** +1 when moving toward the closing edge increases the coordinate. */
  _axis(): { key: 'clientX' | 'clientY'; sign: 1 | -1; size: 'offsetWidth' | 'offsetHeight' } {
    const d = this._direction();
    if (d === 'top') return { key: 'clientY', sign: -1, size: 'offsetHeight' };
    if (d === 'left') return { key: 'clientX', sign: -1, size: 'offsetWidth' };
    if (d === 'right') return { key: 'clientX', sign: 1, size: 'offsetWidth' };
    return { key: 'clientY', sign: 1, size: 'offsetHeight' };
  }

  _translate(delta: number): string {
    const d = this._direction();
    const v = d === 'top' || d === 'left' ? -delta : delta;
    return d === 'left' || d === 'right' ? `translateX(${v}px)` : `translateY(${v}px)`;
  }

  _onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !this._parent()?.open) return;
    const panel = this.querySelector<HTMLElement>('[data-slot="drawer-content"]');
    const target = e.target as Element | null;
    if (!panel || !target || !panel.contains(target)) return;
    if (target.closest(NO_DRAG) && !target.closest('[data-slot="drawer-handle"]')) return;
    const { key } = this._axis();
    this.#drag = { id: e.pointerId, start: e[key], at: e.timeStamp, delta: 0, panel };
    // Capture keeps the drag alive when the pointer leaves the panel. It throws
    // for a pointer that is no longer active, which only costs that nicety.
    try { panel.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    panel.style.transition = 'none';
    panel.addEventListener('pointermove', this._onPointerMove);
    panel.addEventListener('pointerup', this._onPointerUp);
    panel.addEventListener('pointercancel', this._onPointerUp);
  };

  _onPointerMove = (e: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || e.pointerId !== drag.id) return;
    const { key, sign } = this._axis();
    // Only movement toward the closing edge moves the panel.
    drag.delta = Math.max(0, (e[key] - drag.start) * sign);
    drag.panel.style.transform = this._translate(drag.delta);
  };

  _onPointerUp = (e: PointerEvent): void => {
    const drag = this.#drag;
    if (!drag || e.pointerId !== drag.id) return;
    this.#drag = null;
    const { panel, delta } = drag;
    panel.removeEventListener('pointermove', this._onPointerMove);
    panel.removeEventListener('pointerup', this._onPointerUp);
    panel.removeEventListener('pointercancel', this._onPointerUp);
    try { panel.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const size = panel[this._axis().size] || 1;
    const velocity = delta / Math.max(1, e.timeStamp - drag.at);
    panel.style.transition = '';
    panel.style.transform = '';
    if (e.type !== 'pointercancel' && delta > 0 && (delta > size * CLOSE_RATIO || velocity > FLICK)) {
      this._parent()?.hide();
    }
  };
}
UiDrawerContent.register('ui-drawer-content');
