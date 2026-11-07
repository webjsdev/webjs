import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

export default function SkeletonText() {
  return html`
    <div class="flex w-full max-w-xs flex-col gap-2" aria-hidden="true">
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-full')}></div>
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-full')}></div>
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-3/4')}></div>
    </div>
  `;
}
