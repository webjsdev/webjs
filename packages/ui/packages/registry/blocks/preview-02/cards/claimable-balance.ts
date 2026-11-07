/**
 * The preview-02 "Claimable Balance" card: the balance, a status badge and a
 * breakdown in a muted item. A fragment helper. Installed at
 * `components/preview-02/claimable-balance.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { itemClass, itemContentClass } from '../../../components/item.ts';
import { separatorClass } from '../../../components/separator.ts';

function row(label: string, value: string, strong = false) {
  return html`<div class="flex items-center justify-between">
    <span class="text-sm text-muted-foreground">${label}</span>
    <span class=${strong ? 'text-sm font-semibold tabular-nums' : 'text-sm font-medium tabular-nums'}>${value}</span>
  </div>`;
}

export function claimableBalance() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Claimable Balance</div>
        <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-5xl tabular-nums')}>$0.00</div>
        <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>
          <span class="size-2 rounded-full bg-yellow-500"></span>
          Pending Setup
        </span>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 flex-col justify-end')}>
        <div data-slot="item" data-variant="muted" data-size="default" class=${cn(itemClass({ variant: 'muted' }), 'flex-col items-stretch')}>
          <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-3')}>
            ${row('Net Royalties', '$0.00')}
            ${row('Processing Fee', '-$0.00')}
            <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
            ${row('Total Ready to Claim', '$0.00 USD', true)}
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Once your bank is connected, balances over $10.00 are automatically eligible for monthly distribution on the 15th of each month.</div>
      </div>
    </div>
  `;
}
