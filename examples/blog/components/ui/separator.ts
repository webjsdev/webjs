/**
 * Separator: horizontal or vertical divider. Pure class helper. For
 * accessibility, set `role="separator"` (or `role="none"` for purely
 * decorative use) and `aria-orientation` on the element.
 *
 * shadcn parity:
 *   orientation: horizontal (default) | vertical
 *   decorative: true (default: uses `role="none"`)
 *
 * Usage:
 *   <div role="none" class=${separatorClass()} data-orientation="horizontal"></div>
 *   <div role="separator" aria-orientation="vertical"
 *        class=${separatorClass({ orientation: 'vertical' })}
 *        data-orientation="vertical"></div>
 *
 * Design tokens used: --border.
 */
import { cn } from '../../lib/utils.ts';

const BASE =
  'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export function separatorClass(_opts: { orientation?: SeparatorOrientation } = {}): string {
  // Orientation is driven by the `data-orientation` attribute on the element,
  // not by class variants: matches shadcn. The opts arg is reserved for
  // future variants (e.g. dashed) and to keep the signature stable.
  return cn(BASE);
}
