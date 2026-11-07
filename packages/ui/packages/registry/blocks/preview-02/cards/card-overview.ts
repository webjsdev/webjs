/**
 * The preview-02 card overview: the card balance, the next payment due and a
 * small bar chart of the year's activity. A fragment helper; the chart is the
 * kit's server-drawn `barChart`. Installed by `npx @webjsdev/ui add preview-02`
 * at `components/preview-02/card-overview.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import { cardClass, cardContentClass, cardDescriptionClass, cardTitleClass } from '../../../components/card.ts';
import { barChart, type ChartConfig } from '../../../components/chart.ts';
import { cn } from '../../../lib/utils.ts';

const activityData = [
  { month: 'Jan', amount: 40 },
  { month: 'Feb', amount: 55 },
  { month: 'Mar', amount: 35 },
  { month: 'Apr', amount: 60 },
  { month: 'May', amount: 45 },
  { month: 'Jun', amount: 50 },
  { month: 'Jul', amount: 65 },
  { month: 'Aug', amount: 40 },
  { month: 'Sep', amount: 55 },
  { month: 'Oct', amount: 70 },
  { month: 'Nov', amount: 45 },
  { month: 'Dec', amount: 80 },
];

const chartConfig = {
  amount: { label: 'Activity', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function cardOverview() {
  return html`
    <div class="grid grid-cols-2 gap-3">
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-content" class=${cardContentClass()}>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Card Balance</div>
          <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl tabular-nums')}>US$12.94</div>
          <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'tabular-nums')}>US$11,337.06 Available</div>
        </div>
      </div>
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'flex flex-col justify-between')}>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 flex-col justify-between')}>
          <div class="flex flex-col gap-1">
            <div data-slot="card-description" class=${cardDescriptionClass()}>Payment Due</div>
            <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl')}>1 Apr</div>
          </div>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-3 w-full')}>Pay Early</button>
        </div>
      </div>
      <div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-2')}>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-2')}>
          <div class="flex items-center justify-between">
            <div data-slot="card-description" class=${cardDescriptionClass()}>Yearly Activity</div>
            <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>+US$0.25 Daily Cash</span>
          </div>
          ${barChart({
            config: chartConfig,
            data: activityData,
            title: 'Card activity by month',
            class: 'aspect-auto h-20 w-full',
            width: 330,
            height: 80,
            margin: { top: 4, right: 0, bottom: 0, left: 0 },
            xAxis: { dataKey: 'month', tickLine: false, tickMargin: 4, axisLine: false, tickFormatter: (v) => String(v).slice(0, 1), class: 'text-[10px]' },
            tooltip: { cursor: false, hideLabel: true },
            bars: [{ dataKey: 'amount', fill: 'var(--color-amount)', radius: [3, 3, 0, 0] }],
          })}
        </div>
      </div>
    </div>
  `;
}
