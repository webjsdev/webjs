/**
 * The preview block's traffic card: desktop and mobile visitors by month as a
 * bar chart with a legend, the two totals and their mix delta, and a report
 * button. A fragment helper, rendered by the server, with the kit's chart
 * (plain SVG; `<ui-chart>` adds the tooltip). Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/bar-chart-card.ts`.
 * Ported from shadcn/ui's preview block.
 *
 * shadcn squares the bars off under the lyra and sera styles. Pass
 * `rounded: false` for those.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { barChart, type ChartConfig } from '../../../components/chart.ts';

const barChartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const barChartConfig: ChartConfig = {
  desktop: { label: 'Desktop', color: 'var(--chart-1)' },
  mobile: { label: 'Mobile', color: 'var(--chart-2)' },
};

export function barChartCard(opts: { rounded?: boolean } = {}) {
  const radius = opts.rounded === false ? 0 : [6, 6, 0, 0];
  const desktopTotal = barChartData.reduce((sum, item) => sum + item.desktop, 0);
  const mobileTotal = barChartData.reduce((sum, item) => sum + item.mobile, 0);
  const desktopDelta = Math.round(((desktopTotal - mobileTotal) / mobileTotal) * 100);
  const stat = (label: string, value: string) => html`
    <div class="px-2 text-center">
      <div class="text-[0.65rem] text-muted-foreground uppercase">${label}</div>
      <div class="text-sm font-medium tabular-nums">${value}</div>
    </div>
  `;
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-lg')}>Traffic channels</div>
        <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'line-clamp-2 text-sm leading-snug')}>
          Monthly desktop and mobile traffic for the last six months. Compare
          volume and mix across platforms and devices at a glance.
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4 pt-0')}>
        ${barChart({
          config: barChartConfig,
          data: barChartData,
          // The legend overflows the plot a little, as Recharts' HTML legend does.
          class: 'max-h-[180px] w-full [&_.ui-chart-legend-wrapper]:overflow-visible [&_.ui-chart-surface]:overflow-visible',
          title: 'Desktop and mobile visitors by month',
          margin: { left: 0, right: 0, top: 8, bottom: 0 },
          grid: { vertical: false, strokeDasharray: '3 3' },
          xAxis: { dataKey: 'month', tickLine: false, tickMargin: 8, axisLine: false, tickFormatter: (value) => String(value).slice(0, 3) },
          tooltip: { cursor: false, indicator: 'dashed' },
          legend: {},
          bars: [
            { dataKey: 'desktop', fill: 'var(--color-desktop)', radius },
            { dataKey: 'mobile', fill: 'var(--color-mobile)', radius },
          ],
        })}
        <div class="grid w-full grid-cols-3 divide-x divide-border/60">
          ${stat('Desktop', desktopTotal.toLocaleString('en-US'))}
          ${stat('Mobile', mobileTotal.toLocaleString('en-US'))}
          ${stat('Mix Delta', `${desktopDelta > 0 ? '+' : ''}${desktopDelta}%`)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>View report</button>
      </div>
    </div>
  `;
}
