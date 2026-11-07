/**
 * Sheet: a dialog that slides in from an edge of the screen (a side panel, a
 * mobile menu, a filter drawer). Tier-2. It IS a dialog, the way shadcn's
 * Sheet is the Dialog primitive with a side: the same native `<dialog>`
 * opened with `showModal()`, the same focus trap, Escape and backdrop close,
 * focus restoration, scroll lock and label wiring, attached to an edge.
 *
 * shadcn parity:
 *   Sheet                → <ui-sheet open>
 *   SheetTrigger         → <ui-sheet-trigger>
 *   SheetContent (side: top | right | bottom | left)
 *                        → <ui-sheet-content side="right">
 *   SheetClose           → <ui-sheet-close>
 *   SheetHeader / SheetFooter
 *                        → <div class=${sheetHeaderClass()}> / <div class=${sheetFooterClass()}>
 *   SheetTitle / SheetDescription
 *                        → <h2 data-slot="sheet-title" class=${sheetTitleClass()}> /
 *                          <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
 *
 * `side` names a physical edge, as shadcn's does, so `side="right"` stays on
 * the right under `dir="rtl"`. Pick the side from the reading direction when
 * a panel should follow it.
 *
 * A11y (handled by the element, plus one obligation): the native `<dialog>`
 * carries `role="dialog"`, and on open it is named by the `sheet-title` node
 * (falling back to the first heading, then to a generic name) and described by
 * the `sheet-description` node. Focus moves into the sheet, Tab stays inside,
 * Escape and a backdrop click close it, and focus returns to the trigger. Give
 * every sheet a real title, since a generic "Dialog" name says nothing about
 * what opened, and put the trigger's own accessible name on a real `<button>`.
 *
 * @example
 * ```html
 * <ui-sheet>
 *   <ui-sheet-trigger><button class=${buttonClass({ variant: 'outline' })} type="button">Filters</button></ui-sheet-trigger>
 *   <ui-sheet-content side="right">
 *     <div class=${sheetHeaderClass()}>
 *       <h2 data-slot="sheet-title" class=${sheetTitleClass()}>Filters</h2>
 *       <p data-slot="sheet-description" class=${sheetDescriptionClass()}>Narrow the list.</p>
 *     </div>
 *   </ui-sheet-content>
 * </ui-sheet>
 * ```
 */
import { UiDialog, UiDialogTrigger, UiDialogContent, UiDialogClose } from './dialog.ts';

export type SheetSide = 'top' | 'right' | 'bottom' | 'left';

/** The visible panel. The element applies it; exported for a custom shell. */
export function sheetContentClass(): string {
  return 'cn-sheet-content data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10';
}

/** The auto-injected close button in the corner. */
export function sheetCloseButtonClass(): string {
  return 'cn-sheet-close';
}

/** The overlay behind the panel, which each style dims in its own way. */
export function sheetOverlayClass(): string {
  return 'cn-sheet-overlay fixed inset-0 z-50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0';
}

/** The title and description block at the top. */
export function sheetHeaderClass(): string {
  return 'cn-sheet-header flex flex-col';
}

/** The actions block, pushed to the bottom. */
export function sheetFooterClass(): string {
  return 'cn-sheet-footer mt-auto flex flex-col';
}

/** The sheet's title. Mark it `data-slot="sheet-title"` so the sheet is named by it. */
export function sheetTitleClass(): string {
  return 'cn-sheet-title cn-font-heading';
}

/** The sheet's description. Mark it `data-slot="sheet-description"`. */
export function sheetDescriptionClass(): string {
  return 'cn-sheet-description';
}

export class UiSheet extends UiDialog {
  static rootTag = 'ui-sheet';
  static contentTag = 'ui-sheet-content';
  static slotPrefix = 'sheet';
}
UiSheet.register('ui-sheet');

export class UiSheetTrigger extends UiDialogTrigger {
  static rootTag = 'ui-sheet';
  static slotPrefix = 'sheet';
}
UiSheetTrigger.register('ui-sheet-trigger');

export class UiSheetClose extends UiDialogClose {
  static rootTag = 'ui-sheet';
  static slotPrefix = 'sheet';
}
UiSheetClose.register('ui-sheet-close');

export class UiSheetContent extends UiDialogContent {
  static rootTag = 'ui-sheet';
  static slotPrefix = 'sheet';

  // `side` is read straight from the attribute rather than declared as a
  // reactive prop: the element is built on the dialog's factory base, and the
  // side is something an author writes once in markup. Attribute reads work
  // during server rendering too, so the first paint already carries data-side.
  _side(): SheetSide {
    const s = this.getAttribute?.('side');
    return s === 'top' || s === 'bottom' || s === 'left' ? s : 'right';
  }

  _panelClass(): string {
    return sheetContentClass();
  }

  _closeClass(): string {
    return sheetCloseButtonClass();
  }

  _overlayClass(): string {
    return sheetOverlayClass();
  }
}
UiSheetContent.register('ui-sheet-content');
