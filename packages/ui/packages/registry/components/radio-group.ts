/**
 * RadioGroup — group of native radio inputs. Pure composition:
 * just use native `<input type="radio" name="...">` with a shared `name`.
 * The browser handles keyboard nav (Arrow keys), single-selection, and form
 * submission. No JS needed.
 *
 * shadcn parity: matches shadcn RadioGroup visual (size-4 circle with a
 * filled dot indicator when checked).
 *
 * Usage:
 *   <div role="radiogroup" class=${radioGroupClass()}>
 *     <div class="flex items-center gap-2">
 *       <input type="radio" name="plan" value="basic" id="plan-basic" class=${radioClass()}>
 *       <label class=${labelClass()} for="plan-basic">Basic</label>
 *     </div>
 *     <div class="flex items-center gap-2">
 *       <input type="radio" name="plan" value="pro" id="plan-pro" class=${radioClass()}>
 *       <label class=${labelClass()} for="plan-pro">Pro</label>
 *     </div>
 *   </div>
 *
 * Design tokens used: --input, --primary, --ring, --destructive.
 */
import { cn } from '../lib/utils.ts';

const DOT_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='5' fill='oklch(0.205 0 0)'/></svg>\")";

const RADIO_CLASS =
  'aspect-square size-4 shrink-0 appearance-none rounded-full border border-input bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 checked:border-primary checked:bg-no-repeat checked:bg-center dark:bg-input/30 dark:aria-invalid:ring-destructive/40';

const STYLES = `
input[type="radio"][data-slot="radio"]:checked {
  background-image: ${DOT_SVG};
  background-size: 100%;
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
export const radioGroupClass = (): string => 'grid gap-3';

/** Tailwind classes for a styled `<input type="radio">`. Add `data-slot="radio"` for the indicator dot. */
export function radioClass(): string {
  return cn(RADIO_CLASS);
}
