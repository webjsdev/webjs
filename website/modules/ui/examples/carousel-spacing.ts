import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

export default function CarouselSpacing() {
  return html`
    <ui-carousel class="w-full max-w-[12rem] sm:max-w-xs md:max-w-sm">
      <ui-carousel-content class="[&_[data-slot=carousel-content]>div]:-ms-1">
        ${Array.from({ length: 5 }).map((_, index) => html`
          <ui-carousel-item class="basis-1/2 ps-1 lg:basis-1/3">
            <div class="p-1">
              <div data-slot="card" data-size="default" class=${cardClass()}>
                <div data-slot="card-content" class=${cn(cardContentClass(), 'flex aspect-square items-center justify-center p-6')}>
                  <span class="text-2xl font-semibold">${index + 1}</span>
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
