import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldErrorClass } from '#modules/ui/components/field.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function SelectInvalid() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-invalid="true" class=${cn(fieldClass(), 'w-full max-w-48')}>
      <label data-slot="field-label" for="select-invalid" class=${fieldLabelClass()}>Fruit</label>
      <ui-select placeholder="Select a fruit">
        <select id="select-invalid" name="fruit" aria-invalid="true" aria-describedby="select-invalid-error" class=${cn(selectTriggerClass(), 'w-full')}>
          <option value="" disabled selected hidden>Select a fruit</option>
          <optgroup label="Fruits">
            <option value="apple">Apple</option>
            <option value="banana">Banana</option>
            <option value="blueberry">Blueberry</option>
          </optgroup>
        </select>
      </ui-select>
      <div role="alert" data-slot="field-error" id="select-invalid-error" class=${fieldErrorClass()}>Please select a fruit.</div>
    </div>
  `;
}
