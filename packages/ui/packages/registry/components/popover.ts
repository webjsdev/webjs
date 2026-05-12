import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Popover primitives. Composition:
 *
 *   <ui-popover>
 *     <ui-popover-trigger><ui-button>Open</ui-button></ui-popover-trigger>
 *     <ui-popover-content>Content...</ui-popover-content>
 *   </ui-popover>
 *
 * State is managed on the root <ui-popover>. The trigger toggles `open`;
 * the content portals into document.body and is positioned via floating-ui.
 * Click outside or Escape closes.
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'bottom') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

export class UiPopover extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-popover-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-popover-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-popover-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-popover-close', this._onClose as EventListener);
  }

  _onToggle = () => { this.setOpen(!this.open); };
  _onClose = () => { this.setOpen(false); };

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-popover-trigger, ui-popover-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  render() { return html`<slot></slot>`; }
}
UiPopover.register('ui-popover');

export class UiPopoverTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => { this.dispatchEvent(new CustomEvent('ui-popover-toggle', { bubbles: true })); };
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiPopoverTrigger.register('ui-popover-trigger');

export class UiPopoverContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;
  private _cleanupOutside: (() => void) | null = null;
  private _onKey: ((e: KeyboardEvent) => void) | null = null;

  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardown();
  }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state === 'open') this._show();
    else this._teardown();
  }

  _show() {
    if (this._portal) return;
    const root = this.closest('ui-popover') as HTMLElement | null;
    const trigger = root?.querySelector('ui-popover-trigger') as HTMLElement | null;
    if (!root || !trigger) return;

    const el = document.createElement('div');
    el.setAttribute('data-slot', 'popover-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;

    const placement = this.getAttribute('placement') || 'bottom';
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, placement));

    // click-outside
    const outside = (e: PointerEvent) => {
      const path = e.composedPath();
      if (!path.includes(el) && !path.includes(trigger)) {
        (root as any).dispatchEvent(new CustomEvent('ui-popover-close', { bubbles: true }));
      }
    };
    document.addEventListener('pointerdown', outside);
    this._cleanupOutside = () => document.removeEventListener('pointerdown', outside);

    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (root as any).dispatchEvent(new CustomEvent('ui-popover-close', { bubbles: true }));
    };
    document.addEventListener('keydown', this._onKey);
  }

  _teardown() {
    if (this._cleanupAutoUpdate) { this._cleanupAutoUpdate(); this._cleanupAutoUpdate = null; }
    if (this._cleanupOutside) { this._cleanupOutside(); this._cleanupOutside = null; }
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; } // content renders into portal, host stays empty
}
UiPopoverContent.register('ui-popover-content');
