/**
 * An interactive pie chart, a chart block ported from shadcn/ui's chart-pie-interactive.
 *
 * Installed by `npx @webjsdev/ui add chart-pie-interactive` at
 * `components/charts/chart-pie-interactive.ts`. It is app code you own, so edit it
 * freely, and render it from any page with `${ChartPieInteractive()}`.
 *
 * The month picker is a native `<select>` inside `<ui-select>`, and the chart
 * for every month is served; the card shows the chosen one through `:has()`,
 * so the picker works with JavaScript off. shadcn's re-renders one chart from
 * React state instead, and draws a colour swatch beside each month, which a
 * native option cannot hold.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../lib/utils.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardHeaderClass, cardTitleClass,
} from '../../components/card.ts';
import { selectTriggerClass } from '../../components/select.ts';
import { chartSector, chartStyle, pieChart, type ChartConfig } from '../../components/chart.ts';

const chartConfig = {
  visitors: {
    label: 'Visitors',
  },
  desktop: {
    label: 'Desktop',
  },
  mobile: {
    label: 'Mobile',
  },
  january: {
    label: 'January',
    color: 'var(--chart-1)',
  },
  february: {
    label: 'February',
    color: 'var(--chart-2)',
  },
  march: {
    label: 'March',
    color: 'var(--chart-3)',
  },
  april: {
    label: 'April',
    color: 'var(--chart-4)',
  },
  may: {
    label: 'May',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

const desktopData = [
  { month: 'january', desktop: 186, fill: 'var(--color-january)' },
  { month: 'february', desktop: 305, fill: 'var(--color-february)' },
  { month: 'march', desktop: 237, fill: 'var(--color-march)' },
  { month: 'april', desktop: 173, fill: 'var(--color-april)' },
  { month: 'may', desktop: 209, fill: 'var(--color-may)' },
];

const months = desktopData.map((item) => item.month);

// Which month's chart shows, read from the picker's checked option. Written
// out whole so Tailwind finds every class in the source.
const SHOWN_WHEN: Record<string, string> = {
  january: 'w-full group-has-[option[value=february]:checked]/chart:hidden group-has-[option[value=march]:checked]/chart:hidden group-has-[option[value=april]:checked]/chart:hidden group-has-[option[value=may]:checked]/chart:hidden',
  february: 'hidden w-full group-has-[option[value=february]:checked]/chart:block',
  march: 'hidden w-full group-has-[option[value=march]:checked]/chart:block',
  april: 'hidden w-full group-has-[option[value=april]:checked]/chart:block',
  may: 'hidden w-full group-has-[option[value=may]:checked]/chart:block',
};

// The donut with `activeIndex` pulled out and ringed, and its total in the middle.
function chart(activeIndex: number) {
  return pieChart({
    config: chartConfig,
    class: 'mx-auto aspect-square w-full max-w-[300px]',
    width: 300,
    data: desktopData,
    title: `Desktop visitors by month, ${chartConfig[months[activeIndex] as keyof typeof chartConfig].label} highlighted`,
    tooltip: { cursor: false, hideLabel: true },
    pies: [{
      dataKey: 'desktop',
      nameKey: 'month',
      innerRadius: 60,
      strokeWidth: 5,
      shape: ({ index, outerRadius, ...props }) => index === activeIndex
        ? svg`<g>${chartSector({ ...props, outerRadius: outerRadius + 10 })}${chartSector({ ...props, outerRadius: outerRadius + 25, innerRadius: outerRadius + 12 })}</g>`
        : chartSector({ ...props, outerRadius }),
      center: ({ cx, cy }) => svg`
        <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="middle">
          <tspan x=${cx} y=${cy} class="fill-foreground text-3xl font-bold">${desktopData[activeIndex].desktop.toLocaleString('en-US')}</tspan>
          <tspan x=${cx} y=${cy + 24} class="fill-muted-foreground">Visitors</tspan>
        </text>`,
    }],
  });
}

export default function ChartPieInteractive() {
  // shadcn's ChartStyle on the card, so the month colours reach the header too.
  return html`
    <div data-slot="card" data-chart="pie-interactive" style=${chartStyle(chartConfig)} class=${cn(cardClass(), 'group/chart flex flex-col')}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'flex-row items-start space-y-0 pb-0')}>
        <div class="grid gap-1">
          <div data-slot="card-title" class=${cardTitleClass()}>Pie Chart - Interactive</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>January - June 2024</div>
        </div>
        <ui-select class="ml-auto w-fit">
          <select aria-label="Select a value" class=${cn(selectTriggerClass(), 'h-7 w-[130px] rounded-lg pl-2.5')}>
            ${months.map((key, i) => html`<option value=${key} selected=${i === 0}>${chartConfig[key as keyof typeof chartConfig].label}</option>`)}
          </select>
        </ui-select>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-1 justify-center pb-0')}>
        ${months.map((key, i) => html`<div class=${SHOWN_WHEN[key]}>${chart(i)}</div>`)}
      </div>
    </div>
  `;
}
