/**
 * Direction: right-to-left and left-to-right layout. Tier-1, and deliberately
 * thin, because the platform already has the provider: the `dir` attribute.
 *
 * shadcn parity:
 *   DirectionProvider dir="rtl"  → dir="rtl" on any ancestor element (the
 *                                  page's <html>, or one region of it)
 *   useDirection()               → readDirection(element)
 *
 * shadcn needs a React provider so its Radix components can read the
 * direction. Here every component styles itself with logical properties
 * (`ps-*`, `ms-*`, `start-*`, `text-start`, `rounded-s-*`), which the browser
 * resolves from the nearest `dir`, so setting `dir="rtl"` on an ancestor is
 * the whole of it: padding, alignment, icon sides and inner corners all flip
 * with no script. `readDirection()` is for the rare code that must branch on
 * the direction itself, such as a keyboard handler mapping ArrowLeft to
 * "next" in RTL.
 *
 * A11y (required for accessible output): set `dir` together with `lang` on
 * the same element (`<html lang="ar" dir="rtl">`), since a screen reader picks
 * its voice from `lang` and the layout comes from `dir`. Arrow-key navigation
 * should follow the visual direction, which is what `readDirection()` is for.
 *
 * @example
 * ```html
 * <section dir="rtl" lang="ar">
 *   <button class=${buttonClass()} type="button">حفظ</button>
 * </section>
 * ```
 */

export type Direction = 'ltr' | 'rtl';

/**
 * The direction in effect for an element: the nearest ancestor's `dir`
 * attribute (`auto` and anything else count as left-to-right), else
 * left-to-right. Reads attributes only, so it also runs during server
 * rendering where there is no computed style.
 */
export function readDirection(el: Element | null | undefined): Direction {
  const holder = el?.closest?.('[dir]');
  return holder?.getAttribute('dir')?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}
