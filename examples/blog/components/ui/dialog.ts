/**
 * Dialog: modal dialog with focus trap, Escape-to-close, and overlay click.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
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
 *   `open`: boolean (reflected). Presence ⇒ dialog is shown.
 *
 * Events fired on <ui-dialog>:
 *   `ui-open-change`: `{ detail: { open: boolean } }`: fires after the
 *     element transitions between open / closed states.
 *
 * Keyboard:
 *   Escape           close
 *   Tab / Shift-Tab  cycle focusable elements within the dialog content
 *
 * Programmatic API on <ui-dialog>:
 *   .show()   .hide()   .toggle()
 *
 * Design tokens used: --background, --border, --muted-foreground, --foreground.
 */

import { cn, Base, defineElement } from '../../lib/utils/cn.ts';

// --------------------------------------------------------------------------
// Class helpers for static subparts. Compose with plain elements.
// --------------------------------------------------------------------------

/** Dialog header: flex column for title + description, stacks on mobile. */
export const dialogHeaderClass = (): string =>
  'flex flex-col gap-2 text-center sm:text-left';

/** Dialog title: large semibold heading. */
export const dialogTitleClass = (): string =>
  'text-lg leading-none font-semibold';

/** Dialog description: subdued caption below the title. */
export const dialogDescriptionClass = (): string =>
  'text-sm text-muted-foreground';

/** Dialog footer: right-aligned actions on desktop, reverse-stacked on mobile. */
export const dialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';

/** Dialog content panel: centered, fixed-position box with shadow + border. */
export const dialogContentClass = (): string =>
  'fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none sm:max-w-lg';

/** Dialog backdrop: fixed full-viewport translucent overlay. */
export const dialogOverlayClass = (): string => 'fixed inset-0 z-50 bg-black/50';

// --------------------------------------------------------------------------
// Visibility CSS: installed once. Hides content + overlay when the host
// <ui-dialog> doesn't have the `open` attribute. This works at SSR time too:
// because SSR includes no `open` attribute by default, content is invisible
// until JS hydrates and the user opens the dialog.
// --------------------------------------------------------------------------

const STYLES = `
ui-dialog:not([open]) ui-dialog-content,
ui-dialog:not([open]) ui-dialog-overlay { display: none !important; }
ui-dialog[open] { display: contents; }
ui-dialog-content { display: grid; }
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
// Body scroll lock: refcounted so multiple open dialogs nest correctly.
// --------------------------------------------------------------------------

let scrollLockCount = 0;
let savedOverflow = '';

function lockScroll(): void {
  if (scrollLockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
}

function unlockScroll(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = savedOverflow;
}

// --------------------------------------------------------------------------
// Focus management: find focusables, trap Tab, restore focus on close.
// --------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

// --------------------------------------------------------------------------
// <ui-dialog> owns open state, focus trap, escape, scroll lock.
// --------------------------------------------------------------------------

export class UiDialog extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }

  private _previouslyFocused: HTMLElement | null = null;
  private _keyHandler = (e: KeyboardEvent): void => this._onKeyDown(e);

  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'dialog');
    // Auto-ensure an overlay element exists inside the dialog so styles work
    // even if the author forgot to write <ui-dialog-overlay>.
    if (!this.querySelector(':scope > ui-dialog-overlay')) {
      const overlay = document.createElement('ui-dialog-overlay');
      this.insertBefore(overlay, this.firstChild);
    }
    this._reflect();
  }

  disconnectedCallback(): void {
    if (this.isOpen) {
      this._teardown();
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

  private _reflect(): void {
    this.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
    const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
    if (content) {
      content.setAttribute('data-state', this.isOpen ? 'open' : 'closed');
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
    }
  }

  private _setup(): void {
    this._previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();
    document.addEventListener('keydown', this._keyHandler);
    // Focus first focusable inside the content after a microtask so DOM is settled.
    queueMicrotask(() => {
      const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
      if (!content) return;
      const focusables = getFocusables(content);
      (focusables[0] ?? content).focus({ preventScroll: true });
    });
  }

  private _teardown(): void {
    unlockScroll();
    document.removeEventListener('keydown', this._keyHandler);
    if (this._previouslyFocused) {
      this._previouslyFocused.focus({ preventScroll: true });
      this._previouslyFocused = null;
    }
  }

  private _onKeyDown(e: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
      return;
    }
    if (e.key === 'Tab') {
      const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
      if (!content) return;
      const focusables = getFocusables(content);
      if (focusables.length === 0) {
        e.preventDefault();
        content.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}
defineElement('ui-dialog', UiDialog);

// --------------------------------------------------------------------------
// <ui-dialog-trigger> clicks on this (or any element inside) open the
// enclosing <ui-dialog>. Decorator only: does not render anything.
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
    const dialog = this.closest('ui-dialog') as UiDialog | null;
    dialog?.show();
  };
}
defineElement('ui-dialog-trigger', UiDialogTrigger);

// --------------------------------------------------------------------------
// <ui-dialog-content> is the centered panel. Applies the visual classes from
// dialogContentClass() to its host, merging with any user-provided class.
// --------------------------------------------------------------------------

export class UiDialogContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-content');
    this.setAttribute('tabindex', '-1');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dialogContentClass(), userClass);
  }
}
defineElement('ui-dialog-content', UiDialogContent);

// --------------------------------------------------------------------------
// <ui-dialog-overlay> is the translucent backdrop. Clicks here close the
// enclosing dialog (matches shadcn's modal-close-on-overlay behavior).
// --------------------------------------------------------------------------

export class UiDialogOverlay extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'dialog-overlay');
    this.setAttribute('aria-hidden', 'true');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(dialogOverlayClass(), userClass);
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => {
    const dialog = this.closest('ui-dialog') as UiDialog | null;
    dialog?.hide();
  };
}
defineElement('ui-dialog-overlay', UiDialogOverlay);

// --------------------------------------------------------------------------
// <ui-dialog-close> clicks on this (or any element inside) close the
// enclosing dialog.
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
    const dialog = this.closest('ui-dialog') as UiDialog | null;
    dialog?.hide();
  };
}
defineElement('ui-dialog-close', UiDialogClose);
