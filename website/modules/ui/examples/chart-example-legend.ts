import { html } from '@webjsdev/core';
import { barChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A bar chart with a tooltip and a legend';

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
    color: '#2563eb',
  },
  mobile: {
    label: 'Mobile',
    color: '#60a5fa',
  },
} satisfies ChartConfig;

export default function ChartBarDemoLegend() {
  return html`
    ${barChart({
      config: chartConfig,
      data: chartData,
      class: 'min-h-[200px] w-full',
      title: 'Desktop and mobile visitors, January to June',
      grid: { vertical: false },
      xAxis: { dataKey: 'month', tickLine: false, tickMargin: 10, axisLine: false, tickFormatter: (value) => String(value).slice(0, 3) },
      tooltip: {},
      legend: {},
      bars: [
        { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
        { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
      ],
    })}
  `;
}
