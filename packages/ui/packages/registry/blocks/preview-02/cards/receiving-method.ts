/**
 * The preview-02 Receiving Method card: the payout account holder, a choice
 * between bank transfer and PayPal, and the account number. A fragment
 * helper. Installed by `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/receiving-method.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${savePayoutSettings}>`) and enable the
 * submit button once the form is valid.
 */
import { html } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  fieldClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldLegendClass,
  fieldSetClass,
  fieldTitleClass,
} from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import { radioClass, radioGroupClass } from '../../../components/radio-group.ts';
import { cn } from '../../../lib/utils.ts';
import { XIcon } from '../../../lib/icons.ts';

const METHODS = [
  { value: 'bank', id: 'method-bank', title: 'Bank Transfer', description: 'SWIFT / IBAN', descriptionClass: '' },
  { value: 'paypal', id: 'method-paypal', title: 'PayPal', description: 'Instant Payout', descriptionClass: 'line-clamp-1' },
];

export function receivingMethod() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Payout Preferences</div>
        <div data-slot="card-title" class=${cardTitleClass()}>Receiving Method</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), 'bg-muted')}>
            ${XIcon()}
            <span class="sr-only">Close</span>
          </button>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="account-holder" class=${fieldLabelClass()}>Account Holder Name</label>
            <input data-slot="input" id="account-holder" name="account-holder" value="Synthetic Horizons Music LLC" class=${inputClass()}>
          </div>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="label" class=${fieldLegendClass({ variant: 'label' })}>Receiving Method</legend>
            <div role="radiogroup" aria-label="Receiving method" data-slot="radio-group" class=${cn(radioGroupClass(), 'grid grid-cols-1 items-start gap-3 md:grid-cols-2 style-sera:grid-cols-1')}>
              ${METHODS.map((m) => html`
                <label data-slot="field-label" for=${m.id} class=${fieldLabelClass()}>
                  <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'pb-2.5')}>
                    <input type="radio" data-slot="radio" name="method" value=${m.value} id=${m.id} ?checked=${m.value === 'bank'} class=${radioClass()}>
                    <div data-slot="field-content" class=${fieldContentClass()}>
                      <div data-slot="field-label" class=${fieldTitleClass()}>${m.title}</div>
                      <p data-slot="field-description" class=${cn(fieldDescriptionClass(), m.descriptionClass)}>${m.description}</p>
                    </div>
                  </div>
                </label>
              `)}
            </div>
          </fieldset>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="iban" class=${fieldLabelClass()}>IBAN / Account Number</label>
            <input data-slot="input" id="iban" name="iban" placeholder="DE89 3704 0044 ...." class=${inputClass()}>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" disabled class=${cn(buttonClass(), 'w-full')}>Save Payout Settings</button>
      </div>
    </form>
  `;
}
