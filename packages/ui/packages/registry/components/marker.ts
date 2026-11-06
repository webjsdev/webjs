/**
 * Marker: a small inline note in a stream of content, such as "Today" between
 * chat messages or "Edited" under a post, with an optional icon. Tier-1
 * class helper; compose with a plain element.
 *
 * shadcn parity:
 *   Marker (variant: default | separator | border)
 *                    → markerClass({ variant }), alias markerVariants
 *   MarkerIcon       → markerIconClass()
 *   MarkerContent    → markerContentClass()
 *
 * The `separator` variant draws a rule on both sides of the content, and
 * `border` underlines the whole marker. Set `data-variant` to the variant you
 * pass, which is what the content's centring keys on.
 *
 * A11y (required for accessible output): a marker is text, so it needs no
 * role. When it announces a change in a live log (a date divider inside a
 * chat), it is read in order with the messages around it, which is usually
 * right. Hide a purely decorative icon with `aria-hidden="true"`.
 *
 * Design tokens used: --muted-foreground, --foreground, --border.
 *
 * @example
 * ```html
 * <div class=${markerClass({ variant: 'separator' })} data-variant="separator">
 *   <span class=${markerContentClass()}>Today</span>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE = 'cn-marker group/marker relative flex w-full items-center';

const VARIANTS = {
  default: 'cn-marker-variant-default',
  separator: 'cn-marker-variant-separator',
  border: 'cn-marker-variant-border',
} as const;

export type MarkerVariant = keyof typeof VARIANTS;

/** The marker row. Pair with `data-variant` set to the same variant. */
export function markerClass(opts: { variant?: MarkerVariant } = {}): string {
  return cn(BASE, VARIANTS[opts.variant ?? 'default']);
}

/**
 * shadcn's name for {@link markerClass}, so shadcn code ports verbatim. Like
 * cva, it merges a `className` into the result.
 */
export function markerVariants(opts: { variant?: MarkerVariant } & { className?: string } = {}): string {
  return cn(markerClass(opts), opts.className);
}

/** The leading icon. */
export function markerIconClass(): string {
  return 'cn-marker-icon shrink-0';
}

/** The marker's text. */
export function markerContentClass(): string {
  return 'cn-marker-content min-w-0 wrap-break-word';
}
