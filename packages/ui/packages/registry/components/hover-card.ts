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
 *       <div class="flex gap-3">
 *         <img class="size-10 rounded-full" src="..." alt="">
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
import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// `fixed m-0` opts out of the UA `[popover]` defaults (the auto-centering
// `margin: auto` in particular) so JS-computed top/left coordinates from
// `positionFloating` land correctly. The shadcn visual layer (border, bg,
// padding, shadow) is layered on top. UA `[popover]:not(:popover-open)
// { display: none }` handles closed-state hiding for free.
export const hoverCardContentClass = (): string =>
  'fixed z-50 w-64 m-0 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden';

export class UiHoverCard extends WebComponent {
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
    this.setAttribute('data-slot', 'hover-card');
  }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    // Wait one frame: <ui-hover-card-content> is a descendant WebComponent
    // whose own first render + slot projection runs after ours.
    requestAnimationFrame(() => this._syncContent());
    return html`<slot></slot>`;
  }

  // Back-compat getter: tests + consumer code that read `el.isOpen`
  // keep working alongside the reactive `open` prop.
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

  _syncContent(): void {
    const content = this.querySelector<HTMLElement>('ui-hover-card-content');
    if (!content) return;
    // showPopover throws InvalidStateError on disconnected elements; bail
    // out when the host has been torn down between the RAF schedule and
    // this callback (test teardown, route transition).
    if (!content.isConnected) return;
    content.setAttribute('data-state', this.open ? 'open' : 'closed');
    if (typeof (content as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
      if (this.open) (content as HTMLElement & { showPopover: () => void }).showPopover();
      else (content as HTMLElement & { hidePopover: () => void }).hidePopover();
    }
    if (this.open) this._reposition(content);
  }

  _reposition(content: HTMLElement): void {
    const trigger = this.querySelector<HTMLElement>('ui-hover-card-trigger');
    if (!trigger) return;
    positionFloating(trigger, content, {
      side: (content.getAttribute('side') ?? 'bottom') as PopoverSide,
      align: (content.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(content.getAttribute('side-offset') ?? 4),
      alignOffset: Number(content.getAttribute('align-offset') ?? 0),
    });
  }
}
UiHoverCard.register('ui-hover-card');

export class UiHoverCardTrigger extends WebComponent {
  connectedCallback(): void {
    // Listeners in connectedCallback (not firstUpdated): light-DOM slot
    // projection triggers a disconnect/reconnect cycle on first mount,
    // and firstUpdated runs only once.
    this.addEventListener('mouseenter', this._onEnter);
    this.addEventListener('mouseleave', this._onLeave);
    this.addEventListener('focusin', this._onEnter);
    this.addEventListener('focusout', this._onLeave);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'hover-card-trigger');
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

  _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
UiHoverCardTrigger.register('ui-hover-card-trigger');

export class UiHoverCardContent extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    // Listeners in connectedCallback so the disconnect/reconnect cycle
    // from light-DOM slot projection doesn't leave the content panel
    // without its hover handlers.
    this.addEventListener('mouseenter', this._onEnter);
    this.addEventListener('mouseleave', this._onLeave);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'hover-card-content');
    this.setAttribute('role', 'dialog');
    // Opt into the native top-layer via the Popover API in manual mode.
    // Manual (rather than auto) avoids the native light-dismiss closing
    // the card when the cursor is briefly off the trigger.
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
  }

  disconnectedCallback(): void {
    this.removeEventListener('mouseenter', this._onEnter);
    this.removeEventListener('mouseleave', this._onLeave);
    super.disconnectedCallback?.();
  }

  render() {
    this.className = cn(hoverCardContentClass(), this._userClass);
    return html`<slot></slot>`;
  }

  _onEnter = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  _onLeave = (): void => (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
}
UiHoverCardContent.register('ui-hover-card-content');
