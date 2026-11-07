/**
 * Checkbox: styled native `<input type="checkbox">`. Tier-1 class
 * helper. Uses `appearance: none` + a masked `::before` for the checkmark
 * when `:checked`, so it remains a real form control
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
 *   The tick is drawn by the class itself, so the checked state never reads as
 *   colour alone (WCAG 1.4.1), with or without JavaScript. Keep
 *   `data-slot="checkbox"` on the input, as every example here does, since the
 *   styles' field rules select on it.
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

// The checked and indeterminate paint rides the helper's own classes, so it is
// in the first paint, renders with JavaScript off, and holds in every style.
// The tick is shadcn's (Lucide's CheckIcon, stroke 2, round caps and joins),
// drawn by a `::before` that fills the box's padding box (14px of the 16px
// box, shadcn's size-3.5) in `currentColor` through a mask of the icon. So the
// tick takes the box's text colour, which every style sets on a checked box
// (`text-primary-foreground` on the `bg-primary` fill), and it flips with the
// theme with no per-theme rule. The indeterminate dash is the same fill
// masked to a centred bar, 60% across and 2px tall. The data URI is fully
// percent-encoded so it sits in a class with no space or quote.
// One literal, since Tailwind finds a class only where it is written out whole.
const CHECKBOX_CLASS =
  'cn-checkbox peer relative shrink-0 appearance-none outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50 checked:before:absolute checked:before:inset-0 checked:before:bg-current checked:before:[mask:url(data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23000%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M20%206%209%2017l-5-5%22/%3E%3C/svg%3E)_center/contain_no-repeat] indeterminate:border-primary indeterminate:bg-primary indeterminate:text-primary-foreground indeterminate:before:absolute indeterminate:before:inset-0 indeterminate:before:bg-current indeterminate:before:[mask:linear-gradient(#000,#000)_center/60%_2px_no-repeat]';

/**
 * Tailwind classes for a styled native `<input type="checkbox">`. The classes
 * draw the tick and the indeterminate dash themselves, so a checked box paints
 * with JavaScript off. Keep `data-slot="checkbox"` on the input as shadcn
 * does: the styles' field rules select on it.
 */
export function checkboxClass(): string {
  return cn(CHECKBOX_CLASS);
}
