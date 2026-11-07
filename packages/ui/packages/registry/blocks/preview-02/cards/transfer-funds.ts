/**
 * The preview-02 Transfer Funds card: an amount, the accounts to move it
 * between, and a summary of the transfer. A fragment helper; the account
 * pickers are the kit's `<ui-select>` around native selects. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/transfer-funds.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * The `<form>` has no `action` yet. Bind a server action from a
 * `'use server'` file (`<form action=${transferFunds}>`) before you ship it.
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
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import {
  inputGroupAddonClass,
  inputGroupClass,
  inputGroupInputClass,
  inputGroupTextClass,
} from '../../../components/input-group.ts';
import { itemClass, itemContentClass } from '../../../components/item.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import { separatorClass } from '../../../components/separator.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/select.ts';

const XIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;

function accountSelect(id: string, name: string, value: string, options: { value: string; label: string }[]) {
  return html`<ui-select class="w-full">
    <select id=${id} name=${name} class=${cn(selectTriggerClass(), 'w-full')}>
      <optgroup>
        ${options.map((o) => html`<option value=${o.value} selected=${o.value === value}>${o.label}</option>`)}
      </optgroup>
    </select>
  </ui-select>`;
}

const separator = () => html`<div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>`;

export function transferFunds() {
  return html`
    <form data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Transfer Funds</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Move money between your connected accounts.</div>
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
            <label data-slot="field-label" for="transfer-amount" class=${fieldLabelClass()}>Amount to Transfer</label>
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <input data-slot="input-group-control" id="transfer-amount" name="amount" value="1,200.00" class=${inputGroupInputClass()}>
              <label data-slot="input-group-addon" data-align="inline-start" for="transfer-amount" class=${inputGroupAddonClass()}>
                <span class=${inputGroupTextClass()}>$</span>
              </label>
            </div>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="from-account" class=${fieldLabelClass()}>From Account</label>
            ${accountSelect('from-account', 'from', 'checking', [
              { value: 'checking', label: 'Main Checking (··8402), $12,450.00' },
              { value: 'business', label: 'Business (··7731), $8,920.00' },
            ])}
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="to-account" class=${fieldLabelClass()}>To Account</label>
            ${accountSelect('to-account', 'to', 'savings', [
              { value: 'savings', label: 'High Yield Savings (··1192), $42,100.00' },
              { value: 'investment', label: 'Investment (··3349), $18,200.00' },
            ])}
          </div>
          <div data-slot="item" data-variant="muted" data-size="default" class=${cn(itemClass({ variant: 'muted' }), 'flex-col items-stretch')}>
            <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-3')}>
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Estimated arrival</span>
                <span class="text-sm font-medium">Today, Apr 14</span>
              </div>
              ${separator()}
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted-foreground">Transaction fee</span>
                <span class="text-sm font-medium tabular-nums">$0.00</span>
              </div>
              ${separator()}
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Total amount</span>
                <span class="text-sm font-semibold tabular-nums">$1,200.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Confirm Transfer</button>
      </div>
    </form>
  `;
}
