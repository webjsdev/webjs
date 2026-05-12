/**
 * NativeSelect — styled native `<select>`. Uses `appearance: none` to hide
 * the platform-native dropdown chevron and overlays an SVG chevron on top.
 * Best mobile UX (native picker), full keyboard support, form submission
 * works natively. No JS.
 *
 * shadcn parity: matches shadcn NativeSelect visual + sizes.
 *
 * Usage:
 *   <div class=${nativeSelectWrapperClass()}>
 *     <select class=${nativeSelectClass()} name="plan">
 *       <option class=${nativeSelectOptionClass()}>Basic</option>
 *       <option class=${nativeSelectOptionClass()}>Pro</option>
 *     </select>
 *     <!-- chevron icon, decorative -->
 *     <svg class="${nativeSelectIconClass()}" aria-hidden="true">…</svg>
 *   </div>
 *
 * Design tokens used: --input, --background, --primary, --primary-foreground,
 * --muted-foreground, --ring, --destructive.
 */
import { cn } from '../lib/utils.ts';

export type NativeSelectSize = 'default' | 'sm';

export const nativeSelectWrapperClass = (): string =>
  'group/native-select relative w-fit has-[select:disabled]:opacity-50';

export function nativeSelectClass(): string {
  return cn(
    'h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
  );
}

export const nativeSelectIconClass = (): string =>
  'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none';

/** Option / optgroup styling — forces themed background even in dark mode. */
export const nativeSelectOptionClass = (): string => 'bg-[Canvas] text-[CanvasText]';
export const nativeSelectOptGroupClass = (): string => 'bg-[Canvas] text-[CanvasText]';
