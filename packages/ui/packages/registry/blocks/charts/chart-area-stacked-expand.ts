/**
 * A stacked area chart with expand stacking, a chart block ported from shadcn/ui's chart-area-stacked-expand.
 *
 * Installed by `npx @webjsdev/ui add chart-area-stacked-expand` at
 * `components/charts/chart-area-stacked-expand.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartAreaStackedExpand()}`.
 */
import { html, svg } from '@webjsdev/core';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { areaChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80, other: 45 },
  { month: 'February', desktop: 305, mobile: 200, other: 100 },
  { month: 'March', desktop: 237, mobile: 120, other: 150 },
  { month: 'April', desktop: 73, mobile: 190, other: 50 },
  { month: 'May', desktop: 209, mobile: 130, other: 100 },
  { month: 'June', desktop: 214, mobile: 140, other: 160 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
  other: {
    label: 'Other',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

export default function ChartAreaStackedExpand() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Area Chart - Stacked Expanded</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6months</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${areaChart({
          config: chartConfig,
          data: chartData,
          title: 'Each source\'s share of visitors, January to June',
          margin: { left: 12, right: 12, top: 12 },
          stackOffset: 'expand',
          grid: { vertical: false },
          xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 8, tickFormatter: (value) => String(value).slice(0, 3) },
          tooltip: { cursor: false, indicator: 'line' },
          areas: [
            { dataKey: 'other', type: 'natural', fill: 'var(--color-other)', fillOpacity: 0.1, stroke: 'var(--color-other)', stackId: 'a' },
            { dataKey: 'mobile', type: 'natural', fill: 'var(--color-mobile)', fillOpacity: 0.4, stroke: 'var(--color-mobile)', stackId: 'a' },
            { dataKey: 'desktop', type: 'natural', fill: 'var(--color-desktop)', fillOpacity: 0.4, stroke: 'var(--color-desktop)', stackId: 'a' },
          ],
        })}
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div class="flex w-full items-start gap-2 text-sm">
          <div class="grid gap-2">
            <div class="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
            </div>
            <div class="flex items-center gap-2 leading-none text-muted-foreground">January - June 2024</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
