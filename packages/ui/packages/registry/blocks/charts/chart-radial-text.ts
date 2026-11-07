/**
 * A radial chart with text, a chart block ported from shadcn/ui's chart-radial-text.
 *
 * Installed by `npx @webjsdev/ui add chart-radial-text` at
 * `components/charts/chart-radial-text.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartRadialText()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { radialBarChart, type ChartConfig } from '../../components/chart.ts';

const chartData = [
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
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

export default function ChartRadialText() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-0')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radial Chart - Text</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 pb-0')}>
        ${radialBarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Safari visitors',
          startAngle: 0,
          endAngle: 250,
          outerRadius: 90,
          innerRadius: 80,
          grid: { gridType: 'circle', radialLines: false, stroke: 'none', class: 'first:fill-muted last:fill-background', polarRadius: [90, 80] },
          center: ({ cx, cy }) => svg`
              <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="middle">
                <tspan x=${cx} y=${cy} class="fill-foreground text-4xl font-bold">${chartData[0].visitors.toLocaleString('en-US')}</tspan>
                <tspan x=${cx} y=${cy + 24} class="fill-muted-foreground">Visitors</tspan>
              </text>`,
          bars: [{ dataKey: 'visitors', background: true, cornerRadius: 10 }],
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
