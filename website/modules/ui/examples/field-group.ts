import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldSetClass, fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
  fieldSeparatorClass,
} from '#modules/ui/components/field.ts';

export default function FieldGroupExample() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-xs')}>
      <fieldset data-slot="field-set" class=${fieldSetClass()}>
        <label data-slot="field-label" class=${fieldLabelClass()}>Responses</label>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Get notified when ChatGPT responds to requests that take time, like
          research or image generation.
        </p>
        <div data-slot="checkbox-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="checkbox" data-slot="checkbox" id="push" checked disabled class=${checkboxClass()}>
            <label data-slot="field-label" for="push" class=${cn(fieldLabelClass(), 'font-normal')}>
              Push notifications
            </label>
          </div>
        </div>
      </fieldset>
      <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
      <fieldset data-slot="field-set" class=${fieldSetClass()}>
        <label data-slot="field-label" class=${fieldLabelClass()}>Tasks</label>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Get notified when tasks you&apos;ve created have updates.
          <a href="#">Manage tasks</a>
        </p>
        <div data-slot="checkbox-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="checkbox" data-slot="checkbox" id="push-tasks" class=${checkboxClass()}>
            <label data-slot="field-label" for="push-tasks" class=${cn(fieldLabelClass(), 'font-normal')}>
              Push notifications
            </label>
          </div>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="checkbox" data-slot="checkbox" id="email-tasks" class=${checkboxClass()}>
            <label data-slot="field-label" for="email-tasks" class=${cn(fieldLabelClass(), 'font-normal')}>
              Email notifications
            </label>
          </div>
        </div>
      </fieldset>
    </div>
  `;
}
