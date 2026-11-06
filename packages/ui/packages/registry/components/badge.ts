/**
 * Badge: small visual label. Tier-1 class helper; compose with any
 * inline element (commonly `<span>` or `<a>` for linked badges).
 *
 * shadcn parity:
 *   Badge (variant: default | secondary | destructive | outline | ghost | link)
 *                                  → badgeClass({ variant })
 *
 * The `[a&]:hover:...` hover styles only apply when the element is an `<a>`,
 * so a static `<span>` doesn't pick up an unwanted hover.
 *
 * A11y (required for accessible output): render a static badge as a plain
 * <span> (not focusable, no tabindex). Only an interactive badge (an <a>
 * or <button>) is focusable, and an icon-only one needs an aria-label.
 *
 * Design tokens used: --primary, --secondary, --destructive, --foreground,
 * --accent, --border, --ring.
 *
 * @example
 * ```html
 * <span class=${badgeClass()}>New</span>
 * <span class=${badgeClass({ variant: 'destructive' })}>Error</span>
 * <a class=${badgeClass({ variant: 'link' })} href="/profile">@vivek</a>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE =
  'cn-badge group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none';

const VARIANTS = {
  default: 'cn-badge-variant-default',
  secondary: 'cn-badge-variant-secondary',
  destructive: 'cn-badge-variant-destructive',
  outline: 'cn-badge-variant-outline',
  ghost: 'cn-badge-variant-ghost',
  link: 'cn-badge-variant-link',
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function badgeClass(opts: { variant?: BadgeVariant } = {}): string {
  return cn(BASE, VARIANTS[opts.variant ?? 'default']);
}
