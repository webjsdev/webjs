import { html } from '@webjsdev/core';
import { sliderClass } from '#modules/ui/components/slider.ts';

const translations = {
  en: { dir: 'ltr' },
  ar: { dir: 'rtl' },
  he: { dir: 'rtl' },
};

export default function SliderRtl() {
  const lang = 'ar';
  const { dir } = translations[lang];

  return html`
    <ui-slider dir=${dir} lang=${lang} class="mx-auto w-full max-w-xs">
      <input type="range" min="0" max="100" step="1" value="75" aria-label="Value" class=${sliderClass()}>
    </ui-slider>
  `;
}
