/**
 * Button: styled native `<button>`. Tier-1 class helper. Compose with a
 * real `<button>` (or `<a>` for link-styled buttons) so form submission,
 * focus, keyboard activation, and screen-reader semantics all "just work".
 *
 * shadcn parity:
 *   Button (variant: default | destructive | outline | secondary | ghost | link)
 *         (size:    default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg)
 *                                            → buttonClass({ variant, size })
 *
 * shadcn React's `asChild` (Slot) prop has no equivalent here: just call
 * `buttonClass(...)` and spread the classes onto whatever element you want.
 *
 * A11y (required for accessible output): an icon-only button (the `icon`,
 * `icon-xs`, `icon-sm`, `icon-lg` sizes) has no visible text, so it MUST
 * carry an accessible name via aria-label (or aria-labelledby). A button
 * that opens an overlay should also set aria-haspopup and aria-expanded.
 * Native <button> focus and keyboard activation are already correct.
 *
 * Design tokens used: --primary, --primary-foreground, --destructive,
 * --secondary, --secondary-foreground, --accent, --accent-foreground,
 * --background, --input, --ring.
 *
 * @example
 * ```html
 * <button class=${buttonClass()} type="submit">Save</button>
 * <button class=${buttonClass({ variant: 'outline', size: 'sm' })}>Cancel</button>
 * <button class=${buttonClass({ size: 'icon' })} aria-label="Settings">⚙</button>
 * <a class=${buttonClass({ variant: 'link' })} href="/about">About</a>
 * ```
 */
import { cn } from '../lib/utils.ts';

// Base form (#1666): the semantic `cn-button*` names carry the look, and
// the style named in components.json supplies it when the file is installed
// (styles/style-<name>.css, baked by `add`). What stays inline is the layout
// shadcn's base form keeps inline in every style.
//
// The default new-york style puts cursor-pointer on `cn-button`, so every
// variant gets the right hover affordance. Native <button> defaults to the OS
// arrow cursor in Chromium and Firefox, and shadcn's modern Button has
// gravitated toward an explicit cursor-pointer in the real world (see the open
// issue shadcn-ui/ui#1791). disabled:pointer-events-none below already
// suppresses the cursor on a disabled button.
const BASE =
  'cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';

const VARIANTS = {
  default: 'cn-button-variant-default',
  destructive: 'cn-button-variant-destructive',
  outline: 'cn-button-variant-outline',
  secondary: 'cn-button-variant-secondary',
  ghost: 'cn-button-variant-ghost',
  link: 'cn-button-variant-link',
} as const;

const SIZES = {
  default: 'cn-button-size-default',
  xs: 'cn-button-size-xs',
  sm: 'cn-button-size-sm',
  lg: 'cn-button-size-lg',
  icon: 'cn-button-size-icon',
  'icon-xs': 'cn-button-size-icon-xs',
  'icon-sm': 'cn-button-size-icon-sm',
  'icon-lg': 'cn-button-size-icon-lg',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Compose Tailwind classes for a button. Stable shape: object-arg, both optional. */
export function buttonClass(opts: ButtonClassOptions & { className?: string } = {}): string {
  const variant = opts.variant ?? 'default';
  const size = opts.size ?? 'default';
  return cn(BASE, VARIANTS[variant], SIZES[size], opts.className);
}

/**
 * shadcn's name for {@link buttonClass}, so shadcn code ports verbatim
 * (`buttonVariants({ ... })` is shadcn's `cva` export for `Button`). Like cva, it
 * merges a `className` into the result.
 */
export function buttonVariants(opts: ButtonClassOptions & { className?: string } = {}): string {
  return buttonClass(opts);
}
