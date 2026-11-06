/**
 * Checkbox: styled native `<input type="checkbox">`. Tier-1 class
 * helper. Uses `appearance: none` + an inline-SVG `background-image` for
 * the checkmark when `:checked`, so it remains a real form control
 * (participates in `<form>` submission, no ElementInternals required).
 *
 * shadcn parity:
 *   Checkbox  → checkboxClass()  (visual: size-4, rounded, primary fill
 *                                 when checked, inset shadow, focus ring;
 *                                 bypasses Radix)
 *
 * Design tokens used: --input, --primary, --primary-foreground, --background,
 * --ring, --destructive.
 *
 * A11y (required for accessible output):
 *   `data-slot="checkbox"` is REQUIRED, not decoration. The injected stylesheet
 *   keys the checkmark on it, so without it a checked box renders as a filled
 *   square with no tick: the checked and unchecked states then differ by colour
 *   alone, which is exactly what WCAG 1.4.1 rules out. Every example here
 *   carries it; keep it when you copy one.
 *   Associate a label with the input, either `<label for>` pointing at the
 *   input's `id` (as below) or by nesting the input inside the `<label>`. A
 *   checkbox with no label has no accessible name.
 *   Group related checkboxes in a `<fieldset>` with a `<legend>` naming the
 *   group, so the set is announced as one thing rather than N loose controls.
 *   Set `aria-invalid="true"` on a failed checkbox (the class styles it) and
 *   point `aria-describedby` at the element holding the error text.
 *   The indeterminate state is a PROPERTY, not an attribute
 *   (`el.indeterminate = true`). Do NOT add `aria-checked="mixed"` alongside it:
 *   the browser already maps a native checkbox's `indeterminate` to a mixed
 *   checked state, and hand-writing the ARIA duplicates a state the host
 *   language owns, which is discouraged precisely because the two can then
 *   disagree. Set the property and leave the ARIA alone.
 *
 * @example
 * ```html
 * <div class="flex items-center gap-2">
 *   <input type="checkbox" data-slot="checkbox" name="terms" id="terms" class=${checkboxClass()}>
 *   <label class=${labelClass()} for="terms">I accept the terms</label>
 * </div>
 *
 * <!-- A group of related checkboxes is named by its legend. -->
 * <fieldset class=${stackClass({ gap: 'sm' })}>
 *   <legend class=${fieldLabelClass()}>Email preferences</legend>
 *   <div class="flex items-center gap-2">
 *     <input type="checkbox" data-slot="checkbox" name="digest" id="pref-digest" class=${checkboxClass()}>
 *     <label class=${labelClass()} for="pref-digest">Weekly digest</label>
 *   </div>
 *   <div class="flex items-center gap-2">
 *     <input type="checkbox" data-slot="checkbox" name="security" id="pref-security" class=${checkboxClass()}>
 *     <label class=${labelClass()} for="pref-security">Security alerts</label>
 *   </div>
 * </fieldset>
 * ```
 */
import { cn } from '../lib/utils.ts';

// Inline SVG checkmark used as background when :checked. Encoded for url().
//
// Two variants because shadcn flips `--primary` (and therefore the checked-
// state box colour) between light + dark: in light mode the box is dark
// (`oklch(0.205 0 0)`) and the checkmark needs to be light (white); in dark
// mode the box is light (`oklch(0.922 0 0)`) and the checkmark needs to be
// dark (black). `currentColor` inside a data:url SVG does NOT inherit from
// the host element when used as a background-image: that's a long-
// standing browser limitation: and pseudo-elements (::before/::after) on
// `<input>` aren't reliable cross-browser, so the simplest correct fix is
// to ship two SVGs and toggle them via a theme selector.
// shadcn's tick: Lucide's CheckIcon (stroke 2, round caps and joins), drawn at
// size-3.5 in the 16px box, so 87.5% of the BORDER box (see STYLES): a
// percentage size otherwise measures the padding box, which the 1px border
// shrinks to 14px, and the tick comes out a size smaller than shadcn's.
const CHECKMARK_LIGHT =
  'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M20 6 9 17l-5-5\'/></svg>")';
const CHECKMARK_DARK =
  'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M20 6 9 17l-5-5\'/></svg>")';

const CHECKBOX_CLASS =
  'cn-checkbox peer shrink-0 appearance-none outline-none disabled:cursor-not-allowed disabled:opacity-50';

// Inject style once for the checkmark background-image when :checked.
//
// Theme selectors are kept in sync with what shadcn's components.json
// scaffolds for theme switching: explicit `[data-theme='dark']` /
// `.dark` on `<html>` (set by toggle scripts), AND `prefers-color-
// scheme: dark` gated by `:not([data-theme='light']):not(.light)` so
// an explicit-light toggle still wins over the OS preference. Matches
// the same pattern used elsewhere in the registry.
const STYLES = `
input[type="checkbox"][data-slot="checkbox"]:checked {
  background-image: ${CHECKMARK_LIGHT};
  background-size: 87.5%;
  background-position: center;
  background-repeat: no-repeat;
  background-origin: border-box;
}
input[type="checkbox"][data-slot="checkbox"]:indeterminate {
  background-color: var(--primary);
  background-image: linear-gradient(to right, white, white);
  background-size: 60% 2px;
  background-repeat: no-repeat;
  background-position: center;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']):not(.light) input[type="checkbox"][data-slot="checkbox"]:checked {
    background-image: ${CHECKMARK_DARK};
  }
  :root:not([data-theme='light']):not(.light) input[type="checkbox"][data-slot="checkbox"]:indeterminate {
    background-image: linear-gradient(to right, black, black);
  }
}
:root[data-theme='dark'] input[type="checkbox"][data-slot="checkbox"]:checked,
:root.dark input[type="checkbox"][data-slot="checkbox"]:checked {
  background-image: ${CHECKMARK_DARK};
}
:root[data-theme='dark'] input[type="checkbox"][data-slot="checkbox"]:indeterminate,
:root.dark input[type="checkbox"][data-slot="checkbox"]:indeterminate {
  background-image: linear-gradient(to right, black, black);
}
`;

let installed = false;
export function installCheckboxStyles(): void {
  if (installed || typeof document === 'undefined') return;
  if (document.getElementById('ui-checkbox-styles')) {
    installed = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'ui-checkbox-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
  installed = true;
}

if (typeof document !== 'undefined') installCheckboxStyles();

/**
 * Tailwind classes for a styled native `<input type="checkbox">`.
 *
 * PAIR THIS WITH `data-slot="checkbox"` ON THE SAME INPUT. The injected
 * stylesheet keys the checkmark and the indeterminate dash on that attribute,
 * so the class alone gives you a box that fills with colour when checked but
 * never draws a tick, leaving the two states distinguishable by colour only.
 */
export function checkboxClass(): string {
  return cn(CHECKBOX_CLASS);
}
