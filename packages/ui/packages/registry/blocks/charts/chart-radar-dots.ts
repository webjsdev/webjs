/**
 * A radar chart with dots, a chart block ported from shadcn/ui's chart-radar-dots.
 *
 * Installed by `npx @webjsdev/ui add chart-radar-dots` at
 * `components/charts/chart-radar-dots.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartRadarDots()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { radarChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 273 },
  { month: 'May', desktop: 209 },
  { month: 'June', desktop: 214 },
];

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

export default function ChartRadarDots() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radar Chart - Dots</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6 months</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'pb-0')}>
        ${radarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Visitors by month',
          tooltip: { cursor: false },
          angleAxis: { dataKey: 'month' },
          grid: {},
          radars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)', fillOpacity: 0.6, dot: { r: 4, fillOpacity: 1 } }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2 text-sm')}>
        <div class="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="flex items-center gap-2 leading-none text-muted-foreground">January - June 2024</div>
      </div>
    </div>
  `;
}
