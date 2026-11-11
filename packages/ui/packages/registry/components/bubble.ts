/**
 * Bubble: a chat speech bubble, the group that stacks several from one sender,
 * and the emoji reactions pinned to its corner. Tier-1 class helper; pair with
 * the message helpers for the row, avatar and header around it.
 *
 * shadcn parity:
 *   BubbleGroup                → bubbleGroupClass()
 *   Bubble (variant: default | secondary | muted | tinted | outline | ghost | destructive)
 *                              → bubbleClass({ variant }), alias bubbleVariants
 *   BubbleContent              → bubbleContentClass()
 *   BubbleReactions (side: top | bottom, align: start | end)
 *                              → bubbleReactionsClass({ side, align }), alias bubbleReactionsVariants
 *
 * The variant colours the content, so put `data-slot="bubble-content"` on the
 * inner element and `data-variant` on the bubble. Inside a message with
 * `data-align="end"` the bubble follows to the inline end.
 *
 * A11y (required for accessible output): the bubble is text inside a message,
 * so it needs no role of its own. Reactions are buttons when they act (with an
 * `aria-label` such as "2 people reacted with thumbs up", since an emoji alone
 * reads poorly) and plain text when they only show a count.
 *
 * Design tokens used: --primary, --secondary, --muted, --accent, --border,
 * --destructive.
 *
 * @example
 * ```html
 * <div class=${bubbleClass()} data-slot="bubble" data-variant="default">
 *   <div class=${bubbleContentClass()} data-slot="bubble-content">Shipping it now.</div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

/** Set `data-slot="bubble-group"` on the element. */
export function bubbleGroupClass(): string {
  return 'cn-bubble-group flex min-w-0 flex-col';
}

const BUBBLE_BASE =
  'cn-bubble group/bubble relative flex w-fit min-w-0 flex-col';

const BUBBLE_VARIANTS = {
  default: 'cn-bubble-variant-default',
  secondary: 'cn-bubble-variant-secondary',
  muted: 'cn-bubble-variant-muted',
  tinted: 'cn-bubble-variant-tinted',
  outline: 'cn-bubble-variant-outline',
  ghost: 'cn-bubble-variant-ghost',
  destructive: 'cn-bubble-variant-destructive',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function bubbleClass(opts: { variant?: keyof typeof BUBBLE_VARIANTS } & { className?: string } = {}): string {
  if (opts.className) return cn(bubbleClass({ ...opts, className: undefined }), opts.className);
  return cn(BUBBLE_BASE, BUBBLE_VARIANTS[opts.variant ?? 'default']);
}

/**
 * shadcn's name for {@link bubbleClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function bubbleVariants(opts: { variant?: keyof typeof BUBBLE_VARIANTS } & { className?: string } = {}): string {
  return bubbleClass(opts);
}

/** Set `data-slot="bubble-content"` on the element. */
export function bubbleContentClass(): string {
  return 'cn-bubble-content w-fit max-w-full min-w-0 overflow-hidden wrap-break-word [button]:text-start [button,a]:transition-colors';
}

const BUBBLE_REACTIONS_BASE =
  'cn-bubble-reactions absolute z-10 flex w-fit items-center justify-center';

const BUBBLE_REACTIONS_SIDES = {
  top: 'cn-bubble-reactions-side-top',
  bottom: 'cn-bubble-reactions-side-bottom',
} as const;

const BUBBLE_REACTIONS_ALIGNS = {
  start: 'cn-bubble-reactions-align-start',
  end: 'cn-bubble-reactions-align-end',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function bubbleReactionsClass(opts: { side?: keyof typeof BUBBLE_REACTIONS_SIDES; align?: keyof typeof BUBBLE_REACTIONS_ALIGNS } & { className?: string } = {}): string {
  if (opts.className) return cn(bubbleReactionsClass({ ...opts, className: undefined }), opts.className);
  return cn(BUBBLE_REACTIONS_BASE, BUBBLE_REACTIONS_SIDES[opts.side ?? 'bottom'], BUBBLE_REACTIONS_ALIGNS[opts.align ?? 'end']);
}

/**
 * shadcn's name for {@link bubbleReactionsClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function bubbleReactionsVariants(opts: { side?: keyof typeof BUBBLE_REACTIONS_SIDES; align?: keyof typeof BUBBLE_REACTIONS_ALIGNS } & { className?: string } = {}): string {
  return bubbleReactionsClass(opts);
}
