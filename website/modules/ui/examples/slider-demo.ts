import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

export default function SliderDemo() {
  return html`
    <ui-slider class="mx-auto w-full max-w-xs">
      <input type="range" min="0" max="100" step="1" value="75" aria-label="Value" class=${sliderClass()}>
    </ui-slider>
  `;
}
