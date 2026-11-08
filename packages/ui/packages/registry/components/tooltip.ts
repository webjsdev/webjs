/**
 * Tooltip: hover- / focus-triggered floating tip. Tier-2. The content
 * uses the native Popover API in `popover="manual"` mode for top-layer
 * rendering (no z-index wars); the custom element owns the
 * hover-with-delay state machine and JS positioning.
 *
 * shadcn parity:
 *   Tooltip               → <ui-tooltip delay-duration skip-delay-duration>
 *   TooltipTrigger        → <ui-tooltip-trigger>
 *   TooltipContent        → <ui-tooltip-content side align side-offset align-offset>
 *                           (with shadcn's arrow, TooltipPrimitive.Arrow, drawn
 *                           by the content and placed on the trigger's centre)
 *   TooltipProvider       → not needed; delay state is per-tooltip (and globally
 *                           shared via `skip-delay-duration` cooldown).
 *
 * Attributes on <ui-tooltip>:
 *   `open`:                boolean (reflected). Open state.
 *   `delay-duration`:      ms, default 700. Initial hover delay before opening.
 *   `skip-delay-duration`: ms, default 300. Window after a tooltip closes
 *                          during which the next tooltip skips its
 *                          `delay-duration` (so moving between adjacent
 *                          triggers feels instant).
 *
 * Attributes on <ui-tooltip-content>:
 *   `side`:         "top" (default) | "right" | "bottom" | "left".
 *   `align`:        "center" (default) | "start" | "end".
 *   `side-offset`:  number, default 0 (shadcn's). Pixels between trigger and
 *                   content, on top of the arrow's height, as Radix adds it.
 *   `align-offset`: number, default 0. Pixels of cross-axis shift.
 *
 * Events: none dispatched at present (hover state changes are local;
 * use the reflected `open` attribute to observe state from CSS).
 *
 * Programmatic API on <ui-tooltip>: `.show()` · `.hide()`.
 *
 * Keyboard:
 *   Escape   dismiss a showing tip, leaving focus on the trigger
 *
 * A11y (owned by the element, nothing to supply):
 *   The focusable trigger references the tip via `aria-describedby`, so a
 *   screen reader appends the tip to the trigger's own name, and the tip opens
 *   on focus as well as hover. Escape dismisses a showing tip without moving
 *   focus (APG requires the escape hatch, since a tip can cover the content
 *   underneath it). A CLOSED tooltip never consumes Escape, so it cannot
 *   swallow the key from a dialog it happens to sit inside.
 *   What you DO supply: an accessible name on the trigger control itself. The
 *   tip is a DESCRIPTION, not a name, so an icon-only trigger still needs its
 *   own `aria-label` as the example below shows.
 *
 * Design tokens used: --foreground, --background.
 *
 * @example
 * ```html
 * <ui-tooltip delay-duration="500" skip-delay-duration="300">
 *   <ui-tooltip-trigger>
 *     <button class=${buttonClass({ size: 'icon', variant: 'ghost' })} aria-label="Help">?</button>
 *   </ui-tooltip-trigger>
 *   <ui-tooltip-content side="top">Helpful tip</ui-tooltip-content>
 * </ui-tooltip>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { ensureId } from '../lib/utils.ts';
import { onBeforeCache } from '../lib/dom.ts';
import { positionFloating } from './floating.ts';
import type { PopoverSide, PopoverAlign } from './popover.ts';

// UA `[popover]` defaults paint a bordered, padded panel centered with
// `margin: auto`; the class string opts out via `m-0` + `border-0` and
// layers the shadcn look on top. `fixed` keeps JS-computed top/left in
// top layer. A closed panel is hidden by `not-open:hidden`, since the UA
// `[popover]:not(:popover-open) { display: none }` loses to the
// `inline-flex` most styles give the content (see popoverContentClass).
// `overflow-visible` undoes the UA popover's `overflow: auto`, which would
// clip the arrow hanging off the tip's edge (Radix's content is no popover,
// so shadcn's styles never needed it).
/** The arrow's classes (the element applies them): shadcn's TooltipPrimitive.Arrow. */
export const tooltipArrowClass = (): string =>
  'cn-tooltip-arrow z-50 translate-y-[calc(-50%_-_2px)] bg-foreground fill-foreground';

