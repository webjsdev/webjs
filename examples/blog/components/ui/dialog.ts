import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core';
import { cn } from '../../lib/utils.ts';

/**
 * Dialog primitives. Composition:
 *
 *   <ui-dialog>
 *     <ui-dialog-trigger><ui-button>Open</ui-button></ui-dialog-trigger>
 *     <ui-dialog-content>
 *       <ui-dialog-header>
 *         <ui-dialog-title>Title</ui-dialog-title>
 *         <ui-dialog-description>...</ui-dialog-description>
 *       </ui-dialog-header>
 *       <ui-dialog-footer>...</ui-dialog-footer>
 *     </ui-dialog-content>
 *   </ui-dialog>
 *
 * State is managed on the root `<ui-dialog>`. Trigger toggles `open` on the
 * root; content shows/hides via `data-state` attribute. Esc closes; click on
 * overlay closes. Focus is trapped within the content while open.
 */

export class UiDialog extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _lastFocused: HTMLElement | null = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-dialog-toggle', this._handleToggle as EventListener);
    this.addEventListener('ui-dialog-close', this._handleClose as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-dialog-toggle', this._handleToggle as EventListener);
    this.removeEventListener('ui-dialog-close', this._handleClose as EventListener);
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
      // focus first focusable inside content on next frame
      queueMicrotask(() => {
        const content = this.querySelector('ui-dialog-content') as HTMLElement | null;
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
    const content = this.querySelector('ui-dialog-content') as HTMLElement | null;
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
    this.querySelectorAll('ui-dialog-content, ui-dialog-overlay, ui-dialog-trigger').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
  }

  render() { return html`<slot></slot>`; }  // host stays light; children pass through
}
UiDialog.register('ui-dialog');

// Trigger: any element wrapped in <ui-dialog-trigger> opens the dialog.
export class UiDialogTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => { this.dispatchEvent(new CustomEvent('ui-dialog-toggle', { bubbles: true })); };
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDialogTrigger.register('ui-dialog-trigger');

// Content + overlay. data-state drives the open/closed animation.
export class UiDialogContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state !== 'open') return html``;
    return html`
      <div
        data-slot="dialog-overlay"
        data-state=${state}
        class=${cn('fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0')}
        @click=${this._closeOnOverlay}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        data-state=${state}
        class=${cn('fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none sm:max-w-lg', 'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95')}
      >
        ${unsafeHTML(this._slot)}
        <button
          aria-label="Close"
          class="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          @click=${this._close}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          <span class="sr-only">Close</span>
        </button>
      </div>
    `;
  }
  _close = () => { this.dispatchEvent(new CustomEvent('ui-dialog-close', { bubbles: true })); };
  _closeOnOverlay = (e: Event) => { if (e.target === e.currentTarget) this._close(); };

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiDialogContent.register('ui-dialog-content');

function makeChild(tag: string, slot: string, classes: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  C.register(tag);
  return C;
}

export const UiDialogHeader = makeChild('ui-dialog-header', 'dialog-header', 'flex flex-col gap-2 text-center sm:text-left');
export const UiDialogFooter = makeChild('ui-dialog-footer', 'dialog-footer', 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end');
export const UiDialogTitle = makeChild('ui-dialog-title', 'dialog-title', 'text-lg leading-none font-semibold');
export const UiDialogDescription = makeChild('ui-dialog-description', 'dialog-description', 'text-sm text-muted-foreground');
