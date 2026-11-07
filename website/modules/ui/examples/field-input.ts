import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function FieldInput() {
  return html`
    <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'w-full max-w-xs')}>
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="username" class=${fieldLabelClass()}>Username</label>
          <input data-slot="input" id="username" type="text" placeholder="Max Leiter" class=${inputClass()}>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            Choose a unique username for your account.
          </p>
        </div>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="password" class=${fieldLabelClass()}>Password</label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            Must be at least 8 characters long.
          </p>
          <input data-slot="input" id="password" type="password" placeholder="••••••••" class=${inputClass()}>
        </div>
      </div>
    </fieldset>
  `;
}
