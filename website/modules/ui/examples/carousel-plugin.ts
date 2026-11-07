import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

// The kit has no plugin system. Autoplay is a few lines in a component of
// your own that calls the carousel's scrollNext() on a timer (see the docs).
export default function CarouselPlugin() {
  return html`
    <ui-carousel loop class="w-full max-w-[10rem] sm:max-w-xs">
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
