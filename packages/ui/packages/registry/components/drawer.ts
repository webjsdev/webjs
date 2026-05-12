import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Drawer — bottom-sheet pattern (mobile-style). v1: no drag interaction,
 * just open/close with translate animation.
 *
 *   <ui-drawer>
 *     <ui-drawer-trigger><ui-button>Open</ui-button></ui-drawer-trigger>
 *     <ui-drawer-content>
 *       <ui-drawer-header>
 *         <ui-drawer-title>Title</ui-drawer-title>
 *         <ui-drawer-description>...</ui-drawer-description>
 *       </ui-drawer-header>
 *       ...
 *       <ui-drawer-footer>...</ui-drawer-footer>
 *     </ui-drawer-content>
 *   </ui-drawer>
 */

export class UiDrawer extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _lastFocused: HTMLElement | null = null;

  constructor() { super(); this.open = false; }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-drawer-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-drawer-close', this._onClose as EventListener);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-drawer-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-drawer-close', this._onClose as EventListener);
  }

  _onToggle = () => this.setOpen(!this.open);
  _onClose = () => this.setOpen(false);

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-drawer-content, ui-drawer-trigger').forEach((el) => {
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
UiDrawer.register('ui-drawer');

export class UiDrawerTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-drawer-toggle', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDrawerTrigger.register('ui-drawer-trigger');

export class UiDrawerClose extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  _onClick = () => this.dispatchEvent(new CustomEvent('ui-drawer-close', { bubbles: true }));
  render() { return html`${unsafeHTML(this._slot)}`; }
}
UiDrawerClose.register('ui-drawer-close');

export class UiDrawerContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }

  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }

  render() {
    const state = this.getAttribute('data-state') || 'closed';
    if (state !== 'open') return html``;
    return html`
      <div
        data-slot="drawer-overlay"
        data-state=${state}
        class=${cn('fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0')}
        @click=${this._closeOnOverlay}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        data-slot="drawer-content"
        data-state=${state}
        data-vaul-drawer-direction="bottom"
        class=${cn('group/drawer-content fixed z-50 flex h-auto flex-col bg-background inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t', 'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-300', 'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-500')}
      >
        <div class="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted"></div>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
  _closeOnOverlay = (e: Event) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('ui-drawer-close', { bubbles: true })); };
}
UiDrawerContent.register('ui-drawer-content');

function makeChild(tag: string, slot: string, classes: string) {
  class C extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  C.register(tag);
  return C;
}

export const UiDrawerHeader = makeChild('ui-drawer-header', 'drawer-header', 'flex flex-col gap-0.5 p-4 text-center md:gap-1.5 md:text-left');
export const UiDrawerFooter = makeChild('ui-drawer-footer', 'drawer-footer', 'mt-auto flex flex-col gap-2 p-4');
export const UiDrawerTitle = makeChild('ui-drawer-title', 'drawer-title', 'font-semibold text-foreground');
export const UiDrawerDescription = makeChild('ui-drawer-description', 'drawer-description', 'text-sm text-muted-foreground');
