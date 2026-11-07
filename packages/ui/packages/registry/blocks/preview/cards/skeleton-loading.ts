/**
 * The preview block's skeleton card: an avatar, text lines and two buttons as
 * loading placeholders. A fragment helper, rendered by the server. Installed
 * by `npx @webjsdev/ui add preview` at `components/preview/skeleton-loading.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass, cardContentClass } from '../../../components/card.ts';
import { skeletonClass } from '../../../components/skeleton.ts';

const bone = (cls: string) => html`<div data-slot="skeleton" aria-hidden="true" class=${cn(skeletonClass(), cls)}></div>`;

export function skeletonLoading() {
  return html`
    <div data-slot="card" data-size="default" aria-busy="true" class=${cardClass()}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex items-center gap-3">
          ${bone('size-10 rounded-full')}
          <div class="flex flex-1 flex-col gap-2">
            ${bone('h-4 w-3/4')}
            ${bone('h-3 w-1/2')}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          ${bone('h-3 w-full')}
          ${bone('h-3 w-full')}
          ${bone('h-3 w-4/5')}
        </div>
        <div class="flex gap-2">
          ${bone('h-8 w-20')}
          ${bone('h-8 w-20')}
        </div>
      </div>
    </div>
  `;
}
