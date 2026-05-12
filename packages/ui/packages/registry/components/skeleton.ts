/**
 * Skeleton — loading placeholder. Pure class helper.
 *
 * shadcn parity: matches shadcn Skeleton (animated rounded muted block).
 *
 * Usage:
 *   <div class=${cn(skeletonClass(), 'h-4 w-32')}></div>
 *   <div class=${cn(skeletonClass(), 'h-12 w-12 rounded-full')}></div>
 *
 * Sizing comes from caller-supplied utilities — skeletonClass() only
 * provides the animation and base look.
 *
 * Design tokens used: --accent.
 */

export const skeletonClass = (): string => 'animate-pulse rounded-md bg-accent';
