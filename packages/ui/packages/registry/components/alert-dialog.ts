/**
 * AlertDialog, Tier-1 class helpers over the native <dialog> element
 * with role="alertdialog" semantics and Escape-to-close blocked. AI
 * agents compose the markup directly. No custom elements.
 *
 * Difference from `dialog.ts`:
 *   - role="alertdialog" on the <dialog> (set this on the element)
 *   - Escape-to-close blocked via the native `cancel` event +
 *     preventDefault. The provided `wireAlertDialog()` helper does this.
 *   - No click-on-backdrop close (alert dialogs require an explicit
 *     Cancel or Action choice).
 *
 * shadcn parity:
 *   <AlertDialog>            -> just the <dialog role="alertdialog">
 *   <AlertDialogTrigger>     -> button with @click=${openDialog}
 *   <AlertDialogContent>     -> the <dialog> with alertDialogContentClass()
 *   <AlertDialogHeader>      -> div with alertDialogHeaderClass()
 *   <AlertDialogTitle>       -> h2/div with alertDialogTitleClass()
 *   <AlertDialogDescription> -> p with alertDialogDescriptionClass()
 *   <AlertDialogFooter>      -> div / form with alertDialogFooterClass()
 *   <AlertDialogCancel>      -> button inside <form method="dialog">
 *   <AlertDialogAction>      -> button with formaction (or @click)
 *
 * Usage:
 *
 *   import { html } from '@webjskit/core';
 *   import {
 *     alertDialogContentClass, alertDialogHeaderClass, alertDialogTitleClass,
 *     alertDialogDescriptionClass, alertDialogFooterClass, wireAlertDialog,
 *   } from '@/components/ui/alert-dialog.ts';
 *   import { openDialog } from '@/components/ui/dialog.ts';
 *   import { buttonClass } from '@/components/ui/button.ts';
 *
 *   return html`
 *     <button class=${buttonClass({ variant: 'destructive' })}
 *             @click=${(e) => openDialog(e.currentTarget)}>
 *       Delete account
 *     </button>
 *     <dialog role="alertdialog" aria-modal="true"
 *             class=${alertDialogContentClass()}
 *             .ref=${(el) => wireAlertDialog(el)}>
 *       <div class=${alertDialogHeaderClass()}>
 *         <h2 class=${alertDialogTitleClass()}>Delete account?</h2>
 *         <p class=${alertDialogDescriptionClass()}>This cannot be undone.</p>
 *       </div>
 *       <form method="dialog" class=${alertDialogFooterClass()}>
 *         <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
 *         <button class=${buttonClass({ variant: 'destructive' })}
 *                 formmethod="post" formaction="/account/delete">
 *           Delete
 *         </button>
 *       </form>
 *     </dialog>
 *   `;
 *
 * The `wireAlertDialog` ref hooks the dialog's `cancel` event to block
 * Escape-to-close. Open is via openDialog() (shared with regular dialog).
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

/**
 * Class for the <dialog role="alertdialog"> element. Centered panel,
 * with size variants:
 *   - default: max-w-lg on sm+
 *   - sm:      max-w-xs on all sizes (via data-size="sm" on the element)
 */
export const alertDialogContentClass = (): string =>
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 m-0 max-h-none rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg data-[size=sm]:max-w-xs backdrop:bg-black/50';

/** Header layout for the alert dialog. */
export const alertDialogHeaderClass = (): string =>
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left';

/** Footer layout: actions row, sm screens stack reversed. */
export const alertDialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end';

/** Title typography. */
export const alertDialogTitleClass = (): string => 'text-lg font-semibold';

/** Description typography. */
export const alertDialogDescriptionClass = (): string => 'text-sm text-muted-foreground';

// --------------------------------------------------------------------------
// Behavior helper: block Escape-to-close
// --------------------------------------------------------------------------

/**
 * Wire an alert-dialog so Escape does NOT close it. The native <dialog>
 * fires a `cancel` event when the user presses Escape; we preventDefault
 * to stop the subsequent close.
 *
 * Pass to the .ref= property binding so it runs once when the element
 * mounts:
 *
 *   <dialog .ref=${(el) => wireAlertDialog(el)} ...>
 *
 * Or call manually from a ReactiveController / lifecycle hook with the
 * dialog element.
 */
export function wireAlertDialog(dlg: HTMLDialogElement): void {
  if (!dlg || dlg.dataset.alertDialogWired === '1') return;
  dlg.dataset.alertDialogWired = '1';
  dlg.addEventListener('cancel', (e) => e.preventDefault());
}
