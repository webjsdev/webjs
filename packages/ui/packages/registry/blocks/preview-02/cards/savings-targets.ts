/**
 * The preview-02 savings pair: a "Savings Targets" card with two progress
 * goals beside a "Buy Investment" order form. A fragment helper. Installed at
 * `components/preview-02/savings-targets.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The order form has no action yet. Bind a server action from a
 * `'use server'` file (`<form action=${placeOrder}>`) before you ship it.
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
import {
  inputGroupAddonClass,
  inputGroupClass,
  inputGroupInputClass,
  inputGroupTextClass,
} from '../../../components/input-group.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemFooterClass,
  itemGroupClass,
} from '../../../components/item.ts';
import {
  nativeSelectClass,
  nativeSelectIconClass,
  nativeSelectOptionClass,
  nativeSelectWrapperClass,
} from '../../../components/native-select.ts';
import { progressClass } from '../../../components/progress.ts';
import { ChevronDownIcon } from '../../../lib/icons.ts';

function target(label: string, amount: string, pct: number, saved: string) {
  return html`<div role="listitem" data-slot="item" data-variant="muted" data-size="default" class=${cn(itemClass({ variant: 'muted' }), 'flex-col items-stretch')}>
    <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-3')}>
      <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'font-heading text-xs font-medium tracking-wider text-muted-foreground uppercase')}>${label}</p>
      <span class="text-3xl font-semibold tabular-nums">${amount}</span>
      <progress data-slot="progress" value=${pct} max="100" aria-label=${`${label} savings progress`} class=${progressClass()}></progress>
    </div>
    <div data-slot="item-footer" class=${itemFooterClass()}>
      <span class="text-sm text-muted-foreground">${pct}% achieved</span>
      <span class="text-sm font-medium tabular-nums">${saved}</span>
    </div>
  </div>`;
}

function stat(label: string, value: string) {
  return html`<div class="flex items-center justify-between">
    <span class="text-sm text-muted-foreground">${label}</span>
    <span class="text-sm font-semibold tabular-nums">${value}</span>
  </div>`;
}

export function savingsTargets() {
  return html`
    <div class="grid grid-cols-2 gap-(--gap)">
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Savings Targets</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Active milestones for 2024</div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>New Goal</button>
          </div>
        </div>
        <div data-slot="card-content" class=${cardContentClass()}>
          <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'gap-3')}>
            ${target('Retirement', '$420,000', 65, '$273,000')}
            ${target('Real Estate', '$85,000', 32, '$27,200')}
          </div>
        </div>
        <div data-slot="card-footer" class=${cardFooterClass()}>
          <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'text-center')}>You have not met your targets for this year.</div>
        </div>
      </div>
      <form data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Buy Investment</div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 flex-col gap-3')}>
          <div data-slot="field-group" class=${cn(fieldGroupClass(), 'flex-1')}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="invest-amount" class=${fieldLabelClass()}>Amount to Invest</label>
              <div data-slot="input-group" role="group" class=${inputGroupClass()}>
                <div role="group" data-slot="input-group-addon" data-align="inline-start" class=${inputGroupAddonClass()}>
                  <span class=${inputGroupTextClass()}>$</span>
                </div>
                <input data-slot="input-group-control" id="invest-amount" name="amount" value="1,000.00" class=${inputGroupInputClass()}>
              </div>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="field-label" for="invest-type" class=${fieldLabelClass()}>Order Type</label>
              <div data-slot="native-select-wrapper" data-size="default" class=${nativeSelectWrapperClass()}>
                <select data-slot="native-select" data-size="default" id="invest-type" name="type" class=${nativeSelectClass()}>
                  <option value="market" selected class=${nativeSelectOptionClass()}>Market Order</option>
                  <option value="limit" class=${nativeSelectOptionClass()}>Limit Order</option>
                  <option value="stop" class=${nativeSelectOptionClass()}>Stop Order</option>
                </select>
                ${ChevronDownIcon(nativeSelectIconClass())}
              </div>
              <p data-slot="field-description" class=${fieldDescriptionClass()}>Market orders execute at the current price.</p>
            </div>
            <div class="flex flex-col gap-2">
              ${stat('Estimated Shares', '1.95')}
              ${stat('Buying Power', '$12,450.00')}
            </div>
          </div>
        </div>
        <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-3')}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Review Order</button>
          <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'text-center')}>Trades are typically executed within minutes during market hours.</div>
        </div>
      </form>
    </div>
  `;
}
