import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass,
  fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function CheckboxDemo() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'max-w-sm')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="terms-checkbox" name="terms-checkbox" class=${checkboxClass()}>
        <label data-slot="label" for="terms-checkbox" class=${labelClass()}>Accept terms and conditions</label>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="terms-checkbox-2" name="terms-checkbox-2" checked class=${checkboxClass()}>
        <div data-slot="field-content" class=${fieldContentClass()}>
          <label data-slot="field-label" for="terms-checkbox-2" class=${fieldLabelClass()}>
            Accept terms and conditions
          </label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            By clicking this checkbox, you agree to the terms.
          </p>
        </div>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" data-disabled="true" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="toggle-checkbox" name="toggle-checkbox" disabled class=${checkboxClass()}>
        <label data-slot="field-label" for="toggle-checkbox" class=${fieldLabelClass()}>Enable notifications</label>
      </div>
      <label data-slot="field-label" class=${fieldLabelClass()}>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <input type="checkbox" data-slot="checkbox" id="toggle-checkbox-2" name="toggle-checkbox-2" class=${checkboxClass()}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <div data-slot="field-label" class=${fieldTitleClass()}>Enable notifications</div>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>
              You can enable or disable notifications at any time.
            </p>
          </div>
        </div>
      </label>
    </div>
  `;
}
