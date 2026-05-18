/**
 * Dialog — modal dialog built on the native <dialog> element.
 *
 * The custom element is a thin decorator. All the heavy lifting comes
 * from HTMLDialogElement.showModal():
 *   - Top-layer rendering (no z-index wars)
 *   - ::backdrop pseudo-element for the overlay
 *   - Native focus management: initial focus on first tabbable, Tab
 *     trapped inside the dialog, focus restored on close
 *   - Escape-to-close via the cancel event
 *   - Background made inert (clicks pass through to nothing)
 *
 * On connection the component reparents <ui-dialog-content> inside a
 * programmatically-created <dialog> so we can call showModal() on it.
 * The <dialog> is transparent and zero-sized; the visible panel is
 * <ui-dialog-content> with its `position: fixed; top: 50%; left: 50%`
 * classes, which is what gets the shadow and rounded border.
 *
 * The previous version's focus trap, Tab cycling, Escape listener,
 * `<ui-dialog-overlay>` element, and document-level keydown handler are
 * all gone — the platform owns them now.
 *
 * shadcn parity:
 *   <Dialog>            → <ui-dialog open>
 *   <DialogTrigger>     → <ui-dialog-trigger>
 *   <DialogContent>     → <ui-dialog-content>
 *   <DialogClose>       → <ui-dialog-close>
 *   <DialogHeader>      → div with dialogHeaderClass()
 *   <DialogTitle>       → h2/div with dialogTitleClass()
 *   <DialogDescription> → p with dialogDescriptionClass()
 *   <DialogFooter>      → div with dialogFooterClass()
 *
 * Usage:
 *   <ui-dialog>
 *     <ui-dialog-trigger>
 *       <button class=${buttonClass({ variant: 'outline' })}>Open</button>
 *     </ui-dialog-trigger>
 *     <ui-dialog-content>
 *       <div class=${dialogHeaderClass()}>
 *         <h2 class=${dialogTitleClass()}>Edit profile</h2>
 *         <p class=${dialogDescriptionClass()}>Make changes here.</p>
 *       </div>
 *       <div class=${dialogFooterClass()}>
 *         <ui-dialog-close>
 *           <button class=${buttonClass({ variant: 'outline' })}>Cancel</button>
 *         </ui-dialog-close>
 *         <button class=${buttonClass()} type="submit">Save</button>
 *       </div>
 *     </ui-dialog-content>
 *   </ui-dialog>
 *
 * Attributes on <ui-dialog>:
 *   `open` — boolean (reflected). Presence shows the dialog.
 *
 * Events on <ui-dialog>:
 *   `ui-open-change` — { detail: { open: boolean } }, fires after the
 *     element transitions between open and closed.
 *
 * Programmatic API: .show()  .hide()  .toggle()
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */

import { cn, Base, defineElement } from '../lib/utils.ts';
import { buttonClass } from './button.ts';

// --------------------------------------------------------------------------
// Class helpers for subparts. Unchanged from the prior version.
// --------------------------------------------------------------------------

export const dialogHeaderClass = (): string =>
  'flex flex-col gap-2 text-center sm:text-left';

export const dialogTitleClass = (): string =>
  'text-lg leading-none font-semibold';

export const dialogDescriptionClass = (): string =>
  'text-sm text-muted-foreground';

export const dialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';

export const dialogContentClass = (): string =>
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none sm:max-w-lg';

// --------------------------------------------------------------------------
// Visibility CSS. The pre-hydration SSR pass renders <ui-dialog-content>
// with the host having no [open] attribute, so it must stay hidden until
// JS upgrades. Once upgraded the native <dialog> takes over: it is
// `display: none` while closed and `display: block` when showModal()
// puts it in the top layer.
// --------------------------------------------------------------------------

