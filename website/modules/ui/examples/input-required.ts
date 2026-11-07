import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputRequired() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="input-required" class=${fieldLabelClass()}>
        Required Field <span class="text-destructive">*</span>
      </label>
      <input data-slot="input" id="input-required" placeholder="This field is required" required class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>This field must be filled out.</p>
    </div>
  `;
}
