import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

export default function CheckboxDisabled() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'mx-auto w-56')}>
      <div role="group" data-slot="field" data-orientation="horizontal" data-disabled="true" class=${fieldClass({ orientation: 'horizontal' })}>
        <input
          type="checkbox"
          data-slot="checkbox"
          id="toggle-checkbox-disabled"
          name="toggle-checkbox-disabled"
          disabled
          class=${checkboxClass()}
        >
        <label data-slot="field-label" for="toggle-checkbox-disabled" class=${fieldLabelClass()}>
          Enable notifications
        </label>
      </div>
    </div>
  `;
}
