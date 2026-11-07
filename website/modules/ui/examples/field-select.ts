import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function FieldSelect() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'w-full max-w-xs')}>
      <label data-slot="field-label" for="field-select-department" class=${fieldLabelClass()}>Department</label>
      <ui-select placeholder="Choose department">
        <select id="field-select-department" class=${selectTriggerClass()}>
          <option value="" disabled selected hidden>Choose department</option>
          <option value="engineering">Engineering</option>
          <option value="design">Design</option>
          <option value="marketing">Marketing</option>
          <option value="sales">Sales</option>
          <option value="support">Customer Support</option>
          <option value="hr">Human Resources</option>
          <option value="finance">Finance</option>
          <option value="operations">Operations</option>
        </select>
      </ui-select>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Select your department or area of work.
      </p>
    </div>
  `;
}
