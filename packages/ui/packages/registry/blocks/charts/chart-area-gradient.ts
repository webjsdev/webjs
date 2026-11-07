/**
 * An area chart with gradient fill, a chart block ported from shadcn/ui's chart-area-gradient.
 *
 * Installed by `npx @webjsdev/ui add chart-area-gradient` at
 * `components/charts/chart-area-gradient.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartAreaGradient()}`.
 */
import { html, svg } from '@webjsdev/core';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { areaChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

const gradients = svg`
  <linearGradient id="fillDesktopGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-desktop)" stop-opacity="0.8"></stop>
    <stop offset="95%" stop-color="var(--color-desktop)" stop-opacity="0.1"></stop>
  </linearGradient>
  <linearGradient id="fillMobileGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-mobile)" stop-opacity="0.8"></stop>
    <stop offset="95%" stop-color="var(--color-mobile)" stop-opacity="0.1"></stop>
  </linearGradient>`;

export default function ChartAreaGradient() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Area Chart - Gradient</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6 months</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${areaChart({
          config: chartConfig,
          data: chartData,
          title: 'Desktop and mobile visitors, January to June',
          defs: gradients,
          margin: { left: 12, right: 12 },
          grid: { vertical: false },
          xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 8, tickFormatter: (value) => String(value).slice(0, 3) },
          tooltip: { cursor: false },
          areas: [
            { dataKey: 'mobile', type: 'natural', fill: 'url(#fillMobileGradient)', fillOpacity: 0.4, stroke: 'var(--color-mobile)', stackId: 'a' },
            { dataKey: 'desktop', type: 'natural', fill: 'url(#fillDesktopGradient)', fillOpacity: 0.4, stroke: 'var(--color-desktop)', stackId: 'a' },
          ],
        })}
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <div class="flex w-full items-start gap-2 text-sm">
          <div class="grid gap-2">
            <div class="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
            </div>
            <div class="flex items-center gap-2 leading-none text-muted-foreground">January - June 2024</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
