import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Alert dialog. Same shape as <ui-dialog> but no close (X) button on the
 * content; expected to be dismissed via explicit action/cancel buttons.
 *
 *   <ui-alert-dialog>
 *     <ui-alert-dialog-trigger><ui-button>Delete</ui-button></ui-alert-dialog-trigger>
 *     <ui-alert-dialog-content>
 *       <ui-alert-dialog-header>
 *         <ui-alert-dialog-title>Are you sure?</ui-alert-dialog-title>
 *         <ui-alert-dialog-description>This cannot be undone.</ui-alert-dialog-description>
 *       </ui-alert-dialog-header>
 *       <ui-alert-dialog-footer>
 *         <ui-alert-dialog-cancel><ui-button variant="outline">Cancel</ui-button></ui-alert-dialog-cancel>
 *         <ui-alert-dialog-action><ui-button>Delete</ui-button></ui-alert-dialog-action>
 *       </ui-alert-dialog-footer>
 *     </ui-alert-dialog-content>
 *   </ui-alert-dialog>
 */

export class UiAlertDialog extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _lastFocused: HTMLElement | null = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-alert-dialog-toggle', this._handleToggle as EventListener);
    this.addEventListener('ui-alert-dialog-close', this._handleClose as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-alert-dialog-toggle', this._handleToggle as EventListener);
    this.removeEventListener('ui-alert-dialog-close', this._handleClose as EventListener);
  }

  _handleToggle = () => { this.setOpen(!this.open); };
  _handleClose = () => { this.setOpen(false); };

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    this._syncDescendants();
    if (open) {
      this._lastFocused = document.activeElement as HTMLElement;
      document.addEventListener('keydown', this._onKey);
      queueMicrotask(() => {
        const content = this.querySelector('ui-alert-dialog-content') as HTMLElement | null;
        const f = content?.querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        f?.focus();
      });
    } else {
      document.removeEventListener('keydown', this._onKey);
      this._lastFocused?.focus();
    }
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  _onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); this.setOpen(false); }
    if (e.key === 'Tab') this._trapFocus(e);
  };

  _trapFocus(e: KeyboardEvent) {
    const content = this.querySelector('ui-alert-dialog-content') as HTMLElement | null;
    if (!content) return;
    const focusable = content.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  _syncDescendants() {
    const state = this.open ? 'open' : 'closed';
    this.querySelectorAll('ui-alert-dialog-content, ui-alert-dialog-overlay, ui-alert-dialog-trigger').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
  }

  render() { return html`<slot></slot>`; }
}
UiAlertDialog.register('ui-alert-dialog');

export class UiAlertDialogTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => { this.dispatchEvent(new CustomEvent('ui-alert-dialog-toggle', { bubbles: true })); };
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiAlertDialogTrigger.register('ui-alert-dialog-trigger');

export class UiAlertDialogContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state !== 'open') return html``;
    return html`
      <div
        data-slot="alert-dialog-overlay"
        data-state=${state}
        class=${cn('fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0')}
      ></div>
      <div
        role="alertdialog"
        aria-modal="true"
        data-slot="alert-dialog-content"
        data-state=${state}
        class=${cn('fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 sm:max-w-lg', 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95')}
      >
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiAlertDialogContent.register('ui-alert-dialog-content');

function makeChild(tag: string, slot: string, classes: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  C.register(tag);
  return C;
}

export const UiAlertDialogHeader = makeChild('ui-alert-dialog-header', 'alert-dialog-header', 'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:place-items-start sm:text-left');
export const UiAlertDialogFooter = makeChild('ui-alert-dialog-footer', 'alert-dialog-footer', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end');
export const UiAlertDialogTitle = makeChild('ui-alert-dialog-title', 'alert-dialog-title', 'text-lg font-semibold');
export const UiAlertDialogDescription = makeChild('ui-alert-dialog-description', 'alert-dialog-description', 'text-sm text-muted-foreground');

// Action: closes the dialog on click (the inner button can handle its own
// onClick; cancellation here just dismisses the alert).
export class UiAlertDialogAction extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => { this.dispatchEvent(new CustomEvent('ui-alert-dialog-close', { bubbles: true })); };
  render() {
    return html`<span data-slot="alert-dialog-action">${unsafeHTML(this._slot)}</span>`;
  }
}
UiAlertDialogAction.register('ui-alert-dialog-action');

export class UiAlertDialogCancel extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => { this.dispatchEvent(new CustomEvent('ui-alert-dialog-close', { bubbles: true })); };
  render() {
    return html`<span data-slot="alert-dialog-cancel">${unsafeHTML(this._slot)}</span>`;
  }
}
UiAlertDialogCancel.register('ui-alert-dialog-cancel');
