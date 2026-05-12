import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
import { cn } from '../lib/utils.ts';

/**
 * Tooltip primitives.
 *
 *   <ui-tooltip-provider delay-duration="500" skip-delay-duration="300">
 *     <ui-tooltip>
 *       <ui-tooltip-trigger><ui-button>Hover</ui-button></ui-tooltip-trigger>
 *       <ui-tooltip-content>Tip</ui-tooltip-content>
 *     </ui-tooltip>
 *   </ui-tooltip-provider>
 *
 * Provider owns the open-delay (`delay-duration`, default 700ms) and the
 * skip-delay window (`skip-delay-duration`, default 300ms) — if any tooltip
 * in the same provider was open within `skipDelayDuration` ms ago, the next
 * one opens immediately (Radix's keyboard-friendly tooltip-chain behaviour).
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

const DEFAULT_DELAY = 700;
const DEFAULT_SKIP_DELAY = 300;

// Provider owns delayDuration + skipDelayDuration + lastClosedAt for the
// "open instantly if a sibling just closed" behaviour.
export class UiTooltipProvider extends WebComponent {
  static properties = {
    delayDuration: { type: Number, attribute: 'delay-duration' },
    skipDelayDuration: { type: Number, attribute: 'skip-delay-duration' },
  };
  declare delayDuration: number;
  declare skipDelayDuration: number;
  // Timestamp (ms) of the last tooltip-close inside this provider. Read by
  // children to decide whether to skip the open delay.
  public _lastClosedAt = 0;
  private _slot = '';
  constructor() {
    super();
    this.delayDuration = DEFAULT_DELAY;
    this.skipDelayDuration = DEFAULT_SKIP_DELAY;
  }
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    // Read attributes manually so we don't depend on attribute-coercion order.
    const dd = this.getAttribute('delay-duration');
    if (dd != null) this.delayDuration = Number(dd);
    const sd = this.getAttribute('skip-delay-duration');
    if (sd != null) this.skipDelayDuration = Number(sd);
    super.connectedCallback();
  }
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiTooltipProvider.register('ui-tooltip-provider');

export class UiTooltip extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _openTimer: any = null;
  // Resolved delay (from nearest provider, or default). Cached on connect.
  public _delay = DEFAULT_DELAY;
  public _skipDelay = DEFAULT_SKIP_DELAY;
  private _provider: UiTooltipProvider | null = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this._provider = this.closest('ui-tooltip-provider') as UiTooltipProvider | null;
    if (this._provider) {
      this._delay = Number(this._provider.delayDuration ?? DEFAULT_DELAY);
      this._skipDelay = Number(this._provider.skipDelayDuration ?? DEFAULT_SKIP_DELAY);
    }
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
    // Within skip-delay window of the last close in this provider → open now.
    const sinceLastClose = this._provider ? Date.now() - this._provider._lastClosedAt : Infinity;
    const delay = sinceLastClose < this._skipDelay ? 0 : this._delay;
    if (delay === 0) this.setOpen(true);
    else this._openTimer = setTimeout(() => this.setOpen(true), delay);
  };
  _onHide = () => {
    if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
    if (this.open && this._provider) this._provider._lastClosedAt = Date.now();
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
