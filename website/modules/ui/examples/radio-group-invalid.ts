import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldLegendClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const options = [
  { value: 'email', id: 'invalid-email', label: 'Email only' },
  { value: 'sms', id: 'invalid-sms', label: 'SMS only' },
  { value: 'both', id: 'invalid-both', label: 'Both Email & SMS' },
];

export default function RadioGroupInvalid() {
  const defaultValue = 'email';

  return html`
    <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'w-full max-w-xs')}>
      <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>Notification Preferences</legend>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Choose how you want to receive notifications.
      </p>
      <div role="radiogroup" data-slot="radio-group" class=${radioGroupClass()}>
        ${options.map((option) => html`
          <div role="group" data-slot="field" data-orientation="horizontal" data-invalid="true" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="radio" data-slot="radio" name="radio-group-invalid" value=${option.value} id=${option.id} aria-invalid="true" ?checked=${option.value === defaultValue} class=${radioClass()}>
            <label data-slot="field-label" for=${option.id} class=${cn(fieldLabelClass(), 'font-normal')}>
              ${option.label}
            </label>
          </div>
        `)}
      </div>
    </fieldset>
  `;
}
