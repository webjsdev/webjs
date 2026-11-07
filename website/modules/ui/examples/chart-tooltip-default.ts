import { html } from '@webjsdev/core';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { barChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A stacked bar chart with a legend';

const chartData = [
  { date: '2024-07-15', running: 450, swimming: 300 },
  { date: '2024-07-16', running: 380, swimming: 420 },
  { date: '2024-07-17', running: 520, swimming: 120 },
  { date: '2024-07-18', running: 140, swimming: 550 },
  { date: '2024-07-19', running: 600, swimming: 350 },
  { date: '2024-07-20', running: 480, swimming: 400 },
];

const chartConfig = {
  running: {
    label: 'Running',
    color: 'var(--chart-1)',
  },
  swimming: {
    label: 'Swimming',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export default function ChartTooltipDefault() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Tooltip - Default</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Default tooltip with ChartTooltipContent.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${barChart({
          config: chartConfig,
          data: chartData,
          title: 'Running and swimming minutes by day',
          xAxis: {
            dataKey: 'date',
            tickLine: false,
            tickMargin: 10,
            axisLine: false,
            tickFormatter: (value) => new Date(String(value)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
          },
          bars: [
            { dataKey: 'running', stackId: 'a', fill: 'var(--color-running)', radius: [0, 0, 4, 4] },
            { dataKey: 'swimming', stackId: 'a', fill: 'var(--color-swimming)', radius: [4, 4, 0, 0] },
          ],
          tooltip: { cursor: false, defaultIndex: 1 },
        })}
      </div>
    </div>
  `;
}
