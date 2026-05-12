import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Form field primitives: a layout system for label + control + helper
 * text + error messaging.
 *
 *   <ui-field>
 *     <ui-field-label for="email">Email</ui-field-label>
 *     <ui-input id="email" name="email"></ui-input>
 *     <ui-field-description>We'll never share your email.</ui-field-description>
 *     <ui-field-error>Email is required.</ui-field-error>
 *   </ui-field>
 *
 * Grouping multiple fields:
 *
 *   <ui-field-set>
 *     <ui-field-legend>Account</ui-field-legend>
 *     <ui-field-group>...</ui-field-group>
 *   </ui-field-set>
 */

const fieldOrientations = {
  vertical: 'flex-col [&>*]:w-full [&>.sr-only]:w-auto',
  horizontal:
    'flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start',
  responsive:
    'flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto',
} as const;

export type FieldOrientation = keyof typeof fieldOrientations;

export class UiField extends WebComponent {
  static properties = {
    orientation: { type: String, reflect: true },
    invalid: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare orientation: FieldOrientation;
  declare invalid: boolean;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.orientation = 'vertical';
    this.invalid = false;
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const o = fieldOrientations[this.orientation] || fieldOrientations.vertical;
    return html`
      <div
        role="group"
        data-slot="field"
        data-orientation=${this.orientation}
        data-invalid=${this.invalid ? 'true' : 'false'}
        data-disabled=${this.disabled ? 'true' : 'false'}
        class=${cn('group/field flex w-full gap-3 data-[invalid=true]:text-destructive', o)}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiField.register('ui-field');

export class UiFieldLabel extends WebComponent {
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
        data-slot="field-label"
        for=${this.for || null}
        class=${cn(
          'group/field-label peer/field-label flex w-fit gap-2 text-sm leading-snug font-medium select-none',
          'group-data-[disabled=true]/field:opacity-50',
        )}
      >${unsafeHTML(this._slot)}</label>
    `;
  }
}
UiFieldLabel.register('ui-field-label');

export class UiFieldDescription extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <p
        data-slot="field-description"
        class=${cn(
          'text-sm leading-normal font-normal text-muted-foreground',
          '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        )}
      >${unsafeHTML(this._slot)}</p>
    `;
  }
}
UiFieldDescription.register('ui-field-description');

export class UiFieldError extends WebComponent {
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
    const content = this.message || this._slot;
    if (!content) return html``;
    return html`
      <div
        role="alert"
        data-slot="field-error"
        class=${cn('text-sm font-normal text-destructive')}
      >${unsafeHTML(content)}</div>
    `;
  }
}
UiFieldError.register('ui-field-error');

export class UiFieldGroup extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="field-group"
        class=${cn(
          'group/field-group @container/field-group flex w-full flex-col gap-7',
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiFieldGroup.register('ui-field-group');

export class UiFieldSeparator extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    const hasContent = !!this._slot.trim();
    return html`
      <div
        data-slot="field-separator"
        data-content=${hasContent ? 'true' : 'false'}
        class=${cn('relative -my-2 h-5 text-sm')}
      >
        <div class="absolute inset-0 top-1/2 h-px bg-border"></div>
        ${hasContent
          ? html`<span class="relative mx-auto block w-fit bg-background px-2 text-muted-foreground" data-slot="field-separator-content">${unsafeHTML(this._slot)}</span>`
          : html``}
      </div>
    `;
  }
}
UiFieldSeparator.register('ui-field-separator');

export class UiFieldLegend extends WebComponent {
  static properties = { variant: { type: String, reflect: true } };
  declare variant: 'legend' | 'label';

  private _slot = '';

  constructor() {
    super();
    this.variant = 'legend';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`
      <legend
        data-slot="field-legend"
        data-variant=${this.variant}
        class=${cn(
          'mb-3 font-medium',
          this.variant === 'legend' ? 'text-base' : 'text-sm',
        )}
      >${unsafeHTML(this._slot)}</legend>
    `;
  }
}
UiFieldLegend.register('ui-field-legend');

export class UiFieldSet extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <fieldset
        data-slot="field-set"
        class=${cn('flex flex-col gap-6')}
      >${unsafeHTML(this._slot)}</fieldset>
    `;
  }
}
UiFieldSet.register('ui-field-set');

export class UiFieldTitle extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="field-title"
        class=${cn(
          'flex w-fit items-center gap-2 text-sm leading-snug font-medium',
          'group-data-[disabled=true]/field:opacity-50',
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiFieldTitle.register('ui-field-title');

export class UiFieldContent extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="field-content"
        class=${cn('group/field-content flex flex-1 flex-col gap-1.5 leading-snug')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiFieldContent.register('ui-field-content');
