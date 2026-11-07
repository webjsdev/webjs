/**
 * Separator: horizontal or vertical divider. Tier-1 class helper. For
 * accessibility, set `role="separator"` + `aria-orientation` on the
 * element (or `role="none"` for purely decorative use).
 *
 * shadcn parity:
 *   Separator (orientation: horizontal | vertical, decorative: bool)
 *                          → separatorClass({ orientation }) + role + data-orientation
 *
 * A11y (required for accessible output): a meaningful divider needs
 * role="separator" plus aria-orientation. A purely decorative one needs
 * role="none" (or aria-hidden="true") so assistive tech does not announce
 * an empty separator.
 *
 * Design tokens used: --border.
 *
 * @example
 * ```html
 * <div role="none" class=${separatorClass()} data-orientation="horizontal"></div>
 * <div role="separator" aria-orientation="vertical"
 *      class=${separatorClass({ orientation: 'vertical' })}
 *      data-orientation="vertical"></div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE =
  'cn-separator shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export function separatorClass(_opts: { orientation?: SeparatorOrientation } = {}): string {
  // Orientation is driven by the `data-orientation` attribute on the element,
  // not by class variants: matches shadcn. The opts arg is reserved for
  // future variants (e.g. dashed) and to keep the signature stable.
  return cn(BASE);
}
