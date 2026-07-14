/**
 * HoverCard: popover-like panel triggered by hover with configurable
 * open / close delays. Tier-2. The content uses the native Popover API
 * in `popover="manual"` mode for top-layer rendering; the custom
 * element owns the hover-with-linger state machine and JS positioning.
 *
 * shadcn parity:
 *   HoverCard          → <ui-hover-card open-delay close-delay>
 *   HoverCardTrigger   → <ui-hover-card-trigger>
 *   HoverCardContent   → <ui-hover-card-content side align side-offset align-offset>
 *
 * Attributes on <ui-hover-card>:
 *   `open`:        boolean (reflected). Open state.
 *   `open-delay`:  ms, default 700. Hover delay before opening.
 *   `close-delay`: ms, default 300. Linger delay before closing once
 *                  cursor leaves trigger + content.
 *
 * Attributes on <ui-hover-card-content>:
 *   `side`:         "top" | "right" | "bottom" (default) | "left".
 *   `align`:        "center" (default) | "start" | "end".
 *   `side-offset`:  number, default 4. Pixels between trigger and content.
 *   `align-offset`: number, default 0. Pixels of cross-axis shift.
 *
 * Events: none dispatched at present; observe the reflected `open`
 * attribute from CSS or JS.
 *
 * Programmatic API on <ui-hover-card>: `.show()` · `.hide()`.
 *
 * Design tokens used: --popover, --popover-foreground, --border.
 *
 * @example
 * ```html
 * <ui-hover-card open-delay="700" close-delay="300">
 *   <ui-hover-card-trigger>
 *     <a href="/user/vivek">@vivek</a>
 *   </ui-hover-card-trigger>
 *   <ui-hover-card-content>
 *     <div class="flex gap-3">
 *       <img class="size-10 rounded-full" src="/avatars/vivek.jpg" alt="Vivek Khandelwal">
 *       <div>
 *         <div class="text-sm font-semibold">Vivek Khandelwal</div>
 *         <p class="text-sm text-muted-foreground">Builds the platform, not against it.</p>
 *       </div>
 *     </div>
 *   </ui-hover-card-content>
 * </ui-hover-card>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { ensureId } from '../lib/utils.ts';
import { onBeforeCache } from '../lib/dom.ts';
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

export class UiHoverCard extends WebComponent({
  open: prop(Boolean, { reflect: true }),
  // `openDelay` / `closeDelay` ride the `open-delay` / `close-delay`
  // attributes (shadcn parity), read as typed props.
  openDelay: Number,
  closeDelay: Number,
}) {
  _showTimer: number | undefined;
  _hideTimer: number | undefined;

  constructor() {
    super();
    this.open = false;
    this.openDelay = 700;
    this.closeDelay = 300;
  }

  _disposeBeforeCache?: () => void;

  connectedCallback(): void {
    super.connectedCallback?.();
    // webjs projects slotted light-DOM children after the first render, so
    // the trigger control is not in place at connect. Defer to the next
    // frame, when the projection has run.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this._wireAria());
    }
    // Close before the page is cached for back/forward so a restored snapshot
    // does not come back frozen open (#766).
    this._disposeBeforeCache = onBeforeCache(() => { this.open = false; });
  }

  disconnectedCallback(): void {
    this._disposeBeforeCache?.();
    super.disconnectedCallback?.();
  }

  // The trigger also opens on focus (see the @focusin handler), so it is
  // keyboard-reachable: expose the popup relationship on the focusable
  // control. aria-expanded is refreshed on every open transition.
  _control(): HTMLElement | null {
    const t = this.querySelector('ui-hover-card-trigger');
    if (!t) return null;
    return (
      t.querySelector<HTMLElement>('a[href], button, [tabindex], [role="button"]') ??
      (t as HTMLElement)
    );
  }

  _wireAria(): void {
    const control = this._control();
    if (!control) return;
    control.setAttribute('aria-haspopup', 'dialog');
    control.setAttribute('aria-expanded', String(this.open));
    const content = this.querySelector<HTMLElement>('ui-hover-card-content [role="dialog"]');
    if (content) control.setAttribute('aria-controls', ensureId(content, 'ui-hovercard'));
  }

  // Back-compat getter.
  get isOpen(): boolean { return this.open; }

  show(): void {
    clearTimeout(this._hideTimer);
    this._showTimer = window.setTimeout(() => { this.open = true; }, this.openDelay);
  }

  hide(): void {
    clearTimeout(this._showTimer);
    this._hideTimer = window.setTimeout(() => { this.open = false; }, this.closeDelay);
  }

  // Touch open: there is no hover delay and no mouseleave to close it, so open
  // immediately and arm a one-shot outside-tap dismiss (a tap anywhere outside
  // this card closes it). Deferred a tick so the opening tap itself does not
  // immediately dismiss it.
  openByTouch(): void {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    this.open = true;
    const onOutside = (ev: Event): void => {
      // Close on an outside tap; also self-remove if the card was already
      // closed by other means (a re-tap toggle), so the listener never lingers.
      if (!this.open || !this.contains(ev.target as Node)) {
        this.open = false;
        document.removeEventListener('pointerdown', onOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  }

  render() {
    return html`<div
      data-slot="hover-card"
      data-state=${this.open ? 'open' : 'closed'}
    ><slot></slot></div>`;
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (!changedProperties.has('open')) return;
    if (changedProperties.get('open') === undefined) return;
    // Wait one microtask for <ui-hover-card-content>'s inner [popover]
    // element to commit; we drive its showPopover() / hidePopover() and
    // refresh the trigger's aria-expanded.
    queueMicrotask(() => {
      this._wireAria();
      this._syncContent();
    });
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
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  // Hover/focus open + close are MOUSE affordances. On a no-hover (touch)
  // device, iOS Safari still fires SYNTHETIC mouseenter/mouseleave (and
  // focusin/focusout from the inner link) around a tap, which would otherwise
  // immediately re-close a tap-opened card. Gate the hover handlers to pointer
  // devices so on touch the card is driven only by the tap path (#745).
  _noHover = (): boolean => !!window.matchMedia?.('(hover: none)').matches;
  _onEnter = (): void => {
    if (this._noHover()) return;
    (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  };
  _onLeave = (): void => {
    if (this._noHover()) return;
    (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
  };

  // Touch path. A touch device has no `mouseenter`, so a tap would fall through
  // to the inner `<a href>` and navigate. On a no-hover device the trigger tap
  // TOGGLES the card and NEVER navigates (the real link is reachable inside the
  // opened card). It must ALWAYS preventDefault, including while open: the
  // client router pushState()s on any bubble-phase `<a>` click that is not
  // defaultPrevented, so a re-tap that fell through would push a history entry
  // every time and Back would need N presses (#745).
  _onClick = (e: Event): void => {
    if (!window.matchMedia?.('(hover: none)').matches) return;
    const card = this.closest('ui-hover-card') as UiHoverCard | null;
    if (!card) return;
    e.preventDefault();
    e.stopPropagation();
    if (card.open) card.open = false;
    else card.openByTouch();
  };
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

  // Hover/focus open + close are MOUSE affordances. On a no-hover (touch)
  // device, iOS Safari still fires SYNTHETIC mouseenter/mouseleave (and
  // focusin/focusout from the inner link) around a tap, which would otherwise
  // immediately re-close a tap-opened card. Gate the hover handlers to pointer
  // devices so on touch the card is driven only by the tap path (#745).
  _noHover = (): boolean => !!window.matchMedia?.('(hover: none)').matches;
  _onEnter = (): void => {
    if (this._noHover()) return;
    (this.closest('ui-hover-card') as UiHoverCard | null)?.show();
  };
  _onLeave = (): void => {
    if (this._noHover()) return;
    (this.closest('ui-hover-card') as UiHoverCard | null)?.hide();
  };
}
UiHoverCardContent.register('ui-hover-card-content');
