/**
 * Tooltip, Tier-1 class helpers over the native `[popover="manual"]`
 * element plus a small attachTooltip helper for the hover-with-delay
 * state machine. AI agents compose the markup directly. No custom
 * elements.
 *
 * What the native popover gives you:
 *   - Top-layer rendering (no z-index wars)
 *   - showPopover() / hidePopover() programmatic API
 *   - UA `[popover]:not(:popover-open) { display: none }` for closed state
 *
 * What attachTooltip() adds:
 *   - Hover/focus open after `delay-duration` (default 700ms)
 *   - Close after 100ms hover-out grace
 *   - `skip-delay-duration` window (default 300ms): if another tooltip
 *     closed within this window, the next one opens immediately
 *   - positionFloating placement (side / align / side-offset)
 *
 * shadcn parity (class helper level):
 *   <Tooltip>         -> the wrapping div is gone, just wire trigger + content
 *   <TooltipTrigger>  -> the trigger button itself
 *   <TooltipContent>  -> the `[popover="manual"]` element with tooltipContentClass()
 *
 * Usage:
 *
 *   import { html } from '@webjskit/core';
 *   import { tooltipContentClass, attachTooltip } from '@/components/ui/tooltip.ts';
 *   import { buttonClass } from '@/components/ui/button.ts';
 *
 *   return html`
 *     <button class=${buttonClass({ variant: 'ghost', size: 'icon' })}
 *             aria-label="Help"
 *             .ref=${(trigger: HTMLElement) => {
 *               const tip = document.getElementById('help-tip')!;
 *               attachTooltip(trigger, tip, { side: 'top' });
 *             }}>
 *       ?
 *     </button>
 *     <div id="help-tip" popover="manual" role="tooltip"
 *          class=${tooltipContentClass()}>
 *       Helpful tip
 *     </div>
 *   `;
 *
 * Design tokens used: --foreground, --background.
 */
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

// Module-level "last close" timestamp, shared across every tooltip on
// the page. When the next tooltip is hovered within `skipDelay`
// ms of this stamp, it skips its `delay` wait and opens immediately.
// Matches shadcn's TooltipProvider.skipDelayDuration.
let lastTooltipHideAt = 0;

export interface AttachTooltipOptions {
  /** Hover delay before opening, in ms. Default 700. */
  delay?: number;
  /** Window after another tooltip closes during which the next skips its delay. Default 300. */
  skipDelay?: number;
  /** Placement side. Default 'top'. */
  side?: PopoverSide;
  /** Alignment along the side axis. Default 'center'. */
  align?: PopoverAlign;
  /** Pixel offset from the trigger along the side axis. Default 4. */
  sideOffset?: number;
  /** Pixel offset along the align axis. Default 0. */
  alignOffset?: number;
}

/**
 * Wire a trigger element to open a popover-mode tooltip on hover or focus.
 * Returns a teardown function that removes the listeners (call from
 * disconnect / cleanup hooks if needed; for SSR + hydrate apps the
 * listeners live as long as the elements).
 *
 * The content element must have `popover="manual"` so the native
 * showPopover()/hidePopover() API works without auto-light-dismiss.
 */
export function attachTooltip(
  trigger: HTMLElement,
  content: HTMLElement,
  opts: AttachTooltipOptions = {},
): () => void {
  const delay = opts.delay ?? 700;
  const skipDelay = opts.skipDelay ?? 300;
  let showTimer: number | undefined;
  let hideTimer: number | undefined;

  function show(): void {
    clearTimeout(hideTimer);
    const sinceLastHide = Date.now() - lastTooltipHideAt;
    const openNow = (): void => {
      if ('showPopover' in content && typeof content.showPopover === 'function') {
        (content as HTMLElement & { showPopover(): void }).showPopover();
      }
      positionFloating(trigger, content, {
        side: opts.side ?? 'top',
        align: opts.align ?? 'center',
        sideOffset: opts.sideOffset ?? 4,
        alignOffset: opts.alignOffset ?? 0,
      });
    };
    if (lastTooltipHideAt > 0 && sinceLastHide < skipDelay) {
      openNow();
      return;
    }
    showTimer = window.setTimeout(openNow, delay);
  }

  function hide(): void {
    clearTimeout(showTimer);
    hideTimer = window.setTimeout(() => {
      if ('hidePopover' in content && typeof content.hidePopover === 'function') {
        (content as HTMLElement & { hidePopover(): void }).hidePopover();
      }
      lastTooltipHideAt = Date.now();
    }, 100);
  }

  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('mouseleave', hide);
  trigger.addEventListener('focusin', show);
  trigger.addEventListener('focusout', hide);

  return (): void => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    trigger.removeEventListener('mouseenter', show);
    trigger.removeEventListener('mouseleave', hide);
    trigger.removeEventListener('focusin', show);
    trigger.removeEventListener('focusout', hide);
  };
}
