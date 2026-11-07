import { html } from '@webjsdev/core';
import { TrendingUp } from '#lib/ui/lucide.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { areaChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A simple area chart';

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
  },
} satisfies ChartConfig;

export default function ChartAreaDefault() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Area Chart</div>
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
          tooltip: { cursor: false, indicator: 'line' },
          areas: [{ dataKey: 'desktop', type: 'natural', fill: 'var(--color-desktop)', fillOpacity: 0.4, stroke: 'var(--color-desktop)' }],
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
