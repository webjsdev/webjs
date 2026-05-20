/**
 * Tooltip, hover/focus-triggered floating tip. The tooltip content uses
 * the native Popover API in `popover="manual"` mode so it renders in the
 * top layer (no z-index wars) while the custom element retains control of
 * the hover-with-delay state machine.
 *
 * shadcn parity:
 *   Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.
 *   delay-duration       attribute (ms, default 700), initial hover delay
 *   skip-delay-duration  attribute (ms, default 300), window after a tooltip
 *                                                     closes during which the
 *                                                     next tooltip skips its
 *                                                     delay-duration
 *   side / align / side-offset / align-offset, placement (positionFloating)
 *
 * Usage:
 *   <ui-tooltip delay-duration="500" skip-delay-duration="300">
 *     <ui-tooltip-trigger>
 *       <button class=${buttonClass({ size: 'icon', variant: 'ghost' })} aria-label="Help">?</button>
 *     </ui-tooltip-trigger>
 *     <ui-tooltip-content side="top">Helpful tip</ui-tooltip-content>
 *   </ui-tooltip>
 *
 * Design tokens used: --foreground, --background.
 */
import { WebComponent, html } from '@webjskit/core';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// UA `[popover]` defaults paint a bordered, padded panel centered with
// `margin: auto`; the class string opts out via `m-0` + `border-0` and
// layers the shadcn look on top. `fixed` keeps JS-computed top/left in
// top layer. UA `[popover]:not(:popover-open) { display: none }` keeps
// the closed state hidden.
export const tooltipContentClass = (): string =>
  'fixed z-50 w-fit m-0 border-0 overflow-visible rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background';

// Module-level "last close" timestamp, shared across every <ui-tooltip>
// on the page. When the next tooltip is hovered within
// `skip-delay-duration` ms of this stamp, it skips its delay-duration
// wait and opens immediately. Matches shadcn TooltipProvider.skipDelayDuration.
let lastTooltipHideAt = 0;

// --------------------------------------------------------------------------
// <ui-tooltip>
// --------------------------------------------------------------------------

export class UiTooltip extends WebComponent {
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

  // Back-compat getter for tests + external code that read `el.isOpen`
  // alongside the reactive `open` prop.
  get isOpen(): boolean { return this.open; }

  show(): void {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    const delay = Number(this.getAttribute('delay-duration') ?? 700);
    const skipDelay = Number(this.getAttribute('skip-delay-duration') ?? 300);
    const sinceLastHide = Date.now() - lastTooltipHideAt;
    if (lastTooltipHideAt > 0 && sinceLastHide < skipDelay) {
      this.open = true;
      return;
    }
    this._showTimer = window.setTimeout(() => { this.open = true; }, delay);
  }

  hide(): void {
    clearTimeout(this._showTimer);
    this._hideTimer = window.setTimeout(() => {
      this.open = false;
      lastTooltipHideAt = Date.now();
    }, 100);
  }

  render() {
    // Toggle popover open/closed on the descendant <ui-tooltip-content>
    // after slot projection has settled (one frame). Side-effect; do not
    // call from render() body itself.
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      requestAnimationFrame(() => this._syncContent());
    }
    return html`<div
      data-slot="tooltip"
      data-state=${this.open ? 'open' : 'closed'}
    ><slot></slot></div>`;
  }

  _syncContent(): void {
    // <ui-tooltip-content> renders a `<div popover="manual">` inside its
    // slot output; the popover API lives on that inner div, not the
    // host. Query past the host to the actual popover element.
    const popover = this.querySelector<HTMLElement>('ui-tooltip-content [popover]');
    const host = this.querySelector<HTMLElement>('ui-tooltip-content');
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
    const trigger = this.querySelector<HTMLElement>('ui-tooltip-trigger');
    if (!trigger) return;
    // Placement attributes live on the <ui-tooltip-content> host (the
    // public API surface); positioning targets the inner popover element.
    positionFloating(trigger, popover, {
      side: (contentHost.getAttribute('side') ?? 'top') as PopoverSide,
      align: (contentHost.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(contentHost.getAttribute('side-offset') ?? 4),
      alignOffset: Number(contentHost.getAttribute('align-offset') ?? 0),
    });
  }
}
UiTooltip.register('ui-tooltip');

// --------------------------------------------------------------------------
// <ui-tooltip-trigger>
// Wraps the user's focusable element. Hover/focus handlers live on the
// rendered wrapper via declarative bindings; no manual addEventListener
// or disconnect cleanup is needed.
// --------------------------------------------------------------------------

export class UiTooltipTrigger extends WebComponent {
  render() {
    return html`<div
      data-slot="tooltip-trigger"
      @mouseenter=${this._onEnter}
      @mouseleave=${this._onLeave}
      @focusin=${this._onEnter}
      @focusout=${this._onLeave}
    ><slot></slot></div>`;
  }

  _onEnter = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.show();
  _onLeave = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.hide();
}
UiTooltipTrigger.register('ui-tooltip-trigger');

// --------------------------------------------------------------------------
// <ui-tooltip-content>
// Renders a `<div popover="manual" role="tooltip">` (the floating panel).
// The popover attribute is declarative on the inner element, so the
// browser registers it as a popover before the parent calls showPopover.
// --------------------------------------------------------------------------

export class UiTooltipContent extends WebComponent {
  render() {
    return html`<div
      data-slot="tooltip-content"
      role="tooltip"
      popover="manual"
      class=${tooltipContentClass()}
    ><slot></slot></div>`;
  }
}
UiTooltipContent.register('ui-tooltip-content');
