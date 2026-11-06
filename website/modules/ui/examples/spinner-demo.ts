import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  itemClass, itemMediaClass, itemContentClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function SpinnerDemo() {
  return html`
    <div class="flex w-full max-w-xs flex-col gap-4 [--radius:1rem]">
      <div data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          ${spinner()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${cn(itemTitleClass(), 'line-clamp-1')}>Processing payment...</div>
        </div>
        <div data-slot="item-content" class=${cn(itemContentClass(), 'flex-none justify-end')}>
          <span class="text-sm tabular-nums">$100.00</span>
        </div>
      </div>
    </div>
  `;
}
