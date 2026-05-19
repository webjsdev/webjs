/**
 * Dialog, modal dialog built on the native <dialog> element.
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
 * Component composition uses named slots: the rendered template emits
 * a programmatic <dialog> with `<slot name="dialog-content">` inside.
 * The user authors `<ui-dialog-content>` as a normal child; the
 * component sets `slot="dialog-content"` on it during connection so
 * the slot machinery routes it inside the <dialog> automatically.
 * Triggers and other children stay in the default slot, outside the
 * <dialog>.
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
 *   `open`, boolean (reflected). Presence shows the dialog.
 *
 * Events on <ui-dialog>:
 *   `ui-open-change`, { detail: { open: boolean } }, fires after the
 *     element transitions between open and closed.
 *
 * Programmatic API: .show()  .hide()  .toggle()
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */

import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';
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
// Pre-hydration paint fallback. Before the script upgrades the custom
// elements, <ui-dialog-content> sits in normal flow and would flash
// visible. The selector-based rules hide it until JS marks the host as
// `[open]`. Custom-element display defaults (`display: inline`) also
// need explicit values, which Tailwind cannot supply on tags the user
// authors. Once upgraded, the native <dialog> wrapper takes over:
// closed `<dialog>` is UA `display: none`, opened via showModal() is
// `display: block` in the top layer.
// --------------------------------------------------------------------------

const STYLES = `
ui-dialog:not([open]) ui-dialog-content { display: none !important; }
ui-dialog[open] { display: contents; }
ui-dialog-content { display: grid; }
`;

// Tailwind class string applied to the rendered <dialog> element.
// Clears the UA defaults so the <dialog> itself becomes an invisible
// top-layer host. The visible box is rendered by <ui-dialog-content>
// with dialogContentClass. backdrop: variant styles the ::backdrop
// pseudo-element.
const NATIVE_DIALOG_CLASS = 'border-0 bg-transparent p-0 m-0 w-0 h-0 max-w-none max-h-none overflow-visible text-inherit backdrop:bg-black/50';

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

export class UiDialog extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _native: HTMLDialogElement | null = null;
  _lastOpen: boolean = false;

  constructor() {
    super();
    this.open = false;
  }

  connectedCallback(): void {
    installStyles();
    // Route the authored <ui-dialog-content> child into the named slot
    // inside the rendered <dialog>. This happens BEFORE the framework's
    // slot machinery captures children, so projection is automatic.
    const content = this.querySelector<HTMLElement>(':scope > ui-dialog-content');
    if (content && !content.hasAttribute('slot')) {
      content.setAttribute('slot', 'dialog-content');
    }
    // Remove the legacy overlay; native ::backdrop handles it.
    this.querySelector<HTMLElement>(':scope > ui-dialog-overlay')?.remove();
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dialog');
    this._native = this.querySelector<HTMLDialogElement>('dialog[data-slot="dialog-native"]');
    if (this._native) {
      this._native.addEventListener('close', this._onNativeClose);
      this._native.addEventListener('click', this._onNativeClick as EventListener);
    }
    if (this.open) this._setup();
  }

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    if (this._native) {
      this._native.removeEventListener('close', this._onNativeClose);
      this._native.removeEventListener('click', this._onNativeClick as EventListener);
    }
    super.disconnectedCallback?.();
  }

  show(): void { this.open = true; }
  hide(): void { this.open = false; }
  toggle(): void { this.open = !this.open; }

  // Back-compat getter: the previous API exposed `isOpen` while the
  // new reactive prop is `open`. Tests + consumer code that read
  // `dialog.isOpen` keep working.
  get isOpen(): boolean { return this.open; }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    queueMicrotask(() => this._afterRender());
    return html`
      <slot></slot>
      <dialog data-slot="dialog-native" class=${NATIVE_DIALOG_CLASS}>
        <slot name="dialog-content"></slot>
      </dialog>
    `;
  }

  _afterRender(): void {
    const content = this.querySelector<HTMLElement>('ui-dialog-content');
    if (content) {
      content.setAttribute('data-state', this.open ? 'open' : 'closed');
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
    }
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      if (this.open) this._setup();
      else this._teardown();
      this.dispatchEvent(
        new CustomEvent('ui-open-change', { detail: { open: this.open }, bubbles: true }),
      );
    }
  }

  _setup(): void {
    if (!this._native) return;
    lockScroll();
    if (!this._native.open) this._native.showModal();
  }

  _teardown(): void {
    unlockScroll();
    if (this._native?.open) this._native.close();
  }

  _onNativeClose = (): void => {
    if (this.open) this.open = false;
  };

  _onNativeClick = (e: MouseEvent): void => {
    if (e.target === this._native) this.hide();
  };
}
UiDialog.register('ui-dialog');

// --------------------------------------------------------------------------
// <ui-dialog-trigger>
// --------------------------------------------------------------------------

export class UiDialogTrigger extends WebComponent {
  firstUpdated(): void {
    this.setAttribute('data-slot', 'dialog-trigger');
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.show();
  };
}
UiDialogTrigger.register('ui-dialog-trigger');

// --------------------------------------------------------------------------
// <ui-dialog-content>
// --------------------------------------------------------------------------

export const dialogCloseButtonClass = (): string =>
  "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const DIALOG_CLOSE_X_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';

export class UiDialogContent extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dialog-content');
    this.setAttribute('tabindex', '-1');
    const showCloseButton = this.getAttribute('show-close-button') !== 'false';
    if (showCloseButton && !this.querySelector(':scope > ui-dialog-close')) {
      const closeEl = document.createElement('ui-dialog-close');
      closeEl.setAttribute('aria-label', 'Close');
      closeEl.className = dialogCloseButtonClass();
      closeEl.innerHTML = DIALOG_CLOSE_X_SVG;
      this.appendChild(closeEl);
    }
  }

  render() {
    this.className = cn(dialogContentClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDialogContent.register('ui-dialog-content');

// --------------------------------------------------------------------------
// <ui-dialog-close>
// --------------------------------------------------------------------------

export class UiDialogClose extends WebComponent {
  firstUpdated(): void {
    this.setAttribute('data-slot', 'dialog-close');
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    (this.closest('ui-dialog') as UiDialog | null)?.hide();
  };
}
UiDialogClose.register('ui-dialog-close');

// --------------------------------------------------------------------------
// <ui-dialog-footer>
// --------------------------------------------------------------------------

export class UiDialogFooter extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'dialog-footer');
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

  render() {
    this.className = cn(dialogFooterClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiDialogFooter.register('ui-dialog-footer');
