import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputInvalid() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-invalid="true" class=${fieldClass()}>
      <label data-slot="field-label" for="input-invalid" class=${fieldLabelClass()}>Invalid Input</label>
      <input data-slot="input" id="input-invalid" placeholder="Error" aria-invalid="true" class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        This field contains validation errors.
      </p>
    </div>
  `;
}
