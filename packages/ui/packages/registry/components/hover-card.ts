/**
 * HoverCard — popover-like panel triggered by hover with configurable delays.
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
 *       <div class="flex gap-3">
 *         <img class="size-10 rounded-full" src="…" alt="">
 *         <div>
 *           <h4 class="font-semibold">@vivek</h4>
 *           <p class="text-sm text-muted-foreground">Building webjs.</p>
 *         </div>
 *       </div>
 *     </ui-hover-card-content>
 *   </ui-hover-card>
 *
 * Design tokens used: --popover, --popover-foreground, --border.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

export const hoverCardContentClass = (): string =>
  'z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden';

const STYLES = `
ui-hover-card:not([open]) ui-hover-card-content { display: none !important; }
ui-hover-card-content { display: block; position: fixed; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-hover-card-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-hover-card-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export class UiHoverCard extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  private _showTimer: number | undefined;
  private _hideTimer: number | undefined;

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'hover-card');
    this._reflect();
  }
  attributeChangedCallback(): void {
    this._reflect();
    if (this.hasAttribute('open')) this._reposition();
  }
  show(): void {
    clearTimeout(this._hideTimer);
    const delay = Number(this.getAttribute('open-delay') ?? 700);
    this._showTimer = window.setTimeout(() => this.setAttribute('open', ''), delay);
  }
  hide(): void {
    clearTimeout(this._showTimer);
    const delay = Number(this.getAttribute('close-delay') ?? 300);
    this._hideTimer = window.setTimeout(() => this.removeAttribute('open'), delay);
  }
  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>(':scope > ui-hover-card-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-hover-card-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
    });
  }
  private _reflect(): void {
    this.setAttribute('data-state', this.hasAttribute('open') ? 'open' : 'closed');
    const c = this.querySelector<HTMLElement>(':scope > ui-hover-card-content');
    c?.setAttribute('data-state', this.hasAttribute('open') ? 'open' : 'closed');
  }
}
defineElement('ui-hover-card', UiHoverCard);

export class UiHoverCardTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'hover-card-trigger');
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
  private _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  private _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
defineElement('ui-hover-card-trigger', UiHoverCardTrigger);

export class UiHoverCardContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'hover-card-content');
    this.setAttribute('role', 'dialog');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(hoverCardContentClass(), userClass);
    // Keep open while pointer is over the content itself.
    this.addEventListener('mouseenter', this._onEnter);
    this.addEventListener('mouseleave', this._onLeave);
  }
  disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this._onEnter);
    this.removeEventListener('mouseleave', this._onLeave);
  }
  private _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  private _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
defineElement('ui-hover-card-content', UiHoverCardContent);
