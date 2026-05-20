/**
 * AlertDialog, modal requiring explicit Cancel / Action confirmation.
 * Variant of Dialog: role="alertdialog", no Escape-to-close, no
 * overlay-click-to-close. Built on the native <dialog> element.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
 *
 * Composition follows the same named-slot pattern as dialog.ts:
 * the rendered template emits a <dialog> with a named slot inside,
 * and the user's authored <ui-alert-dialog-content> is routed there
 * by setting slot="alert-dialog-content" on it during connection.
 *
 * shadcn parity:
 *   AlertDialog, AlertDialogTrigger, AlertDialogContent (size: default | sm),
 *   AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
 *   AlertDialogFooter, AlertDialogAction, AlertDialogCancel.
 *
 * Usage:
 *   <ui-alert-dialog>
 *     <ui-alert-dialog-trigger>
 *       <button class=${buttonClass({ variant: 'destructive' })}>Delete</button>
 *     </ui-alert-dialog-trigger>
 *     <ui-alert-dialog-content>
 *       <div class=${alertDialogHeaderClass()}>
 *         <h2 class=${alertDialogTitleClass()}>Delete account?</h2>
 *         <p class=${alertDialogDescriptionClass()}>This cannot be undone.</p>
 *       </div>
 *       <div class=${alertDialogFooterClass()}>
 *         <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
 *         <ui-alert-dialog-action variant="destructive">Delete</ui-alert-dialog-action>
 *       </div>
 *     </ui-alert-dialog-content>
 *   </ui-alert-dialog>
 *
 * Design tokens used: --background, --border, --muted-foreground.
 */
import { WebComponent, html } from '@webjskit/core';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

export const alertDialogContentClass = (): string =>
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadcn-lg shadow-lg duration-200 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg';

export const alertDialogHeaderClass = (): string =>
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left';

export const alertDialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end';

export const alertDialogTitleClass = (): string => 'text-lg font-semibold';

export const alertDialogDescriptionClass = (): string => 'text-sm text-muted-foreground';

// Pre-hydration paint fallback (see dialog.ts for the long version).
const STYLES = `
ui-alert-dialog:not([open]) ui-alert-dialog-content { display: none !important; }
ui-alert-dialog-content { display: grid; }
`;

const NATIVE_DIALOG_CLASS = 'border-0 bg-transparent p-0 m-0 w-0 h-0 max-w-none max-h-none overflow-visible text-inherit backdrop:bg-black/50';

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-alert-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-alert-dialog-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// Body scroll lock. Refcounted so nested dialogs unlock in order. Kept in
// lockstep with dialog.ts (not imported) so `webjs ui add alert-dialog`
// doesn't pull in the full dialog component.
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
// <ui-alert-dialog>
// --------------------------------------------------------------------------

export class UiAlertDialog extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
  };
  declare open: boolean;

  _lastOpen: boolean = false;

  constructor() {
    super();
    this.open = false;
  }

  connectedCallback(): void {
    installStyles();
    const content = this.querySelector<HTMLElement>(':scope > ui-alert-dialog-content');
    if (content && !content.hasAttribute('slot')) {
      content.setAttribute('slot', 'alert-dialog-content');
    }
    this.querySelector<HTMLElement>(':scope > ui-alert-dialog-overlay')?.remove();
    super.connectedCallback?.();
  }

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    super.disconnectedCallback?.();
  }

  show(): void { this.open = true; }
  hide(): void { this.open = false; }

  // Back-compat getter alongside the reactive `open` prop.
  get isOpen(): boolean { return this.open; }

  render() {
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      requestAnimationFrame(() => {
        if (this.open) this._setup();
        else this._teardown();
      });
    }
    return html`<div data-slot="alert-dialog" data-state=${this.open ? 'open' : 'closed'}>
      <slot></slot>
      <dialog
        data-slot="alert-dialog-native"
        class=${NATIVE_DIALOG_CLASS}
        @cancel=${this._onNativeCancel}
        @close=${this._onNativeClose}
      ><slot name="alert-dialog-content"></slot></dialog>
    </div>`;
  }

  get _native(): HTMLDialogElement | null {
    return this.querySelector<HTMLDialogElement>('dialog[data-slot="alert-dialog-native"]');
  }

  _setup(): void {
    const native = this._native;
    if (!native) return;
    lockScroll();
    if (!native.open) native.showModal();
  }

  _teardown(): void {
    unlockScroll();
    const native = this._native;
    if (native?.open) native.close();
  }

  // Block native Escape-to-close. Alert dialogs require an explicit
  // Cancel/Action choice; the cancel event fires when Escape is pressed.
  _onNativeCancel = (e: Event): void => e.preventDefault();
  _onNativeClose = (): void => {
    if (this.open) this.open = false;
  };
}
UiAlertDialog.register('ui-alert-dialog');

