/**
 * Switch: toggle styled as a sliding pill. Tier-1 class helpers. A
 * hidden native `<input type="checkbox" role="switch">` handles form
 * submission + keyboard; a sibling `<span>` provides the visual track +
 * thumb (positioned via the `peer-checked:` variant).
 *
 * shadcn parity:
 *   Switch (size: default | sm)  → <ui-switch size checked name value disabled
 *                                   required aria-label input-id>, which renders
 *                                   shadcn's switch (a `data-slot="switch"` root
 *                                   and a `switch-thumb`) around a real checkbox,
 *                                   so every shadcn style draws it
 *                                 → or, as plain markup, switchInputClass() on a
 *                                   hidden <input> + switchTrackClass({ size }) on
 *                                   a sibling <span> (the default style only)
 *
 * <ui-switch> renders on the server too: its checkbox is a real form control
 * laid transparent over the track, so it submits, takes a <label>, and toggles
 * with JavaScript off. `data-state` follows it, and the data-checked variant
 * also reads the native state (a switch root whose own checkbox is checked, a
 * thumb after a checked checkbox), so the look follows the control without
 * script too. `ui-checked-change` reports a change ({ detail: { checked } }).
 *
 * Design tokens used: --primary, --input, --background, --foreground, --ring,
 * --primary-foreground.
 *
 * A11y (required for accessible output):
 *   Keep `role="switch"` on the native checkbox. That is what makes a screen
 *   reader announce "on / off" rather than "checked / unchecked", and the
 *   browser maps the input's checked state to it for free.
 *   NAME IT. The visible track is a `<span>` and the real control is `sr-only`,
 *   so there is no text on the input at all. Wrapping the whole thing in a
 *   `<label>` (the first example) is the simplest way, since the label's text
 *   then names the input. A STANDALONE switch, one with no wrapping `<label>`
 *   and no `<label for>` pointing at it, has NO accessible name and needs an
 *   explicit `aria-label`, as the second example shows.
 *   The visual track and thumb are presentation only. They carry no text and no
 *   role, so nothing about the state reaches assistive tech through them: it all
 *   comes from the input. Do not move the name onto the track.
 *   Use `disabled` on the input, not on the track: the track styles itself from
 *   the `peer-disabled:` variant, and only the real control can refuse input.
 *
 * @example
 * ```html
 * <ui-switch name="airplane" aria-label="Airplane mode" checked></ui-switch>
 *
 * <!-- With a visible label, which names the switch. -->
 * <label class="inline-flex items-center gap-2">
 *   <ui-switch name="notify"></ui-switch> Notifications
 * </label>
 *
 * <!-- The helpers, for a plain-markup switch. -->
 * <label class="inline-flex items-center gap-2">
 *   <input type="checkbox" role="switch" name="notify" class=${switchInputClass()}>
 *   <span class=${switchTrackClass()}></span>
 *   <span class=${labelClass()}>Notifications</span>
 * </label>
 *
 * <!-- Standalone (no wrapping label), so the name has to be explicit. -->
 * <input type="checkbox" role="switch" name="wifi" aria-label="Wi-Fi"
 *        class=${switchInputClass()}>
 * <span class=${switchTrackClass()}></span>
 *
 * <!-- Small size. -->
 * <input type="checkbox" role="switch" name="x" aria-label="Compact mode"
 *        class=${cn(switchInputClass(), 'peer/sm')}>
 * <span class=${switchTrackClass({ size: 'sm' })}></span>
 * ```
 */
import { WebComponent, html, prop, nothing } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';

/** Hidden native checkbox: handles form value + keyboard activation. */
export const switchInputClass = (): string => 'peer sr-only';

const TRACK_BASE =
  'cn-switch peer group/switch inline-flex items-center transition-all outline-none relative';

const TRACK_SIZES = {
  default: 'cn-switch-size-default',
  sm: 'cn-switch-size-sm',
} as const;