// Where the arrow's wrapper sits for each side the tip lands on, as Radix's
// PopperArrow places it: on the edge facing the trigger, turned to point at it.
const ARROW_PLACEMENT: Record<string, { edge: string; origin: string; transform: string }> = {
  top: { edge: 'bottom', origin: '', transform: 'translateY(100%)' },
  bottom: { edge: 'top', origin: 'center 0', transform: 'rotate(180deg)' },
  right: { edge: 'left', origin: '0 0', transform: 'translateY(50%) rotate(90deg) translateX(-50%)' },
  left: { edge: 'right', origin: '100% 0', transform: 'translateY(50%) rotate(-90deg) translateX(50%)' },
};
// Radix's Arrow is 10 by 5.
const ARROW_WIDTH = 10;

export const tooltipContentClass = (): string =>
  'cn-tooltip-content z-50 w-fit origin-(--radix-tooltip-content-transform-origin) overflow-visible bg-foreground text-background not-open:hidden';

// Module-level "last close" timestamp, shared across every <ui-tooltip>
// on the page. When the next tooltip is hovered within
// `skip-delay-duration` ms of this stamp, it skips its delay-duration
// wait and opens immediately. Matches shadcn TooltipProvider.skipDelayDuration.
let lastTooltipHideAt = 0;

// --------------------------------------------------------------------------
// <ui-tooltip>
// --------------------------------------------------------------------------

