/**
 * Slider: pick a number, or a range, on a track. Tier 1 and Tier 2.
 *
 * Tier 1: `sliderClass()` styles one native `<input type="range">`, which is
 * all a single value needs and works with no JavaScript at all.
 *
 * Tier 2: `<ui-slider>` ENHANCES one native range input per thumb (D13). You
 * author the inputs, so without JavaScript the page shows them and the form
 * submits them. With JavaScript the element hides them (visually only: they
 * still submit and reset with the form) and draws shadcn's track, range and
 * thumbs, writing every move back into the inputs. Two inputs make a range,
 * and a thumb never passes its neighbour.
 *
 * shadcn parity:
 *   Slider                   → <ui-slider orientation> around one
 *                              <input type="range" min max step value> per thumb
 *   defaultValue / value     → each input's value
 *   min / max / step         → the inputs' own attributes (read from the first)
 *   disabled                 → `disabled` on the inputs
 *   onValueChange            → `ui-value-change` ({ detail: { value: number[] } });
 *                              each input also fires `input`
 *   onValueCommit            → `ui-value-commit` ({ detail: { value: number[] } });
 *                              each moved input also fires `change`
 *
 * Keyboard (as Radix's): ArrowRight / ArrowUp step up, ArrowLeft / ArrowDown
 * step down (ArrowLeft / ArrowRight swap under `dir="rtl"`), PageUp / PageDown
 * and Shift with an arrow move ten steps, Home / End go to the ends. A press
 * on the track moves the nearest thumb there and drags it.
 *
 * A11y (handled by the element, plus your part): each thumb is a focusable
 * `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and
 * `aria-orientation`, named by its input's `<label>`s or `aria-label`, and a
 * label click focuses its thumb. Your part: a name for every input, which for
 * a range means one per thumb ("Minimum price", "Maximum price").
 *
 * @example
 * ```html
 * <input type="range" class=${sliderClass()} min="0" max="100" value="50" aria-label="Volume">
 *
 * <ui-slider>
 *   <input type="range" class=${sliderClass()} name="min" min="0" max="100" step="5" value="25" aria-label="Minimum">
 *   <input type="range" class=${sliderClass()} name="max" min="0" max="100" step="5" value="75" aria-label="Maximum">
 * </ui-slider>
 * ```
 */
import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { ensureId } from '../lib/utils.ts';

/** One native `<input type="range">`, styled to match the drawn slider. */
export function sliderClass(): string {
  return [
    'h-4 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-hidden',
    '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted',
    '[&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm',
    'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50',
    '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted',
    '[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary',
    '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm',
  ].join(' ');
}

/** The drawn slider's root (the element applies them). */
export const sliderRootClass = (): string =>
  'cn-slider relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col';
/** The track (the element applies them). */
export const sliderTrackClass = (): string =>
  'cn-slider-track relative grow overflow-hidden data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full';
/** The filled range (the element applies them). */
export const sliderRangeClass = (): string =>
  'cn-slider-range absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full';
/** A thumb (the element applies them). */
export const sliderThumbClass = (): string =>
  'cn-slider-thumb block shrink-0 select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

// The visual-only hide the select uses: still submitted and reset with the form.
const HIDDEN_CONTROL =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;opacity:0;pointer-events:none;overflow:hidden;';

