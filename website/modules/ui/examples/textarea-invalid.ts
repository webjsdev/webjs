import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function TextareaInvalid() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-invalid="true" class=${fieldClass()}>
      <label data-slot="field-label" for="textarea-invalid" class=${fieldLabelClass()}>Message</label>
      <textarea data-slot="textarea" id="textarea-invalid" placeholder="Type your message here." aria-invalid="true" class=${textareaClass()}></textarea>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>Please enter a valid message.</p>
    </div>
  `;
}
