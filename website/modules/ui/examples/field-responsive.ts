import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldContentClass,
  fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function FieldResponsive() {
  return html`
    <div class="w-full max-w-lg">
      <form>
        <fieldset data-slot="field-set" class=${fieldSetClass()}>
          <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Profile</legend>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>Fill in your profile information.</p>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="responsive" class=${fieldClass({ orientation: 'responsive' })}>
              <div data-slot="field-content" class=${fieldContentClass()}>
                <label data-slot="field-label" for="name" class=${fieldLabelClass()}>Name</label>
                <p data-slot="field-description" class=${fieldDescriptionClass()}>
                  Provide your full name for identification
                </p>
              </div>
              <input data-slot="input" id="name" placeholder="Evil Rabbit" required class=${inputClass()}>
            </div>
            <div role="group" data-slot="field" data-orientation="responsive" class=${fieldClass({ orientation: 'responsive' })}>
              <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
                Cancel
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  `;
}
