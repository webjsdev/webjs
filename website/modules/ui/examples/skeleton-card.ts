import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardHeaderClass, cardContentClass } from '#modules/ui/components/card.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

export default function SkeletonCard() {
  return html`
    <div data-slot="card" data-size="default" aria-hidden="true" class=${cn(cardClass(), 'w-full max-w-xs')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-2/3')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-1/2')}></div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'aspect-video w-full')}></div>
      </div>
    </div>
  `;
}
