/**
 * Tooltip — hover/focus-triggered floating tip. The tooltip content uses
 * the native Popover API in `popover="manual"` mode so it renders in the
 * top layer (no z-index wars) while the custom element retains control of
 * the hover-with-delay state machine.
 *
 * shadcn parity:
 *   Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.
 *   delay-duration       attribute (ms, default 700)  — initial hover delay
 *   skip-delay-duration  attribute (ms, default 300)  — window after a tooltip
 *                                                      closes during which the
 *                                                      next tooltip skips its
 *                                                      delay-duration
 *   side / align / side-offset / align-offset — placement (positionFloating)
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
import { cn, Base, defineElement } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

export const tooltipContentClass = (): string =>
  'z-50 w-fit rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background';

// `[popover]:not(:popover-open) { display: none }` is the UA default;
// we add `position: fixed` so JS-computed top/left coordinates take effect
// in the top layer. Authors who want CSS anchor positioning instead can
// override at the call site.
const STYLES = `
ui-tooltip-content[popover] {
  position: fixed;
  margin: 0;
  border: 0;
  padding: revert;
  background: revert;
  color: revert;
  overflow: visible;
}
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-tooltip-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// Module-level "last close" timestamp, shared across every <ui-tooltip> on
// the page. When the next tooltip is hovered within `skip-delay-duration`
// ms of this stamp, it skips its `delay-duration` wait and opens
// immediately — matching shadcn's TooltipProvider.skipDelayDuration.
let lastTooltipHideAt = 0;

export class UiTooltip extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  private _showTimer: number | undefined;
  private _hideTimer: number | undefined;

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'tooltip');
    this._reflect();
  }
  attributeChangedCallback(): void {
    this._reflect();
    if (this.isOpen) this._reposition();
  }
  get isOpen(): boolean {
    return this.hasAttribute('open');
  }
  show(): void {
    clearTimeout(this._hideTimer);
    const delay = Number(this.getAttribute('delay-duration') ?? 700);
    const skipDelay = Number(this.getAttribute('skip-delay-duration') ?? 300);
    // Within the skip window after another tooltip just closed, open
    // immediately (no delay-duration wait).
    const sinceLastHide = Date.now() - lastTooltipHideAt;
    if (lastTooltipHideAt > 0 && sinceLastHide < skipDelay) {
      this.setAttribute('open', '');
      return;
    }
    this._showTimer = window.setTimeout(() => this.setAttribute('open', ''), delay);
  }
  hide(): void {
    clearTimeout(this._showTimer);
    this._hideTimer = window.setTimeout(() => {
      this.removeAttribute('open');
      lastTooltipHideAt = Date.now();
    }, 100);
  }
  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>(':scope > ui-tooltip-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-tooltip-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'top') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
      alignOffset: Number(content.getAttribute('align-offset') ?? 0),
    });
  }
  private _reflect(): void {
    const open = this.isOpen;
    this.setAttribute('data-state', open ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>(':scope > ui-tooltip-content');
    if (!content) return;
    content.setAttribute('data-state', open ? 'open' : 'closed');
    // Delegate visibility to the native popover. The popover attribute is
    // wired by <ui-tooltip-content>'s connectedCallback; here we just flip
    // the popover-open state to match our `open` attribute.
    if (typeof (content as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
      if (open) (content as HTMLElement & { showPopover: () => void }).showPopover();
      else (content as HTMLElement & { hidePopover: () => void }).hidePopover();
    }
  }
}
defineElement('ui-tooltip', UiTooltip);

export class UiTooltipTrigger extends Base {
  connectedCallback(): void {
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
  }
  private _onEnter = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.show();
  private _onLeave = (): void => (this.closest('ui-tooltip') as UiTooltip | null)?.hide();
}
defineElement('ui-tooltip-trigger', UiTooltipTrigger);

export class UiTooltipContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'tooltip-content');
    this.setAttribute('role', 'tooltip');
    // Opt into the native top-layer via the Popover API in manual mode.
    // We drive show/hide ourselves (hover delay), so manual is the right
    // mode: auto would also dismiss on outside click, which isn't what a
    // hover tooltip wants.
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(tooltipContentClass(), userClass);
  }
}
defineElement('ui-tooltip-content', UiTooltipContent);
