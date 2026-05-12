/**
 * AspectRatio — preserve a width:height ratio for its child. Uses the modern
 * CSS `aspect-ratio` property (Baseline 2022). No custom element needed.
 *
 * shadcn parity: matches shadcn AspectRatio (Radix primitive).
 *
 * Usage:
 *   <div style="aspect-ratio: 16/9;" class="${aspectRatioClass()}">
 *     <img src="…" class="h-full w-full object-cover rounded-md">
 *   </div>
 *
 *   <!-- Or with Tailwind's arbitrary aspect-ratio: -->
 *   <div class="aspect-[16/9]">
 *     <img …>
 *   </div>
 *
 * Design tokens used: none (layout only).
 */

export const aspectRatioClass = (): string => 'relative w-full';
