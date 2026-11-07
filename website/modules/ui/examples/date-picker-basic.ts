import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';

export default function DatePickerBasic() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'mx-auto w-44')}>
      <label data-slot="field-label" for="date-picker-simple" class=${fieldLabelClass()}>Date</label>
      <button
        type="button"
        id="date-picker-simple"
        popovertarget="date-picker-simple-content"
        aria-haspopup="dialog"
        aria-expanded="false"
        data-slot="button"
        data-variant="outline"
        data-size="default"
        class=${cn(buttonClass({ variant: 'outline' }), 'justify-start font-normal')}
      >
        <span>Pick a date</span>
      </button>
      <div id="date-picker-simple-content" popover role="dialog" aria-label="Pick a date" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto p-0')}>
        <ui-calendar mode="single"></ui-calendar>
      </div>
    </div>
  `;
}
