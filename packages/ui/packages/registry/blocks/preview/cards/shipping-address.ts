/**
 * The preview block's shipping address card: street, apartment, city, state,
 * ZIP and country fields, and a save-as-default checkbox. A fragment helper,
 * rendered by the server, with the kit's `<ui-select>` around native selects.
 * Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/shipping-address.ts`. Ported from shadcn/ui's preview
 * block.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${saveAddress}>`) before you ship it.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { checkboxClass } from '../../../components/checkbox.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { inputClass } from '../../../components/input.ts';
import { selectTriggerClass } from '../../../components/select.ts';

const input = (id: string, name: string, label: string, placeholder: string) => html`
  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
    <label data-slot="field-label" for=${id} class=${fieldLabelClass()}>${label}</label>
    <input data-slot="input" id=${id} name=${name} placeholder=${placeholder} class=${inputClass()}>
  </div>
`;

const select = (id: string, name: string, label: string, options: Array<[string, string]>, selected: string) => html`
  <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
    <label data-slot="field-label" for=${id} class=${fieldLabelClass()}>${label}</label>
    <ui-select>
      <select id=${id} name=${name} class=${cn(selectTriggerClass(), 'w-full')}>
        ${options.map(([value, text]) => html`<option value=${value} ?selected=${value === selected}>${text}</option>`)}
      </select>
    </ui-select>
  </div>
`;

export function shippingAddress() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Shipping Address</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Where should we deliver?</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form id="shipping-address-form">
          <div data-slot="field-group" class=${fieldGroupClass()}>
            ${input('shipping-street', 'street', 'Street address', '123 Main Street')}
            ${input('shipping-apt', 'apartment', 'Apt / Suite', 'Apt 4B')}
            <div data-slot="field-group" class=${cn(fieldGroupClass(), 'grid grid-cols-2')}>
              ${input('shipping-city', 'city', 'City', 'San Francisco')}
              ${select('shipping-state', 'state', 'State', [['CA', 'California'], ['NY', 'New York'], ['TX', 'Texas']], 'CA')}
            </div>
            <div data-slot="field-group" class=${cn(fieldGroupClass(), 'grid grid-cols-2')}>
              ${input('shipping-zip', 'zip', 'ZIP Code', '94102')}
              ${select('shipping-country', 'country', 'Country', [['US', 'United States'], ['CA', 'Canada'], ['UK', 'United Kingdom']], 'US')}
            </div>
            <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
              <input type="checkbox" id="shipping-save" name="saveAsDefault" checked data-slot="checkbox" class=${checkboxClass()}>
              <label data-slot="field-label" for="shipping-save" class=${cn(fieldLabelClass(), 'font-normal')}>Save as default address</label>
            </div>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="reset" form="shipping-address-form" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Cancel</button>
        <button type="submit" form="shipping-address-form" data-slot="button" data-variant="default" data-size="sm" class=${cn(buttonClass({ size: 'sm' }), 'ml-auto')}>Save Address</button>
      </div>
    </div>
  `;
}
