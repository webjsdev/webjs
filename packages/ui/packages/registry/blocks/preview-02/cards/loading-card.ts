/**
 * The preview-02 loading card: a card's skeleton placeholder. A fragment
 * helper. Installed by `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/loading-card.ts`. Ported from shadcn/ui's preview-02.
 */
import { html } from '@webjsdev/core';
import { cardClass, cardContentClass, cardHeaderClass } from '../../../components/card.ts';
import { skeletonClass } from '../../../components/skeleton.ts';
import { cn } from '../../../lib/utils.ts';

const skeleton = (cls: string) => html`<div data-slot="skeleton" aria-hidden="true" class=${cn(skeletonClass(), cls)}></div>`;

export function loadingCard() {
  return html`
    <div data-slot="card" data-size="default" aria-busy="true" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        ${skeleton('h-5 w-32')}
        ${skeleton('h-4 w-48')}
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        ${skeleton('h-32 w-full rounded-lg')}
        <div class="flex flex-col gap-2">
          ${skeleton('h-4 w-full')}
          ${skeleton('h-4 w-3/4')}
          ${skeleton('h-4 w-1/2')}
        </div>
        <div class="flex gap-2">
          ${skeleton('h-9 flex-1 rounded-md')}
          ${skeleton('h-9 flex-1 rounded-md')}
        </div>
      </div>
    </div>
  `;
}
