import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputFile() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="picture" class=${fieldLabelClass()}>Picture</label>
      <input data-slot="input" id="picture" type="file" class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>Select a picture to upload.</p>
    </div>
  `;
}
