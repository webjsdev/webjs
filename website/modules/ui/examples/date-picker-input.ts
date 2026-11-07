import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { CalendarIcon } from '#lib/ui/lucide.ts';

function formatDate(date: Date | undefined) {
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function DatePickerInput() {
  const date = new Date('2025-06-01');

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'mx-auto w-48')}>
      <label data-slot="field-label" for="date-required" class=${fieldLabelClass()}>Subscription Date</label>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input
          data-slot="input-group-control"
          id="date-required"
          value=${formatDate(date)}
          placeholder="June 01, 2025"
          class=${inputGroupInputClass()}
        >
        <div role="group" data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <button
            type="button"
            id="date-picker"
            popovertarget="date-picker-input-content"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-label="Select date"
            data-slot="button"
            data-variant="ghost"
            data-size="icon-xs"
            class=${inputGroupButtonClass({ size: 'icon-xs', variant: 'ghost' })}
          >
            ${CalendarIcon()}
            <span class="sr-only">Select date</span>
          </button>
          <div id="date-picker-input-content" popover role="dialog" aria-label="Select date" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'end', sideOffset: 8 }), 'w-auto overflow-hidden p-0')}>
            <ui-calendar mode="single" value="2025-06-01" month="2025-06"></ui-calendar>
          </div>
        </div>
      </div>
    </div>
  `;
}
