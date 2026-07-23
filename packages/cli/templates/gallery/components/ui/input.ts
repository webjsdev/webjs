/**
 * Input: styled native `<input>`. Tier-1 class helper. Works with every
 * input type (text, email, password, number, search, tel, url, date,
 * time, file, color, …). Form submission, autocomplete, browser
 * validation, and password managers all work because it IS the native
 * input.
 *
 * shadcn parity:
 *   Input  → inputClass()
 *
 * Pair with `<label class=${labelClass()} for="...">` and a hint paragraph
 * (`<p class=${hintClass()} id="...-hint">`). Wrap all three in
 * `<div class=${fieldClass()}>` for the canonical field rhythm.
 *
 * Design tokens used: --input, --background, --primary, --primary-foreground,
 * --muted-foreground, --foreground, --ring, --destructive.
 *
 * @example
 * ```html
 * <input class=${inputClass()} type="email" name="email" id="email" required
 *        aria-describedby="email-hint">
 * ```
 */
import { cn } from '#lib/utils/cn.ts';

const INPUT_BASE =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30';

const INPUT_FOCUS =
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const INPUT_INVALID =
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40';

/** Compose Tailwind classes for a native `<input>`. */
export function inputClass(): string {
  return cn(INPUT_BASE, INPUT_FOCUS, INPUT_INVALID);
}
