import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { TrendingUp } from '#lib/ui/lucide.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { radialBarChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A radial chart';

const chartData = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 187, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
  { browser: 'other', visitors: 90, fill: 'var(--color-other)' },
];

const chartConfig = {
  visitors: { label: 'Visitors' },
  chrome: { label: 'Chrome', color: 'var(--chart-1)' },
  safari: { label: 'Safari', color: 'var(--chart-2)' },
  firefox: { label: 'Firefox', color: 'var(--chart-3)' },
  edge: { label: 'Edge', color: 'var(--chart-4)' },
  other: { label: 'Other', color: 'var(--chart-5)' },
} satisfies ChartConfig;

export default function ChartRadialSimple() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radial Chart</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 pb-0')}>
        ${radialBarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Visitors by browser',
          innerRadius: 30,
          outerRadius: 110,
          tooltip: { cursor: false, hideLabel: true, nameKey: 'browser' },
          bars: [{ dataKey: 'visitors', background: true }],
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
