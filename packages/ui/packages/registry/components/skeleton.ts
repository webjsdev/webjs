/**
 * Skeleton: loading placeholder. Tier-1 class helper. Sizing comes from
 * caller-supplied utilities; `skeletonClass()` only provides the
 * animation + base look.
 *
 * shadcn parity:
 *   Skeleton  → skeletonClass()  (visual: animated rounded muted block)
 *
 * Usage:
 *   <div class=${cn(skeletonClass(), 'h-4 w-32')}></div>
 *   <div class=${cn(skeletonClass(), 'h-12 w-12 rounded-full')}></div>
 *
 * Design tokens used: --accent.
 */

export const skeletonClass = (): string => 'animate-pulse rounded-md bg-accent';
