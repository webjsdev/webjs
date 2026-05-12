import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Drawer — shadcn parity. Supports drag-to-dismiss (vaul-style) on
 * pointer/touch, all four directions, velocity-based dismissal,
 * spring snap-back, and backdrop opacity tracking the drag.
 *
 *   <ui-drawer direction="bottom">
 *     <ui-drawer-trigger><ui-button>Open</ui-button></ui-drawer-trigger>
 *     <ui-drawer-content>
 *       <ui-drawer-handle></ui-drawer-handle>  <!-- optional explicit handle -->
 *       <ui-drawer-header>
 *         <ui-drawer-title>Title</ui-drawer-title>
 *         <ui-drawer-description>...</ui-drawer-description>
 *       </ui-drawer-header>
 *       ...
 *       <ui-drawer-footer>...</ui-drawer-footer>
 *     </ui-drawer-content>
 *   </ui-drawer>
 */

type DrawerDirection = 'bottom' | 'top' | 'left' | 'right';
const SPRING_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export class UiDrawer extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
    direction: { type: String, reflect: true },
  };
  declare open: boolean;
  declare direction: DrawerDirection;
  private _lastFocused: HTMLElement | null = null;

  constructor() { super(); this.open = false; this.direction = 'bottom'; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-drawer-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-drawer-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-drawer-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-drawer-close', this._onClose as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    const dir = this.direction || 'bottom';
    this.querySelectorAll('ui-drawer-content, ui-drawer-trigger').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
      (el as HTMLElement).setAttribute('data-direction', dir);
    });
    if (open) {
      this._lastFocused = document.activeElement as HTMLElement;
      document.addEventListener('keydown', this._onKey);
    } else {
      document.removeEventListener('keydown', this._onKey);
      this._lastFocused?.focus();
    }
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); this.setOpen(false); } };

  render() { return html`<slot></slot>`; }
}
UiDrawer.register('ui-drawer');

export class UiDrawerTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-drawer-toggle', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDrawerTrigger.register('ui-drawer-trigger');

export class UiDrawerClose extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-drawer-close', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDrawerClose.register('ui-drawer-close');

/** Optional explicit grabbable handle. Visually identical to the auto-rendered grip;
 *  the difference is that consumers can place it anywhere inside content. */
export class UiDrawerHandle extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('data-drawer-drag-handle', '');
  }
  render() {
    return html`<div class="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted cursor-grab active:cursor-grabbing" aria-hidden="true"></div>`;
  }
}
UiDrawerHandle.register('ui-drawer-handle');

export class UiDrawerContent extends WebComponent {
  private _slot = '';

