/**
 * A line chart with dots and colors, a chart block ported from shadcn/ui's chart-line-dots-colors.
 *
 * Installed by `npx @webjsdev/ui add chart-line-dots-colors` at
 * `components/charts/chart-line-dots-colors.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartLineDotsColors()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { lineChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
  { browser: 'firefox', visitors: 187, fill: 'var(--color-firefox)' },
  { browser: 'edge', visitors: 173, fill: 'var(--color-edge)' },
  { browser: 'other', visitors: 90, fill: 'var(--color-other)' },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
    color: 'var(--chart-2)',
  },
  chrome: {
    label: 'Chrome',
    color: 'var(--chart-1)',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-2)',
  },
  firefox: {
    label: 'Firefox',
    color: 'var(--chart-3)',
  },
  edge: {
    label: 'Edge',
    color: 'var(--chart-4)',
  },
  other: {
    label: 'Other',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

export default function ChartLineDotsColors() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Line Chart - Dots Colors</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${lineChart({
          config: chartConfig,
          data: chartData,
          title: 'Visitors by browser',
          margin: { top: 24, left: 24, right: 24 },
          grid: { vertical: false },
          tooltip: { cursor: false, indicator: 'line', nameKey: 'visitors', hideLabel: true },
          lines: [{
            dataKey: 'visitors',
            type: 'natural',
            stroke: 'var(--color-visitors)',
            strokeWidth: 2,
            // Each point's dot in its browser's colour.
            dot: ({ cx, cy, datum }) => svg`<circle class="ui-chart-dot" cx=${cx} cy=${cy} r="5" fill=${String(datum.fill)} stroke=${String(datum.fill)}></circle>`,
          }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-start gap-2 text-sm')}>
        <div class="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="leading-none text-muted-foreground">Showing total visitors for the last 6 months</div>
      </div>
    </div>
  `;
}
