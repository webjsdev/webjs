import { html } from '@webjsdev/core';
import { labelClass } from '#modules/ui/components/label.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';

// The settled values are server-rendered beside the label. A listener for
// ui-value-change (detail.value) keeps them current as the thumbs move.
export default function SliderControlled() {
  const value = [0.3, 0.7];

  return html`
    <div class="mx-auto grid w-full max-w-xs gap-3">
      <div class="flex items-center justify-between gap-2">
        <label data-slot="label" for="slider-demo-temperature" class=${labelClass()}>Temperature</label>
        <span class="text-sm text-muted-foreground">
          ${value.join(', ')}
        </span>
      </div>
      <ui-slider>
        <input type="range" id="slider-demo-temperature" min="0" max="1" step="0.1" value=${value[0]} class=${sliderClass()}>
        <input type="range" min="0" max="1" step="0.1" value=${value[1]} aria-label="Maximum temperature" class=${sliderClass()}>
      </ui-slider>
    </div>
  `;
}
