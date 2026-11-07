import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldLegendClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const plans = [
  { value: 'monthly', id: 'plan-monthly', label: 'Monthly ($9.99/month)' },
  { value: 'yearly', id: 'plan-yearly', label: 'Yearly ($99.99/year)' },
  { value: 'lifetime', id: 'plan-lifetime', label: 'Lifetime ($299.99)' },
];

export default function FieldRadio() {
  const defaultValue = 'monthly';

  return html`
    <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'w-full max-w-xs')}>
      <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>Subscription Plan</legend>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        Yearly and lifetime plans offer significant savings.
      </p>
      <div role="radiogroup" data-slot="radio-group" class=${radioGroupClass()}>
        ${plans.map((plan) => html`
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <input type="radio" data-slot="radio" name="field-radio-plan" value=${plan.value} id=${plan.id} ?checked=${plan.value === defaultValue} class=${radioClass()}>
            <label data-slot="field-label" for=${plan.id} class=${cn(fieldLabelClass(), 'font-normal')}>
              ${plan.label}
            </label>
          </div>
        `)}
      </div>
    </fieldset>
  `;
}