const STYLES = `
ui-dialog:not([open]) ui-dialog-content { display: none !important; }
ui-dialog[open] { display: contents; }
ui-dialog-content { display: grid; }
ui-dialog dialog[data-slot="dialog-native"] {
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  width: 0;
  height: 0;
  max-width: none;
  max-height: none;
  overflow: visible;
  color: inherit;
}
ui-dialog dialog[data-slot="dialog-native"]::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-dialog-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// Body scroll lock. Refcounted so nested dialogs unlock in order. Native
// <dialog> does not lock body scroll, only inert-ifies the background;
// preserved behavior parity with the previous version.
// --------------------------------------------------------------------------

let scrollLockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll(): void {
  if (scrollLockCount === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  scrollLockCount++;
}

function unlockScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// --------------------------------------------------------------------------
// <ui-dialog>
// --------------------------------------------------------------------------

export class UiDialog extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }

  private _native: HTMLDialogElement | null = null;
  private _onNativeClose = (): void => {
    if (this.isOpen) this.removeAttribute('open');
  };
  private _onNativeClick = (e: MouseEvent): void => {
    if (e.target === this._native) this.hide();
  };

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'dialog');
    this._wrap();
    this._reflect();
    if (this.isOpen) this._setup();
  }

  disconnectedCallback(): void {
    if (this.isOpen) this._teardown();
    if (this._native) {
      this._native.removeEventListener('close', this._onNativeClose);
      this._native.removeEventListener('click', this._onNativeClick as EventListener);
    }
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open' && oldVal !== newVal) {
      this._reflect();
      if (newVal !== null) this._setup();
      else this._teardown();
      this.dispatchEvent(
        new CustomEvent('ui-open-change', { detail: { open: this.isOpen }, bubbles: true }),
      );
    }
  }

  get isOpen(): boolean {
    return this.hasAttribute('open');
  }

  set isOpen(v: boolean) {
    if (v) this.setAttribute('open', '');
    else this.removeAttribute('open');
  }

  show(): void {
    this.isOpen = true;
  }

  hide(): void {
    this.isOpen = false;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  private _wrap(): void {
    const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
    if (!content) return;
    // Already wrapped (HMR re-attach or repeated connectedCallback).
    if (content.parentElement?.tagName === 'DIALOG') {
      this._native = content.parentElement as HTMLDialogElement;
    } else {
      const dlg = document.createElement('dialog');
      dlg.setAttribute('data-slot', 'dialog-native');
      content.replaceWith(dlg);
      dlg.appendChild(content);
      this._native = dlg;
    }
    // The legacy <ui-dialog-overlay> is no longer needed; ::backdrop covers it.
    this.querySelector<HTMLElement>(':scope > ui-dialog-overlay')?.remove();
    this._native.addEventListener('close', this._onNativeClose);
    this._native.addEventListener('click', this._onNativeClick as EventListener);
  }

  private _reflect(): void {
    this.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>('ui-dialog-content');
    if (content) {
      content.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
    }
  }

  private _setup(): void {
    if (!this._native) return;
    lockScroll();
    if (!this._native.open) this._native.showModal();
  }

  private _teardown(): void {
    unlockScroll();
    if (this._native?.open) this._native.close();
  }
}
defineElement('ui-dialog', UiDialog);

// --------------------------------------------------------------------------
// <ui-dialog-trigger>
// --------------------------------------------------------------------------

export class UiDialogTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-trigger');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.show();
  };
}
defineElement('ui-dialog-trigger', UiDialogTrigger);

// --------------------------------------------------------------------------
// <ui-dialog-content>
// --------------------------------------------------------------------------

export const dialogCloseButtonClass = (): string =>
  "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const DIALOG_CLOSE_X_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';

export class UiDialogContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-content');
    this.setAttribute('tabindex', '-1');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dialogContentClass(), userClass);
    const showCloseButton = this.getAttribute('show-close-button') !== 'false';
    if (showCloseButton && !this.querySelector(':scope > ui-dialog-close')) {
      const closeEl = document.createElement('ui-dialog-close');
      closeEl.setAttribute('aria-label', 'Close');
      closeEl.className = dialogCloseButtonClass();
      closeEl.innerHTML = DIALOG_CLOSE_X_SVG;
      this.appendChild(closeEl);
    }
  }
}
defineElement('ui-dialog-content', UiDialogContent);

// --------------------------------------------------------------------------
// <ui-dialog-close>
// --------------------------------------------------------------------------

export class UiDialogClose extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-close');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.hide();
  };
}
defineElement('ui-dialog-close', UiDialogClose);

// --------------------------------------------------------------------------
// <ui-dialog-footer>
// --------------------------------------------------------------------------

export class UiDialogFooter extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-footer');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dialogFooterClass(), userClass);
    const showClose = this.hasAttribute('show-close-button')
      && this.getAttribute('show-close-button') !== 'false';
    if (showClose && !this.querySelector(':scope > ui-dialog-close')) {
      const closeEl = document.createElement('ui-dialog-close');
      const btn = document.createElement('button');
      btn.className = buttonClass({ variant: 'outline' });
      btn.textContent = 'Close';
      closeEl.appendChild(btn);
      this.appendChild(closeEl);
    }
  }
}
defineElement('ui-dialog-footer', UiDialogFooter);
