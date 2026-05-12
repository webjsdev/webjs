import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

const toggleBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const toggleVariants = {
  default: 'bg-transparent',
  outline:
    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
} as const;

const toggleSizes = {
  default: 'h-9 min-w-9 px-2',
  sm: 'h-8 min-w-8 px-1.5',
  lg: 'h-10 min-w-10 px-2.5',
} as const;

export type ToggleVariant = keyof typeof toggleVariants;
export type ToggleSize = keyof typeof toggleSizes;

export function toggleClasses(variant: ToggleVariant = 'default', size: ToggleSize = 'default') {
  return cn(toggleBase, toggleVariants[variant] || toggleVariants.default, toggleSizes[size] || toggleSizes.default);
}

/**
 * Standalone toggle button. Pressed/unpressed state.
 *
 *   <ui-toggle ?pressed=${on} @change=${e => …}>Bold</ui-toggle>
 */
export class UiToggle extends WebComponent {
  static properties = {
    pressed: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
  };
  declare pressed: boolean;
  declare disabled: boolean;
  declare variant: ToggleVariant;
  declare size: ToggleSize;

  private _slot = '';

  constructor() {
    super();
    this.pressed = false;
    this.disabled = false;
    this.variant = 'default';
    this.size = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const state = this.pressed ? 'on' : 'off';
    return html`
      <button
        type="button"
        aria-pressed=${this.pressed ? 'true' : 'false'}
        ?disabled=${this.disabled}
        data-slot="toggle"
        data-state=${state}
        data-variant=${this.variant}
        data-size=${this.size}
        class=${toggleClasses(this.variant, this.size)}
        @click=${this._onClick}
      >${unsafeHTML(this._slot)}</button>
    `;
  }

  private _onClick = () => {
    if (this.disabled) return;
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { pressed: this.pressed }, bubbles: true, composed: true }),
    );
  };
}
UiToggle.register('ui-toggle');
