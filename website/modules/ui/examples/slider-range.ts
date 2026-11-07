import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

export default function SliderRange() {
  return html`
    <ui-slider class="mx-auto w-full max-w-xs">
      <input type="range" min="0" max="100" step="5" value="25" aria-label="Minimum" class=${sliderClass()}>
      <input type="range" min="0" max="100" step="5" value="50" aria-label="Maximum" class=${sliderClass()}>
    </ui-slider>
  `;
}
