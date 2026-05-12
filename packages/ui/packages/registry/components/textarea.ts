/**
 * Textarea — styled native `<textarea>` via a class-helper function. Real
 * native multi-line input — form submission, autosize via `field-sizing`,
 * native validation all work.
 *
 * Usage:
 *   <textarea class=${textareaClass()} name="message" rows="4" placeholder="Your message…">
 *   </textarea>
 *
 * Pair with `<label class=${labelClass()} for="...">` and wrap in
 * `<div class=${fieldClass()}>` for the canonical field rhythm.
 *
 * Design tokens used: --input, --background, --muted-foreground, --ring,
 * --destructive.
 */
import { cn } from '../lib/utils.ts';

const TEXTAREA_BASE =
  'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40';

/** Compose Tailwind classes for a native `<textarea>`. */
export function textareaClass(): string {
  return cn(TEXTAREA_BASE);
}
