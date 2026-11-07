import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

export default function InputForm() {
  return html`
    <form class="w-full max-w-sm">
      <div data-slot="field-group" class=${fieldGroupClass()}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="form-name" class=${fieldLabelClass()}>Name</label>
          <input data-slot="input" id="form-name" type="text" placeholder="Evil Rabbit" required class=${inputClass()}>
        </div>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="form-email" class=${fieldLabelClass()}>Email</label>
          <input data-slot="input" id="form-email" type="email" placeholder="john@example.com" class=${inputClass()}>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>
            We&apos;ll never share your email with anyone.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="form-phone" class=${fieldLabelClass()}>Phone</label>
            <input data-slot="input" id="form-phone" type="tel" placeholder="+1 (555) 123-4567" class=${inputClass()}>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="form-country" class=${fieldLabelClass()}>Country</label>
            <ui-select>
              <select id="form-country" class=${selectTriggerClass()}>
                <option value="us" selected>United States</option>
                <option value="uk">United Kingdom</option>
                <option value="ca">Canada</option>
              </select>
            </ui-select>
          </div>
        </div>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="form-address" class=${fieldLabelClass()}>Address</label>
          <input data-slot="input" id="form-address" type="text" placeholder="123 Main St" class=${inputClass()}>
        </div>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
            Cancel
          </button>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
        </div>
      </div>
    </form>
  `;
}
