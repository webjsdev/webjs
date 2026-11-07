/**
 * The preview-02 "Contribution History" card: six months of contributions as
 * a bar chart, two summary items and a report button. A fragment helper; the
 * chart is the kit's `<ui-chart>`, drawn by the server. Installed at
 * `components/preview-02/contribution-history.ts`. Ported from shadcn/ui's
 * preview-02.
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
import { barChart, type ChartConfig } from '../../../components/chart.ts';
import { itemClass, itemContentClass, itemDescriptionClass } from '../../../components/item.ts';

const chartData = [
  { month: 'Dec', amount: 800 },
  { month: 'Jan', amount: 1100 },
  { month: 'Feb', amount: 900 },
  { month: 'Mar', amount: 1300 },
  { month: 'Apr', amount: 750 },
  { month: 'May', amount: 1400 },
];

const chartConfig: ChartConfig = {
  amount: { label: 'Contribution', color: 'var(--chart-2)' },
};

function summary(label: string, value: string, note: string) {
  return html`<div data-slot="item" data-variant="muted" data-size="default" class=${cn(itemClass({ variant: 'muted' }), 'flex-col items-stretch')}>
    <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-1')}>
      <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'text-xs font-medium tracking-wider text-muted-foreground uppercase')}>${label}</p>
      <span class="font-heading text-lg font-semibold">${value}</span>
      <span class="text-sm text-muted-foreground">${note}</span>
    </div>
  </div>`;
}

export function contributionHistory() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Contribution History</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Last 6 months of activity</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${barChart({
          config: chartConfig,
          data: chartData,
          title: 'Monthly contributions, December to May',
          class: 'h-[200px] w-full',
          width: 330,
          height: 200,
          margin: { left: 0, right: 0, top: 8, bottom: 0 },
          xAxis: { dataKey: 'month', tickLine: false, tickMargin: 8, axisLine: false },
          yAxis: false,
          grid: false,
          maxBarSize: 40,
          tooltip: { cursor: false, hideLabel: true, class: 'min-w-40' },
          bars: [{ dataKey: 'amount', fill: 'var(--color-amount)', radius: [6, 6, 0, 0] }],
        })}
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          ${summary('Upcoming', 'May 25, 2024', '$1,000 scheduled')}
          ${summary('Auto-Save Plan', 'Accelerated', 'Recurring weekly')}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>View Full Report</button>
      </div>
    </div>
  `;
}