export class UiTooltip extends WebComponent({
  open: prop(Boolean, { reflect: true }),
  // `delayDuration` / `skipDelayDuration` ride the `delay-duration` /
  // `skip-delay-duration` attributes (shadcn parity), read as typed props.
  delayDuration: Number,
  skipDelayDuration: Number,
}) {
  _showTimer: number | undefined;
  _hideTimer: number | undefined;

  _keyHandler = (e: KeyboardEvent): void => this._onKeyDown(e);

  constructor() {
    super();
    this.open = false;
    this.delayDuration = 700;
    this.skipDelayDuration = 300;
  }

  _disposeBeforeCache?: () => void;

  connectedCallback(): void {
    super.connectedCallback?.();
    // webjs projects slotted light-DOM children in a pass after the first
    // render, so the trigger's focusable control is not in place yet at
    // connect / firstUpdated. Defer to the next frame, by which point the
    // projection has run and both the control and the tip content exist.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this._wireAria());
    }
    // Close before a back/forward snapshot so it does not restore open (#766).
    this._disposeBeforeCache = onBeforeCache(() => { this.open = false; this.removeAttribute('open'); });
  }

  disconnectedCallback(): void {
    this._unbindEscape();
    this._disposeBeforeCache?.();
    super.disconnectedCallback?.();
  }

  // APG Tooltip requires an Escape escape-hatch: a tip can cover the content
  // underneath it, and a keyboard user who cannot dismiss it is stuck. Focus
  // is deliberately untouched, since the tip is not focusable and the trigger
  // should keep focus (moving it would lose the user's place).
  //
  // The listener is bound only WHILE OPEN, which is how a closed tooltip is
  // kept from consuming Escape that a dialog (or anything else) wants.
  _onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !this.open) return;
    e.preventDefault();
    this._dismiss();
  }

  // Immediate, unlike hide()'s 100ms hover-out grace: a dismissal is a
  // deliberate act, so it should not sit around waiting to be cancelled.
  _dismiss(): void {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    this.open = false;
    lastTooltipHideAt = Date.now();
  }

  _bindEscape(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', this._keyHandler);
  }

  _unbindEscape(): void {
    if (typeof document === 'undefined') return;
    document.removeEventListener('keydown', this._keyHandler);
  }

  // APG tooltip wiring: the focusable trigger references the tip via
  // aria-describedby, so a screen reader appends the tip text to the
  // trigger's own name ("Help, button, Helpful tip"). The tip is JS-driven,
  // so doing this at runtime is correct.
  _wireAria(): void {
    const triggerHost = this.querySelector('ui-tooltip-trigger');
    const content = this.querySelector<HTMLElement>('ui-tooltip-content [role="tooltip"]');
    if (!triggerHost || !content) return;
    const control =
      triggerHost.querySelector<HTMLElement>('button, a[href], [tabindex], [role="button"]') ??
      (triggerHost as HTMLElement);
    const id = ensureId(content, 'ui-tooltip');
    const existing = control.getAttribute('aria-describedby');
    if (!existing) control.setAttribute('aria-describedby', id);
    else if (!existing.split(/\s+/).includes(id)) {
      control.setAttribute('aria-describedby', `${existing} ${id}`);
    }
  }

  // Back-compat getter for tests + external code that read `el.isOpen`
  // alongside the reactive `open` prop.
  get isOpen(): boolean { return this.open; }

  show(): void {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    const delay = this.delayDuration;
    const skipDelay = this.skipDelayDuration;
    const sinceLastHide = Date.now() - lastTooltipHideAt;
    if (lastTooltipHideAt > 0 && sinceLastHide < skipDelay) {
      this.open = true;
      return;
    }
    this._showTimer = window.setTimeout(() => { this.open = true; }, delay);
  }

  hide(): void {
    clearTimeout(this._showTimer);
    // Clear the PENDING hide before scheduling the next one: overwriting the
    // handle alone orphans the old timer, which then fires on its own and
    // closes a tip a later show() had already reopened.
    clearTimeout(this._hideTimer);
    this._hideTimer = window.setTimeout(() => {
      this.open = false;
      lastTooltipHideAt = Date.now();
    }, 100);
  }

  render() {
    return html`<div
      data-slot="tooltip"
      data-state=${this.open ? 'open' : 'closed'}
    ><slot></slot></div>`;
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (!changedProperties.has('open')) return;
    // Skip the constructor's initial open=false set.
    if (changedProperties.get('open') === undefined) return;
    // Bind synchronously rather than inside _syncContent, which bails early on
    // engines with no Popover API: Escape has to work regardless of that.
    if (this.open) this._bindEscape();
    else this._unbindEscape();
    // Defer one microtask so the content child's [popover] inner element
    // has committed; we drive its showPopover() / hidePopover() from here.
    queueMicrotask(() => this._syncContent());
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
    // Radix offsets the tip by the arrow's height on top of sideOffset, so the
    // arrow has room between the tip and the trigger.
    const arrow = popover.querySelector('[data-slot="tooltip-arrow"]');
    const arrowHeight = arrow ? parseFloat(getComputedStyle(arrow).height) || 0 : 0;
    positionFloating(trigger, popover, {
      side: (contentHost.getAttribute('side') ?? 'top') as PopoverSide,
      align: (contentHost.getAttribute('align') ?? 'center') as PopoverAlign,
      sideOffset: Number(contentHost.getAttribute('side-offset') ?? 0) + arrowHeight,
      alignOffset: Number(contentHost.getAttribute('align-offset') ?? 0),
      radix: this.localName.slice(3),
    });
    this._placeArrow(trigger, popover);
  }

  // The arrow sits on the side facing the trigger, centred on it along the
  // tip's edge and kept inside that edge, the way Radix's arrow is.
  _placeArrow(trigger: HTMLElement, popover: HTMLElement): void {
    const wrap = popover.querySelector<HTMLElement>('[data-slot="tooltip-arrow-wrapper"]');
    if (!wrap) return;
    const side = popover.getAttribute('data-side') ?? 'top';
    const place = ARROW_PLACEMENT[side] ?? ARROW_PLACEMENT.top;
    const t = trigger.getBoundingClientRect();
    // The tip's own box, read through its layout offsets rather than its
    // rect, which an entrance animation is still scaling.
    // The wrapper is placed from inside the tip's border.
    const left = popover.offsetLeft + popover.clientLeft;
    const top = popover.offsetTop + popover.clientTop;
    // Radix's transforms keep the wrapper's centre on its left edge's offset
    // plus half its width across a top or bottom edge, and on its top's offset
    // plus half its height along a side edge, so centre it by those.
    const w = wrap.offsetWidth || ARROW_WIDTH;
    const h = wrap.offsetHeight || ARROW_WIDTH / 2;
    const along = side === 'top' || side === 'bottom'
      ? Math.min(Math.max(t.left + t.width / 2 - left - w / 2, 0), popover.clientWidth - w)
      : Math.min(Math.max(t.top + t.height / 2 - top - h / 2, 0), popover.clientHeight - h);
    const st = wrap.style;
    st.left = st.top = st.right = st.bottom = '';
    if (side === 'top' || side === 'bottom') st.left = `${along}px`;
    else st.top = `${along}px`;
    st.setProperty(place.edge, '0px');
    st.transformOrigin = place.origin;
    st.transform = place.transform;
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
    ><slot></slot><span data-slot="tooltip-arrow-wrapper" aria-hidden="true" style="position: absolute; bottom: 0px; transform: translateY(100%)"><svg
      data-slot="tooltip-arrow" class=${tooltipArrowClass()} width="10" height="5" viewBox="0 0 30 10" preserveAspectRatio="none" style="display: block"
    ><polygon points="0,0 30,0 15,10"></polygon></svg></span></div>`;
  }
}
UiTooltipContent.register('ui-tooltip-content');
