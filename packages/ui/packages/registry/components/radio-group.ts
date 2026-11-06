/**
 * RadioGroup: group of native radio inputs. Tier-1 class helpers;
 * compose with native `<input type="radio" name="...">` sharing a name.
 * The browser handles keyboard nav (Arrow keys), single-selection, and
 * form submission. No JS.
 *
 * shadcn parity:
 *   RadioGroup (orientation: horizontal | vertical)
 *                          → radioGroupClass({ orientation }) on a <div role="radiogroup">
 *   RadioGroupItem         → radioClass() on a native <input type="radio">
 *
 * Design tokens used: --input, --primary, --ring, --destructive.
 *
 * A11y (required for accessible output):
 *   `data-slot="radio"` is REQUIRED, not decoration. The injected stylesheet
 *   keys the indicator dot on it, and `radioClass()` carries no checked
 *   background fill, so without the attribute a SELECTED radio differs from an
 *   unselected one by border colour alone. That is both easy to miss and a
 *   WCAG 1.4.1 problem (state by colour only). Every example here carries it.
 *   NAME THE GROUP. A bare `<div role="radiogroup">` has no accessible name, so
 *   a screen reader announces "radio group" with no idea what is being chosen.
 *   Point `aria-labelledby` at the visible group label, as below, or use a
 *   `<fieldset>` + `<legend>` instead of the `role="radiogroup"` div.
 *   Give every input the SAME `name`, which is what makes the browser treat
 *   them as one set: it supplies single-selection, Arrow-key navigation, and a
 *   single tab stop for free. Different names produce N independent radios that
 *   can all be selected at once.
 *   Label each input with `<label for>` pointing at its `id`, and mark the
 *   group `aria-invalid="true"` plus an `aria-describedby` error element when
 *   the selection fails validation.
 *
 * @example
 * ```html
 * <div class=${fieldClass()}>
 *   <span class=${fieldLabelClass()} id="plan-label">Billing plan</span>
 *   <div role="radiogroup" aria-labelledby="plan-label" class=${radioGroupClass()}>
 *     <div class="flex items-center gap-2">
 *       <input type="radio" data-slot="radio" name="plan" value="basic" id="plan-basic" class=${radioClass()}>
 *       <label class=${labelClass()} for="plan-basic">Basic</label>
 *     </div>
 *     <div class="flex items-center gap-2">
 *       <input type="radio" data-slot="radio" name="plan" value="pro" id="plan-pro" class=${radioClass()}>
 *       <label class=${labelClass()} for="plan-pro">Pro</label>
 *     </div>
 *   </div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const RADIO_CLASS =
  'cn-radio-group-item group/radio-group-item peer aspect-square shrink-0 appearance-none border outline-none disabled:cursor-not-allowed disabled:opacity-50';

// The dot is a radial gradient in `currentColor`, the radio's own text colour,
// which the style chooses. shadcn's styles fill a checked radio with the
// primary colour and set `data-checked:text-primary-foreground`, so the dot is
// the light one on the fill; the default style keeps a transparent ring and
// sets `checked:text-primary`, so the dot is the primary one. A fixed colour
// (the SVG this replaced, one per theme) could only match one of the two, and
// disappeared into the fill under every shadcn style. Half the box across,
// as shadcn's indicator is.
const STYLES = `
input[type="radio"][data-slot="radio"]:checked {
  background-image: radial-gradient(circle closest-side, currentColor 50%, transparent calc(50% + 0.5px));
}
`;

let installed = false;
export function installRadioStyles(): void {
  if (installed || typeof document === 'undefined') return;
  if (document.getElementById('ui-radio-styles')) {
    installed = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ui-radio-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
  installed = true;
}

if (typeof document !== 'undefined') installRadioStyles();

/** Tailwind classes for a `<div role="radiogroup">` container. */
export type RadioGroupOrientation = 'vertical' | 'horizontal';

/**
 * Container for a group of native <input type="radio"> elements.
 *
 * Vertical (default): stacked column, gap-3. Matches Radix
 * RadioGroup.Root's default + the most common shadcn snippet.
 *
 * Horizontal: flex row that wraps. Picks `flex flex-wrap gap-x-6
 * gap-y-3` so multi-line wraps still have vertical breathing room.
 */
export function radioGroupClass(opts: { orientation?: RadioGroupOrientation } = {}): string {
  const orientation = opts.orientation ?? 'vertical';
  return orientation === 'horizontal'
    ? 'flex flex-wrap gap-x-6 gap-y-3'
    : 'cn-radio-group';
}

/**
 * Tailwind classes for a styled `<input type="radio">`.
 *
 * PAIR THIS WITH `data-slot="radio"` ON THE SAME INPUT. The injected stylesheet
 * keys the indicator dot on that attribute, and this class deliberately carries
 * no checked background fill, so the class alone leaves a selected radio
 * differing from an unselected one by border colour and nothing else.
 */
export function radioClass(): string {
  return cn(RADIO_CLASS);
}
