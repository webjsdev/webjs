import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

export default function SliderMultiple() {
  return html`
    <ui-slider class="mx-auto w-full max-w-xs">
      <input type="range" min="0" max="100" step="10" value="10" aria-label="First value" class=${sliderClass()}>
      <input type="range" min="0" max="100" step="10" value="20" aria-label="Second value" class=${sliderClass()}>
      <input type="range" min="0" max="100" step="10" value="70" aria-label="Third value" class=${sliderClass()}>
    </ui-slider>
  `;
}
