/**
 * A radial chart with stacked sections, a chart block ported from shadcn/ui's chart-radial-stacked.
 *
 * Installed by `npx @webjsdev/ui add chart-radial-stacked` at
 * `components/charts/chart-radial-stacked.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartRadialStacked()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { radialBarChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [{ month: 'january', mobile: 570, desktop: 1260 }];

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

const totalVisitors = chartData[0].desktop + chartData[0].mobile;

export default function ChartRadialStacked() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radial Chart - Stacked</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 items-center pb-0')}>
        ${radialBarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square w-full max-w-[250px]',
          data: chartData,
          title: 'Desktop and mobile visitors, January',
          endAngle: 180,
          innerRadius: 80,
          outerRadius: 110,
          tooltip: { cursor: false, hideLabel: true },
          center: ({ cx, cy }) => svg`
              <text x=${cx} y=${cy} text-anchor="middle">
                <tspan x=${cx} y=${cy - 16} class="fill-foreground text-2xl font-bold">${totalVisitors.toLocaleString('en-US')}</tspan>
                <tspan x=${cx} y=${cy + 4} class="fill-muted-foreground">Visitors</tspan>
              </text>`,
          bars: [
            { dataKey: 'mobile', fill: 'var(--color-mobile)', stackId: 'a', cornerRadius: 5, class: 'stroke-transparent stroke-2' },
            { dataKey: 'desktop', stackId: 'a', cornerRadius: 5, fill: 'var(--color-desktop)', class: 'stroke-transparent stroke-2' },
          ],
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
