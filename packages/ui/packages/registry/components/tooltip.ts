import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Tooltip primitives.
 *
 *   <ui-tooltip-provider>
 *     <ui-tooltip>
 *       <ui-tooltip-trigger><ui-button>Hover</ui-button></ui-tooltip-trigger>
 *       <ui-tooltip-content>Tip</ui-tooltip-content>
 *     </ui-tooltip>
 *   </ui-tooltip-provider>
 *
 * Provider is a passthrough host (parity with shadcn). Trigger opens content
 * on hover/focus with 700ms delay; closes on pointerleave/blur.
 */

function position(anchor: HTMLElement, floating: HTMLElement, placement: any = 'top') {
  return computePosition(anchor, floating, {
    placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  }).then(({ x, y, placement: p }) => {
    Object.assign(floating.style, { left: `${x}px`, top: `${y}px`, position: 'fixed' });
    floating.setAttribute('data-side', p.split('-')[0]);
  });
}

const DELAY = 700;

// Passthrough provider. Currently no shared state needed.
export class UiTooltipProvider extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiTooltipProvider.register('ui-tooltip-provider');

export class UiTooltip extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _openTimer: any = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-tooltip-show-request', this._onShowReq as EventListener);
    this.addEventListener('ui-tooltip-hide', this._onHide as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._openTimer) clearTimeout(this._openTimer);
  }

  _onShowReq = () => {
    if (this.open) return;
    if (this._openTimer) clearTimeout(this._openTimer);
    this._openTimer = setTimeout(() => this.setOpen(true), DELAY);
  };
  _onHide = () => {
    if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
    this.setOpen(false);
  };

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-tooltip-trigger, ui-tooltip-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
  }

  render() { return html`<slot></slot>`; }
}
UiTooltip.register('ui-tooltip');

export class UiTooltipTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('pointerenter', this._show);
    this.addEventListener('pointerleave', this._hide);
    this.addEventListener('focus', this._show, true);
    this.addEventListener('blur', this._hide, true);
  }
  _show = () => this.dispatchEvent(new CustomEvent('ui-tooltip-show-request', { bubbles: true }));
  _hide = () => this.dispatchEvent(new CustomEvent('ui-tooltip-hide', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiTooltipTrigger.register('ui-tooltip-trigger');

export class UiTooltipContent extends WebComponent {
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
    const root = this.closest('ui-tooltip') as HTMLElement | null;
    const trigger = root?.querySelector('ui-tooltip-trigger') as HTMLElement | null;
    if (!trigger) return;

    const el = document.createElement('div');
    el.setAttribute('data-slot', 'tooltip-content');
    el.setAttribute('data-state', 'open');
    el.setAttribute('role', 'tooltip');
    el.className = cn('z-50 w-fit animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95');
    el.innerHTML = this._slot;
    document.body.appendChild(el);
    this._portal = el;
    const placement = this.getAttribute('placement') || 'top';
    this._cleanupAutoUpdate = autoUpdate(trigger, el, () => position(trigger, el, placement));
  }

  _teardown() {
    if (this._cleanupAutoUpdate) { this._cleanupAutoUpdate(); this._cleanupAutoUpdate = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
  }

  render() { return html``; }
}
UiTooltipContent.register('ui-tooltip-content');
