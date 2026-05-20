/**
 * HoverCard, popover-like panel triggered by hover with configurable
 * open/close delays. The content uses the native Popover API in
 * `popover="manual"` mode for top-layer rendering. The hover-with-linger
 * state machine remains JS.
 *
 * shadcn parity: HoverCard, HoverCardTrigger, HoverCardContent.
 *   open-delay, close-delay (ms).
 *
 * Usage:
 *   <ui-hover-card open-delay="700" close-delay="300">
 *     <ui-hover-card-trigger>
 *       <a href="/user/vivek">@vivek</a>
 *     </ui-hover-card-trigger>
 *     <ui-hover-card-content>
 *       <div class="flex gap-3">…</div>
 *     </ui-hover-card-content>
 *   </ui-hover-card>
 *
 * Design tokens used: --popover, --popover-foreground, --border.
 */
import { WebComponent, html } from '@webjskit/core';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// `fixed m-0` opts out of the UA `[popover]` auto-centering margin so
// JS-computed top/left from positionFloating lands correctly. shadcn's
// visual layer sits on top. UA `[popover]:not(:popover-open) {
// display: none }` handles closed-state hiding.
export const hoverCardContentClass = (): string =>
  'fixed z-50 w-64 m-0 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden';

// --------------------------------------------------------------------------
// <ui-hover-card>
// --------------------------------------------------------------------------

export class UiHoverCard extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _showTimer: number | undefined;
  _hideTimer: number | undefined;
  _lastOpen: boolean = false;

  constructor() {
    super();
    this.open = false;
  }

  // Back-compat getter.
  get isOpen(): boolean { return this.open; }

  show(): void {
    clearTimeout(this._hideTimer);
    const delay = Number(this.getAttribute('open-delay') ?? 700);
    this._showTimer = window.setTimeout(() => { this.open = true; }, delay);
  }

  hide(): void {
    clearTimeout(this._showTimer);
    const delay = Number(this.getAttribute('close-delay') ?? 300);
    this._hideTimer = window.setTimeout(() => { this.open = false; }, delay);
  }

  render() {
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => this._syncContent());
    }
    return html`<div
      data-slot="hover-card"
      data-state=${this.open ? 'open' : 'closed'}
    ><slot></slot></div>`;
  }

  _syncContent(): void {
    // Same nested-popover pattern as tooltip: <ui-hover-card-content>
    // renders an inner <div popover="manual">; the Popover API lives on
    // that inner div, not the host.
    const popover = this.querySelector<HTMLElement>('ui-hover-card-content [popover]');
    const host = this.querySelector<HTMLElement>('ui-hover-card-content');
    if (!popover || !popover.isConnected) return;
    const p = popover as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
      matches: (s: string) => boolean;
    };
    if (typeof p.showPopover !== 'function') return;
    if (this.open) {
      if (!p.matches(':popover-open')) p.showPopover();
      if (host) this._reposition(host, popover);
    } else if (p.matches(':popover-open')) {
      p.hidePopover();
    }
  }

  _reposition(contentHost: HTMLElement, popover: HTMLElement): void {
    const trigger = this.querySelector<HTMLElement>('ui-hover-card-trigger');
    if (!trigger) return;
    positionFloating(trigger, popover, {
      side: (contentHost.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (contentHost.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(contentHost.getAttribute('side-offset') ?? 4),
      alignOffset: Number(contentHost.getAttribute('align-offset') ?? 0),
    });
  }
}
UiHoverCard.register('ui-hover-card');

// --------------------------------------------------------------------------
// <ui-hover-card-trigger>
// --------------------------------------------------------------------------

export class UiHoverCardTrigger extends WebComponent {
  render() {
    return html`<div
      data-slot="hover-card-trigger"
      @mouseenter=${this._onEnter}
      @mouseleave=${this._onLeave}
      @focusin=${this._onEnter}
      @focusout=${this._onLeave}
    ><slot></slot></div>`;
  }

  _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
UiHoverCardTrigger.register('ui-hover-card-trigger');

// --------------------------------------------------------------------------
// <ui-hover-card-content>
// The mouseenter/mouseleave handlers keep the card open while the cursor
// is over the content itself (so it does not close during a brief
// mouseleave on the trigger if the user is moving toward the card).
// --------------------------------------------------------------------------

export class UiHoverCardContent extends WebComponent {
  render() {
    return html`<div
      data-slot="hover-card-content"
      role="dialog"
      popover="manual"
      class=${hoverCardContentClass()}
      @mouseenter=${this._onEnter}
      @mouseleave=${this._onLeave}
    ><slot></slot></div>`;
  }

  _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
UiHoverCardContent.register('ui-hover-card-content');
