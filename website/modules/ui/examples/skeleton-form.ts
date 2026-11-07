import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

export default function SkeletonForm() {
  return html`
    <div class="flex w-full max-w-xs flex-col gap-7" aria-hidden="true">
      <div class="flex flex-col gap-3">
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-20')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-8 w-full')}></div>
      </div>
      <div class="flex flex-col gap-3">
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-24')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-8 w-full')}></div>
      </div>
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-8 w-24')}></div>
    </div>
  `;
}
