import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { ArrowRightIcon } from '#lib/ui/lucide.ts';

const CURRENCIES = [
  { value: '$', label: 'US Dollar' },
  { value: '€', label: 'Euro' },
  { value: '£', label: 'British Pound' },
];

export default function ButtonGroupSelect() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <ui-select position="popper">
          <select name="currency" aria-label="Currency" class=${cn(selectTriggerClass(), 'rounded-e-none font-mono')}>
            ${CURRENCIES.map((currency) => html`
              <option value=${currency.value} ?selected=${currency.value === '$'}>${currency.value} ${currency.label}</option>
            `)}
          </select>
        </ui-select>
        <input data-slot="input" type="text" placeholder="10.00" pattern="[0-9]*" aria-label="Amount" class=${inputClass()}>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Send" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
          ${ArrowRightIcon()}
        </button>
      </div>
    </div>
  `;
}
