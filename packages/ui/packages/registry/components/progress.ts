/**
 * Progress, Tier-1 class helpers over the native `<progress>` element.
 * AI agents compose `<progress>` directly. No custom elements, no JS,
 * no helper function. The native element provides the
 * `progressbar` role and `aria-valuenow` automatically from its
 * `value` and `max` attributes.
 *
 * shadcn parity at the class helper level. Same visual as the prior
 * custom element: 2px track with an animated fill. The fill uses
 * `::-webkit-progress-value` and `::-moz-progress-bar` for the bar
 * pseudo-element, plus `::-webkit-progress-bar` for the track.
 *
 * Usage:
 *
 *   <progress value="42" max="100" class=${progressClass()}></progress>
 *
 *   <!-- Indeterminate (no value attribute): -->
 *   <progress class=${progressClass()}></progress>
 *
 * Design tokens used: --primary.
 */

/**
 * Class for the native `<progress>` element. The track + fill colours
 * come from Tailwind utilities. The browser handles the actual bar
 * rendering through the `::-webkit-progress-value` and
 * `::-moz-progress-bar` pseudo-elements. We expose them via the
 * `[&::-webkit-progress-value]:bg-primary` and
 * `[&::-moz-progress-bar]:bg-primary` Tailwind variants.
 *
 * Indeterminate state (no `value` attribute on the element) gets a
 * pulse animation via `:indeterminate { animate-pulse }`.
 */
export const progressClass = (): string =>
  [
    // Reset native styling. WebKit / Blink draw a default 3D bar that we
    // strip via appearance-none + classic clear of border/bg.
    'block h-2 w-full overflow-hidden rounded-full',
    'appearance-none border-0 bg-primary/20 [&::-webkit-progress-bar]:bg-primary/20',
    // Bar fill: blink/webkit + firefox both via Tailwind 4's arbitrary-
    // pseudo variant. Smooth animation on width change matches shadcn.
    "[&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-all",
    "[&::-moz-progress-bar]:bg-primary",
    // Indeterminate state animates the track itself (no value -> no bar
    // to color, so we pulse the bg).
    'indeterminate:animate-pulse',
  ].join(' ');
