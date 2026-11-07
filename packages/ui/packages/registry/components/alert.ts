/**
 * Alert: informational banner. Tier-1 class helpers; compose with a
 * native `<div role="alert">` (or `role="status"` for non-urgent updates).
 *
 * shadcn parity:
 *   Alert (variant: default | destructive)  → alertClass({ variant })
 *   AlertTitle                              → alertTitleClass()
 *   AlertDescription                        → alertDescriptionClass()
 *   AlertAction                             → alertActionClass() with data-slot="alert-action"
 *                                             (a button or link in the alert's corner)
 *
 * A11y (required for accessible output): put role="alert" on the container
 * for an urgent, interrupting message, or role="status" for a polite,
 * non-urgent update. The class helper sets no role, so without one the
 * banner is silent to assistive tech.
 *
 * Design tokens used: --card, --card-foreground, --destructive, --muted-foreground.
 *
 * @example
 * ```html
 * <div role="alert" class=${alertClass()}>
 *   <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
 *   <div data-slot="alert-title" class=${alertTitleClass()}>Heads up</div>
 *   <div data-slot="alert-description" class=${alertDescriptionClass()}>
 *     Something happened. Probably fine.
 *   </div>
 * </div>
 *
 * <!-- Destructive variant: accent stripe plus colored title and description. -->
 * <div role="alert" class=${alertClass({ variant: 'destructive' })}>
 *   <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></svg>
 *   <div data-slot="alert-title" class=${alertTitleClass()}>Failed</div>
 *   <div data-slot="alert-description" class=${alertDescriptionClass()}>
 *     Couldn't save your changes.
 *   </div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const BASE =
  'cn-alert group/alert relative w-full';

const VARIANTS = {
  default: 'cn-alert-variant-default',
  destructive: 'cn-alert-variant-destructive',
} as const;

export type AlertVariant = keyof typeof VARIANTS;

export function alertClass(opts: { variant?: AlertVariant } = {}): string {
  return cn(BASE, VARIANTS[opts.variant ?? 'default']);
}

export const alertTitleClass = (): string =>
  'cn-alert-title';

export const alertDescriptionClass = (): string =>
  'cn-alert-description';

/** The alert's action, in its corner. Set `data-slot="alert-action"`, which the alert reserves room for. */
export const alertActionClass = (): string =>
  'cn-alert-action';
