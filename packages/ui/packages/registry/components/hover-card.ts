/**
 * HoverCard, Tier-1 class helpers over the native `[popover="manual"]`
 * element plus an attachHoverCard helper for the hover-with-linger
 * state machine. AI agents compose the markup directly. No custom
 * elements.
 *
 * Difference from tooltip:
 *   - Larger content panel (rich content, not just a few-word label)
 *   - role="dialog" on the popover (vs tooltip's role="tooltip")
 *   - The content panel itself stays "hot" on hover, so a slow
 *     mouseleave -> mouseenter on the trigger -> over to the content
 *     does not close it.
 *
 * What attachHoverCard() adds:
 *   - Hover/focus open after open-delay (default 700ms)
 *   - Hover-out grace then close after close-delay (default 300ms)
 *   - Cursor-on-content keeps the card open
 *   - positionFloating placement
 *
 * Usage:
 *
 *   import { html } from '@webjskit/core';
 *   import { hoverCardContentClass, attachHoverCard } from '@/components/ui/hover-card.ts';
 *
 *   return html`
 *     <a href="/user/vivek"
 *        .ref=${(trigger: HTMLElement) => {
 *          const card = document.getElementById('user-card')!;
 *          attachHoverCard(trigger, card, { side: 'bottom' });
 *        }}>
 *       @vivek
 *     </a>
 *     <div id="user-card" popover="manual" role="dialog"
 *          class=${hoverCardContentClass()}>
 *       <div class="flex gap-3">
 *         <img class="size-10 rounded-full" src="/avatar.png" alt="">
 *         <div>
 *           <h4 class="font-semibold">@vivek</h4>
 *           <p class="text-sm text-muted-foreground">Building webjs.</p>
 *         </div>
 *       </div>
 *     </div>
 *   `;
 *
 * Design tokens used: --popover, --popover-foreground, --border.
 */
import { positionFloating, type PopoverSide, type PopoverAlign } from './popover.ts';

// `fixed m-0` opts out of the UA `[popover]` defaults (the auto-centering
// `margin: auto` in particular) so JS-computed top/left coordinates from
// `positionFloating` land correctly. The shadcn visual layer (border, bg,
// padding, shadow) is layered on top. UA `[popover]:not(:popover-open)
// { display: none }` handles closed-state hiding for free.
export const hoverCardContentClass = (): string =>
  'fixed z-50 w-64 m-0 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden';

export interface AttachHoverCardOptions {
  /** Hover delay before opening, in ms. Default 700. */
  openDelay?: number;
  /** Hover-out grace before closing, in ms. Default 300. */
  closeDelay?: number;
  /** Placement side. Default 'bottom'. */
  side?: PopoverSide;
  /** Alignment along the side axis. Default 'center'. */
  align?: PopoverAlign;
  /** Pixel offset from the trigger along the side axis. Default 4. */
  sideOffset?: number;
  /** Pixel offset along the align axis. Default 0. */
  alignOffset?: number;
}

/**
 * Wire a trigger element to open a popover-mode hover card on hover or
 * focus. The card stays open while the cursor is over the content,
 * matching shadcn's HoverCard behavior. Returns a teardown function
 * that removes all the listeners.
 *
 * The content element must have `popover="manual"`.
 */
export function attachHoverCard(
  trigger: HTMLElement,
  content: HTMLElement,
  opts: AttachHoverCardOptions = {},
): () => void {
  const openDelay = opts.openDelay ?? 700;
  const closeDelay = opts.closeDelay ?? 300;
  let showTimer: number | undefined;
  let hideTimer: number | undefined;

  function show(): void {
    clearTimeout(hideTimer);
    showTimer = window.setTimeout(() => {
      if ('showPopover' in content && typeof content.showPopover === 'function') {
        (content as HTMLElement & { showPopover(): void }).showPopover();
      }
      positionFloating(trigger, content, {
        side: opts.side ?? 'bottom',
        align: opts.align ?? 'center',
        sideOffset: opts.sideOffset ?? 4,
        alignOffset: opts.alignOffset ?? 0,
      });
    }, openDelay);
  }

  function hide(): void {
    clearTimeout(showTimer);
    hideTimer = window.setTimeout(() => {
      if ('hidePopover' in content && typeof content.hidePopover === 'function') {
        (content as HTMLElement & { hidePopover(): void }).hidePopover();
      }
    }, closeDelay);
  }

  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('mouseleave', hide);
  trigger.addEventListener('focusin', show);
  trigger.addEventListener('focusout', hide);
  // Keep open while the pointer is over the content itself.
  content.addEventListener('mouseenter', show);
  content.addEventListener('mouseleave', hide);

  return (): void => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    trigger.removeEventListener('mouseenter', show);
    trigger.removeEventListener('mouseleave', hide);
    trigger.removeEventListener('focusin', show);
    trigger.removeEventListener('focusout', hide);
    content.removeEventListener('mouseenter', show);
    content.removeEventListener('mouseleave', hide);
  };
}
