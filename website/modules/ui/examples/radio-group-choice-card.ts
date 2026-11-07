import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const plans = [
  { value: 'plus', id: 'plus-plan', title: 'Plus', description: 'For individuals and small teams.' },
  { value: 'pro', id: 'pro-plan', title: 'Pro', description: 'For growing businesses.' },
  { value: 'enterprise', id: 'enterprise-plan', title: 'Enterprise', description: 'For large teams and enterprises.' },
];

// The whole card is the <label>, so a click anywhere on it picks the radio.
export default function RadioGroupChoiceCard() {
  const defaultValue = 'plus';

  return html`
    <div role="radiogroup" aria-label="Plan" data-slot="radio-group" class=${cn(radioGroupClass(), 'max-w-sm')}>
      ${plans.map((plan) => html`
        <label data-slot="field-label" for=${plan.id} class=${fieldLabelClass()}>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <div data-slot="field-content" class=${fieldContentClass()}>
              <div data-slot="field-label" class=${fieldTitleClass()}>${plan.title}</div>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>${plan.description}</p>
            </div>
            <input type="radio" data-slot="radio" name="radio-group-choice-card" value=${plan.value} id=${plan.id} ?checked=${plan.value === defaultValue} class=${radioClass()}>
          </div>
        </label>
      `)}
    </div>
  `;
}
