import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Sheet (side panel). Variants: side="top|right|bottom|left" (default right).
 *
 *   <ui-sheet>
 *     <ui-sheet-trigger><ui-button>Open</ui-button></ui-sheet-trigger>
 *     <ui-sheet-content side="right">
 *       <ui-sheet-header>
 *         <ui-sheet-title>Title</ui-sheet-title>
 *         <ui-sheet-description>...</ui-sheet-description>
 *       </ui-sheet-header>
 *       ...
 *       <ui-sheet-footer>...</ui-sheet-footer>
 *     </ui-sheet-content>
 *   </ui-sheet>
 */

export class UiSheet extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _lastFocused: HTMLElement | null = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-sheet-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-sheet-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-sheet-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-sheet-close', this._onClose as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-sheet-content, ui-sheet-trigger').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
    if (open) {
      this._lastFocused = document.activeElement as HTMLElement;
      document.addEventListener('keydown', this._onKey);
    } else {
      document.removeEventListener('keydown', this._onKey);
      this._lastFocused?.focus();
    }
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open }, bubbles: true, composed: true }));
  }

  _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); this.setOpen(false); } };

  render() { return html`<slot></slot>`; }
}
UiSheet.register('ui-sheet');

export class UiSheetTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-sheet-toggle', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiSheetTrigger.register('ui-sheet-trigger');

export class UiSheetClose extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-sheet-close', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiSheetClose.register('ui-sheet-close');

export class UiSheetContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }

  static get observedAttributes() { return ['data-state', 'side']; }
  attributeChangedCallback() { this.requestUpdate(); }

  render() {
    const state = this.getAttribute('data-state') || 'closed';
    const side = (this.getAttribute('side') || 'right') as 'top' | 'right' | 'bottom' | 'left';
    if (state !== 'open') return html``;
    const sideCls = {
      right: 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      left:  'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
      top:   'inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
      bottom:'inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    }[side];
    return html`
      <div
        data-slot="sheet-overlay"
        data-state=${state}
        class=${cn('fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0')}
        @click=${this._closeOnOverlay}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        data-slot="sheet-content"
        data-state=${state}
        class=${cn('fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500', sideCls)}
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

  _close = () => this.dispatchEvent(new CustomEvent('ui-sheet-close', { bubbles: true }));
  _closeOnOverlay = (e: Event) => { if (e.target === e.currentTarget) this._close(); };
}
UiSheetContent.register('ui-sheet-content');

function makeChild(tag: string, slot: string, classes: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  C.register(tag);
  return C;
}

export const UiSheetHeader = makeChild('ui-sheet-header', 'sheet-header', 'flex flex-col gap-1.5 p-4');
export const UiSheetFooter = makeChild('ui-sheet-footer', 'sheet-footer', 'mt-auto flex flex-col gap-2 p-4');
export const UiSheetTitle = makeChild('ui-sheet-title', 'sheet-title', 'font-semibold text-foreground');
export const UiSheetDescription = makeChild('ui-sheet-description', 'sheet-description', 'text-sm text-muted-foreground');
