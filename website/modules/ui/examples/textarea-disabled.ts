import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function TextareaDisabled() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" data-disabled="true" class=${fieldClass()}>
      <label data-slot="field-label" for="textarea-disabled" class=${fieldLabelClass()}>Message</label>
      <textarea data-slot="textarea" id="textarea-disabled" placeholder="Type your message here." disabled class=${textareaClass()}></textarea>
    </div>
  `;
}
