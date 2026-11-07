/**
 * The preview-02 "Preferences" form: a default currency select and two
 * switches. A fragment helper; the select and switches are the kit's
 * `<ui-select>` and `<ui-switch>`, each a real form control. Installed at
 * `components/preview-02/preferences.ts`. Ported from shadcn/ui's preview-02.
 *
 * The form has no action yet. Bind a server action from a `'use server'`
 * file (`<form action=${savePreferences}>`) before you ship it, and render
 * each switch's `checked` from the user's saved settings.
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
  fieldContentClass,
  fieldDescriptionClass,
  fieldGroupClass,
  fieldLabelClass,
  fieldSeparatorClass,
} from '../../../components/field.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import '../../../components/select.ts';
import '../../../components/switch.ts';
import { XIcon } from '../../../lib/icons.ts';

const CURRENCIES = [
  { value: 'usd', label: 'USD, United States Dollar' },
  { value: 'eur', label: 'EUR, Euro' },
  { value: 'gbp', label: 'GBP, British Pound' },
  { value: 'jpy', label: 'JPY, Japanese Yen' },
];

const fieldSeparator = () => html`<div role="none" data-slot="field-separator" class=${cn(fieldSeparatorClass(), '-my-4 style-sera:hidden')}></div>`;

function toggle(id: string, name: string, label: string, description: string) {
  return html`<div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
    <div data-slot="field-content" class=${fieldContentClass()}>
      <label data-slot="field-label" for=${id} class=${fieldLabelClass()}>${label}</label>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>${description}</p>
    </div>
    <ui-switch input-id=${id} name=${name} checked></ui-switch>
  </div>`;
}

export function preferences() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Preferences</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Manage your account settings and notifications.</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label="Dismiss" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), 'bg-muted')}>${XIcon()}</button>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="default-currency" class=${fieldLabelClass()}>Default Currency</label>
            <ui-select class="w-full">
              <select id="default-currency" name="currency" class=${cn(selectTriggerClass(), 'w-full')}>
                <optgroup>
                  ${CURRENCIES.map((c) => html`<option value=${c.value} selected=${c.value === 'usd'}>${c.label}</option>`)}
                </optgroup>
              </select>
            </ui-select>
          </div>
          ${fieldSeparator()}
          ${toggle('public-statistics', 'public_statistics', 'Public Statistics', 'Allow others to see your total stream count and listening activity')}
          ${fieldSeparator()}
          ${toggle('email-notifications', 'email_notifications', 'Email Notifications', 'Monthly royalty reports and distribution updates')}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="reset" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Reset</button>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'ml-auto')}>Save Preferences</button>
      </div>
    </form>
  `;
}
