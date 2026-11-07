import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldLabelClass,
  fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function FieldFieldset() {
  return html`
    <fieldset data-slot="field-set" class=${cn(fieldSetClass(), 'w-full max-w-sm')}>
      <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Address Information</legend>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>
        We need your address to deliver your order.
      </p>
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="street" class=${fieldLabelClass()}>Street Address</label>
          <input data-slot="input" id="street" type="text" placeholder="123 Main St" class=${inputClass()}>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="city" class=${fieldLabelClass()}>City</label>
            <input data-slot="input" id="city" type="text" placeholder="New York" class=${inputClass()}>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="zip" class=${fieldLabelClass()}>Postal Code</label>
            <input data-slot="input" id="zip" type="text" placeholder="90502" class=${inputClass()}>
          </div>
        </div>
      </div>
    </fieldset>
  `;
}
