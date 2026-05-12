import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Form primitives. Layout + accessibility scaffold. Native HTML form
 * validation drives the invalid/error state — no React-Hook-Form
 * equivalent in v1.
 *
 *   <ui-form @submit=${onSubmit}>
 *     <ui-form-field>
 *       <ui-form-label for="email">Email</ui-form-label>
 *       <ui-form-control>
 *         <ui-input id="email" name="email" type="email" required></ui-input>
 *       </ui-form-control>
 *       <ui-form-description>Used for password resets.</ui-form-description>
 *       <ui-form-message></ui-form-message>
 *     </ui-form-field>
 *     <ui-button type="submit">Save</ui-button>
 *   </ui-form>
 *
 * TODO(v2): rich validation state management (per-field error tracking,
 * async validators, dirty/touched flags). Today, ui-form-field's
 * `data-invalid` follows the nearest native input's `:invalid` state via
 * pointer events; richer state would need a controller/store.
 */

export class UiForm extends WebComponent {
  static properties = { name: { type: String } };
  declare name: string;

  private _slot = '';

  constructor() {
    super();
    this.name = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  _onSubmit = (e: SubmitEvent) => {
    const form = e.currentTarget as HTMLFormElement;
    // Dispatch a higher-level event with the serialized form data.
    const data: Record<string, FormDataEntryValue> = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    this.dispatchEvent(new CustomEvent('form-submit', { detail: { data, form }, bubbles: true, composed: true }));
  };

  render() {
    return html`
      <form
        data-slot="form"
        name=${this.name || null}
        @submit=${this._onSubmit}
      >${unsafeHTML(this._slot)}</form>
    `;
  }
}
UiForm.register('ui-form');

export class UiFormField extends WebComponent {
  static properties = {
    name: { type: String },
    error: { type: String },
  };
  declare name: string;
  declare error: string;

  private _slot = '';

  constructor() {
    super();
    this.name = '';
    this.error = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <div
        data-slot="form-field"
        data-name=${this.name || null}
        data-invalid=${this.error ? 'true' : 'false'}
        class=${cn('grid gap-2')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiFormField.register('ui-form-field');

export class UiFormLabel extends WebComponent {
  static properties = { for: { type: String } };
  declare for: string;

  private _slot = '';

  constructor() {
    super();
    this.for = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <label
        data-slot="form-label"
        for=${this.for || null}
        class=${cn(
          'text-sm font-medium leading-none select-none',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          '[[data-invalid=true]_&]:text-destructive',
        )}
      >${unsafeHTML(this._slot)}</label>
    `;
  }
}
UiFormLabel.register('ui-form-label');

export class UiFormControl extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div data-slot="form-control">${unsafeHTML(this._slot)}</div>`;
  }
}
UiFormControl.register('ui-form-control');

export class UiFormDescription extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <p data-slot="form-description" class=${cn('text-sm text-muted-foreground')}>
        ${unsafeHTML(this._slot)}
      </p>
    `;
  }
}
UiFormDescription.register('ui-form-description');

export class UiFormMessage extends WebComponent {
  static properties = { message: { type: String } };
  declare message: string;

  private _slot = '';

  constructor() {
    super();
    this.message = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const body = this.message || this._slot;
    if (!body) return html``;
    return html`
      <p
        role="alert"
        data-slot="form-message"
        class=${cn('text-sm font-medium text-destructive')}
      >${unsafeHTML(body)}</p>
    `;
  }
}
UiFormMessage.register('ui-form-message');
