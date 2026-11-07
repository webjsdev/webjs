/**
 * The preview-02 Stock Performance card: a ticker picker over a six-month
 * price chart. A fragment helper; the picker is the kit's `<ui-combobox>` and
 * the chart its server-drawn `areaChart`. Installed by
 * `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/stock-performance.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * It renders the chart for `ticker` (VOO by default). shadcn swaps the chart
 * in React state when another ticker is picked; in your app, put the picker
 * in a GET form (the combobox submits its value under `name`) and render the
 * chart for the ticker in the query string.
 */
import { html, svg } from '@webjsdev/core';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { areaChart, type ChartConfig } from '../../../components/chart.ts';
import { fieldClass, fieldGroupClass, fieldLabelClass } from '../../../components/field.ts';
import { separatorClass } from '../../../components/separator.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/combobox.ts';

const TICKERS = ['VOO', 'VIG', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

const CHART_DATA: Record<string, { month: string; price: number }[]> = {
  VOO: [
    { month: 'Jan', price: 412 },
    { month: 'Feb', price: 438 },
    { month: 'Mar', price: 395 },
    { month: 'Apr', price: 450 },
    { month: 'May', price: 420 },
    { month: 'Jun', price: 462 },
  ],
  AAPL: [
    { month: 'Jan', price: 185 },
    { month: 'Feb', price: 210 },
    { month: 'Mar', price: 172 },
    { month: 'Apr', price: 198 },
    { month: 'May', price: 178 },
    { month: 'Jun', price: 215 },
  ],
};

const DEFAULT_DATA = [
  { month: 'Jan', price: 100 },
  { month: 'Feb', price: 118 },
  { month: 'Mar', price: 95 },
  { month: 'Apr', price: 125 },
  { month: 'May', price: 108 },
  { month: 'Jun', price: 130 },
];

const chartConfig = {
  price: { label: 'Price', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function stockPerformance(opts: { ticker?: string } = {}) {
  const ticker = opts.ticker ?? 'VOO';
  const data = CHART_DATA[ticker] ?? DEFAULT_DATA;
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Stock Performance</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>6-month price history.</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="ticker-select" class=${fieldLabelClass()}>Ticker</label>
            <ui-combobox name="ticker" value=${ticker}>
              <ui-combobox-input input-id="ticker-select" placeholder="Search ticker..."></ui-combobox-input>
              <ui-combobox-content>
                <ui-combobox-empty>No tickers found.</ui-combobox-empty>
                <ui-combobox-list>
                  ${TICKERS.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
                </ui-combobox-list>
              </ui-combobox-content>
            </ui-combobox>
          </div>
        </div>
        <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'style-sera:hidden')}></div>
        ${areaChart({
          config: chartConfig,
          data,
          title: `${ticker} price over six months`,
          class: 'aspect-auto h-[200px] w-full',
          width: 330,
          height: 200,
          margin: { left: 0, right: 0, top: 8, bottom: 0 },
          defs: svg`<linearGradient id="stock-performance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-price)" stop-opacity="0.3"></stop>
            <stop offset="100%" stop-color="var(--color-price)" stop-opacity="0.05"></stop>
          </linearGradient>`,
          grid: { vertical: false, strokeDasharray: '3 3' },
          tooltip: { cursor: false, hideLabel: true },
          areas: [{ dataKey: 'price', type: 'monotone', stroke: 'var(--color-price)', strokeWidth: 2, fill: 'url(#stock-performance-fill)' }],
        })}
      </div>
    </div>
  `;
}
