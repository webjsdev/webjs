import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputDemo() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="input-demo-api-key" class=${fieldLabelClass()}>API Key</label>
      <input data-slot="input" id="input-demo-api-key" type="password" placeholder="sk-..." aria-describedby="input-demo-api-key-description" class=${inputClass()}>
      <p data-slot="field-description" id="input-demo-api-key-description" class=${fieldDescriptionClass()}>
        Your API key is encrypted and stored securely.
      </p>
    </div>
  `;
}
