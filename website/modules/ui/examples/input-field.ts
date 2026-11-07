import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputField() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="input-field-username" class=${fieldLabelClass()}>Username</label>
      <input data-slot="input" id="input-field-username" type="text" placeholder="Enter your username" class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Choose a unique username for your account.
      </p>
    </div>
  `;
}
