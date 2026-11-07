/**
 * The preview block's visitors card: six months of desktop visitors as an
 * area chart, with the change since last month as a badge. A fragment helper;
 * the chart is the kit's `areaChart`, drawn by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/visitors.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { areaChart, type ChartConfig } from '../../../components/chart.ts';

const areaChartData = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 73 },
  { month: 'May', desktop: 209 },
  { month: 'June', desktop: 214 },
];

const areaChartConfig: ChartConfig = {
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
};

/** The change from the month before to the last month, in whole percent. */
function trend() {
  const latest = areaChartData[areaChartData.length - 1]?.desktop ?? 0;
  const previous = areaChartData[areaChartData.length - 2]?.desktop ?? latest;
  return previous === 0 ? 0 : Math.round(((latest - previous) / previous) * 100);
}

export function visitors() {
  const percent = trend();
  const variant = percent >= 0 ? 'secondary' : 'destructive';
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'pb-0')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Visitors</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Last 6 months</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <span data-slot="badge" data-variant=${variant} class=${badgeClass({ variant })}>${percent > 0 ? '+' : ''}${percent}% vs last month</span>
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-0')}>
        ${areaChart({
          config: areaChartConfig,
          data: areaChartData,
          class: 'h-48 w-full',
          title: 'Desktop visitors by month, January to June',
          width: 384,
          height: 192,
          margin: { left: 0, right: 0, top: 6, bottom: 0 },
          xAxis: { dataKey: 'month', hide: true, tickLine: false, axisLine: false, tickMargin: 6, tickFormatter: (value) => String(value).slice(0, 3) },
          tooltip: { cursor: false, indicator: 'line' },
          areas: [
            { dataKey: 'desktop', type: 'natural', fill: 'var(--color-desktop)', fillOpacity: 0.15, stroke: 'var(--color-desktop)', strokeWidth: 2 },
          ],
        })}
      </div>
    </div>
  `;
}
