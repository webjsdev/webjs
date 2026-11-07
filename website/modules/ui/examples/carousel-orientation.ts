import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

// A vertical carousel takes its height on <ui-carousel-content>. The track
// inside it carries the negative margin that pairs with each slide's padding.
export default function CarouselOrientation() {
  return html`
    <ui-carousel orientation="vertical" class="w-full max-w-xs">
      <ui-carousel-content class="h-[270px] [&_[data-slot=carousel-content]>div]:-mt-1">
        ${Array.from({ length: 5 }).map((_, index) => html`
          <ui-carousel-item class="basis-1/2 pt-1">
            <div class="p-1">
              <div data-slot="card" data-size="default" class=${cardClass()}>
                <div data-slot="card-content" class=${cn(cardContentClass(), 'flex items-center justify-center p-6')}>
                  <span class="text-3xl font-semibold">${index + 1}</span>
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
