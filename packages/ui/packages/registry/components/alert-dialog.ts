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
import { cn } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

export const alertDialogContentClass = (): string =>
  'group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadcn-lg shadow-lg duration-200 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg';

export const alertDialogHeaderClass = (): string =>
  'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left';

export const alertDialogFooterClass = (): string =>
  'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end';

export const alertDialogTitleClass = (): string => 'text-lg font-semibold';

export const alertDialogDescriptionClass = (): string => 'text-sm text-muted-foreground';

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

let scrollLockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';
function lockScroll(): void {
  if (scrollLockCount === 0) {
    // Reserve the gutter the OS scrollbar was occupying so the body doesn't
    // visibly widen when `overflow: hidden` removes it. See dialog.ts for
    // the full rationale. Kept in lockstep here because alert-dialog
    // intentionally re-implements the lock (rather than importing from
    // dialog.ts) so users can `webjs ui add alert-dialog` without pulling
    // in the full dialog component.
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

  _native: HTMLDialogElement | null = null;
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

  firstUpdated(): void {
    this.setAttribute('data-slot', 'alert-dialog');
    this._native = this.querySelector<HTMLDialogElement>('dialog[data-slot="alert-dialog-native"]');
    if (this._native) {
      this._native.addEventListener('cancel', this._onNativeCancel);
      this._native.addEventListener('close', this._onNativeClose);
    }
    if (this.open) this._setup();
  }

  disconnectedCallback(): void {
    if (this.open) this._teardown();
    if (this._native) {
      this._native.removeEventListener('cancel', this._onNativeCancel);
      this._native.removeEventListener('close', this._onNativeClose);
    }
    super.disconnectedCallback?.();
  }

  show(): void { this.open = true; }
  hide(): void { this.open = false; }

  render() {
    this.setAttribute('data-state', this.open ? 'open' : 'closed');
    queueMicrotask(() => this._afterRender());
    return html`
      <slot></slot>
      <dialog data-slot="alert-dialog-native" class=${NATIVE_DIALOG_CLASS}>
        <slot name="alert-dialog-content"></slot>
      </dialog>
    `;
  }

  _afterRender(): void {
    const content = this.querySelector<HTMLElement>('ui-alert-dialog-content');
    if (content) {
      content.setAttribute('data-state', this.open ? 'open' : 'closed');
      content.setAttribute('role', 'alertdialog');
      content.setAttribute('aria-modal', 'true');
    }
    if (this._lastOpen !== this.open) {
      this._lastOpen = this.open;
      if (this.open) this._setup();
      else this._teardown();
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

  // Cancel the native Escape-to-close. The browser fires a `cancel` event
  // when the user presses Escape on an open dialog; preventDefault stops
  // the subsequent close. No click-to-close on the backdrop either (intentional
  // omission, alert dialogs require an explicit Cancel/Action choice).
  _onNativeCancel = (e: Event): void => e.preventDefault();
  _onNativeClose = (): void => {
    if (this.open) this.open = false;
  };
}
UiAlertDialog.register('ui-alert-dialog');

export class UiAlertDialogTrigger extends WebComponent {
  firstUpdated(): void {
    this.setAttribute('data-slot', 'alert-dialog-trigger');
    this.addEventListener('click', this._onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<slot></slot>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.show();
}
UiAlertDialogTrigger.register('ui-alert-dialog-trigger');

export class UiAlertDialogContent extends WebComponent {
  static properties = {
    size: { type: String, reflect: true },
  };
  declare size: 'default' | 'sm';

  _userClass: string = '';

  constructor() {
    super();
    this.size = 'default';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'alert-dialog-content');
    this.setAttribute('tabindex', '-1');
  }

  render() {
    this.setAttribute('data-size', this.size);
    this.className = cn(alertDialogContentClass(), this._userClass);
    return html`<slot></slot>`;
  }
}
UiAlertDialogContent.register('ui-alert-dialog-content');

// shadcn's <AlertDialogAction> and <AlertDialogCancel> ARE button-styled
// elements with forwarded `variant` and `size` props from the Button
// component. We mirror that: the host element itself receives
// buttonClass({variant, size}) so users can write
//   <ui-alert-dialog-action variant="destructive">Delete</ui-alert-dialog-action>
// and get the right visuals without wrapping a <button>. Cancel defaults
// to variant="outline" (matches shadcn); Action defaults to "default".
//
// Back-compat: if the consumer provided a child <button> (the legacy
// wrap-a-button pattern), we don't restyle the host. Their button keeps
// its own buttonClass call and the host stays a transparent wrapper.

function applyAlertDialogButton(host: HTMLElement, defaultVariant: ButtonVariant, userClass: string): void {
  if (host.querySelector(':scope > button')) return;
  const variant = (host.getAttribute('variant') ?? defaultVariant) as ButtonVariant;
  const size = (host.getAttribute('size') ?? 'default') as ButtonSize;
  host.className = cn(buttonClass({ variant, size }), userClass);
  host.setAttribute('role', 'button');
  if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
}

function alertDialogButtonKeydown(this: HTMLElement, e: KeyboardEvent): void {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    this.click();
  }
}

export class UiAlertDialogCancel extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'alert-dialog-cancel');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', alertDialogButtonKeydown as EventListener);
    super.disconnectedCallback?.();
  }

  render() {
    applyAlertDialogButton(this, 'outline', this._userClass);
    return html`<slot></slot>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
UiAlertDialogCancel.register('ui-alert-dialog-cancel');

export class UiAlertDialogAction extends WebComponent {
  _userClass: string = '';

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'alert-dialog-action');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', alertDialogButtonKeydown as EventListener);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', alertDialogButtonKeydown as EventListener);
    super.disconnectedCallback?.();
  }

  render() {
    applyAlertDialogButton(this, 'default', this._userClass);
    return html`<slot></slot>`;
  }

  _onClick = (): void => (this.closest('ui-alert-dialog') as UiAlertDialog | null)?.hide();
}
UiAlertDialogAction.register('ui-alert-dialog-action');
