import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

export default function CheckboxBasic() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'mx-auto w-56')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="terms-checkbox-basic" name="terms-checkbox-basic" class=${checkboxClass()}>
        <label data-slot="field-label" for="terms-checkbox-basic" class=${fieldLabelClass()}>
          Accept terms and conditions
        </label>
      </div>
    </div>
  `;
}
