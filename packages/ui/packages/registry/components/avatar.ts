/**
 * Avatar: circular user image with fallback. Tier-1 class helpers;
 * compose with a native `<span>` or `<img>`. As in shadcn, one of the two
 * shows, never both, and with no script: the image is laid over the fallback
 * (`absolute inset-0` inside the `relative` root), so a loaded image covers
 * it, and a missing or broken one leaves the fallback showing. A broken
 * image paints neither its alt text (`text-transparent`) nor, in Chromium,
 * its broken-image glyph: a broken `<img>` renders a `::before` box (a loaded
 * one never does), and the full-height block it gets here pushes the glyph
 * out of the clipped box. Safari ignores that box and draws its glyph over
 * the initials (Firefox can too at larger sizes), so where that matters hide
 * the image on failure with script (`onerror`).
 *
 * shadcn parity:
 *   Avatar (size: default | sm | lg)  → avatarClass({ size }) with `data-size`
 *   AvatarImage                       → avatarImageClass()
 *   AvatarFallback                    → avatarFallbackClass()
 *   AvatarBadge                       → avatarBadgeClass()
 *   AvatarGroup                       → avatarGroupClass()
 *   AvatarGroupCount                  → avatarGroupCountClass()
 *
 * A11y (required for accessible output): the <img> MUST have an alt that
 * names the person (alt="Vivek Khandelwal"), or alt="" when a visible text
 * fallback already names them. Always provide the fallback <span> so the
 * avatar is still named if the image fails to load.
 *
 * Design tokens used: --muted, --muted-foreground, --primary, --background.
 *
 * @example
 * ```html
 * <span class=${avatarClass()} data-size="default" data-slot="avatar">
 *   <img class=${avatarImageClass()} src="/avatars/vivek.jpg" alt="Vivek Khandelwal">
 *   <span class=${avatarFallbackClass()}>VK</span>
 * </span>
 *
 * <div class=${avatarGroupClass()}>
 *   <span class=${avatarClass()} data-size="default" data-slot="avatar">
 *     <img class=${avatarImageClass()} src="/avatars/vivek.jpg" alt="Vivek Khandelwal">
 *     <span class=${avatarFallbackClass()}>VK</span>
 *   </span>
 *   <span class=${avatarClass()} data-size="default" data-slot="avatar">
 *     <img class=${avatarImageClass()} src="/avatars/amir.jpg" alt="Amir Rao">
 *     <span class=${avatarFallbackClass()}>AR</span>
 *   </span>
 *   <div class=${avatarGroupCountClass()}>+3</div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

export type AvatarSize = 'default' | 'sm' | 'lg';

const AVATAR_BASE =
  'cn-avatar group/avatar relative flex shrink-0 select-none';

export function avatarClass(_opts: { size?: AvatarSize } = {}): string {
  // Size driven by data-size attribute on the element (matches shadcn).
  return cn(AVATAR_BASE);
}

export const avatarImageClass = (): string =>
  'cn-avatar-image absolute inset-0 aspect-square size-full object-cover overflow-hidden text-transparent before:block before:h-full';

export const avatarFallbackClass = (): string =>
  'cn-avatar-fallback flex size-full items-center justify-center text-sm group-data-[size=sm]/avatar:text-xs';

export const avatarBadgeClass = (): string =>
  'cn-avatar-badge absolute end-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2 group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2';

export const avatarGroupClass = (): string =>
  'cn-avatar-group group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background';

export const avatarGroupCountClass = (): string =>
  'cn-avatar-group-count relative flex shrink-0 items-center justify-center ring-2 ring-background';
