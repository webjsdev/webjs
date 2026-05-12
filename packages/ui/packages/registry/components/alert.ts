import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Alert family — <ui-alert>, <ui-alert-title>, <ui-alert-description>.
 *
 *   <ui-alert variant="destructive">
 *     <ui-alert-title>Heads up</ui-alert-title>
 *     <ui-alert-description>Something broke.</ui-alert-description>
 *   </ui-alert>
 */

const base =
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current';

const variants = {
  default: 'bg-card text-card-foreground',
  destructive:
    'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
} as const;

export type AlertVariant = keyof typeof variants;

export class UiAlert extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: AlertVariant;

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    return html`<div
      data-slot="alert"
      role="alert"
      data-variant=${this.variant}
      class=${cn(base, variants[this.variant] || variants.default)}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAlert.register('ui-alert');

export class UiAlertTitle extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="alert-title"
      class=${cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAlertTitle.register('ui-alert-title');

export class UiAlertDescription extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    return html`<div
      data-slot="alert-description"
      class=${cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
      )}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAlertDescription.register('ui-alert-description');
