import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Hover card. Same shape as popover but opens on hover (with delay) and
 * closes on mouseleave from the trigger AND content.
 *
 *   <ui-hover-card>
 *     <ui-hover-card-trigger>@username</ui-hover-card-trigger>
 *     <ui-hover-card-content>Bio...</ui-hover-card-content>
 *   </ui-hover-card>
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

const OPEN_DELAY = 700;
const CLOSE_DELAY = 300;

export class UiHoverCard extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _openTimer: any = null;
  private _closeTimer: any = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-hover-card-open-request', this._onOpenReq as EventListener);
    this.addEventListener('ui-hover-card-close-request', this._onCloseReq as EventListener);
    this.addEventListener('ui-hover-card-cancel-close', this._cancelClose as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._openTimer) clearTimeout(this._openTimer);
    if (this._closeTimer) clearTimeout(this._closeTimer);
  }

  _onOpenReq = () => {
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
    if (this.open) return;
    this._openTimer = setTimeout(() => this.setOpen(true), OPEN_DELAY);
  };

  _onCloseReq = () => {
    if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
    this._closeTimer = setTimeout(() => this.setOpen(false), CLOSE_DELAY);
  };

  _cancelClose = () => {
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
  };

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-hover-card-trigger, ui-hover-card-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
  }

  render() { return html`<slot></slot>`; }
}
UiHoverCard.register('ui-hover-card');

export class UiHoverCardTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', this._onEnter);
    this.addEventListener('pointerleave', this._onLeave);
    this.addEventListener('focus', this._onEnter, true);
    this.addEventListener('blur', this._onLeave, true);
  }
  _onEnter = () => this.dispatchEvent(new CustomEvent('ui-hover-card-open-request', { bubbles: true }));
  _onLeave = () => this.dispatchEvent(new CustomEvent('ui-hover-card-close-request', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiHoverCardTrigger.register('ui-hover-card-trigger');

export class UiHoverCardContent extends WebComponent {
  private _slot = '';
  private _portal: HTMLElement | null = null;
  private _cleanupAutoUpdate: (() => void) | null = null;

  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  disconnectedCallback() { super.disconnectedCallback(); this._teardown(); }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state === 'open') this._show();
    else this._teardown();
  }

  _show() {
    if (this._portal) return;
    const root = this.closest('ui-hover-card') as HTMLElement | null;
    const trigger = root?.querySelector('ui-hover-card-trigger') as HTMLElement | null;
    if (!root || !trigger) return;

    const el = document.createElement('div');
    el.setAttribute('data-slot', 'hover-card-content');
    el.setAttribute('data-state', 'open');
    el.className = cn('z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95');
    el.innerHTML = this._slot;
    el.addEventListener('pointerenter', () => root.dispatchEvent(new CustomEvent('ui-hover-card-cancel-close', { bubbles: true })));
    el.addEventListener('pointerleave', () => root.dispatchEvent(new CustomEvent('ui-hover-card-close-request', { bubbles: true })));
    document.body.appendChild(el);
    this._portal = el;
    const placement = this.getAttribute('placement') || 'bottom';
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, placement));
  }

  _teardown() {
    if (this._cleanupAutoUpdate) { this._cleanupAutoUpdate(); this._cleanupAutoUpdate = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiHoverCardContent.register('ui-hover-card-content');
