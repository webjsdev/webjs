import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { TrendingUp } from '#lib/ui/lucide.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { radarChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A radar chart';

const chartData = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 273 },
  { month: 'May', desktop: 209 },
  { month: 'June', desktop: 214 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export default function ChartRadarDefault() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-4')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radar Chart</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6 months</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'pb-0')}>
        ${radarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Desktop visitors, January to June',
          tooltip: { cursor: false },
          angleAxis: { dataKey: 'month' },
          grid: {},
          radars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)', fillOpacity: 0.6 }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2 text-sm')}>
        <div class="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="flex items-center gap-2 leading-none text-muted-foreground">January - June 2024</div>
      </div>
    </div>
  `;
}
