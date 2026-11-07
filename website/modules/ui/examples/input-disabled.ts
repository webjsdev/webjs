import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputDisabled() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-disabled="true" class=${fieldClass()}>
      <label data-slot="field-label" for="input-demo-disabled" class=${fieldLabelClass()}>Email</label>
      <input data-slot="input" id="input-demo-disabled" type="email" placeholder="Email" disabled class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>This field is currently disabled.</p>
    </div>
  `;
}
