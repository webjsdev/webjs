/**
 * Popover — floating panel anchored to a trigger. Hand-rolled positioning
 * (no @floating-ui/dom). Auto-flips if there's not enough room.
 *
 * shadcn parity:
 *   Popover, PopoverTrigger, PopoverContent, PopoverAnchor,
 *   PopoverHeader, PopoverTitle, PopoverDescription.
 *   Attributes on content: align (start | center | end), side, side-offset.
 *
 * Usage:
 *   <ui-popover>
 *     <ui-popover-trigger>
 *       <button class=${buttonClass({ variant: 'outline' })}>Filter</button>
 *     </ui-popover-trigger>
 *     <ui-popover-content side="bottom" align="start" side-offset="4">
 *       <div class=${popoverHeaderClass()}>
 *         <h3 class=${popoverTitleClass()}>Filter posts</h3>
 *         <p class=${popoverDescriptionClass()}>By tag and status.</p>
 *       </div>
 *       …
 *     </ui-popover-content>
 *   </ui-popover>
 *
 * Events on `<ui-popover>`:
 *   `ui-open-change` — { detail: { open: boolean } }.
 *
 * Keyboard: Escape closes; outside-click closes; Tab cycles content focus.
 *
 * Design tokens used: --popover, --popover-foreground, --border,
 * --muted-foreground.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

export const popoverContentClass = (): string =>
  'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden';

export const popoverHeaderClass = (): string => 'flex flex-col gap-1 text-sm';
export const popoverTitleClass = (): string => 'font-medium';
export const popoverDescriptionClass = (): string => 'text-muted-foreground';

// --------------------------------------------------------------------------
// Visibility CSS
// --------------------------------------------------------------------------

const STYLES = `
ui-popover:not([open]) ui-popover-content { display: none !important; }
ui-popover-content { display: block; position: fixed; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-popover-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-popover-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// Positioning helper. Computes top/left for a content element relative to a
// trigger, given side + align + offset. Auto-flips when off-screen.
// --------------------------------------------------------------------------

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';

export function positionFloating(
  trigger: HTMLElement,
  content: HTMLElement,
  opts: { side?: PopoverSide; align?: PopoverAlign; sideOffset?: number } = {},
): void {
  const side = opts.side ?? 'bottom';
  const align = opts.align ?? 'center';
  const sideOffset = opts.sideOffset ?? 4;
  const tr = trigger.getBoundingClientRect();
  const cr = content.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  let actualSide = side;

  const fitsBottom = tr.bottom + sideOffset + cr.height <= vh;
  const fitsTop = tr.top - sideOffset - cr.height >= 0;
  const fitsRight = tr.right + sideOffset + cr.width <= vw;
  const fitsLeft = tr.left - sideOffset - cr.width >= 0;

  if (side === 'bottom' && !fitsBottom && fitsTop) actualSide = 'top';
  else if (side === 'top' && !fitsTop && fitsBottom) actualSide = 'bottom';
  else if (side === 'right' && !fitsRight && fitsLeft) actualSide = 'left';
  else if (side === 'left' && !fitsLeft && fitsRight) actualSide = 'right';

  if (actualSide === 'bottom') top = tr.bottom + sideOffset;
  else if (actualSide === 'top') top = tr.top - sideOffset - cr.height;
  else if (actualSide === 'right' || actualSide === 'left') {
    if (align === 'start') top = tr.top;
    else if (align === 'end') top = tr.bottom - cr.height;
    else top = tr.top + (tr.height - cr.height) / 2;
  }

  if (actualSide === 'right') left = tr.right + sideOffset;
  else if (actualSide === 'left') left = tr.left - sideOffset - cr.width;
  else {
    if (align === 'start') left = tr.left;
    else if (align === 'end') left = tr.right - cr.width;
    else left = tr.left + (tr.width - cr.width) / 2;
  }

  // Clamp into viewport
  left = Math.max(8, Math.min(left, vw - cr.width - 8));
  top = Math.max(8, Math.min(top, vh - cr.height - 8));

  content.style.top = `${top}px`;
  content.style.left = `${left}px`;
  content.setAttribute('data-side', actualSide);
  content.setAttribute('data-align', align);
}

// --------------------------------------------------------------------------
// <ui-popover>
// --------------------------------------------------------------------------

export class UiPopover extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }

  private _docClickHandler = (e: MouseEvent): void => this._onDocClick(e);
  private _keyHandler = (e: KeyboardEvent): void => this._onKeyDown(e);
  private _resizeHandler = (): void => this._reposition();

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'popover');
    this._reflect();
  }
  disconnectedCallback(): void {
    if (this.isOpen) this._teardown();
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open' && oldVal !== newVal) {
      this._reflect();
      if (newVal !== null) this._setup();
      else this._teardown();
      this.dispatchEvent(
        new CustomEvent('ui-open-change', { detail: { open: this.isOpen }, bubbles: true }),
      );
    }
  }

  get isOpen(): boolean {
    return this.hasAttribute('open');
  }
  show(): void {
    this.setAttribute('open', '');
  }
  hide(): void {
    this.removeAttribute('open');
  }
  toggle(): void {
    if (this.isOpen) this.hide();
    else this.show();
  }

  _reposition(): void {
    const trigger = this.querySelector<HTMLElement>(':scope > ui-popover-trigger');
    const content = this.querySelector<HTMLElement>(':scope > ui-popover-content');
    if (!trigger || !content) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
    });
  }

  private _reflect(): void {
    this.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>(':scope > ui-popover-content');
    if (content) content.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
  }

  private _setup(): void {
    queueMicrotask(() => {
      this._reposition();
      document.addEventListener('click', this._docClickHandler);
      document.addEventListener('keydown', this._keyHandler);
      window.addEventListener('resize', this._resizeHandler);
      window.addEventListener('scroll', this._resizeHandler, true);
    });
  }
  private _teardown(): void {
    document.removeEventListener('click', this._docClickHandler);
    document.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resizeHandler);
    window.removeEventListener('scroll', this._resizeHandler, true);
  }

  private _onDocClick(e: MouseEvent): void {
    if (!this.isOpen) return;
    if (e.composedPath().some((n) => n === this)) return;
    this.hide();
  }
  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isOpen) this.hide();
  }
}
defineElement('ui-popover', UiPopover);

export class UiPopoverTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'popover-trigger');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => {
    (this.closest('ui-popover') as UiPopover | null)?.toggle();
  };
}
defineElement('ui-popover-trigger', UiPopoverTrigger);

export class UiPopoverContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'popover-content');
    this.setAttribute('role', 'dialog');
    this.setAttribute('tabindex', '-1');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(popoverContentClass(), userClass);
  }
}
defineElement('ui-popover-content', UiPopoverContent);
