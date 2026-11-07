import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { barChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'An interactive bar chart';

const chartData = [
  { date: '2024-04-01', desktop: 222, mobile: 150 },
  { date: '2024-04-02', desktop: 97, mobile: 180 },
  { date: '2024-04-03', desktop: 167, mobile: 120 },
  { date: '2024-04-04', desktop: 242, mobile: 260 },
  { date: '2024-04-05', desktop: 373, mobile: 290 },
  { date: '2024-04-06', desktop: 301, mobile: 340 },
  { date: '2024-04-07', desktop: 245, mobile: 180 },
  { date: '2024-04-08', desktop: 409, mobile: 320 },
  { date: '2024-04-09', desktop: 59, mobile: 110 },
  { date: '2024-04-10', desktop: 261, mobile: 190 },
  { date: '2024-04-11', desktop: 327, mobile: 350 },
  { date: '2024-04-12', desktop: 292, mobile: 210 },
  { date: '2024-04-13', desktop: 342, mobile: 380 },
  { date: '2024-04-14', desktop: 137, mobile: 220 },
  { date: '2024-04-15', desktop: 120, mobile: 170 },
  { date: '2024-04-16', desktop: 138, mobile: 190 },
  { date: '2024-04-17', desktop: 446, mobile: 360 },
  { date: '2024-04-18', desktop: 364, mobile: 410 },
  { date: '2024-04-19', desktop: 243, mobile: 180 },
  { date: '2024-04-20', desktop: 89, mobile: 150 },
  { date: '2024-04-21', desktop: 137, mobile: 200 },
  { date: '2024-04-22', desktop: 224, mobile: 170 },
  { date: '2024-04-23', desktop: 138, mobile: 230 },
  { date: '2024-04-24', desktop: 387, mobile: 290 },
  { date: '2024-04-25', desktop: 215, mobile: 250 },
  { date: '2024-04-26', desktop: 75, mobile: 130 },
  { date: '2024-04-27', desktop: 383, mobile: 420 },
  { date: '2024-04-28', desktop: 122, mobile: 180 },
  { date: '2024-04-29', desktop: 315, mobile: 240 },
  { date: '2024-04-30', desktop: 454, mobile: 380 },
];

const chartConfig = {
  views: { label: 'Page Views' },
  desktop: { label: 'Desktop', color: 'var(--chart-2)' },
  mobile: { label: 'Mobile', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const total = {
  desktop: chartData.reduce((acc, curr) => acc + curr.desktop, 0),
  mobile: chartData.reduce((acc, curr) => acc + curr.mobile, 0),
};

const day = (value: unknown, opts: Intl.DateTimeFormatOptions) =>
  new Date(String(value)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

// One chart per series, both served. The header's two choices are radio
// inputs, so picking one swaps the chart through :has() with no script.
function chart(key: 'desktop' | 'mobile') {
  return barChart({
    config: chartConfig,
    class: 'aspect-auto h-[250px] w-full',
    width: 590,
    height: 250,
    data: chartData,
    title: `${chartConfig[key].label} page views, April 2024`,
    margin: { left: 12, right: 12 },
    grid: { vertical: false },
    xAxis: {
      dataKey: 'date',
      tickLine: false,
      axisLine: false,
      tickMargin: 8,
      minTickGap: 32,
      tickFormatter: (value) => day(value, { month: 'short', day: 'numeric' }),
    },
    tooltip: {
      class: 'w-[150px]',
      nameKey: 'views',
      labelFormatter: (value) => day(value, { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    bars: [{ dataKey: key, fill: `var(--color-${key})` }],
  });
}

export default function ChartDemo() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'group/chart py-0 pb-4')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'flex flex-col items-stretch border-b p-0! sm:flex-row')}>
        <div class="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-0!">
          <div data-slot="card-title" class=${cardTitleClass()}>Bar Chart - Interactive</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 3 months</div>
        </div>
        <div class="flex" role="radiogroup" aria-label="Series">
          ${(['desktop', 'mobile'] as const).map((key) => html`
            <label class="relative z-30 flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l has-checked:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
              <input type="radio" name="chart-demo-series" value=${key} ?checked=${key === 'desktop'} class="sr-only">
              <span class="text-xs text-muted-foreground">${chartConfig[key].label}</span>
              <span class="text-lg leading-none font-bold sm:text-3xl">${total[key].toLocaleString('en-US')}</span>
            </label>`)}
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-2 sm:p-6')}>
        <div class="group-has-[input[value=mobile]:checked]/chart:hidden">${chart('desktop')}</div>
        <div class="hidden group-has-[input[value=mobile]:checked]/chart:block">${chart('mobile')}</div>
      </div>
    </div>
  `;
}
