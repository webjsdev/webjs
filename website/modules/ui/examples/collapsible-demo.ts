import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  collapsibleClass, collapsibleTriggerClass, collapsibleContentClass,
} from '#modules/ui/components/collapsible.ts';
import { ChevronsUpDown } from '#lib/ui/lucide.ts';

// A native <details> hides everything but its <summary> while closed, so the
// always-visible status row rides inside the summary with the header.
export default function CollapsibleDemo() {
  return html`
    <details data-slot="collapsible" class=${cn(collapsibleClass(), 'flex w-[350px] flex-col gap-2')}>
      <summary data-slot="collapsible-trigger" class=${cn(collapsibleTriggerClass(), 'flex-col gap-2 font-normal')}>
        <span class="flex items-center justify-between gap-4 self-stretch px-4">
          <h4 class="text-sm font-semibold">Order #4189</h4>
          <span data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-8')}>
            ${ChevronsUpDown()}
            <span class="sr-only">Toggle details</span>
          </span>
        </span>
        <span class="flex items-center justify-between self-stretch rounded-md border px-4 py-2 text-sm">
          <span class="text-muted-foreground">Status</span>
          <span class="font-medium">Shipped</span>
        </span>
      </summary>
      <div data-slot="collapsible-content" class=${cn(collapsibleContentClass(), 'flex flex-col gap-2')}>
        <div class="rounded-md border px-4 py-2 text-sm">
          <p class="font-medium">Shipping address</p>
          <p class="text-muted-foreground">100 Market St, San Francisco</p>
        </div>
        <div class="rounded-md border px-4 py-2 text-sm">
          <p class="font-medium">Items</p>
          <p class="text-muted-foreground">2x Studio Headphones</p>
        </div>
      </div>
    </details>
  `;
}
