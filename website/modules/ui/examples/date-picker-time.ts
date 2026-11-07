import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

export default function DatePickerTime() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'mx-auto max-w-xs flex-row')}>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="date-picker-optional" class=${fieldLabelClass()}>Date</label>
        <button
          type="button"
          id="date-picker-optional"
          popovertarget="date-picker-time-content"
          aria-haspopup="dialog"
          aria-expanded="false"
          data-slot="button"
          data-variant="outline"
          data-size="default"
          class=${cn(buttonClass({ variant: 'outline' }), 'w-32 justify-between font-normal')}
        >
          Select date
          ${ChevronDownIcon()}
        </button>
        <div id="date-picker-time-content" popover role="dialog" aria-label="Select date" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto overflow-hidden p-0')}>
          <ui-calendar mode="single" caption-layout="dropdown"></ui-calendar>
        </div>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'w-32')}>
        <label data-slot="field-label" for="time-picker-optional" class=${fieldLabelClass()}>Time</label>
        <input
          data-slot="input"
          type="time"
          id="time-picker-optional"
          step="1"
          value="10:30:00"
          class=${cn(inputClass(), 'appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none')}
        >
      </div>
    </div>
  `;
}
