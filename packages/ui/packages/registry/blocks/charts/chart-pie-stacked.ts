/**
 * A pie chart with stacked sections, a chart block ported from shadcn/ui's chart-pie-stacked.
 *
 * Installed by `npx @webjsdev/ui add chart-pie-stacked` at
 * `components/charts/chart-pie-stacked.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartPieStacked()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { pieChart, type ChartConfig } from '../../components/chart.ts';

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  desktop: {
    label: 'Desktop',
  },
  mobile: {
    label: 'Mobile',
  },
  january: {
    label: 'January',
    color: 'var(--chart-1)',
  },
  february: {
    label: 'February',
    color: 'var(--chart-2)',
  },
  march: {
    label: 'March',
    color: 'var(--chart-3)',
  },
  april: {
    label: 'April',
    color: 'var(--chart-4)',
  },
  may: {
    label: 'May',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

const desktopData = [
  { month: 'january', desktop: 186, fill: 'var(--color-january)' },
  { month: 'february', desktop: 305, fill: 'var(--color-february)' },
  { month: 'march', desktop: 237, fill: 'var(--color-march)' },
  { month: 'april', desktop: 173, fill: 'var(--color-april)' },
  { month: 'may', desktop: 209, fill: 'var(--color-may)' },
];

const mobileData = [
  { month: 'january', mobile: 80, fill: 'var(--color-january)' },
  { month: 'february', mobile: 200, fill: 'var(--color-february)' },
  { month: 'march', mobile: 120, fill: 'var(--color-march)' },
  { month: 'april', mobile: 190, fill: 'var(--color-april)' },
  { month: 'may', mobile: 130, fill: 'var(--color-may)' },
];

export default function ChartPieStacked() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Pie Chart - Stacked</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 pb-0')}>
        ${pieChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: desktopData,
          title: 'Desktop and mobile visitors by month',
          tooltip: {
            labelKey: 'visitors',
            nameKey: 'month',
            indicator: 'line',
            labelFormatter: (_, payload) => chartConfig[payload[0]?.dataKey as keyof typeof chartConfig]?.label,
          },
          pies: [
            { data: desktopData, dataKey: 'desktop', outerRadius: 60 },
            { data: mobileData, dataKey: 'mobile', innerRadius: 70, outerRadius: 90 },
          ],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2 text-sm')}>
        <div class="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="leading-none text-muted-foreground">Showing total visitors for the last 6 months</div>
      </div>
    </div>
  `;
}
