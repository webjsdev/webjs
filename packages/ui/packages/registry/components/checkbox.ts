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
 * @example
 * ```html
 * <input type="checkbox" name="terms" id="terms" class=${checkboxClass()}>
 * <label class=${labelClass()} for="terms">I accept the terms</label>
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
const CHECKMARK_LIGHT =
  'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'white\'><path d=\'M16.704 5.293a1 1 0 010 1.414l-7.001 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 11.586l6.29-6.293a1 1 0 011.414 0z\'/></svg>")';
const CHECKMARK_DARK =
  'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'black\'><path d=\'M16.704 5.293a1 1 0 010 1.414l-7.001 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 11.586l6.29-6.293a1 1 0 011.414 0z\'/></svg>")';

const CHECKBOX_CLASS =
  'peer size-4 shrink-0 appearance-none rounded-[4px] border border-input bg-transparent shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 checked:border-primary checked:bg-primary checked:bg-no-repeat checked:bg-center dark:bg-input/30 dark:aria-invalid:ring-destructive/40';

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
  background-size: 80%;
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

/** Tailwind classes for a styled native `<input type="checkbox">`. Add `data-slot="checkbox"` for the checkmark style to apply. */
export function checkboxClass(): string {
  return cn(CHECKBOX_CLASS);
}
