/**
 * The preview-02 "Q2 Dividend Income" card: one muted item per holding, each
 * with a small quarterly bar chart and its payout. A fragment helper; the
 * charts are the kit's `<ui-chart>`, drawn by the server. Installed at
 * `components/preview-02/dividend-income.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { barChart, type ChartConfig } from '../../../components/chart.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemGroupClass,
  itemTitleClass,
} from '../../../components/item.ts';

const XIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;

const HOLDINGS = [
  { name: 'Vanguard VIG', shares: '450 Shares', amount: '$1,842.10', data: [380, 420, 390, 652] },
  { name: 'S&P 500 VOO', shares: '112 Shares', amount: '$928.40', data: [180, 210, 320, 218] },
  { name: 'Apple AAPL', shares: '85 Shares', amount: '$340.00', data: [60, 70, 120, 90] },
  { name: 'Realty Income', shares: '320 Shares', amount: '$1,139.50', data: [240, 260, 280, 360] },
];

const miniChartConfig: ChartConfig = {
  value: { label: 'Dividend', color: 'var(--chart-2)' },
};

export function dividendIncome() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Q2 Dividend Income</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Quarterly dividend payouts across your portfolio holdings.</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label="Dismiss" class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), 'bg-muted')}>${XIcon()}</button>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="list" data-slot="item-group" class=${itemGroupClass()}>
          ${HOLDINGS.map((holding) => html`
            <div role="listitem" data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${itemTitleClass()}>${holding.name}</div>
                <p data-slot="item-description" class=${itemDescriptionClass()}>${holding.shares}</p>
              </div>
              ${barChart({
                config: miniChartConfig,
                data: holding.data.map((value, i) => ({ q: `Q${i + 1}`, value })),
                title: `${holding.name} quarterly dividends`,
                class: 'hidden h-8 w-24 md:block',
                width: 96,
                height: 32,
                margin: { top: 0, right: 0, bottom: 0, left: 0 },
                tooltip: { cursor: false, hideLabel: true },
                bars: [{ dataKey: 'value', fill: 'var(--color-value)', radius: [3, 3, 0, 0] }],
              })}
              <span class="hidden text-sm font-semibold tabular-nums md:block">${holding.amount}</span>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
