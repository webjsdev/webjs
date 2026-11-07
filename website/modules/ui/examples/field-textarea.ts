import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function FieldTextarea() {
  return html`
    <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'w-full max-w-xs')}>
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="feedback" class=${fieldLabelClass()}>Feedback</label>
          <textarea data-slot="textarea" id="feedback" placeholder="Your feedback helps us improve..." rows="4" class=${textareaClass()}></textarea>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            Share your thoughts about our service.
          </p>
        </div>
      </div>
    </fieldset>
  `;
}
