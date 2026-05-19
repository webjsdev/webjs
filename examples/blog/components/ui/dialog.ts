/**
 * Dialog, Tier-1 class helpers over the native <dialog> element. AI
 * agents compose <dialog> directly in their markup and use these
 * helpers for visual styling. No custom elements, no slot machinery.
 *
 * What you get for free, from native <dialog> alone:
 *   - showModal() for modal-with-backdrop rendering in the top layer
 *   - ::backdrop pseudo-element for the overlay (no z-index wars)
 *   - Focus trap: Tab cycles inside, focus restores to invoker on close
 *   - Escape-to-close via the native `cancel` event
 *   - Background made inert (clicks pass through to nothing)
 *   - <form method="dialog"> inside closes the dialog when submitted,
 *     with NO JavaScript whatsoever. Use it for Cancel / Close buttons.
 *
 * shadcn parity at the class helper level:
 *   <Dialog>            -> just the <dialog> element
 *   <DialogContent>     -> the <dialog> with dialogClass()
 *   <DialogHeader>      -> div with dialogHeaderClass()
 *   <DialogTitle>       -> h2/div with dialogTitleClass()
 *   <DialogDescription> -> p with dialogDescriptionClass()
 *   <DialogFooter>      -> div / form with dialogFooterClass()
 *   <DialogTrigger>     -> any button with @click=${openDialog}
 *   <DialogClose>       -> button inside <form method="dialog">
 *
 * Usage in a webjs page or component:
 *
 *   import { html } from '@webjskit/core';
 *   import {
 *     dialogClass, dialogHeaderClass, dialogTitleClass,
 *     dialogDescriptionClass, dialogFooterClass, openDialog,
 *   } from '@/components/ui/dialog.ts';
 *   import { buttonClass } from '@/components/ui/button.ts';
 *
 *   return html`
 *     <button class=${buttonClass({ variant: 'outline' })}
 *             @click=${(e) => openDialog(e.currentTarget)}>
 *       Edit profile
 *     </button>
 *     <dialog class=${dialogClass()}>
 *       <div class=${dialogHeaderClass()}>
 *         <h2 class=${dialogTitleClass()}>Edit profile</h2>
 *         <p class=${dialogDescriptionClass()}>Make changes here.</p>
 *       </div>
 *       <form method="dialog" class=${dialogFooterClass()}>
 *         <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
 *         <button class=${buttonClass()}
 *                 formmethod="post" formaction="/profile">
 *           Save
 *         </button>
 *       </form>
 *     </dialog>
 *   `;
 *
 * Cancel works without JavaScript because `<form method="dialog">`
 * tells the browser: when this form submits, close the parent dialog.
 * Save works without JavaScript because `formmethod="post"
 * formaction="/profile"` is a standard HTML form submission that the
 * webjs client router intercepts for partial-swap behavior. With JS
 * disabled, both buttons still do what they should.
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */
// --------------------------------------------------------------------------
// Class helpers. Same shape as other Tier-1 helpers (button, card, input,
// etc.): plain functions returning a Tailwind class string. Authors append
// their own classes via inline string concatenation if needed.
// --------------------------------------------------------------------------

/**
 * Class for the <dialog> element itself. Adds the centered-panel look:
 * fixed positioning, rounded border, background, shadow, and the
 * ::backdrop styling. `m-0 max-h-none` opts out of the native <dialog>
 * UA auto-centering so the explicit positioning takes effect.
 */
export const dialogClass = (): string =>
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 m-0 max-h-none rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg backdrop:bg-black/50';

/** Header layout for the dialog. Stacks title + description. */
export const dialogHeaderClass = (): string =>
  'flex flex-col gap-2 text-center sm:text-left';

/** Title typography (use on an h2 or h3). */
export const dialogTitleClass = (): string => 'text-lg leading-none font-semibold';

/** Description typography (use on a p). */
export const dialogDescriptionClass = (): string => 'text-sm text-muted-foreground';

/**
 * Footer layout. Reversed flex column on mobile for primary-action-
 * at-bottom, row on >=sm. Use on a `<form method="dialog">` so the
 * Cancel button closes the dialog without JS.
 */
export const dialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';

// --------------------------------------------------------------------------
// Behavior helpers
// --------------------------------------------------------------------------

/**
 * Open the dialog associated with this trigger. Resolution order:
 *   1. If the trigger has `data-dialog="<id>"`, open the element with
 *      that id.
 *   2. Else look for a <dialog> sibling of the trigger.
 *   3. Else look for a <dialog> descendant of the trigger's container
 *      (the element annotated with `data-dialog-container`, or the
 *      trigger's parent if absent).
 *
 * @example
 *   <button @click=${(e) => openDialog(e.currentTarget)}>Open</button>
 *   <dialog class=${dialogClass()}>...</dialog>
 *
 * @example
 *   <button data-dialog="profile-edit"
 *           @click=${(e) => openDialog(e.currentTarget)}>Edit</button>
 *   <dialog id="profile-edit" class=${dialogClass()}>...</dialog>
 */
export function openDialog(trigger: HTMLElement): void {
  const target = findDialog(trigger);
  if (target && !target.open) target.showModal();
}

/**
 * Close the dialog associated with this trigger (or close the passed
 * <dialog> directly). Most close buttons should sit inside `<form
 * method="dialog">` which closes natively without JS; reach for this
 * helper only when closing from elsewhere in the page.
 */
export function closeDialog(triggerOrDialog: HTMLElement): void {
  if (triggerOrDialog instanceof HTMLDialogElement) {
    if (triggerOrDialog.open) triggerOrDialog.close();
    return;
  }
  const target = findDialog(triggerOrDialog);
  if (target?.open) target.close();
}

function findDialog(trigger: HTMLElement): HTMLDialogElement | null {
  const idAttr = trigger.getAttribute('data-dialog');
  if (idAttr) {
    const el = document.getElementById(idAttr);
    if (el instanceof HTMLDialogElement) return el;
  }
  // Sibling of the trigger:
  let sibling = trigger.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLDialogElement) return sibling;
    sibling = sibling.nextElementSibling;
  }
  // Descendant of the trigger's container:
  const container = trigger.closest('[data-dialog-container]') ?? trigger.parentElement;
  return container?.querySelector<HTMLDialogElement>('dialog') ?? null;
}
