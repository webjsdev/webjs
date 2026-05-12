/**
 * Checkbox — styled native `<input type="checkbox">`. Uses `appearance: none`
 * + an SVG background for the checkmark when `:checked`, so it's a real form
 * control (participates in `<form>` submission natively, no ElementInternals).
 *
 * shadcn parity: matches shadcn Checkbox visual (size-4, rounded, primary fill
 * when checked, inset shadow, focus ring). Bypasses Radix entirely.
 *
 * Usage:
 *   <input type="checkbox" name="terms" id="terms" class=${checkboxClass()}>
 *   <label class=${labelClass()} for="terms">I accept the terms</label>
 *
 * Design tokens used: --input, --primary, --primary-foreground, --background,
 * --ring, --destructive.
 */
import { cn } from '../lib/utils.ts';

// Inline SVG checkmark used as background when :checked. Encoded for url().
const CHECKMARK_SVG =
  'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'white\'><path d=\'M16.704 5.293a1 1 0 010 1.414l-7.001 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 11.586l6.29-6.293a1 1 0 011.414 0z\'/></svg>")';

const CHECKBOX_CLASS =
  'peer size-4 shrink-0 appearance-none rounded-[4px] border border-input bg-transparent shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 checked:border-primary checked:bg-primary checked:bg-no-repeat checked:bg-center dark:bg-input/30 dark:aria-invalid:ring-destructive/40';

// Inject style once for the checkmark background-image when :checked.
const STYLES = `
input[type="checkbox"][data-slot="checkbox"]:checked {
  background-image: ${CHECKMARK_SVG};
  background-size: 80%;
}
input[type="checkbox"][data-slot="checkbox"]:indeterminate {
  background-color: var(--primary);
  background-image: linear-gradient(to right, white, white);
  background-size: 60% 2px;
  background-repeat: no-repeat;
  background-position: center;
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
