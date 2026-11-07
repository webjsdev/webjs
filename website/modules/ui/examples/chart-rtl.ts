import { html } from '@webjsdev/core';
import { barChart, type ChartConfig } from '#modules/ui/components/chart.ts';

export const description = 'A bar chart, right to left';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      january: 'January',
      february: 'February',
      march: 'March',
      april: 'April',
      may: 'May',
      june: 'June',
      desktop: 'Desktop',
      mobile: 'Mobile',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      january: 'يناير',
      february: 'فبراير',
      march: 'مارس',
      april: 'أبريل',
      may: 'مايو',
      june: 'يونيو',
      desktop: 'سطح المكتب',
      mobile: 'الجوال',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      january: 'ינואר',
      february: 'פברואר',
      march: 'מרץ',
      april: 'אפריל',
      may: 'מאי',
      june: 'יוני',
      desktop: 'מחשב',
      mobile: 'נייד',
    },
  },
} as const;

const chartData = [
  { month: 'january', desktop: 186, mobile: 80 },
  { month: 'february', desktop: 305, mobile: 200 },
  { month: 'march', desktop: 237, mobile: 120 },
  { month: 'april', desktop: 73, mobile: 190 },
  { month: 'may', desktop: 209, mobile: 130 },
  { month: 'june', desktop: 214, mobile: 140 },
];

// The provider is the dir attribute: the legend and the tooltip are HTML and
// follow it, and the x axis is reversed so January starts on the right.
export default function ChartRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];
  const label = (value: unknown) => t[value as keyof typeof t] ?? String(value);

  const chartConfig = {
    desktop: {
      label: t.desktop,
      color: 'var(--chart-2)',
    },
    mobile: {
      label: t.mobile,
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  return html`
    <div dir=${dir} lang=${lang} class="w-full">
      ${barChart({
        config: chartConfig,
        data: chartData,
        class: 'min-h-[200px] w-full',
        grid: { vertical: false },
        xAxis: {
          dataKey: 'month',
          tickLine: false,
          tickMargin: 10,
          axisLine: false,
          tickFormatter: (value) => label(value).slice(0, 3),
          reversed: dir === 'rtl',
        },
        tooltip: { labelFormatter: (value) => label(value), labelClass: 'w-32' },
        legend: {},
        bars: [
          { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
          { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
        ],
      })}
    </div>
  `;
}
