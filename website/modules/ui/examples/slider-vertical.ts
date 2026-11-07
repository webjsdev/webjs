import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

export default function SliderVertical() {
  return html`
    <div class="mx-auto flex w-full max-w-xs items-center justify-center gap-6">
      <ui-slider orientation="vertical" class="h-40">
        <input type="range" min="0" max="100" step="1" value="50" aria-label="First value" class=${sliderClass()}>
      </ui-slider>
      <ui-slider orientation="vertical" class="h-40">
        <input type="range" min="0" max="100" step="1" value="25" aria-label="Second value" class=${sliderClass()}>
      </ui-slider>
    </div>
  `;
}
