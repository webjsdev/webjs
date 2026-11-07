/**
 * An interactive area chart, a chart block ported from shadcn/ui's chart-area-interactive.
 *
 * Installed by `npx @webjsdev/ui add chart-area-interactive` at
 * `components/charts/chart-area-interactive.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartAreaInteractive()}`.
 *
 * The range picker is a native `<select>` inside `<ui-select>`, and all three
 * ranges are served; the card shows the chosen one through `:has()`, so the
 * picker works with JavaScript off. shadcn's re-renders one chart from React
 * state instead.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { selectTriggerClass } from '../../components/select.ts';
import { areaChart, type ChartConfig } from '../../components/chart.ts';

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
  { date: '2024-05-01', desktop: 165, mobile: 220 },
  { date: '2024-05-02', desktop: 293, mobile: 310 },
  { date: '2024-05-03', desktop: 247, mobile: 190 },
  { date: '2024-05-04', desktop: 385, mobile: 420 },
  { date: '2024-05-05', desktop: 481, mobile: 390 },
  { date: '2024-05-06', desktop: 498, mobile: 520 },
  { date: '2024-05-07', desktop: 388, mobile: 300 },
  { date: '2024-05-08', desktop: 149, mobile: 210 },
  { date: '2024-05-09', desktop: 227, mobile: 180 },
  { date: '2024-05-10', desktop: 293, mobile: 330 },
  { date: '2024-05-11', desktop: 335, mobile: 270 },
  { date: '2024-05-12', desktop: 197, mobile: 240 },
  { date: '2024-05-13', desktop: 197, mobile: 160 },
  { date: '2024-05-14', desktop: 448, mobile: 490 },
  { date: '2024-05-15', desktop: 473, mobile: 380 },
  { date: '2024-05-16', desktop: 338, mobile: 400 },
  { date: '2024-05-17', desktop: 499, mobile: 420 },
  { date: '2024-05-18', desktop: 315, mobile: 350 },
  { date: '2024-05-19', desktop: 235, mobile: 180 },
  { date: '2024-05-20', desktop: 177, mobile: 230 },
  { date: '2024-05-21', desktop: 82, mobile: 140 },
  { date: '2024-05-22', desktop: 81, mobile: 120 },
  { date: '2024-05-23', desktop: 252, mobile: 290 },
  { date: '2024-05-24', desktop: 294, mobile: 220 },
  { date: '2024-05-25', desktop: 201, mobile: 250 },
  { date: '2024-05-26', desktop: 213, mobile: 170 },
  { date: '2024-05-27', desktop: 420, mobile: 460 },
  { date: '2024-05-28', desktop: 233, mobile: 190 },
  { date: '2024-05-29', desktop: 78, mobile: 130 },
  { date: '2024-05-30', desktop: 340, mobile: 280 },
  { date: '2024-05-31', desktop: 178, mobile: 230 },
  { date: '2024-06-01', desktop: 178, mobile: 200 },
  { date: '2024-06-02', desktop: 470, mobile: 410 },
  { date: '2024-06-03', desktop: 103, mobile: 160 },
  { date: '2024-06-04', desktop: 439, mobile: 380 },
  { date: '2024-06-05', desktop: 88, mobile: 140 },
  { date: '2024-06-06', desktop: 294, mobile: 250 },
  { date: '2024-06-07', desktop: 323, mobile: 370 },
  { date: '2024-06-08', desktop: 385, mobile: 320 },
  { date: '2024-06-09', desktop: 438, mobile: 480 },
  { date: '2024-06-10', desktop: 155, mobile: 200 },
  { date: '2024-06-11', desktop: 92, mobile: 150 },
  { date: '2024-06-12', desktop: 492, mobile: 420 },
  { date: '2024-06-13', desktop: 81, mobile: 130 },
  { date: '2024-06-14', desktop: 426, mobile: 380 },
  { date: '2024-06-15', desktop: 307, mobile: 350 },
  { date: '2024-06-16', desktop: 371, mobile: 310 },
  { date: '2024-06-17', desktop: 475, mobile: 520 },
  { date: '2024-06-18', desktop: 107, mobile: 170 },
  { date: '2024-06-19', desktop: 341, mobile: 290 },
  { date: '2024-06-20', desktop: 408, mobile: 450 },
  { date: '2024-06-21', desktop: 169, mobile: 210 },
  { date: '2024-06-22', desktop: 317, mobile: 270 },
  { date: '2024-06-23', desktop: 480, mobile: 530 },
  { date: '2024-06-24', desktop: 132, mobile: 180 },
  { date: '2024-06-25', desktop: 141, mobile: 190 },
  { date: '2024-06-26', desktop: 434, mobile: 380 },
  { date: '2024-06-27', desktop: 448, mobile: 490 },
  { date: '2024-06-28', desktop: 149, mobile: 200 },
  { date: '2024-06-29', desktop: 103, mobile: 160 },
  { date: '2024-06-30', desktop: 446, mobile: 400 },
];

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

// Gradient ids are per range, since all three charts sit on one page and an
// id must be unique in the document.
const gradients = (days: number) => svg`
  <linearGradient id=${`fillDesktop-${days}d`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-desktop)" stop-opacity="0.8"></stop>
    <stop offset="95%" stop-color="var(--color-desktop)" stop-opacity="0.1"></stop>
  </linearGradient>
  <linearGradient id=${`fillMobile-${days}d`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-mobile)" stop-opacity="0.8"></stop>
    <stop offset="95%" stop-color="var(--color-mobile)" stop-opacity="0.1"></stop>
  </linearGradient>`;

const RANGES = [
  { value: '90d', label: 'Last 3 months', days: 90 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '7d', label: 'Last 7 days', days: 7 },
];

// The rows from `days` before the last one, as shadcn's filter keeps them.
function rangeData(days: number) {
  const start = Date.parse('2024-06-30') - days * 86400000;
  return chartData.filter((item) => Date.parse(item.date) >= start);
}

const day = (value: unknown, opts: Intl.DateTimeFormatOptions) =>
  new Date(String(value)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

function chart(days: number) {
  return areaChart({
    config: chartConfig,
    class: 'aspect-auto h-[250px] w-full',
    width: 1260,
    height: 250,
    data: rangeData(days),
    title: `Visitors, the last ${days} days`,
    defs: gradients(days),
    grid: { vertical: false },
    xAxis: {
      dataKey: 'date',
      tickLine: false,
      axisLine: false,
      tickMargin: 8,
      minTickGap: 32,
      tickFormatter: (value) => day(value, { month: 'short', day: 'numeric' }),
    },
    tooltip: { cursor: false, indicator: 'dot', labelFormatter: (value) => day(value, { month: 'short', day: 'numeric' }) },
    legend: {},
    areas: [
      { dataKey: 'mobile', type: 'natural', fill: `url(#fillMobile-${days}d)`, stroke: 'var(--color-mobile)', stackId: 'a' },
      { dataKey: 'desktop', type: 'natural', fill: `url(#fillDesktop-${days}d)`, stroke: 'var(--color-desktop)', stackId: 'a' },
    ],
  });
}

export default function ChartAreaInteractive() {
  return html`
    <div data-slot="card" class=${cn(cardClass(), 'group/chart pt-0')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row')}>
        <div class="grid flex-1 gap-1">
          <div data-slot="card-title" class=${cardTitleClass()}>Area Chart - Interactive</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Showing total visitors for the last 3 months</div>
        </div>
        <ui-select class="hidden sm:ml-auto sm:flex">
          <select aria-label="Select a value" class=${cn(selectTriggerClass(), 'w-[160px] rounded-lg')}>
            ${RANGES.map((r) => html`<option value=${r.value} selected=${r.value === '90d'}>${r.label}</option>`)}
          </select>
        </ui-select>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-2 pt-4 sm:px-6 sm:pt-6')}>
        <div class="group-has-[option[value=30d]:checked]/chart:hidden group-has-[option[value=7d]:checked]/chart:hidden">${chart(90)}</div>
        <div class="hidden group-has-[option[value=30d]:checked]/chart:block">${chart(30)}</div>
        <div class="hidden group-has-[option[value=7d]:checked]/chart:block">${chart(7)}</div>
      </div>
    </div>
  `;
}
