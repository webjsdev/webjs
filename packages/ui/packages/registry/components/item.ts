/**
 * Item: a flexible row for lists of things (a person, a file, a setting), with
 * media, a title and description, and actions. Tier-1 class helper; compose
 * with a plain element, or an `<a>` / `<button>` when the whole row acts.
 *
 * shadcn parity:
 *   ItemGroup / ItemSeparator          → itemGroupClass() / itemSeparatorClass()
 *   Item (variant: default | outline | muted, size: default | sm | xs)
 *                                      → itemClass({ variant, size }), alias itemVariants
 *   ItemMedia (variant: default | icon | image)
 *                                      → itemMediaClass({ variant }), alias itemMediaVariants
 *   ItemContent / ItemTitle / ItemDescription / ItemActions / ItemHeader / ItemFooter
 *                                      → itemContentClass() ... itemFooterClass()
 *
 * Every part takes its `data-slot` (shown on each helper), which is what the
 * styles use to lay the parts out relative to each other.
 *
 * A11y (required for accessible output): a group of items is a list, so render
 * it as `<ul role="list">` with each item an `<li>`, or keep `role="list"` /
 * `role="listitem"` on divs. A whole-row link is a real `<a>` holding the
 * content, never a click handler on a div. Media that only decorates takes
 * `alt=""` or `aria-hidden="true"`, and an icon-only action needs
 * `aria-label`.
 *
 * Design tokens used: --border, --muted, --muted-foreground, --accent, --ring.
 *
 * @example
 * ```html
 * <div class=${itemClass({ variant: 'outline' })} data-slot="item" data-variant="outline">
 *   <div class=${itemContentClass()} data-slot="item-content">
 *     <div class=${itemTitleClass()} data-slot="item-title">Two-factor authentication</div>
 *     <p class=${itemDescriptionClass()} data-slot="item-description">Verify it is you with a code.</p>
 *   </div>
 *   <div class=${itemActionsClass()} data-slot="item-actions">
 *     <button class=${buttonClass({ variant: 'outline', size: 'sm' })} type="button">Enable</button>
 *   </div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

/** Set `data-slot="item-group"` on the element. */
export function itemGroupClass(): string {
  return 'cn-item-group group/item-group flex w-full flex-col';
}

/** Set `data-slot="item-separator"` on the element. */
export function itemSeparatorClass(): string {
  return 'cn-item-separator';
}

const ITEM_BASE =
  'cn-item group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors';

const ITEM_VARIANTS = {
  default: 'cn-item-variant-default',
  outline: 'cn-item-variant-outline',
  muted: 'cn-item-variant-muted',
} as const;

const ITEM_SIZES = {
  default: 'cn-item-size-default',
  sm: 'cn-item-size-sm',
  xs: 'cn-item-size-xs',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function itemClass(opts: { variant?: keyof typeof ITEM_VARIANTS; size?: keyof typeof ITEM_SIZES } = {}): string {
  return cn(ITEM_BASE, ITEM_VARIANTS[opts.variant ?? 'default'], ITEM_SIZES[opts.size ?? 'default']);
}

/**
 * shadcn's name for {@link itemClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function itemVariants(opts: { variant?: keyof typeof ITEM_VARIANTS; size?: keyof typeof ITEM_SIZES } & { className?: string } = {}): string {
  return cn(itemClass(opts), opts.className);
}

const ITEM_MEDIA_BASE =
  'cn-item-media flex shrink-0 items-center justify-center [&_svg]:pointer-events-none';

const ITEM_MEDIA_VARIANTS = {
  default: 'cn-item-media-variant-default',
  icon: 'cn-item-media-variant-icon',
  image: 'cn-item-media-variant-image',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function itemMediaClass(opts: { variant?: keyof typeof ITEM_MEDIA_VARIANTS } = {}): string {
  return cn(ITEM_MEDIA_BASE, ITEM_MEDIA_VARIANTS[opts.variant ?? 'default']);
}

/**
 * shadcn's name for {@link itemMediaClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function itemMediaVariants(opts: { variant?: keyof typeof ITEM_MEDIA_VARIANTS } & { className?: string } = {}): string {
  return cn(itemMediaClass(opts), opts.className);
}

/** Set `data-slot="item-content"` on the element. */
export function itemContentClass(): string {
  return 'cn-item-content flex flex-1 flex-col [&+[data-slot=item-content]]:flex-none';
}

/** Set `data-slot="item-title"` on the element. */
export function itemTitleClass(): string {
  return 'cn-item-title line-clamp-1 flex w-fit items-center';
}

/** Set `data-slot="item-description"` on the element. */
export function itemDescriptionClass(): string {
  return 'cn-item-description line-clamp-2 font-normal [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary';
}

/** Set `data-slot="item-actions"` on the element. */
export function itemActionsClass(): string {
  return 'cn-item-actions flex items-center';
}

/** Set `data-slot="item-header"` on the element. */
export function itemHeaderClass(): string {
  return 'cn-item-header flex basis-full items-center justify-between';
}

/** Set `data-slot="item-footer"` on the element. */
export function itemFooterClass(): string {
  return 'cn-item-footer flex basis-full items-center justify-between';
}
