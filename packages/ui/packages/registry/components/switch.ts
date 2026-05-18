/**
 * Switch: toggle styled as a sliding pill. A hidden native `<input
 * type="checkbox" role="switch">` handles form submission and keyboard.
 * A sibling `<span>` provides the visual track + thumb.
 *
 * shadcn parity: matches shadcn Switch visual (rounded pill, animated thumb,
 * primary fill when checked). Supports `size: default | sm`.
 *
 * Usage:
 *   <label class="inline-flex items-center gap-2">
 *     <input type="checkbox" role="switch" name="notify" class=${switchInputClass()}>
 *     <span class=${switchTrackClass()}></span>
 *     <span class=${labelClass()}>Notifications</span>
 *   </label>
 *
 *   <!-- Small size: -->
 *   <input type="checkbox" role="switch" name="x" class=${cn(switchInputClass(), 'peer/sm')}>
 *   <span class=${switchTrackClass({ size: 'sm' })}></span>
 *
 * Design tokens used: --primary, --input, --background, --foreground, --ring,
 * --primary-foreground.
 */
import { cn } from '../lib/utils.ts';

/** Hidden native checkbox: handles form value + keyboard activation. */
export const switchInputClass = (): string => 'peer sr-only';

const TRACK_BASE =
  'inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 bg-input dark:bg-input/80 peer-checked:bg-primary relative';

const TRACK_SIZES = {
  default: 'h-[1.15rem] w-8',
  sm: 'h-3.5 w-6',
} as const;

const THUMB_SIZES = {
  default:
    "after:size-4 after:translate-x-px peer-checked:after:translate-x-[calc(100%-2px)]",
  sm: "after:size-3 after:translate-x-px peer-checked:after:translate-x-[calc(100%-1px)]",
} as const;

const THUMB_BASE =
  'after:pointer-events-none after:absolute after:left-0 after:rounded-full after:bg-background after:transition-transform peer-checked:after:bg-primary-foreground dark:after:bg-foreground';

export type SwitchSize = keyof typeof TRACK_SIZES;

export function switchTrackClass(opts: { size?: SwitchSize } = {}): string {
  const size = opts.size ?? 'default';
  return cn(TRACK_BASE, TRACK_SIZES[size], THUMB_BASE, THUMB_SIZES[size]);
}
