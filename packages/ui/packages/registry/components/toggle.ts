/**
 * Toggle — pressable on/off button. Pure class helper; use with a native
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
 * Usage (custom element — handles state for you):
 *   <ui-toggle aria-label="Toggle bold">
 *     <svg>…</svg>
 *   </ui-toggle>
 *
 * Design tokens used: --muted, --muted-foreground, --accent, --accent-foreground,
 * --input, --background, --ring, --destructive.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';

// cursor-pointer + select-none on BASE for both call sites — the
// class-helper applied to a native <button> (where shadcn's upstream
// also omits it; see the same convention the button fix applies) and
// the <ui-toggle> custom element (a generic element with no implicit
// pointer cursor). select-none prevents drag-selecting icon/label
// glyphs that aren't meant to be selectable. disabled:pointer-events-
// none below already suppresses cursor for disabled native buttons.
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
// <ui-toggle> — manages pressed state + aria-pressed + data-state on a host
// button. Convenience when you want state without writing the toggling JS.
// --------------------------------------------------------------------------

export class UiToggle extends Base {
  static get observedAttributes(): string[] {
    return ['pressed', 'variant', 'size', 'disabled'];
  }

  connectedCallback(): void {
    this.setAttribute('data-slot', 'toggle');
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', this.hasAttribute('disabled') ? '-1' : '0');
    this._applyClass();
    this._reflect();
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
  }
  attributeChangedCallback(name: string): void {
    if (name === 'pressed' || name === 'disabled') this._reflect();
    if (name === 'variant' || name === 'size') this._applyClass();
  }

  get pressed(): boolean {
    return this.hasAttribute('pressed');
  }
  set pressed(v: boolean) {
    if (v) this.setAttribute('pressed', '');
    else this.removeAttribute('pressed');
  }

  private _applyClass(): void {
    const userClass = this.getAttribute('class') ?? '';
    const variant = (this.getAttribute('variant') ?? 'default') as ToggleVariant;
    const size = (this.getAttribute('size') ?? 'default') as ToggleSize;
    this.className = cn(toggleClass({ variant, size }), userClass);
  }

  private _reflect(): void {
    const on = this.pressed;
    this.setAttribute('data-state', on ? 'on' : 'off');
    this.setAttribute('aria-pressed', String(on));
    if (this.hasAttribute('disabled')) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  private _onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent('ui-pressed-change', { detail: { pressed: this.pressed }, bubbles: true }),
    );
  };

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._onClick();
    }
  };
}
defineElement('ui-toggle', UiToggle);
