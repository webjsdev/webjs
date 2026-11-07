/**
 * A bar chart with negative values, a chart block ported from shadcn/ui's chart-bar-negative.
 *
 * Installed by `npx @webjsdev/ui add chart-bar-negative` at
 * `components/charts/chart-bar-negative.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartBarNegative()}`.
 *
 * shadcn colours each bar with a `<Cell>`; here each row carries its `fill`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { barChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', visitors: 186 },
  { month: 'February', visitors: 205 },
  { month: 'March', visitors: -207 },
  { month: 'April', visitors: 173 },
  { month: 'May', visitors: -209 },
  { month: 'June', visitors: 214 },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

export default function ChartBarNegative() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Bar Chart - Negative</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${barChart({
          config: chartConfig,
          // Positive months in one colour, negative ones in another.
          data: chartData.map((item) => ({ ...item, fill: item.visitors > 0 ? 'var(--chart-1)' : 'var(--chart-2)' })),
          title: 'Visitors by month, with the months that lost them',
          grid: { vertical: false },
          tooltip: { cursor: false, hideLabel: true, hideIndicator: true },
          bars: [{ dataKey: 'visitors', labels: [{ position: 'top', dataKey: 'month' }] }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-start gap-2 text-sm')}>
        <div class="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="leading-none text-muted-foreground">Showing total visitors for the last 6 months</div>
      </div>
    </div>
  `;
}
