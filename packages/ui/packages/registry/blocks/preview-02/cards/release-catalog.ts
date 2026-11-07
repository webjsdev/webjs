/**
 * The preview-02 holdings catalog card: a search field and an asset-type
 * filter over a list of holdings. A fragment helper. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/release-catalog.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * The search field and the filter show their initial state. Make the search a
 * GET form to your holdings route and filter the list on the server.
 */
import { html } from '@webjsdev/core';
import { badgeClass } from '../../../components/badge.ts';
import { cardClass, cardContentClass, cardHeaderClass } from '../../../components/card.ts';
import { inputGroupAddonClass, inputGroupClass, inputGroupInputClass } from '../../../components/input-group.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/toggle-group.ts';
import { SearchIcon } from '../../../lib/icons.ts';

const HOLDINGS = [
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'ETF', added: 'Jan 2021', shares: '112', value: '$48,230.40' },
  { ticker: 'VIG', name: 'Vanguard Dividend Appreciation', type: 'ETF', added: 'Mar 2022', shares: '450', value: '$26,033.79' },
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'Stock', added: 'Nov 2020', shares: '85', value: '$18,488.90' },
  { ticker: 'O', name: 'Realty Income Corp', type: 'REIT', added: 'Jun 2023', shares: '320', value: '$15,136.59' },
];

export function releaseCatalog() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div class="flex items-center justify-between gap-3">
          <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'max-w-sm')}>
            <input data-slot="input-group-control" id="release-catalog-search" placeholder="Search holdings or tickers..." aria-label="Search holdings or tickers" class=${inputGroupInputClass()}>
            <label data-slot="input-group-addon" data-align="inline-start" for="release-catalog-search" class=${inputGroupAddonClass()}>${SearchIcon()}</label>
          </div>
          <ui-toggle-group type="single" value="etfs" variant="outline" spacing="1" aria-label="Asset type">
            <ui-toggle-group-item value="stocks">Stocks</ui-toggle-group-item>
            <ui-toggle-group-item value="etfs">ETFs</ui-toggle-group-item>
            <ui-toggle-group-item value="reits">REITs</ui-toggle-group-item>
          </ui-toggle-group>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="list" data-slot="item-group" class=${itemGroupClass()}>
          ${HOLDINGS.map((holding) => html`
            <div role="listitem" data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
              <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
                <div class="flex size-12 items-center justify-center rounded-lg border text-sm font-semibold">${holding.ticker}</div>
              </div>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${itemTitleClass()}>${holding.name}</div>
                <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'text-xs tracking-wider uppercase')}>${holding.shares} Shares · ${holding.added}</p>
              </div>
              <div class="flex shrink-0 items-center gap-6">
                <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>${holding.type}</span>
                <div class="flex flex-col items-end gap-0.5">
                  <span class="text-xs tracking-wider text-muted-foreground uppercase">Value</span>
                  <span class="font-medium tabular-nums">${holding.value}</span>
                </div>
              </div>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
