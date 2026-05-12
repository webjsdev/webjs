import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';

/**
 * Collapsible. Composition:
 *
 *   <ui-collapsible ?open=${expanded}>
 *     <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
 *     <ui-collapsible-content>Hidden content</ui-collapsible-content>
 *   </ui-collapsible>
 *
 * Root owns `open`. Trigger toggles it. Content shows/hides via data-state.
 */
export class UiCollapsible extends WebComponent {
  static properties = {
    open: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare open: boolean;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.open = false;
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-collapsible-toggle', this._onToggle as EventListener);
    queueMicrotask(() => this._syncChildren());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-collapsible-toggle', this._onToggle as EventListener);
  }

  _onToggle = () => {
    if (this.disabled) return;
    this.open = !this.open;
    this._syncChildren();
    this.dispatchEvent(new CustomEvent('open-change', { detail: { open: this.open }, bubbles: true, composed: true }));
  };

  _syncChildren() {
    const state = this.open ? 'open' : 'closed';
    this.querySelectorAll('ui-collapsible-trigger, ui-collapsible-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
    });
  }

  static get observedAttributes() {
    return ['open'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'open') this._syncChildren();
  }

  render() {
    return html`<div data-slot="collapsible" data-state=${this.open ? 'open' : 'closed'}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiCollapsible.register('ui-collapsible');

export class UiCollapsibleTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }
  _onClick = () => {
    this.dispatchEvent(new CustomEvent('ui-collapsible-toggle', { bubbles: true }));
  };
  render() {
    return html`<span data-slot="collapsible-trigger">${unsafeHTML(this._slot)}</span>`;
  }
}
UiCollapsibleTrigger.register('ui-collapsible-trigger');

export class UiCollapsibleContent extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  static get observedAttributes() {
    return ['data-state'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'data-state') this.requestUpdate();
  }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    return html`<div
      data-slot="collapsible-content"
      data-state=${state}
      ?hidden=${state !== 'open'}
      class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiCollapsibleContent.register('ui-collapsible-content');
