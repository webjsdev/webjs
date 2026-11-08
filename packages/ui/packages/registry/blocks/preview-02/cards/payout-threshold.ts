/**
 * The preview-02 "Payout Threshold" form: a currency select, a minimum
 * payout slider and notes. A fragment helper; the select and slider are the
 * kit's `<ui-select>` and `<ui-slider>`, each around its native control.
 * Installed at `components/preview-02/payout-threshold.ts`. Ported from
 * shadcn/ui's preview-02.
 *
 * The form has no action yet. Bind a server action from a `'use server'`
 * file (`<form action=${saveThreshold}>`) before you ship it. shadcn shows the
 * slider's value live from React state; the amount here is the server's
 * first value, so read the submitted `min_payout` in your action.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
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
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
} from '../../../components/field.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import { sliderClass } from '../../../components/slider.ts';
import { textareaClass } from '../../../components/textarea.ts';
import '../../../components/select.ts';
import '../../../components/slider.ts';
import { XIcon } from '../../../lib/icons.ts';

const CURRENCIES = [
  { value: 'usd', label: 'USD, United States Dollar' },
  { value: 'eur', label: 'EUR, Euro' },
  { value: 'gbp', label: 'GBP, British Pound' },
  { value: 'jpy', label: 'JPY, Japanese Yen' },
];

export function payoutThreshold() {
  const amount = 2500;
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Payout Threshold</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Set the minimum balance required before a payout is triggered.</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label="Dismiss" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), 'bg-muted')}>${XIcon()}</button>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="preferred-currency" class=${fieldLabelClass()}>Preferred Currency</label>
            <ui-select class="w-full">
              <select id="preferred-currency" name="currency" class=${cn(selectTriggerClass(), 'w-full')}>
                <optgroup>
                  ${CURRENCIES.map((c) => html`<option value=${c.value} ?selected=${c.value === 'usd'}>${c.label}</option>`)}
                </optgroup>
              </select>
            </ui-select>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <div class="flex items-baseline justify-between">
              <label data-slot="field-label" for="min-payout" class=${fieldLabelClass()}>Minimum Payout Amount</label>
              <span class="text-2xl font-semibold tabular-nums">$${amount.toFixed(2)}</span>
            </div>
            <ui-slider>
              <input type="range" id="min-payout" name="min_payout" min="50" max="10000" step="50" value=${amount} class=${sliderClass()}>
            </ui-slider>
            <div class="flex items-center justify-between">
              <p data-slot="field-description" class=${fieldDescriptionClass()}>$50 (MIN)</p>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>$10,000 (MAX)</p>
            </div>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="payout-notes" class=${fieldLabelClass()}>Notes</label>
            <textarea data-slot="textarea" id="payout-notes" name="notes" placeholder="Add any notes for this payout configuration..." class=${cn(textareaClass(), 'min-h-[100px]')}></textarea>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Save Threshold</button>
      </div>
    </form>
  `;
}
