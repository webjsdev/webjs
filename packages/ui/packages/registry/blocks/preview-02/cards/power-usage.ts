/**
 * The preview-02 Power Usage card: the day's usage as a bar chart, the
 * current draw and solar output, and the battery level. A fragment helper;
 * the chart is the kit's server-drawn `barChart`. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/power-usage.ts`.
 * Ported from shadcn/ui's preview-02, which squares the bars in its lyra and
 * sera styles; pass `{ rounded: false }` for that.
 */
import { html } from '@webjsdev/core';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { barChart, type ChartConfig } from '../../../components/chart.ts';
import { progressClass } from '../../../components/progress.ts';
import { separatorClass } from '../../../components/separator.ts';
import { cn } from '../../../lib/utils.ts';

const chartData = [
  { hour: '6a', usage: 1.2 },
  { hour: '8a', usage: 2.8 },
  { hour: '10a', usage: 3.1 },
  { hour: '12p', usage: 2.4 },
  { hour: '2p', usage: 3.4 },
  { hour: '4p', usage: 2.9 },
  { hour: '6p', usage: 3.8 },
  { hour: '8p', usage: 3.2 },
];

const chartConfig = {
  usage: { label: 'Usage (kW)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function powerUsage(opts: { rounded?: boolean } = {}) {
  const rounded = opts.rounded ?? true;
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Power Usage</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Whole Home</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        ${barChart({
          config: chartConfig,
          data: chartData,
          title: 'Power usage through the day, in kilowatts',
          class: 'aspect-auto h-[140px] w-full',
          width: 330,
          height: 140,
          margin: { left: 0, right: 0, top: 4, bottom: 0 },
          xAxis: { dataKey: 'hour', tickLine: false, tickMargin: 6, axisLine: false, class: 'text-xs' },
          tooltip: { cursor: false, hideLabel: true },
          bars: [{ dataKey: 'usage', fill: 'var(--color-usage)', radius: rounded ? [4, 4, 0, 0] : 0 }],
        })}
        <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-muted-foreground">Currently Using</span>
            <span class="text-lg font-semibold tabular-nums">3.4 kW</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-muted-foreground">Solar Gen</span>
            <span class="text-lg font-semibold text-chart-1 tabular-nums">+1.2 kW</span>
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-start gap-1')}>
        <span id="power-usage-battery" class="text-sm text-muted-foreground">Battery Level</span>
        <div class="flex w-full items-center gap-2">
          <progress data-slot="progress" value="85" max="100" aria-labelledby="power-usage-battery" class=${cn(progressClass(), 'flex-1')}></progress>
          <span class="text-sm font-medium tabular-nums">85%</span>
        </div>
      </div>
    </div>
  `;
}
