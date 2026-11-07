/**
 * A stacked bar chart whose tooltip adds a total row, a chart block ported from shadcn/ui's chart-tooltip-advanced.
 *
 * Installed by `npx @webjsdev/ui add chart-tooltip-advanced` at
 * `components/charts/chart-tooltip-advanced.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartTooltipAdvanced()}`.
 */
import { html } from '@webjsdev/core';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { barChart, type ChartConfig } from '../../components/chart.ts';

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

export default function ChartTooltipAdvanced() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Tooltip - Advanced</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Tooltip with custom formatter and total.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${barChart({
          config: chartConfig,
          data: chartData,
          title: 'Running and swimming by day',
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
          tooltip: {
            hideLabel: true,
            class: 'w-[180px]',
            // Each row with its colour, name and kcal, and a total under the last.
            formatter: (value, name, item, index) => html`
              <div class="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)" style=${`--color-bg: var(--color-${name})`}></div>
              ${chartConfig[name as keyof typeof chartConfig]?.label || name}
              <div class="ml-auto flex items-baseline gap-0.5 font-mono font-medium text-foreground tabular-nums">
                ${value}
                <span class="font-normal text-muted-foreground">kcal</span>
              </div>
              ${index === 1
                ? html`<div class="mt-1.5 flex basis-full items-center border-t pt-1.5 text-xs font-medium text-foreground">
                    Total
                    <div class="ml-auto flex items-baseline gap-0.5 font-mono font-medium text-foreground tabular-nums">
                      ${Number(item.payload.running) + Number(item.payload.swimming)}
                      <span class="font-normal text-muted-foreground">kcal</span>
                    </div>
                  </div>`
                : ''}`,
            cursor: false,
            defaultIndex: 1,
          },
        })}
      </div>
    </div>
  `;
}
