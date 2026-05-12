/**
 * Label — styled native `<label>` via a class-helper function. Use with a real
 * `<label for="...">` so click-to-focus, `htmlFor`/`for` linking, and screen
 * reader association all work natively.
 *
 * shadcn parity: matches shadcn's Label component (which wraps Radix Label).
 *
 * Usage:
 *   <label class=${labelClass()} for="email">Email</label>
 *   <input class=${inputClass()} id="email" name="email" type="email">
 *
 * Disabled-state inheritance: when a label is inside a container with
 * `data-disabled="true"` (the "field" pattern), it dims automatically.
 * When a label sits next to a peer-disabled control, same effect.
 *
 * Design tokens used: none (typography only).
 */

/** Compose Tailwind classes for a native `<label>`. */
export function labelClass(): string {
  return 'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50';
}
