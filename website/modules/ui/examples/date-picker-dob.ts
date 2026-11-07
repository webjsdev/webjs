import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';

export default function DatePickerDob() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'mx-auto w-44')}>
      <label data-slot="field-label" for="date" class=${fieldLabelClass()}>Date of birth</label>
      <button
        type="button"
        id="date"
        popovertarget="date-picker-dob-content"
        aria-haspopup="dialog"
        aria-expanded="false"
        data-slot="button"
        data-variant="outline"
        data-size="default"
        class=${cn(buttonClass({ variant: 'outline' }), 'justify-start font-normal')}
      >
        Select date
      </button>
      <div id="date-picker-dob-content" popover role="dialog" aria-label="Date of birth" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto overflow-hidden p-0')}>
        <ui-calendar mode="single" caption-layout="dropdown"></ui-calendar>
      </div>
    </div>
  `;
}
