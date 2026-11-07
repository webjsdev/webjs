import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

export default function SliderDisabled() {
  return html`
    <ui-slider class="mx-auto w-full max-w-xs">
      <input type="range" min="0" max="100" step="1" value="50" aria-label="Value" disabled class=${sliderClass()}>
    </ui-slider>
  `;
}
