/**
 * Switch: toggle styled as a sliding pill. Tier-1 class helpers. A
 * hidden native `<input type="checkbox" role="switch">` handles form
 * submission + keyboard; a sibling `<span>` provides the visual track +
 * thumb (positioned via the `peer-checked:` variant).
 *
 * shadcn parity:
 *   Switch (size: default | sm)  → switchInputClass() on a hidden <input> +
 *                                   switchTrackClass({ size }) on a sibling <span>
 *
 * Design tokens used: --primary, --input, --background, --foreground, --ring,
 * --primary-foreground.
 *
 * A11y (required for accessible output):
 *   Keep `role="switch"` on the native checkbox. That is what makes a screen
 *   reader announce "on / off" rather than "checked / unchecked", and the
 *   browser maps the input's checked state to it for free.
 *   NAME IT. The visible track is a `<span>` and the real control is `sr-only`,
 *   so there is no text on the input at all. Wrapping the whole thing in a
 *   `<label>` (the first example) is the simplest way, since the label's text
 *   then names the input. A STANDALONE switch, one with no wrapping `<label>`
 *   and no `<label for>` pointing at it, has NO accessible name and needs an
 *   explicit `aria-label`, as the second example shows.
 *   The visual track and thumb are presentation only. They carry no text and no
 *   role, so nothing about the state reaches assistive tech through them: it all
 *   comes from the input. Do not move the name onto the track.
 *   Use `disabled` on the input, not on the track: the track styles itself from
 *   the `peer-disabled:` variant, and only the real control can refuse input.
 *
 * @example
 * ```html
 * <label class="inline-flex items-center gap-2">
 *   <input type="checkbox" role="switch" name="notify" class=${switchInputClass()}>
 *   <span class=${switchTrackClass()}></span>
 *   <span class=${labelClass()}>Notifications</span>
 * </label>
 *
 * <!-- Standalone (no wrapping label), so the name has to be explicit. -->
 * <input type="checkbox" role="switch" name="wifi" aria-label="Wi-Fi"
 *        class=${switchInputClass()}>
 * <span class=${switchTrackClass()}></span>
 *
 * <!-- Small size. -->
 * <input type="checkbox" role="switch" name="x" aria-label="Compact mode"
 *        class=${cn(switchInputClass(), 'peer/sm')}>
 * <span class=${switchTrackClass({ size: 'sm' })}></span>
 * ```
 */
import { cn } from '../lib/utils.ts';

/** Hidden native checkbox: handles form value + keyboard activation. */
export const switchInputClass = (): string => 'peer sr-only';

const TRACK_BASE =
  'cn-switch peer group/switch inline-flex items-center transition-all outline-none relative';

const TRACK_SIZES = {
  default: 'cn-switch-size-default',
  sm: 'cn-switch-size-sm',
} as const;

const THUMB_SIZES = {
  default: 'cn-switch-thumb-size-default',
  sm: 'cn-switch-thumb-size-sm',
} as const;

const THUMB_BASE =
  'cn-switch-thumb';

export type SwitchSize = keyof typeof TRACK_SIZES;

export function switchTrackClass(opts: { size?: SwitchSize } = {}): string {
  const size = opts.size ?? 'default';
  return cn(TRACK_BASE, TRACK_SIZES[size], THUMB_BASE, THUMB_SIZES[size]);
}
