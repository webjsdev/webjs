/**
 * Tooltip, hover/focus-triggered floating tip. The tooltip content uses
 * the native Popover API in `popover="manual"` mode so it renders in the
 * top layer (no z-index wars) while the custom element retains control of
 * the hover-with-delay state machine.
 *
 * shadcn parity:
 *   Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.
 *   delay-duration       attribute (ms, default 700) , initial hover delay
 *   skip-delay-duration  attribute (ms, default 300) , window after a tooltip
 *                                                      closes during which the
 *                                                      next tooltip skips its
 *                                                      delay-duration
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
import { cn } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// The native UA stylesheet for `[popover]` paints a bordered, padded,
// background-coloured panel centered with `margin: auto`. Every one of
// those defaults fights our visual styling, so the class string opts
// out of them with explicit Tailwind utilities (`m-0`, `border-0`) and
// then layers the shadcn look on top. `fixed` keeps JS-computed top/left
// coordinates working in the top layer. UA `[popover]:not(:popover-open)
// { display: none }` continues to hide the element when closed, so no
// extra CSS rule for that is needed.
export const tooltipContentClass = (): string =>
  'fixed z-50 w-fit m-0 border-0 overflow-visible rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background';

// Module-level "last close" timestamp, shared across every <ui-tooltip> on
// the page. When the next tooltip is hovered within `skip-delay-duration`
// ms of this stamp, it skips its `delay-duration` wait and opens
// immediately, matching shadcn's TooltipProvider.skipDelayDuration.
let lastTooltipHideAt = 0;

export class UiTooltip extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _showTimer: number | undefined;
  _hideTimer: number | undefined;

  constructor() {
    super();
    this.open = false;
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tooltip');
  }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    queueMicrotask(() => this._syncContent());
    return html`<slot></slot>`;
  }

  // Back-compat getter: tests + consumer code that read `el.isOpen`
  // keep working alongside the reactive `open` prop.
  get isOpen(): boolean { return this.open; }

  show(): void {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    const delay = Number(this.getAttribute('delay-duration') ?? 700);
    const skipDelay = Number(this.getAttribute('skip-delay-duration') ?? 300);
    // Within the skip window after another tooltip just closed, open
    // immediately (no delay-duration wait).
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

  _syncContent(): void {
    // Children live under the projection slot now; query by descendant
    // search since :scope > would only see the slot wrapper.
    const content = this.querySelector<HTMLElement>('ui-tooltip-content');
    if (!content) return;
    content.setAttribute('data-state', this.open ? 'open' : 'closed');
    if (typeof (content as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
      if (this.open) (content as HTMLElement & { showPopover: () => void }).showPopover();
      else (content as HTMLElement & { hidePopover: () => void }).hidePopover();
    }
    if (this.open) this._reposition(content);
  }

  _reposition(content: HTMLElement): void {
    const trigger = this.querySelector<HTMLElement>('ui-tooltip-trigger');
    if (!trigger) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'top') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
      alignOffset: Number(content.getAttribute('align-offset') ?? 0),
    });
  }
}
UiTooltip.register('ui-tooltip');

export class UiTooltipTrigger extends WebComponent {
  firstUpdated(): void {
    this.setAttribute('data-slot', 'tooltip-trigger');
    this.addEventListener('mouseenter', this._onEnter);
    this.addEventListener('mouseleave', this._onLeave);
    this.addEventListener('focusin', this._onEnter);
    this.addEventListener('focusout', this._onLeave);
  }

  disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this._onEnter);
    this.removeEventListener('mouseleave', this._onLeave);
    this.removeEventListener('focusin', this._onEnter);
    this.removeEventListener('focusout', this._onLeave);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _onEnter = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.show();
  _onLeave = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.hide();
}
UiTooltipTrigger.register('ui-tooltip-trigger');

export class UiTooltipContent extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tooltip-content');
    this.setAttribute('role', 'tooltip');
    // Opt into the native top-layer via the Popover API in manual mode.
    // We drive show/hide ourselves (hover delay), so manual is the right
    // mode: auto would also dismiss on outside click, which is not what
    // a hover tooltip wants.
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
  }

  render() {
    this.className = cn(tooltipContentClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiTooltipContent.register('ui-tooltip-content');
