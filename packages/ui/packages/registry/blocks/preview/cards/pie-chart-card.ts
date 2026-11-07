/**
 * The preview block's browser share card: visitors by browser as a donut
 * with the total in its centre and a legend, then the leading browser's
 * share as a progress bar. A fragment helper, rendered by the server, with
 * the kit's chart (plain SVG; `<ui-chart>` adds the tooltip). Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/pie-chart-card.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { pieChart, type ChartConfig } from '../../../components/chart.ts';
import { progressClass } from '../../../components/progress.ts';

const pieChartData = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 287, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
];

const pieChartConfig: ChartConfig = {
  visitors: { label: 'Visitors' },
  chrome: { label: 'Chrome', color: 'var(--chart-1)' },
  safari: { label: 'Safari', color: 'var(--chart-2)' },
  firefox: { label: 'Firefox', color: 'var(--chart-3)' },
  edge: { label: 'Edge', color: 'var(--chart-4)' },
};

export function pieChartCard() {
  const totalVisitors = pieChartData.reduce((sum, item) => sum + item.visitors, 0);
  const topBrowser = pieChartData.reduce((max, item) => (item.visitors > max.visitors ? item : max));
  const topBrowserShare = Math.round((topBrowser.visitors / totalVisitors) * 100);
  const topBrowserLabel = pieChartConfig[topBrowser.browser]?.label ?? 'Top';
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Browser Share</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2026</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>${topBrowserLabel}</span>
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'pt-0')}>
        ${pieChart({
          config: pieChartConfig,
          data: pieChartData,
          // The legend is wider than the donut, as Recharts' HTML legend is.
          class: 'mx-auto aspect-square max-h-[190px] [&_.ui-chart-legend-wrapper]:overflow-visible [&_.ui-chart-surface]:overflow-visible',
          title: 'Visitors by browser',
          tooltip: { cursor: false, hideLabel: true },
          legend: { nameKey: 'browser', class: 'translate-y-2' },
          pies: [{
            dataKey: 'visitors',
            nameKey: 'browser',
            innerRadius: 50,
            strokeWidth: 5,
            center: ({ cx, cy }) => svg`
              <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="middle">
                <tspan x=${cx} y=${cy - 16} class="fill-foreground text-2xl font-bold">${totalVisitors.toLocaleString('en-US')}</tspan>
                <tspan x=${cx} y=${cy + 4} class="fill-muted-foreground text-xs">Visitors</tspan>
              </text>`,
          }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-stretch gap-2')}>
        <div class="flex items-center text-xs">
          <span class="font-medium">${topBrowserLabel}</span>
          <span class="ml-auto text-muted-foreground tabular-nums">${topBrowserShare}%</span>
        </div>
        <progress data-slot="progress" value=${topBrowserShare} max="100" aria-label=${`${topBrowserLabel} share`} class=${cn(progressClass(), '[&::-moz-progress-bar]:bg-chart-3 [&::-webkit-progress-value]:bg-chart-3')}></progress>
      </div>
    </div>
  `;
}
