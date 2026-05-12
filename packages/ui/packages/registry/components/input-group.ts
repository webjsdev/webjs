import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Input group primitives. A flex container that places addons (icons,
 * buttons, text labels) inline with a control (input or textarea):
 *
 *   <ui-input-group>
 *     <ui-input-group-icon><svg/></ui-input-group-icon>
 *     <ui-input-group-input placeholder="Search"></ui-input-group-input>
 *     <ui-input-group-button>Go</ui-input-group-button>
 *   </ui-input-group>
 */

export class UiInputGroup extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="input-group"
        role="group"
        class=${cn(
          'group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30',
          'h-9 min-w-0 has-[>textarea]:h-auto',
          'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50',
          'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiInputGroup.register('ui-input-group');

export class UiInputGroupText extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    return html`
      <span
        data-slot="input-group-text"
        class=${cn(
          "flex items-center gap-2 px-3 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        )}
      >${unsafeHTML(this._slot)}</span>
    `;
  }
}
UiInputGroupText.register('ui-input-group-text');

export class UiInputGroupIcon extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    return html`
      <span
        data-slot="input-group-icon"
        class=${cn(
          "flex shrink-0 items-center justify-center pl-3 text-muted-foreground [&>svg]:size-4",
        )}
      >${unsafeHTML(this._slot)}</span>
    `;
  }
}
UiInputGroupIcon.register('ui-input-group-icon');

export class UiInputGroupButton extends WebComponent {
  static properties = {
    type: { type: String },
    disabled: { type: Boolean, reflect: true },
  };
  declare type: 'button' | 'submit' | 'reset';
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.type = 'button';
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    return html`
      <button
        type=${this.type}
        ?disabled=${this.disabled}
        data-slot="input-group-button"
        class=${cn(
          'inline-flex shrink-0 items-center justify-center gap-1.5 h-8 rounded-md px-2.5 text-sm font-medium transition-colors mr-1',
          'hover:bg-accent hover:text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          "[&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-4",
        )}
      >${unsafeHTML(this._slot)}</button>
    `;
  }
}
UiInputGroupButton.register('ui-input-group-button');

export class UiInputGroupInput extends WebComponent {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    type: { type: String },
    name: { type: String },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare placeholder: string;
  declare type: string;
  declare name: string;
  declare disabled: boolean;
  declare required: boolean;
  declare readonly: boolean;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.type = 'text';
    this.name = '';
    this.disabled = false;
    this.required = false;
    this.readonly = false;
  }

  _onInput = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true }));
  };

  render() {
    return html`
      <input
        data-slot="input-group-control"
        type=${this.type}
        name=${this.name}
        .value=${this.value}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        ?required=${this.required}
        ?readonly=${this.readonly}
        @input=${this._onInput}
        class=${cn(
          'flex-1 rounded-none border-0 bg-transparent px-3 py-2 text-sm shadow-none outline-none placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-transparent',
        )}
      />
    `;
  }
}
UiInputGroupInput.register('ui-input-group-input');
