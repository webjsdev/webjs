import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

export default function SkeletonTable() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-2" aria-hidden="true">
      ${Array.from({ length: 5 }).map(() => html`
        <div class="flex gap-4">
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 flex-1')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24')}></div>
          <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-20')}></div>
        </div>
      `)}
    </div>
  `;
}
