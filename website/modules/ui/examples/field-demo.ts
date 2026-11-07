import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldLabelClass,
  fieldDescriptionClass, fieldSeparatorClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const years = ['2024', '2025', '2026', '2027', '2028', '2029'];

export default function FieldDemo() {
  return html`
    <div class="w-full max-w-md">
      <form>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Payment Method</legend>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>
              All transactions are secure and encrypted
            </p>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-card-name-43j" class=${fieldLabelClass()}>
                  Name on Card
                </label>
                <input data-slot="input" id="checkout-7j9-card-name-43j" placeholder="Evil Rabbit" required class=${inputClass()}>
              </div>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-card-number-uw1" class=${fieldLabelClass()}>
                  Card Number
                </label>
                <input data-slot="input" id="checkout-7j9-card-number-uw1" placeholder="1234 5678 9012 3456" required class=${inputClass()}>
                <p data-slot="field-description" class=${fieldDescriptionClass()}>
                  Enter your 16-digit card number
                </p>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-exp-month-ts6" class=${fieldLabelClass()}>
                    Month
                  </label>
                  <ui-select placeholder="MM">
                    <select id="checkout-exp-month-ts6" class=${selectTriggerClass()}>
                      <option value="" disabled selected hidden>MM</option>
                      ${months.map((m) => html`<option value=${m}>${m}</option>`)}
                    </select>
                  </ui-select>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-7j9-exp-year-f59" class=${fieldLabelClass()}>
                    Year
                  </label>
                  <ui-select placeholder="YYYY">
                    <select id="checkout-7j9-exp-year-f59" class=${selectTriggerClass()}>
                      <option value="" disabled selected hidden>YYYY</option>
                      ${years.map((y) => html`<option value=${y}>${y}</option>`)}
                    </select>
                  </ui-select>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-7j9-cvv" class=${fieldLabelClass()}>CVV</label>
                  <input data-slot="input" id="checkout-7j9-cvv" placeholder="123" required class=${inputClass()}>
                </div>
              </div>
            </div>
          </fieldset>
          <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Billing Address</legend>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>
              The billing address associated with your payment method
            </p>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                <input type="checkbox" data-slot="checkbox" id="checkout-7j9-same-as-shipping-wgm" checked class=${checkboxClass()}>
                <label data-slot="field-label" for="checkout-7j9-same-as-shipping-wgm" class=${cn(fieldLabelClass(), 'font-normal')}>
                  Same as shipping address
                </label>
              </div>
            </div>
          </fieldset>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-optional-comments" class=${fieldLabelClass()}>
                  Comments
                </label>
                <textarea data-slot="textarea" id="checkout-7j9-optional-comments" placeholder="Add any additional comments" class=${cn(textareaClass(), 'resize-none')}></textarea>
              </div>
            </div>
          </fieldset>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit</button>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}
