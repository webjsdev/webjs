import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Button group primitives. Visually joins child buttons by removing inner
 * radii and sharing borders. Children should typically be <ui-button>
 * instances, but any element with `data-slot=*` works.
 *
 *   <ui-button-group orientation="horizontal">
 *     <ui-button variant="outline">One</ui-button>
 *     <ui-button variant="outline">Two</ui-button>
 *     <ui-button-group-separator></ui-button-group-separator>
 *     <ui-button variant="outline">Three</ui-button>
 *   </ui-button-group>
 */

const groupBase =
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>input]:flex-1";

const groupOrientations = {
  horizontal:
    "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
  vertical:
    "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
} as const;

export type ButtonGroupOrientation = keyof typeof groupOrientations;

export class UiButtonGroup extends WebComponent {
  static properties = {
    orientation: { type: String, reflect: true },
  };
  declare orientation: ButtonGroupOrientation;

  private _slot = '';

  constructor() {
    super();
    this.orientation = 'horizontal';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const o = groupOrientations[this.orientation] || groupOrientations.horizontal;
    return html`
      <div
        role="group"
        data-slot="button-group"
        data-orientation=${this.orientation}
        class=${cn(groupBase, o)}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiButtonGroup.register('ui-button-group');

export class UiButtonGroupText extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`
      <div
        data-slot="button-group-text"
        class=${cn(
          "flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiButtonGroupText.register('ui-button-group-text');

export class UiButtonGroupSeparator extends WebComponent {
  static properties = {
    orientation: { type: String, reflect: true },
  };
  declare orientation: 'horizontal' | 'vertical';

  constructor() {
    super();
    this.orientation = 'vertical';
  }

  render() {
    const isVertical = this.orientation === 'vertical';
    return html`
      <div
        role="separator"
        data-slot="button-group-separator"
        data-orientation=${this.orientation}
        aria-orientation=${this.orientation}
        class=${cn(
          'relative m-0! self-stretch bg-input',
          isVertical ? 'w-px h-auto' : 'h-px w-full',
        )}
      ></div>
    `;
  }
}
UiButtonGroupSeparator.register('ui-button-group-separator');
