import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variants = {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  destructive:
    'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
  outline:
    'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
  secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
  link: 'text-primary underline-offset-4 hover:underline',
} as const;

const sizes = {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  xs: 'h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*=size-])]:size-3',
  sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
  lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
  icon: 'size-9',
  'icon-xs': 'size-6 rounded-md [&_svg:not([class*=size-])]:size-3',
  'icon-sm': 'size-8',
  'icon-lg': 'size-10',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export class UiButton extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    type: { type: String },
  };
  declare variant: ButtonVariant;
  declare size: ButtonSize;
  declare disabled: boolean;
  declare type: 'button' | 'submit' | 'reset';

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
    this.size = 'default';
    this.disabled = false;
    this.type = 'button';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const classes = cn(base, variants[this.variant] || variants.default, sizes[this.size] || sizes.default);
    return html`
      <button
        type=${this.type}
        ?disabled=${this.disabled}
        class=${classes}
        data-slot="button"
        data-variant=${this.variant}
        data-size=${this.size}
      >${unsafeHTML(this._slot)}</button>
    `;
  }
}
UiButton.register('ui-button');
