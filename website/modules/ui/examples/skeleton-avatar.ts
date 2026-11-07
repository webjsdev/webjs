import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

export default function SkeletonAvatar() {
  return html`
    <div class="flex w-fit items-center gap-4" aria-hidden="true">
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'size-10 shrink-0 rounded-full')}></div>
      <div class="grid gap-2">
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-[150px]')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-[100px]')}></div>
      </div>
    </div>
  `;
}
