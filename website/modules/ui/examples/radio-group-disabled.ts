import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

export default function RadioGroupDisabled() {
  return html`
    <div role="radiogroup" aria-label="Options" data-slot="radio-group" class=${cn(radioGroupClass(), 'w-fit')}>
      <div role="group" data-slot="field" data-orientation="horizontal" data-disabled="true" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="radio" data-slot="radio" name="radio-group-disabled" value="option1" id="disabled-1" disabled class=${radioClass()}>
        <label data-slot="field-label" for="disabled-1" class=${cn(fieldLabelClass(), 'font-normal')}>Disabled</label>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="radio" data-slot="radio" name="radio-group-disabled" value="option2" id="disabled-2" checked class=${radioClass()}>
        <label data-slot="field-label" for="disabled-2" class=${cn(fieldLabelClass(), 'font-normal')}>Option 2</label>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="radio" data-slot="radio" name="radio-group-disabled" value="option3" id="disabled-3" class=${radioClass()}>
        <label data-slot="field-label" for="disabled-3" class=${cn(fieldLabelClass(), 'font-normal')}>Option 3</label>
      </div>
    </div>
  `;
}
