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
// <ui-toggle> owns stateful pressed / aria-pressed / data-state on a
// host button. Authored children (an icon, a label, etc.) project
// through the default slot.
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

  // Snapshot the author's class attribute at attach time so subsequent
  // re-renders (variant / size change) merge with it instead of stomping.
  _userClass: string = '';

  constructor() {
    super();
    this.pressed = false;
    this.variant = 'default';
    this.size = 'default';
    this.disabled = false;
  }

  connectedCallback(): void {
    // Capture authored class before the first render writes ours.
    this._userClass = this.getAttribute('class') ?? '';
    // Attach listeners every reconnect. Light-DOM slot projection causes
    // a disconnect/reconnect cycle on first mount; firstUpdated only
    // runs once, so listeners attached there get orphaned by the
    // intermediate disconnectedCallback removal.
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'toggle');
    this.setAttribute('role', 'button');
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback?.();
  }

  render() {
    // Host-level attributes that derive from reactive props get applied
    // on every render. Setting non-observed attributes here (data-state,
    // aria-pressed, tabindex, aria-disabled) does not re-enter render.
    this.className = cn(toggleClass({ variant: this.variant, size: this.size }), this._userClass);
    this.setAttribute('data-state', this.pressed ? 'on' : 'off');
    this.setAttribute('aria-pressed', String(this.pressed));
    this.setAttribute('tabindex', this.disabled ? '-1' : '0');
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    if (this.disabled) return;
    this.pressed = !this.pressed;
    this.dispatchEvent(
      new CustomEvent('ui-pressed-change', { detail: { pressed: this.pressed }, bubbles: true }),
    );
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._onClick();
    }
  };
}
UiToggle.register('ui-toggle');
