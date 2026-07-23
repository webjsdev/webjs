/**
 * inputClass: the gallery's text-field design token, built on @webjsdev/ui.
 *
 * Like buttonClass, this is a `@webjsdev/ui` tier-1 CLASS HELPER: it returns a
 * Tailwind class string you spread onto a NATIVE `<input>` or `<textarea>`, so
 * the browser's built-in form behaviour, validation, and accessibility all work
 * with nothing extra:
 *
 *   <input class=${inputClass()} name="email" type="email" />
 *   <textarea class=${inputClass()} name="message" rows="3"></textarea>
 *
 * The same helper styles inputs AND textareas here, because this app wants them
 * to look identical. That is the point of a design token: one place decides how
 * every field looks, so they cannot drift apart. If you later want a distinct
 * textarea look, add a `textareaClass` alongside this and theme it separately
 * (that is exactly how `webjs ui add textarea` would give you one).
 *
 * OWN-AND-THEME: this is `@webjsdev/ui`'s input, THEMED to this scaffold's look
 * (a filled `bg-background` field, `rounded-xl`, a primary focus border). You
 * own this file: change the class values here and every field in the app
 * updates at once. This is the intended workflow when building on `@webjsdev/ui`
 * for a real app: pull the primitive, then make it yours.
 */
import { cn } from '#lib/utils/cn.ts';

// One surface for every text field. `focus:border-primary` is the whole focus
// affordance (no ring), to match this app's quiet, token-driven chrome.
const BASE =
  'w-full bg-background border border-border rounded-xl px-3 py-2 text-[15px] text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Compose the Tailwind classes for a text input or textarea. Append your own
 * layout classes as needed: `class="${inputClass()} max-w-sm"`.
 */
export function inputClass(extra?: string): string {
  return cn(BASE, extra);
}
