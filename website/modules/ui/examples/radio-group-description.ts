import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

const options = [
  { value: 'default', id: 'desc-r1', label: 'Default', description: 'Standard spacing for most use cases.' },
  { value: 'comfortable', id: 'desc-r2', label: 'Comfortable', description: 'More space between elements.' },
  { value: 'compact', id: 'desc-r3', label: 'Compact', description: 'Minimal spacing for dense layouts.' },
];

export default function RadioGroupDescription() {
  const defaultValue = 'comfortable';

  return html`
    <div role="radiogroup" aria-label="Spacing" data-slot="radio-group" class=${cn(radioGroupClass(), 'w-fit')}>
      ${options.map((option) => html`
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <input type="radio" data-slot="radio" name="radio-group-description" value=${option.value} id=${option.id} ?checked=${option.value === defaultValue} class=${radioClass()}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <label data-slot="field-label" for=${option.id} class=${fieldLabelClass()}>${option.label}</label>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${option.description}</p>
          </div>
        </div>
      `)}
    </div>
  `;
}