const THUMB_SIZES = {
  default: 'cn-switch-thumb-size-default',
  sm: 'cn-switch-thumb-size-sm',
} as const;

const THUMB_BASE =
  'cn-switch-thumb';

export type SwitchSize = keyof typeof TRACK_SIZES;

export function switchTrackClass(opts: { size?: SwitchSize } = {}): string {
  const size = opts.size ?? 'default';
  return cn(TRACK_BASE, TRACK_SIZES[size], THUMB_BASE, THUMB_SIZES[size]);
}

// --------------------------------------------------------------------------
// <ui-switch>
// --------------------------------------------------------------------------

/**
 * shadcn's Switch: a root and a thumb around a real checkbox. The authored
 * attributes that belong to the control (`name`, `value`, `checked`,
 * `disabled`, `required`, `aria-label`, `aria-labelledby`,
 * `aria-describedby`, `aria-invalid`, and `input-id` for a `<label for>`) are
 * passed to it. `aria-invalid` also lands on the root, where every style draws
 * the error ring (shadcn's root is the control itself).
 */
export class UiSwitch extends WebComponent({
  size: prop<SwitchSize>(String, { reflect: true }),
  checked: prop(Boolean),
  disabled: prop(Boolean),
  required: prop(Boolean),
  name: prop(String),
  value: prop(String),
  inputId: prop(String, { attribute: 'input-id' }),
  // Observed so a re-validation that sets or clears it re-renders the switch.
  invalid: prop(String, { attribute: 'aria-invalid' }),
}) {
  constructor() {
    super();
    this.size = 'default';
    this.checked = false;
    this.disabled = false;
    this.required = false;
    this.name = '';
    this.value = '';
    this.inputId = '';
    this.invalid = '';
  }

  _attr(name: string): string | null {
    return typeof this.getAttribute === 'function' ? this.getAttribute(name) : null;
  }

  _onChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    this.checked = input.checked;
    this.dispatchEvent(new CustomEvent('ui-checked-change', { detail: { checked: input.checked }, bubbles: true }));
  };

  // The focus ring sits on the root and keys on the checkbox inside having
  // keyboard focus: in shadcn the focused element IS the root (a Radix
  // button), here it is the real checkbox the root contains.
  // The root is the box, as shadcn's root (a Radix button) is: a flex item
  // its row centres. A block host around it added a line box of its own and
  // sat the switch a few pixels high, so the host is display: contents,
  // through its style, which the server serves.
  render() {
    if (typeof this.getAttribute === 'function' && !this.getAttribute('style')) this.setAttribute('style', 'display: contents');
    const size = this.size === 'sm' ? 'sm' : 'default';
    const state = this.checked ? 'checked' : 'unchecked';
    return html`<span
      data-slot="switch"
      data-size=${size}
      data-state=${state}
      aria-invalid=${this.invalid === 'true' ? 'true' : nothing}
      ?data-disabled=${this.disabled}
      class=${cn('cn-switch peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 has-[>input:focus-visible]:ring-[3px] has-[>input:focus-visible]:ring-ring/50', TRACK_SIZES[size])}
    ><input
      type="checkbox"
      role="switch"
      id=${this.inputId || nothing}
      name=${this.name || nothing}
      value=${this.value || nothing}
      ?checked=${this.checked}
      ?disabled=${this.disabled}
      ?required=${this.required}
      aria-label=${this._attr('aria-label') ?? nothing}
      aria-labelledby=${this._attr('aria-labelledby') ?? nothing}
      aria-describedby=${this._attr('aria-describedby') ?? nothing}
      aria-invalid=${this.invalid === 'true' ? 'true' : nothing}
      class="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      @change=${this._onChange}
    ><span
      data-slot="switch-thumb"
      data-state=${state}
      class=${cn('cn-switch-thumb cn-switch-knob pointer-events-none block ring-0 transition-transform', THUMB_SIZES[size])}
    ></span></span>`;
  }
}
UiSwitch.register('ui-switch');
