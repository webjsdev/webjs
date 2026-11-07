/**
 * A bar chart with a custom label, a chart block ported from shadcn/ui's chart-bar-label-custom.
 *
 * Installed by `npx @webjsdev/ui add chart-bar-label-custom` at
 * `components/charts/chart-bar-label-custom.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartBarLabelCustom()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { barChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-2)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
  label: {
    color: 'var(--background)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

export default function ChartBarLabelCustom() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Bar Chart - Custom Label</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${barChart({
          config: chartConfig,
          data: chartData,
          title: 'Desktop visitors, January to June',
          layout: 'vertical',
          margin: { right: 16 },
          grid: { horizontal: false },
          yAxis: { dataKey: 'month', type: 'category', tickLine: false, tickMargin: 10, axisLine: false, tickFormatter: (value) => String(value).slice(0, 3), hide: true },
          xAxis: { dataKey: 'desktop', type: 'number', hide: true },
          tooltip: { cursor: false, indicator: 'line' },
          bars: [{
            dataKey: 'desktop',
            fill: 'var(--color-desktop)',
            radius: 4,
            labels: [
              { dataKey: 'month', position: 'insideLeft', offset: 8, class: 'fill-(--color-label)', fontSize: 12 },
              { dataKey: 'desktop', position: 'right', offset: 8, class: 'fill-foreground', fontSize: 12 },
            ],
          }],
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
