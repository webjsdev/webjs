/**
 * Tooltip — hover/focus-triggered floating tip.
 *
 * shadcn parity:
 *   Tooltip, TooltipTrigger, TooltipContent, TooltipProvider.
 *   delay-duration attribute (ms, default 700).
 *
 * Usage:
 *   <ui-tooltip delay-duration="500">
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

const STYLES = `
ui-tooltip:not([open]) ui-tooltip-content { display: none !important; }
ui-tooltip-content { display: block; position: fixed; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-tooltip-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

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
    this._showTimer = window.setTimeout(() => this.setAttribute('open', ''), delay);
  }
  hide(): void {
    clearTimeout(this._showTimer);
    this._hideTimer = window.setTimeout(() => this.removeAttribute('open'), 100);
  }
  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>(':scope > ui-tooltip-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-tooltip-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'top') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
    });
  }
  private _reflect(): void {
    this.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
    const c = this.querySelector<HTMLElement>(':scope > ui-tooltip-content');
    c?.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
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
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(tooltipContentClass(), userClass);
  }
}
defineElement('ui-tooltip-content', UiTooltipContent);