  // Drag state
  private _dragging = false;
  private _startX = 0;
  private _startY = 0;
  private _pointerId: number | null = null;
  private _contentEl: HTMLElement | null = null;
  private _overlayEl: HTMLElement | null = null;
  private _samples: Array<{ t: number; v: number }> = [];
  private _size = 0;
  private _axis: 'x' | 'y' = 'y';
  private _sign: 1 | -1 = 1; // +1 = dismiss when positive delta (bottom/right), -1 = dismiss when negative (top/left)

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._removeDocListeners();
  }

  static get observedAttributes() { return ['data-state', 'data-direction']; }
  attributeChangedCallback() { this.requestUpdate(); }

  private _direction(): DrawerDirection {
    const d = (this.getAttribute('data-direction') as DrawerDirection) || 'bottom';
    return d;
  }

  render() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state !== 'open') return html``;
    const direction = this._direction();

    const positionCls = ({
      bottom: 'inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t',
      top:    'inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b',
      left:   'inset-y-0 left-0 mr-24 max-w-[80vw] w-3/4 rounded-r-lg border-r',
      right:  'inset-y-0 right-0 ml-24 max-w-[80vw] w-3/4 rounded-l-lg border-l',
    } as const)[direction];

    const animCls = ({
      bottom: 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      top:    'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
      left:   'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
      right:  'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    } as const)[direction];

    const flexCls = (direction === 'left' || direction === 'right') ? 'flex-row' : 'flex-col';
    const showHandle = direction === 'bottom' || direction === 'top';

    return html`
      <div
        data-slot="drawer-overlay"
        data-state=${state}
        class=${cn('fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0')}
        @click=${this._closeOnOverlay}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        data-slot="drawer-content"
        data-state=${state}
        data-vaul-drawer-direction=${direction}
        class=${cn('group/drawer-content fixed z-50 flex h-auto bg-background', flexCls, positionCls, 'data-[state=closed]:animate-out data-[state=closed]:duration-300', 'data-[state=open]:animate-in data-[state=open]:duration-500', animCls)}
        @pointerdown=${this._onPointerDown}
      >
        ${showHandle ? html`<div data-drawer-drag-handle class="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted cursor-grab active:cursor-grabbing" aria-hidden="true"></div>` : html``}
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }

  _closeOnOverlay = (e: Event) => {
    if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('ui-drawer-close', { bubbles: true }));
  };

  // ── Drag ─────────────────────────────────────────────────────────────

  private _refsForDrag(): boolean {
    this._contentEl = this.querySelector('[data-slot="drawer-content"]') as HTMLElement | null;
    this._overlayEl = this.querySelector('[data-slot="drawer-overlay"]') as HTMLElement | null;
    return !!this._contentEl;
  }

  private _shouldStartDragFrom(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    // Explicit drag handle always starts drag.
    if (target.closest('[data-drawer-drag-handle]')) return true;
    // Skip interactive children — let them receive the pointer.
    if (target.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-drag]')) return false;
    return true;
  }

  _onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!this._refsForDrag()) return;
    if (!this._shouldStartDragFrom(e.target)) return;

    const dir = this._direction();
    this._axis = (dir === 'left' || dir === 'right') ? 'x' : 'y';
    this._sign = (dir === 'bottom' || dir === 'right') ? 1 : -1;

    const rect = this._contentEl!.getBoundingClientRect();
    this._size = this._axis === 'y' ? rect.height : rect.width;

    this._dragging = true;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._pointerId = e.pointerId;
    this._samples = [{ t: performance.now(), v: this._axis === 'y' ? e.clientY : e.clientX }];

    // Kill any in-flight snap-back transition.
    this._contentEl!.style.transition = 'none';

    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }

    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
    document.addEventListener('pointercancel', this._onPointerUp);
  };

  _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging || !this._contentEl) return;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    const raw = this._axis === 'y' ? dy : dx;
    // Constrain: only allow movement in the dismiss direction (clamp to 0 otherwise).
    const delta = this._sign === 1 ? Math.max(0, raw) : Math.min(0, raw);

    this._samples.push({ t: performance.now(), v: this._axis === 'y' ? e.clientY : e.clientX });
    if (this._samples.length > 5) this._samples.shift();

    const axisProp = this._axis === 'y' ? 'translateY' : 'translateX';
    this._contentEl.style.transform = `${axisProp}(${delta}px)`;

    if (this._overlayEl && this._size > 0) {
      const progress = Math.min(1, Math.abs(delta) / this._size);
      this._overlayEl.style.opacity = String(1 - progress);
    }
  };

  _onPointerUp = (e: PointerEvent) => {
    if (!this._dragging || !this._contentEl) return;
    this._dragging = false;
    this._removeDocListeners();

    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    const raw = this._axis === 'y' ? dy : dx;
    const delta = this._sign === 1 ? Math.max(0, raw) : Math.min(0, raw);
    const absDelta = Math.abs(delta);

    // Velocity from ring buffer
    let velocity = 0;
    if (this._samples.length >= 2) {
      const a = this._samples[0];
      const b = this._samples[this._samples.length - 1];
      const dt = b.t - a.t;
      velocity = dt > 0 ? Math.abs((b.v - a.v) / dt) : 0;
    }

    const distanceDismiss = this._size > 0 && absDelta > this._size * 0.5;
    const velocityDismiss = velocity > 0.5 && absDelta > 20; // require some movement
    const shouldDismiss = distanceDismiss || velocityDismiss;

    if (shouldDismiss) {
      this.dispatchEvent(new CustomEvent('ui-drawer-close', { bubbles: true }));
      // Leave transform in place; close re-renders content (state=closed → empty).
    } else {
      this._snapBack();
    }
  };

  private _snapBack() {
    const el = this._contentEl;
    if (!el) return;
    el.style.transition = `transform 300ms ${SPRING_EASE}`;
    el.style.transform = '';
    if (this._overlayEl) {
      this._overlayEl.style.transition = `opacity 300ms ${SPRING_EASE}`;
      this._overlayEl.style.opacity = '';
    }
    const clear = () => {
      el.style.transition = '';
      if (this._overlayEl) this._overlayEl.style.transition = '';
      el.removeEventListener('transitionend', clear);
    };
    el.addEventListener('transitionend', clear);
  }

  private _removeDocListeners() {
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    document.removeEventListener('pointercancel', this._onPointerUp);
  }
}
UiDrawerContent.register('ui-drawer-content');

function makeChild(tag: string, slot: string, classes: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  C.register(tag);
  return C;
}

export const UiDrawerHeader = makeChild('ui-drawer-header', 'drawer-header', 'flex flex-col gap-0.5 p-4 text-center md:gap-1.5 md:text-left');
export const UiDrawerFooter = makeChild('ui-drawer-footer', 'drawer-footer', 'mt-auto flex flex-col gap-2 p-4');
export const UiDrawerTitle = makeChild('ui-drawer-title', 'drawer-title', 'font-semibold text-foreground');
export const UiDrawerDescription = makeChild('ui-drawer-description', 'drawer-description', 'text-sm text-muted-foreground');