// --------------------------------------------------------------------------
// <ui-alert-dialog-trigger>
// --------------------------------------------------------------------------

export class UiAlertDialogTrigger extends WebComponent {
  render() {
    return html`<div
      data-slot="alert-dialog-trigger"
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.show();
}
UiAlertDialogTrigger.register('ui-alert-dialog-trigger');

// --------------------------------------------------------------------------
// <ui-alert-dialog-content>
// --------------------------------------------------------------------------

export class UiAlertDialogContent extends WebComponent {
  static properties = {
    size: { type: String, reflect: true },
  };
  declare size: 'default' | 'sm';

  constructor() {
    super();
    this.size = 'default';
  }

  render() {
    return html`<div
      data-slot="alert-dialog-content"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      data-size=${this.size}
      data-state=${this._parent()?.open ? 'open' : 'closed'}
      class=${alertDialogContentClass()}
    ><slot></slot></div>`;
  }

  _parent(): UiAlertDialog | null {
    return this.closest('ui-alert-dialog') as UiAlertDialog | null;
  }
}
UiAlertDialogContent.register('ui-alert-dialog-content');

// --------------------------------------------------------------------------
// <ui-alert-dialog-cancel> + <ui-alert-dialog-action>
// shadcn's <AlertDialogAction> and <AlertDialogCancel> ARE button-styled
// elements with forwarded `variant` and `size` props. Each renders its
// own native <button> with @click + @keydown bindings, and the user's
// label text projects through a slot.
//
// Back-compat: if the user authored a <button> inside (legacy wrap-a-
// button pattern), the inner button is suppressed and the user's
// button keeps its own styling. The flag captured in connectedCallback
// is authoritative because by render() time the slot machinery has
// moved the authored children off the host.
// --------------------------------------------------------------------------

export class UiAlertDialogCancel extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
  };
  declare variant: ButtonVariant;
  declare size: ButtonSize;

  _hasAuthoredButton: boolean = false;

  constructor() {
    super();
    this.variant = 'outline';
    this.size = 'default';
  }

  connectedCallback(): void {
    this._hasAuthoredButton = !!this.querySelector('button');
    super.connectedCallback?.();
  }

  render() {
    return this._hasAuthoredButton
      ? html`<div data-slot="alert-dialog-cancel" @click=${this._onClick}><slot></slot></div>`
      : html`<button
          type="button"
          data-slot="alert-dialog-cancel"
          class=${buttonClass({ variant: this.variant, size: this.size })}
          @click=${this._onClick}
        ><slot></slot></button>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
UiAlertDialogCancel.register('ui-alert-dialog-cancel');

export class UiAlertDialogAction extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
  };
  declare variant: ButtonVariant;
  declare size: ButtonSize;

  _hasAuthoredButton: boolean = false;

  constructor() {
    super();
    this.variant = 'default';
    this.size = 'default';
  }

  connectedCallback(): void {
    this._hasAuthoredButton = !!this.querySelector('button');
    super.connectedCallback?.();
  }

  render() {
    return this._hasAuthoredButton
      ? html`<div data-slot="alert-dialog-action" @click=${this._onClick}><slot></slot></div>`
      : html`<button
          type="button"
          data-slot="alert-dialog-action"
          class=${buttonClass({ variant: this.variant, size: this.size })}
          @click=${this._onClick}
        ><slot></slot></button>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
UiAlertDialogAction.register('ui-alert-dialog-action');
