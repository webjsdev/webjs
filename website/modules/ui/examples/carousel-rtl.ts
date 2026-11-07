import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

const translations = {
  en: { dir: 'ltr' },
  ar: { dir: 'rtl' },
  he: { dir: 'rtl' },
};

function toArabicNumerals(num: number): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num
    .toString()
    .split('')
    .map((digit) => arabicNumerals[parseInt(digit, 10)])
    .join('');
}

// dir="rtl" is the whole switch: the carousel reads its direction from the
// page, so it scrolls, steps and flips its arrows to match.
export default function CarouselRtl() {
  const language = 'ar';
  const { dir } = translations[language];
  const formatNumber = (num: number): string => (language === 'ar' ? toArabicNumerals(num) : num.toString());

  return html`
    <ui-carousel dir=${dir} class="w-full max-w-[12rem] sm:max-w-xs">
      <ui-carousel-content>
        ${Array.from({ length: 5 }).map((_, index) => html`
          <ui-carousel-item>
            <div class="p-1">
              <div data-slot="card" data-size="default" dir=${dir} class=${cardClass()}>
                <div data-slot="card-content" class=${cn(cardContentClass(), 'flex aspect-square items-center justify-center p-6')}>
                  <span class="text-4xl font-semibold">${formatNumber(index + 1)}</span>
                </div>
              </div>
            </div>
          </ui-carousel-item>
        `)}
      </ui-carousel-content>
      <ui-carousel-previous></ui-carousel-previous>
      <ui-carousel-next></ui-carousel-next>
    </ui-carousel>
  `;
}
