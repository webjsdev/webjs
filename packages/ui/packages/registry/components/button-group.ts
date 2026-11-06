/**
 * Button group: a row (or column) of buttons that share their borders, so
 * they read as one control. Tier-1 class helper; compose with a real
 * container element and real buttons.
 *
 * shadcn parity:
 *   ButtonGroup (orientation: horizontal | vertical)
 *                          → buttonGroupClass({ orientation }), alias buttonGroupVariants
 *   ButtonGroupText        → buttonGroupTextClass()
 *   ButtonGroupSeparator   → buttonGroupSeparatorClass() with separatorClass({ orientation })
 *
 * The group flattens the inner corners and drops the doubled border between
 * neighbours, by logical side, so it reads correctly under `dir="rtl"`. A
 * nested group (a group of groups) keeps its own gap.
 *
 * A11y (required for accessible output): put `role="group"` on the container
 * and name it with `aria-label` (or `aria-labelledby`) when the buttons share
 * a purpose a screen-reader user needs to hear ("Text alignment"). Each button
 * keeps its own accessible name; an icon-only one needs `aria-label`. Set
 * `data-orientation` to match the orientation you pass, and a separator inside
 * the group is decorative, so give it `role="none"` or `aria-hidden="true"`.
 *
 * Design tokens used: --border, --input, --muted.
 *
 * @example
 * ```html
 * <div class=${buttonGroupClass()} role="group" aria-label="Text alignment" data-orientation="horizontal">
 *   <button class=${buttonClass({ variant: 'outline' })} type="button">Left</button>
 *   <button class=${buttonClass({ variant: 'outline' })} type="button">Center</button>
 *   <button class=${buttonClass({ variant: 'outline' })} type="button">Right</button>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE =
  "cn-button-group group/button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1";

const ORIENTATIONS = {
  horizontal:
    'cn-button-group-orientation-horizontal [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none',
  vertical:
    'cn-button-group-orientation-vertical flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
} as const;

export type ButtonGroupOrientation = keyof typeof ORIENTATIONS;

/** The group container. Pair with `role="group"` and `data-orientation`. */
export function buttonGroupClass(opts: { orientation?: ButtonGroupOrientation } = {}): string {
  return cn(BASE, ORIENTATIONS[opts.orientation ?? 'horizontal']);
}

/**
 * shadcn's name for {@link buttonGroupClass}, so shadcn code ports verbatim
 * (`buttonGroupVariants({ ... })` is shadcn's `cva` export for `ButtonGroup`).
 * Like cva, it merges a `className` into the result.
 */
export function buttonGroupVariants(opts: { orientation?: ButtonGroupOrientation } & { className?: string } = {}): string {
  return cn(buttonGroupClass(opts), opts.className);
}

/** A non-interactive label or value sitting inside the group. */
export function buttonGroupTextClass(): string {
  return 'cn-button-group-text flex items-center [&_svg]:pointer-events-none';
}

/**
 * A divider between buttons. Compose with the separator helper:
 * `cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass())`.
 */
export function buttonGroupSeparatorClass(): string {
  return 'cn-button-group-separator relative self-stretch data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto';
}