export class UiSlider extends WebComponent({
  orientation: prop<'horizontal' | 'vertical'>(String, { reflect: true }),
}) {
  readonly #enhanced = signal(false);
  _observer: MutationObserver | null = null;
  _waiting: MutationObserver | null = null;
  _form: HTMLFormElement | null = null;
  _saved = new Map<HTMLInputElement, string | null>();
  _drag = -1;
  _moved = new Set<number>();

  constructor() {
    super();
    this.orientation = 'horizontal';
  }

  /** The native range inputs, one per thumb. */
  inputs(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll<HTMLInputElement>('input[type="range"]'));
  }

  /** The current values, one per thumb. */
  get value(): number[] {
    return this.inputs().map((i) => Number(i.value));
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    queueMicrotask(() => {
      if (this._enhance() || this._waiting) return;
      this._waiting = new MutationObserver(() => {
        if (this._enhance()) { this._waiting?.disconnect(); this._waiting = null; }
      });
      this._waiting.observe(this, { childList: true, subtree: true });
    });
  }

  disconnectedCallback(): void {
    this._waiting?.disconnect();
    this._observer?.disconnect();
    for (const [input, style] of this._saved) {
      input.removeEventListener('focus', this._onInputFocus);
      if (style !== null) input.setAttribute('style', style);
      else input.removeAttribute('style');
      input.removeAttribute('aria-hidden');
      input.removeAttribute('tabindex');
    }
    this._saved.clear();
    this._form?.removeEventListener('reset', this._onReset);
    super.disconnectedCallback?.();
  }

  /** Take over from the native inputs. True once it has (or already had). */
  _enhance(): boolean {
    if (this.#enhanced.get()) return true;
    const inputs = this.inputs();
    if (!inputs.length) return false;
    for (const input of inputs) {
      const style = input.getAttribute('style');
      this._saved.set(input, style);
      input.setAttribute('style', (style ?? '') + HIDDEN_CONTROL);
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      input.addEventListener('focus', this._onInputFocus);
    }
    this._form = inputs[0].form;
    this._form?.addEventListener('reset', this._onReset);
    this._observer = new MutationObserver(() => { this.requestUpdate(); });
    for (const input of inputs) this._observer.observe(input, { attributes: true });
    this.#enhanced.set(true);
    return true;
  }

  _onReset = (): void => {
    queueMicrotask(() => { this.requestUpdate(); });
  };

  // A label click focuses the hidden input; the user means its thumb.
  _onInputFocus = (e: Event): void => {
    const i = this.inputs().indexOf(e.target as HTMLInputElement);
    this._thumbs()[i]?.focus();
  };

  _thumbs(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[data-slot="slider-thumb"]'));
  }

  _bounds(): { min: number; max: number; step: number } {
    const first = this.inputs()[0];
    const min = Number(first?.min || 0);
    const max = Number(first?.max || 100);
    const step = Number(first?.step) > 0 ? Number(first.step) : 1;
    return { min, max: max > min ? max : min + 1, step };
  }

  _rtl(): boolean {
    return typeof getComputedStyle === 'function' && getComputedStyle(this).direction === 'rtl';
  }

  render() {
    if (!this.#enhanced.get()) {
      return html`<div data-slot="slider" data-orientation=${this.orientation || 'horizontal'} class="grid gap-2"><slot></slot></div>`;
    }
    const vertical = this.orientation === 'vertical';
    const orientation = vertical ? 'vertical' : 'horizontal';
    const inputs = this.inputs();
    const { min, max } = this._bounds();
    const pct = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
    const values = inputs.map((i) => Number(i.value));
    const disabled = inputs.some((i) => i.disabled);
    const lo = values.length > 1 ? pct(Math.min(...values)) : 0;
    const hi = pct(Math.max(...values));
    const rangeStyle = vertical
      ? `bottom:${lo}%;top:${100 - hi}%`
      : `inset-inline-start:${lo}%;inset-inline-end:${100 - hi}%`;
    const flip = this._rtl() ? 1 : -1;
    return html`<div
      data-slot="slider"
      data-orientation=${orientation}
      ?data-disabled=${disabled}
      class=${sliderRootClass()}
      @pointerdown=${this._onPointerDown}
      @pointermove=${this._onPointerMove}
      @pointerup=${this._onPointerUp}
      @pointercancel=${this._onPointerUp}
    ><slot></slot><span data-slot="slider-track" data-orientation=${orientation} class=${sliderTrackClass()}><span
      data-slot="slider-range" data-orientation=${orientation} class=${sliderRangeClass()} style=${rangeStyle}
    ></span></span>${inputs.map((input, i) => {
      const p = pct(values[i]);
      // At P% along the track, shifted back by P% of its own size, so a
      // thumb sits inside the track at both ends, as Radix's does.
      const place = vertical
        ? `position:absolute;bottom:${p}%;transform:translateY(${p}%)`
        : `position:absolute;inset-inline-start:${p}%;transform:translateX(${flip * p}%)`;
      const labels = input.labels ? Array.from(input.labels).map((l) => ensureId(l, 'ui-slider-label')) : [];
      return html`<span style=${place}><span
        data-slot="slider-thumb"
        role="slider"
        tabindex=${input.disabled ? '-1' : '0'}
        aria-valuemin=${String(min)}
        aria-valuemax=${String(max)}
        aria-valuenow=${String(values[i])}
        aria-valuetext=${input.getAttribute('aria-valuetext') || null}
        aria-orientation=${orientation}
        aria-labelledby=${labels.length ? labels.join(' ') : null}
        aria-label=${!labels.length && input.getAttribute('aria-label') ? input.getAttribute('aria-label') : null}
        aria-disabled=${input.disabled ? 'true' : null}
        ?data-disabled=${input.disabled}
        data-orientation=${orientation}
        class=${sliderThumbClass()}
        @keydown=${(e: KeyboardEvent) => this._onKeyDown(e, i)}
      ></span></span>`;
    })}</div>`;
  }

  /** Move thumb `i` to `raw`, snapped to the step and kept between its neighbours. */
  _set(i: number, raw: number): boolean {
    const inputs = this.inputs();
    const input = inputs[i];
    if (!input || input.disabled) return false;
    const { min, max, step } = this._bounds();
    let v = Math.round((raw - min) / step) * step + min;
    v = Number(v.toFixed(10));
    const lower = i > 0 ? Number(inputs[i - 1].value) : min;
    const upper = i < inputs.length - 1 ? Number(inputs[i + 1].value) : max;
    v = Math.min(Math.max(v, lower, min), upper, max);
    if (Number(input.value) === v) return false;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this._moved.add(i);
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('ui-value-change', { bubbles: true, detail: { value: this.value } }));
    return true;
  }

  // The end of a gesture: a key press, or a pointer release.
  _commit(): void {
    if (!this._moved.size) return;
    const inputs = this.inputs();
    for (const i of this._moved) inputs[i]?.dispatchEvent(new Event('change', { bubbles: true }));
    this._moved.clear();
    this.dispatchEvent(new CustomEvent('ui-value-commit', { bubbles: true, detail: { value: this.value } }));
  }

  _onKeyDown(e: KeyboardEvent, i: number): void {
    const { min, max, step } = this._bounds();
    const v = Number(this.inputs()[i]?.value);
    const big = step * 10;
    const rtl = this._rtl() && this.orientation !== 'vertical';
    const up = (n: number) => this._set(i, v + n);
    let handled = true;
    switch (e.key) {
      case 'ArrowUp': up(e.shiftKey ? big : step); break;
      case 'ArrowDown': up(-(e.shiftKey ? big : step)); break;
      case 'ArrowRight': up((rtl ? -1 : 1) * (e.shiftKey ? big : step)); break;
      case 'ArrowLeft': up((rtl ? 1 : -1) * (e.shiftKey ? big : step)); break;
      case 'PageUp': up(big); break;
      case 'PageDown': up(-big); break;
      case 'Home': this._set(i, min); break;
      case 'End': this._set(i, max); break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this._commit();
  }

  // The value under a pointer position, from the track's box.
  _valueAt(e: PointerEvent): number {
    const track = this.querySelector<HTMLElement>('[data-slot="slider-track"]');
    const { min, max } = this._bounds();
    if (!track) return min;
    const r = track.getBoundingClientRect();
    let t: number;
    if (this.orientation === 'vertical') t = (r.bottom - e.clientY) / r.height;
    else t = this._rtl() ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
    return min + Math.min(1, Math.max(0, t)) * (max - min);
  }

  _onPointerDown = (e: PointerEvent): void => {
    const inputs = this.inputs();
    if (!inputs.length || inputs.every((i) => i.disabled) || e.button !== 0) return;
    const v = this._valueAt(e);
    const values = inputs.map((i) => Number(i.value));
    // The nearest thumb; between two at the same spot, the one the press is
    // past, so a range collapsed to one point can still be pulled apart.
    let best = 0;
    values.forEach((x, i) => {
      const d = Math.abs(x - v);
      const bestD = Math.abs(values[best] - v);
      if (d < bestD || (d === bestD && v > x)) best = i;
    });
    if (inputs[best].disabled) return;
    e.preventDefault();
    this._drag = best;
    // A pointer the engine does not track (a synthetic one) cannot be captured.
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* drag without capture */ }
    this._set(best, v);
    this._thumbs()[best]?.focus();
  };

  _onPointerMove = (e: PointerEvent): void => {
    if (this._drag < 0) return;
    this._set(this._drag, this._valueAt(e));
  };

  _onPointerUp = (e: PointerEvent): void => {
    if (this._drag < 0) return;
    this._drag = -1;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    this._commit();
  };
}
UiSlider.register('ui-slider');
