/**
 * Spinner: an animated busy indicator. Tier-1 helpers, `spinnerClass()` for
 * the classes and `spinner()` for the whole inline SVG (the Lucide
 * loader-circle path, so no icon package is needed). It inherits the text
 * colour through `currentColor`, so it matches whatever it sits in.
 *
 * shadcn parity:
 *   Spinner  → spinner({ class, label })   (the inline SVG)
 *            → spinnerClass()              (the classes, for your own SVG)
 *
 * Size it with a size utility: `spinner({ class: 'size-6' })` replaces the
 * default `size-4`.
 *
 * Design tokens used: none (it draws in `currentColor`).
 *
 * A11y (required for accessible output):
 *   `spinner()` renders `role="status"` + `aria-label="Loading"`, so a
 *   standalone spinner is announced. Pass `label` for a more specific name
 *   (`spinner({ label: 'Loading invoices' })`).
 *   Inside a BUTTON while a save is running, mark the button itself busy:
 *   `disabled` (so a second click cannot submit twice) plus `aria-busy="true"`,
 *   and keep a visible text label ("Saving"). The button's text already says
 *   what is happening, so pass `decorative: true`, which renders the SVG with
 *   `aria-hidden="true"` and no role, rather than nesting a second live status
 *   inside the button's name. Re-enable the button and drop `aria-busy` when
 *   the save settles, and report the outcome somewhere that is announced (a
 *   toast, or the form's error text).
 *   A spinner that replaces a whole region is better as a skeleton when the
 *   final layout is known, with `aria-busy="true"` on the region.
 *
 * @example
 * ```html
 * <div class="flex items-center gap-2 text-sm text-muted-foreground">
 *   ${spinner()} Loading invoices
 * </div>
 *
 * <button class=${buttonClass()} type="submit" disabled aria-busy="true">
 *   ${spinner({ decorative: true })} Saving
 * </button>
 * ```
 */
import { html } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';

/** Spinner classes: `size-4` plus `animate-spin`. Apply to your own `<svg>`. */
export const spinnerClass = (): string => 'size-4 animate-spin';

/**
 * The spinner as an inline SVG template. `class` is merged over
 * `spinnerClass()` (a later size utility wins), `label` names it (default
 * "Loading"), and `decorative` hides it from assistive tech for use beside
 * visible text such as a busy button's label.
 */
export function spinner(opts: { class?: string; label?: string; decorative?: boolean } = {}) {
  const cls = cn(spinnerClass(), opts.class);
  // Branched rather than a nullish `role=${...}` hole: the server renderer
  // stringifies a null attribute value, so a single template would serve
  // `role=""` on the decorative form.
  if (opts.decorative) {
    return html`<svg data-slot="spinner" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class=${cls}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`;
  }
  return html`<svg data-slot="spinner" role="status" aria-label=${opts.label ?? 'Loading'} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class=${cls}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`;
}
