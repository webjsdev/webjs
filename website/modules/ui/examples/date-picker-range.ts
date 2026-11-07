import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { CalendarIcon } from '#lib/ui/lucide.ts';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const label = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

// January 20 to February 9 of this year, as shadcn's demo starts.
export default function DatePickerRange() {
  const year = new Date().getFullYear();
  const from = new Date(Date.UTC(year, 0, 20));
  const to = new Date(Date.UTC(year, 0, 20 + 20));

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'mx-auto w-60')}>
      <label data-slot="field-label" for="date-picker-range" class=${fieldLabelClass()}>Date Picker Range</label>
      <button
        type="button"
        id="date-picker-range"
        popovertarget="date-picker-range-content"
        aria-haspopup="dialog"
        aria-expanded="false"
        data-slot="button"
        data-variant="outline"
        data-size="default"
        class=${cn(buttonClass({ variant: 'outline' }), 'justify-start px-2.5 font-normal')}
      >
        ${CalendarIcon()}
        ${[label(from), label(to)].join(' - ')}
      </button>
      <div id="date-picker-range-content" popover role="dialog" aria-label="Pick a date range" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto p-0')}>
        <ui-calendar mode="range" value=${`${iso(from)}/${iso(to)}`} month=${iso(from).slice(0, 7)} number-of-months="2"></ui-calendar>
      </div>
    </div>
  `;
}
