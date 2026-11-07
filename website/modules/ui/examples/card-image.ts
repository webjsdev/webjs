import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardFooterClass,
} from '#modules/ui/components/card.ts';

export default function CardImage() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'relative mx-auto w-full max-w-sm pt-0')}>
      <div class="absolute inset-0 z-30 aspect-video bg-black/35"></div>
      <img
        src="https://avatar.vercel.sh/shadcn1"
        alt="Event cover"
        class="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40"
      >
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-action" class=${cardActionClass()}>
          <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>Featured</span>
        </div>
        <div data-slot="card-title" class=${cardTitleClass()}>Design systems meetup</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          A practical talk on component APIs, accessibility, and shipping
          faster.
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>View Event</button>
      </div>
    </div>
  `;
}
