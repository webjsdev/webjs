import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

// The counter shows the first paint. In an app, a component listens for the
// carousel's ui-slide-change event and writes detail.index + 1 into it.
export default function CarouselApi() {
  const count = 5;
  const current = 1;

  return html`
    <div class="mx-auto max-w-[10rem] sm:max-w-xs">
      <ui-carousel class="w-full max-w-xs">
        <ui-carousel-content>
          ${Array.from({ length: count }).map((_, index) => html`
            <ui-carousel-item>
              <div data-slot="card" data-size="default" class=${cn(cardClass(), 'm-px')}>
                <div data-slot="card-content" class=${cn(cardContentClass(), 'flex aspect-square items-center justify-center p-6')}>
                  <span class="text-4xl font-semibold">${index + 1}</span>
                </div>
              </div>
            </ui-carousel-item>
          `)}
        </ui-carousel-content>
        <ui-carousel-previous></ui-carousel-previous>
        <ui-carousel-next></ui-carousel-next>
      </ui-carousel>
      <div class="py-2 text-center text-sm text-muted-foreground">
        Slide ${current} of ${count}
      </div>
    </div>
  `;
}
