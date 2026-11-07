import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';

export default function CheckboxDescription() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'mx-auto w-72')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input
          type="checkbox"
          data-slot="checkbox"
          id="terms-checkbox-desc"
          name="terms-checkbox-desc"
          checked
          class=${checkboxClass()}
        >
        <div data-slot="field-content" class=${fieldContentClass()}>
          <label data-slot="field-label" for="terms-checkbox-desc" class=${fieldLabelClass()}>
            Accept terms and conditions
          </label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            By clicking this checkbox, you agree to the terms and conditions.
          </p>
        </div>
      </div>
    </div>
  `;
}
