import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldTitleClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';

// Two range inputs make a range; the description shows the settled values.
export default function FieldSlider() {
  const value = [200, 800];

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'w-full max-w-xs')}>
      <div data-slot="field-label" class=${fieldTitleClass()}>Price Range</div>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Set your budget range ($<span class="font-medium tabular-nums">${value[0]}</span> -
        <span class="font-medium tabular-nums">${value[1]}</span>).
      </p>
      <ui-slider class="mt-2 w-full">
        <input type="range" min="0" max="1000" step="10" value=${value[0]} aria-label="Minimum price" class=${sliderClass()}>
        <input type="range" min="0" max="1000" step="10" value=${value[1]} aria-label="Maximum price" class=${sliderClass()}>
      </ui-slider>
    </div>
  `;
}
