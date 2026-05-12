import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

/**
 * Slider — single-thumb range input. Native `<input type="range">` with
 * styled track and thumb laid out on top.
 *
 *   <ui-slider min="0" max="100" .value=${50} @input=${e => …}></ui-slider>
 *
 * Multi-thumb sliders are not supported in this port (shadcn's primitive
 * supports them via radix; we'd need custom logic to match — single-thumb
 * covers the common case).
 */
export class UiSlider extends WebComponent {
  static properties = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    value: { type: Number },
    disabled: { type: Boolean, reflect: true },
    orientation: { type: String, reflect: true },
    name: { type: String },
    id: { type: String, reflect: true },
  };
  declare min: number;
  declare max: number;
  declare step: number;
  declare value: number;
  declare disabled: boolean;
  declare orientation: 'horizontal' | 'vertical';
  declare name: string;
  declare id: string;

  constructor() {
    super();
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.value = 0;
    this.disabled = false;
    this.orientation = 'horizontal';
    this.name = '';
    this.id = '';
  }

  render() {
    const pct = ((this.value - this.min) / Math.max(1, this.max - this.min)) * 100;
    return html`
      <div
        data-slot="slider"
        data-orientation=${this.orientation}
        class=${cn(
          'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        )}
      >
        <div
          data-slot="slider-track"
          data-orientation=${this.orientation}
          class=${cn(
            'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
          )}
        >
          <div
            data-slot="slider-range"
            data-orientation=${this.orientation}
            class=${cn(
              'absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
            )}
            style=${this.orientation === 'vertical' ? `height:${pct}%; bottom:0` : `width:${pct}%`}
          ></div>
        </div>
        <input
          type="range"
          min=${this.min}
          max=${this.max}
          step=${this.step}
          .value=${String(this.value)}
          ?disabled=${this.disabled}
          name=${this.name || null}
          id=${this.id || null}
          aria-orientation=${this.orientation}
          class="absolute inset-0 size-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
          @input=${this._onInput}
          @change=${this._onChange}
        />
      </div>
    `;
  }

  private _onInput = (e: Event) => {
    const next = Number((e.target as HTMLInputElement).value);
    this.value = next;
    this.dispatchEvent(new CustomEvent('input', { detail: { value: next }, bubbles: true, composed: true }));
  };

  private _onChange = (e: Event) => {
    const next = Number((e.target as HTMLInputElement).value);
    this.value = next;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: next }, bubbles: true, composed: true }));
  };
}
UiSlider.register('ui-slider');
