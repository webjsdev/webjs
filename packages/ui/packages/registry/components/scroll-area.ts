/**
 * Scroll area: a region that scrolls inside a fixed size, with a thin,
 * theme-coloured scrollbar. Tier-1 class helper on native overflow; no
 * script, no custom scrollbar element.
 *
 * shadcn parity:
 *   ScrollArea (+ its viewport)  → scrollAreaClass({ orientation })
 *   ScrollBar                    → the native scrollbar, styled through
 *                                  scrollbar-width and scrollbar-color
 *
 * shadcn draws its own scrollbar with Radix. The platform's scrollbar is
 * styled instead here, which keeps native scrolling, momentum, keyboard
 * scrolling and the browser's own overlay behaviour intact. Give the element
 * a size (`h-72`, `max-h-96`, `w-96`) so it has something to scroll inside.
 *
 * A11y (required for accessible output): a region that scrolls must be
 * reachable by keyboard, so give it `tabindex="0"`, and because a focusable
 * region needs a name, add `role="region"` with an `aria-label` that says what
 * scrolls ("Release notes"). The focus ring is part of the class.
 *
 * Design tokens used: --border, --ring.
 *
 * @example
 * ```html
 * <div class=${cn(scrollAreaClass(), 'h-72 w-48 rounded-md border')} tabindex="0" role="region" aria-label="Tags">
 *   <ul class="p-4">${tags.map((t) => html`<li>${t}</li>`)}</ul>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE =
  'cn-scroll-area relative rounded-[inherit] [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

const ORIENTATIONS = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
} as const;

export type ScrollAreaOrientation = keyof typeof ORIENTATIONS;

/** The scrolling region. `orientation` picks the axis (default vertical). */
export function scrollAreaClass(opts: { orientation?: ScrollAreaOrientation } = {}): string {
  return cn(BASE, ORIENTATIONS[opts.orientation ?? 'vertical']);
}
