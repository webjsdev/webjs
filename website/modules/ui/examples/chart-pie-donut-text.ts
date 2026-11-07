import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { TrendingUp } from '#lib/ui/lucide.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { pieChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A donut chart with text';

const chartData = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
  { browser: 'other', visitors: 190, fill: 'var(--color-other)' },
];

const chartConfig = {
  visitors: { label: 'Visitors' },
  chrome: { label: 'Chrome', color: 'var(--chart-1)' },
  safari: { label: 'Safari', color: 'var(--chart-2)' },
  firefox: { label: 'Firefox', color: 'var(--chart-3)' },
  edge: { label: 'Edge', color: 'var(--chart-4)' },
  other: { label: 'Other', color: 'var(--chart-5)' },
} satisfies ChartConfig;

export default function ChartPieDonutText() {
  const totalVisitors = chartData.reduce((acc, curr) => acc + curr.visitors, 0);

  return html`
    <div data-slot="card" class=${cn(cardClass(), 'flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Pie Chart - Donut with Text</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 pb-0')}>
        ${pieChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Visitors by browser',
          tooltip: { cursor: false, hideLabel: true },
          pies: [{
            dataKey: 'visitors',
            nameKey: 'browser',
            innerRadius: 60,
            strokeWidth: 5,
            center: ({ cx, cy }) => svg`
              <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="middle">
                <tspan x=${cx} y=${cy} class="fill-foreground text-3xl font-bold">${totalVisitors.toLocaleString('en-US')}</tspan>
                <tspan x=${cx} y=${cy + 24} class="fill-muted-foreground">Visitors</tspan>
              </text>`,
          }],
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
