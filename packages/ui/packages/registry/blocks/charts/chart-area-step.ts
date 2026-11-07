/**
 * A step area chart, a chart block ported from shadcn/ui's chart-area-step.
 *
 * Installed by `npx @webjsdev/ui add chart-area-step` at
 * `components/charts/chart-area-step.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartAreaStep()}`.
 */
import { html, svg } from '@webjsdev/core';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { areaChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 73 },
  { month: 'May', desktop: 209 },
  { month: 'June', desktop: 214 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
    icon: () => Activity(),
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

// lucide's activity, the series icon in the config.
const Activity = () => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path></svg>`;

export default function ChartAreaStep() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Area Chart - Step</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6 months</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${areaChart({
          config: chartConfig,
          data: chartData,
          title: 'Desktop visitors, January to June',
          margin: { left: 12, right: 12 },
          grid: { vertical: false },
          xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 8, tickFormatter: (value) => String(value).slice(0, 3) },
          tooltip: { cursor: false, hideLabel: true },
          areas: [{ dataKey: 'desktop', type: 'step', fill: 'var(--color-desktop)', fillOpacity: 0.4, stroke: 'var(--color-desktop)' }],
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
