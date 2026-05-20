/**
 * Toggle: pressable on/off button. Pure class helper; use with a native
 * `<button>` and toggle the `data-state="on|off"` and `aria-pressed`
 * attributes yourself, OR use the stateful `<ui-toggle>` element.
 *
 * shadcn parity:
 *   variants: default | outline
 *   sizes:    default | sm | lg
 *
 * Usage (controlled, declarative):
 *   <button class=${toggleClass()} data-state="off" aria-pressed="false"
 *           onclick="this.dataset.state = this.dataset.state==='on'?'off':'on'">
 *     <svg>…</svg>
 *   </button>
 *
 * Usage (custom element handles state for you):
 *   <ui-toggle aria-label="Toggle bold">
 *     <svg>…</svg>
 *   </ui-toggle>
 *
 * Design tokens used: --muted, --muted-foreground, --accent, --accent-foreground,
 * --input, --background, --ring, --destructive.
 */
import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

// cursor-pointer + select-none on BASE for both call sites: the
// class-helper applied to a native <button> (where shadcn's upstream
// also omits it; see the same convention the button fix applies) and
// the <ui-toggle> custom element. select-none prevents drag-selecting
// icon/label glyphs that aren't meant to be selectable. disabled:
// pointer-events-none below already suppresses cursor for disabled buttons.
const BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap select-none transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const VARIANTS = {
  default: 'bg-transparent',
  outline:
    'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground',
} as const;

const SIZES = {
  default: 'h-9 min-w-9 px-2',
  sm: 'h-8 min-w-8 px-1.5',
  lg: 'h-10 min-w-10 px-2.5',
} as const;

export type ToggleVariant = keyof typeof VARIANTS;
export type ToggleSize = keyof typeof SIZES;

export function toggleClass(opts: { variant?: ToggleVariant; size?: ToggleSize } = {}): string {
  return cn(BASE, VARIANTS[opts.variant ?? 'default'], SIZES[opts.size ?? 'default']);
}

// --------------------------------------------------------------------------
// <ui-toggle> wraps a native <button> and tracks pressed state. Native
// <button> handles Enter/Space → click + focus + disabled semantics for
// free; we only own the pressed-state toggle on click. Authored children
// project through the default slot inside the inner button.
// --------------------------------------------------------------------------

export class UiToggle extends WebComponent {
  static properties = {
    pressed: { type: Boolean, reflect: true },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare pressed: boolean;
  declare variant: ToggleVariant;
  declare size: ToggleSize;
  declare disabled: boolean;

  constructor() {
    super();
    this.pressed = false;
    this.variant = 'default';
    this.size = 'default';
    this.disabled = false;
  }

  render() {
    return html`<button
      type="button"
      data-slot="toggle"
      class=${toggleClass({ variant: this.variant, size: this.size })}
      aria-pressed=${String(this.pressed)}
      data-state=${this.pressed ? 'on' : 'off'}
      ?disabled=${this.disabled}
      @click=${this._onClick}
    ><slot></slot></button>`;
  }

  _onClick = (): void => {
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent('ui-pressed-change', { detail: { pressed: this.pressed }, bubbles: true }),
    );
  };
}
UiToggle.register('ui-toggle');
