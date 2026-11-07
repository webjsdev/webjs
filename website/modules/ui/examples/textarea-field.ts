import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function TextareaField() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="textarea-message" class=${fieldLabelClass()}>Message</label>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>Enter your message below.</p>
      <textarea data-slot="textarea" id="textarea-message" placeholder="Type your message here." class=${textareaClass()}></textarea>
    </div>
  `;
}
