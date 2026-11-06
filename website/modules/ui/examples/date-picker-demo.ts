import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function DatePickerDemo() {
  return html`
    <button type="button" popovertarget="date-picker-demo" aria-haspopup="dialog" aria-expanded="false" data-empty="true" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-[212px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground')}>
      <span>Pick a date</span>
      ${ChevronDownIcon()}
    </button>
    <div id="date-picker-demo" popover role="dialog" aria-label="Pick a date" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto p-0')}>
      <ui-calendar mode="single"></ui-calendar>
    </div>
  `;
}
