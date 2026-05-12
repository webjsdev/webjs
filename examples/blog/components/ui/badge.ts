import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core';
import { cn } from '../../lib/utils.ts';

const base =
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden";

const variants = {
  default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
  secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
  destructive:
    'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
  outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
} as const;

export class UiBadge extends WebComponent {
  static properties = { variant: { type: String, reflect: true } };
  declare variant: keyof typeof variants;
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
    return html`<span data-slot="badge" class=${cn(base, variants[this.variant] || variants.default)}>${unsafeHTML(this._slot)}</span>`;
  }
}
UiBadge.register('ui-badge');
