/**
 * A radar chart with icons, a chart block ported from shadcn/ui's chart-radar-icons.
 *
 * Installed by `npx @webjsdev/ui add chart-radar-icons` at
 * `components/charts/chart-radar-icons.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartRadarIcons()}`.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { radarChart, type ChartConfig } from '../../components/chart.ts';

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
    icon: () => ArrowDownFromLine(),
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
    icon: () => ArrowUpFromLine(),
  },
} satisfies ChartConfig;

// lucide's trending-up, the icon in shadcn's footer.
const TrendingUp = (cls = '') => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-trending-up ' + cls}><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;

// lucide's arrow-down-from-line and arrow-up-from-line, the series icons.
const ArrowDownFromLine = () => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-arrow-down-from-line"><path d="M19 3H5"></path><path d="M12 21V7"></path><path d="m6 15 6 6 6-6"></path></svg>`;
const ArrowUpFromLine = () => svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide lucide-arrow-up-from-line"><path d="m18 9-6-6-6 6"></path><path d="M12 3v14"></path><path d="M5 21h14"></path></svg>`;

export default function ChartRadarIcons() {
  return html`
    <div data-slot="card" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'items-center pb-4')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Radar Chart - Icons</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 6 months</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${radarChart({
          config: chartConfig,
          class: 'mx-auto aspect-square max-h-[250px]',
          data: chartData,
          title: 'Visitors by month',
          tooltip: { cursor: false, indicator: 'line' },
          angleAxis: { dataKey: 'month' },
          grid: {},
          margin: { top: -40, bottom: -10, left: 0, right: 0 },
          legend: { class: 'mt-8', height: 60 },
          radars: [
            { dataKey: 'desktop', fill: 'var(--color-desktop)', fillOpacity: 0.6 },
            { dataKey: 'mobile', fill: 'var(--color-mobile)' },
          ],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2 pt-4 text-sm')}>
        <div class="flex items-center gap-2 leading-none font-medium">
          Trending up by 5.2% this month ${TrendingUp('h-4 w-4')}
        </div>
        <div class="flex items-center gap-2 leading-none text-muted-foreground">January - June 2024</div>
      </div>
    </div>
  `;
}
