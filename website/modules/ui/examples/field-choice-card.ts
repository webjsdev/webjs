import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldContentClass,
  fieldLabelClass, fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const options = [
  { value: 'kubernetes', id: 'kubernetes-r2h', title: 'Kubernetes', description: 'Run GPU workloads on a K8s cluster.' },
  { value: 'vm', id: 'vm-z4k', title: 'Virtual Machine', description: 'Access a cluster to run GPU workloads.' },
];

// The whole card is the <label>, so a click anywhere on it picks the radio.
export default function FieldChoiceCard() {
  const defaultValue = 'kubernetes';

  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-xs')}>
      <fieldset data-slot="field-set" class=${fieldSetClass()}>
        <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>Compute Environment</legend>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Select the compute environment for your cluster.
        </p>
        <div role="radiogroup" data-slot="radio-group" class=${radioGroupClass()}>
          ${options.map((option) => html`
            <label data-slot="field-label" for=${option.id} class=${fieldLabelClass()}>
              <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                <div data-slot="field-content" class=${fieldContentClass()}>
                  <div data-slot="field-label" class=${fieldTitleClass()}>${option.title}</div>
                  <p data-slot="field-description" class=${fieldDescriptionClass()}>${option.description}</p>
                </div>
                <input type="radio" data-slot="radio" name="field-choice-card" value=${option.value} id=${option.id} ?checked=${option.value === defaultValue} class=${radioClass()}>
              </div>
            </label>
          `)}
        </div>
      </fieldset>
    </div>
  `;
}
