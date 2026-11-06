import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

export default function CarouselDemo() {
  return html`
    <ui-carousel class="w-full max-w-[12rem] sm:max-w-xs">
      <ui-carousel-content>
        ${Array.from({ length: 5 }).map((_, index) => html`
          <ui-carousel-item>
            <div class="p-1">
              <div data-slot="card" data-size="default" class=${cardClass()}>
                <div data-slot="card-content" class=${cn(cardContentClass(), 'flex aspect-square items-center justify-center p-6')}>
                  <span class="text-4xl font-semibold">${index + 1}</span>
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
