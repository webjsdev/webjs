import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Chart docs page, ported from shadcn's
 * content/docs/components/radix/chart.mdx (#1666): the same sections in the
 * same order, the prose rewritten where it describes Recharts or React. The
 * "Updating to Recharts v3" section and its callout are left out, since the
 * kit's charts are not built on Recharts.
 */
export const demo = 'chart-demo';

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;

/** Between the lead demo and Installation: the introduction and Component. */
export function intro(toc: TocEntry[]) {
  return html`
    <p>Introducing <strong>Charts</strong>. A collection of chart components that you can copy and paste into your apps.</p>
    <p>Charts are designed to look great out of the box. They work well with the other components and are fully customizable to fit your project.</p>
    <p><a href="/ui/charts/area">Browse the Charts Library</a>.</p>

    ${heading(toc, 2, 'Component')}
    <p>The charts are drawn on the server as plain SVG, with no charting library. The layout is a port of <a href="https://recharts.org/">Recharts</a>, which shadcn's charts are built on: the same margins, scales, curves, bar layout and tick thinning, and the same option names.</p>
    <p>We designed the <code>chart</code> component with composition in mind. <strong>Each chart is one function call, with the grid, the axes, the tooltip and the legend as options you add only when and where you need them</strong>.</p>
    ${codeFigure(`import { html } from '@webjsdev/core';
import { barChart } from '#components/ui/chart.ts';

export function myChart() {
  return html\`
    \${barChart({
      config: chartConfig,
      data,
      bars: [{ dataKey: 'value' }],
      tooltip: {},
    })}
  \`;
}`, { lineNumbers: true })}
    <p>The first paint is the whole chart, so it reads with JavaScript off. The <code>&lt;ui-chart&gt;</code> element the function returns adds the tooltip, the hover cursor and the keyboard once it loads.</p>
    <p><strong>The components are yours</strong>. The three files <code>add chart</code> writes are plain source in your app.</p>`;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Your First Chart')}
    <p>Let's build your first chart. We'll build a bar chart, add a grid, axis, tooltip and legend.</p>
    <div class=${steps}>
      <h3>Start by defining your data</h3>
      <p>The following data represents the number of desktop and mobile users for each month.</p>
      ${callout(html`<strong>Note:</strong> Your data can be in any shape. You are not limited to the shape of the data below. Use the <code>dataKey</code> option to map your data to the chart.`, { className: 'mt-4' })}
      ${codeFigure(`const chartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];`, { title: 'components/example-chart.ts', lineNumbers: true })}

      <h3>Define your chart config</h3>
      <p>The chart config holds configuration for the chart. This is where you place human-readable strings, such as labels, icons and color tokens for theming.</p>
      ${codeFigure(`import type { ChartConfig } from '#components/ui/chart.ts';

const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: '#2563eb',
  },
  mobile: {
    label: 'Mobile',
    color: '#60a5fa',
  },
} satisfies ChartConfig;`, { title: 'components/example-chart.ts', lineNumbers: true })}

      <h3>Build your chart</h3>
      <p>You can now build your chart with <code>barChart()</code>.</p>
      ${callout(html`<strong>Important:</strong> Keep a height, a <code>min-h-[VALUE]</code> or an <code>aspect-*</code> class on the chart. The SVG scales to the box its container gives it.`, { className: 'mt-4 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-950' })}
      ${await componentPreview('chart-example', { previewClass: 'h-80' })}
    </div>

    ${heading(toc, 3, 'Add a Grid')}
    <p>Let's add a grid to the chart.</p>
    <div class=${steps}>
      <h3>Add the <code>grid</code> option to your chart.</h3>
      ${codeFigure(`\${barChart({
  config: chartConfig,
  data: chartData,
  class: 'min-h-[200px] w-full',
  grid: { vertical: false },
  bars: [
    { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
    { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
  ],
})}`, { lineNumbers: true })}
      ${await componentPreview('chart-example-grid', { previewClass: 'h-80' })}
    </div>

    ${heading(toc, 3, 'Add an Axis')}
    <p>To add an x-axis to the chart, we'll use the <code>xAxis</code> option.</p>
    <div class=${steps}>
      <h3>Add the <code>xAxis</code> option to your chart.</h3>
      ${codeFigure(`\${barChart({
  config: chartConfig,
  data: chartData,
  class: 'h-[200px] w-full',
  grid: { vertical: false },
  xAxis: {
    dataKey: 'month',
    tickLine: false,
    tickMargin: 10,
    axisLine: false,
    tickFormatter: (value) => String(value).slice(0, 3),
  },
  bars: [
    { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
    { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
  ],
})}`, { lineNumbers: true })}
      ${await componentPreview('chart-example-axis', { previewClass: 'h-80' })}
    </div>

    ${heading(toc, 3, 'Add Tooltip')}
    <p>So far the chart is static SVG. It looks great out of the box thanks to the chart's container classes.</p>
    <p>To add a tooltip, we'll use the <code>tooltip</code> option, which draws shadcn's <code>ChartTooltipContent</code>.</p>
    <div class=${steps}>
      <h3>Add the <code>tooltip</code> option to your chart.</h3>
      ${codeFigure(`\${barChart({
  config: chartConfig,
  data: chartData,
  class: 'h-[200px] w-full',
  grid: { vertical: false },
  xAxis: {
    dataKey: 'month',
    tickLine: false,
    tickMargin: 10,
    axisLine: false,
    tickFormatter: (value) => String(value).slice(0, 3),
  },
  tooltip: {},
  bars: [
    { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
    { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
  ],
})}`, { lineNumbers: true })}
      ${await componentPreview('chart-example-tooltip', { previewClass: 'h-80' })}
      <p>Hover to see the tooltips. Easy, right? One option, and we've got a beautiful tooltip.</p>
    </div>

    ${heading(toc, 3, 'Add Legend')}
    <p>We'll do the same for the legend, with the <code>legend</code> option, which draws shadcn's <code>ChartLegendContent</code>.</p>
    <div class=${steps}>
      <h3>Add the <code>legend</code> option to your chart.</h3>
      ${codeFigure(`\${barChart({
  config: chartConfig,
  data: chartData,
  class: 'h-[200px] w-full',
  grid: { vertical: false },
  xAxis: {
    dataKey: 'month',
    tickLine: false,
    tickMargin: 10,
    axisLine: false,
    tickFormatter: (value) => String(value).slice(0, 3),
  },
  tooltip: {},
  legend: {},
  bars: [
    { dataKey: 'desktop', fill: 'var(--color-desktop)', radius: 4 },
    { dataKey: 'mobile', fill: 'var(--color-mobile)', radius: 4 },
  ],
})}`, { lineNumbers: true })}
      ${await componentPreview('chart-example-legend', { previewClass: 'h-80' })}
    </div>
    <p>Done. You've built your first chart! What's next?</p>
    <ul>
      <li><a href="#theming">Themes and Colors</a></li>
      <li><a href="#tooltip">Tooltip</a></li>
      <li><a href="#legend">Legend</a></li>
    </ul>

    ${heading(toc, 2, 'Chart Config')}
    <p>The chart config is where you define the labels, icons and colors for a chart.</p>
    <p>It is intentionally decoupled from chart data.</p>
    <p>This allows you to share config and color tokens between charts. It can also work independently for cases where your data or color tokens live remotely or in a different format.</p>
    ${codeFigure(`import { MonitorIcon } from '#lib/utils/icons.ts';
import type { ChartConfig } from '#components/ui/chart.ts';

const chartConfig = {
  desktop: {
    label: 'Desktop',
    // A function returning an html or svg template.
    icon: () => MonitorIcon(),
    // A color like 'hsl(220, 98%, 61%)' or 'var(--color-name)'
    color: '#2563eb',
    // OR a theme object with 'light' and 'dark' keys
    theme: {
      light: '#2563eb',
      dark: '#dc2626',
    },
  },
} satisfies ChartConfig;`, { lineNumbers: true })}

    ${heading(toc, 2, 'Theming')}
    <p>Charts have built-in support for theming. You can use css variables (recommended) or color values in any color format, such as hex, hsl or oklch.</p>

    ${heading(toc, 3, 'CSS Variables')}
    <div class=${steps}>
      <h3>Define your colors in your css file</h3>
      ${codeFigure(`@layer base {
  :root {
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
  }

  .dark {
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
  }
}`, { title: 'app/globals.css', lang: 'css', lineNumbers: true })}
      <h3>Add the color to your <code>chartConfig</code></h3>
      ${codeFigure(`const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;`, { title: 'components/example-chart.ts', lineNumbers: true })}
    </div>

    ${heading(toc, 3, 'hex, hsl or oklch')}
    <p>You can also define your colors directly in the chart config. Use the color format you prefer.</p>
    ${codeFigure(`const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: '#2563eb',
  },
  mobile: {
    label: 'Mobile',
    color: 'hsl(220, 98%, 61%)',
  },
  tablet: {
    label: 'Tablet',
    color: 'oklch(0.5 0.2 240)',
  },
  laptop: {
    label: 'Laptop',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;`, { title: 'components/example-chart.ts', lineNumbers: true })}

    ${heading(toc, 3, 'Using Colors')}
    <p>To use the theme colors in your chart, reference the colors using the format <code>var(--color-KEY)</code>. The chart sets one such variable per config entry on its container.</p>
    <h4>Components</h4>
    ${codeFigure(`bars: [{ dataKey: 'desktop', fill: 'var(--color-desktop)' }]`)}
    <h4>Chart Data</h4>
    ${codeFigure(`const chartData = [
  { browser: 'chrome', visitors: 275, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
];`, { title: 'components/example-chart.ts', lineNumbers: true })}
    <h4>Tailwind</h4>
    ${codeFigure(`labels: [{ class: 'fill-(--color-desktop)' }]`, { title: 'components/example-chart.ts' })}

    ${heading(toc, 2, 'Tooltip')}
    <p>A chart tooltip contains a label, name, indicator and value. You can use a combination of these to customize your tooltip.</p>
    ${await componentPreview('chart-tooltip', { hideCode: true })}
    <p>You can turn on/off any of these using the <code>hideLabel</code>, <code>hideIndicator</code> options and customize the indicator style using the <code>indicator</code> option.</p>
    <p>Use <code>labelKey</code> and <code>nameKey</code> to use a custom key for the tooltip label and name.</p>
    <p>Every chart function takes a <code>tooltip</code> option. Pass it to add the tooltip to your chart.</p>
    ${codeFigure(`tooltip: {}`, { title: 'components/example-chart.ts' })}
    <p>The tooltip for each point is resolved on the server, so a <code>labelFormatter</code>, a <code>formatter</code> or a config <code>icon</code> runs there and never ships to the browser.</p>

    ${heading(toc, 3, 'Props')}
    <p>Use the following options to customize the tooltip.</p>
    ${table(['Option', 'Type', 'Description'], [
      [html`<code>labelKey</code>`, 'string', 'The config or data key to use for the label.'],
      [html`<code>nameKey</code>`, 'string', 'The config or data key to use for the name.'],
      [html`<code>indicator</code>`, html`<code>dot</code> <code>line</code> or <code>dashed</code>`, 'The indicator style for the tooltip.'],
      [html`<code>hideLabel</code>`, 'boolean', 'Whether to hide the label.'],
      [html`<code>hideIndicator</code>`, 'boolean', 'Whether to hide the indicator.'],
    ])}

    ${heading(toc, 3, 'Colors')}
    <p>Colors are automatically referenced from the chart config.</p>

    ${heading(toc, 3, 'Custom')}
    <p>To use a custom key for tooltip label and names, use the <code>labelKey</code> and <code>nameKey</code> options.</p>
    ${codeFigure(`const chartData = [
  { browser: 'chrome', visitors: 187, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
];

const chartConfig = {
  visitors: {
    label: 'Total Visitors',
  },
  chrome: {
    label: 'Chrome',
    color: 'var(--chart-1)',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;`, { lineNumbers: true })}
    ${codeFigure(`tooltip: { labelKey: 'visitors', nameKey: 'browser' }`, { title: 'components/example-chart.ts' })}
    <p>This will use <code>Total Visitors</code> for label and <code>Chrome</code> and <code>Safari</code> for the tooltip names.</p>

    ${heading(toc, 2, 'Legend')}
    <p>Every chart function takes a <code>legend</code> option. Pass it to add a legend to your chart.</p>
    ${codeFigure(`legend: {}`, { title: 'components/example-chart.ts' })}

    ${heading(toc, 3, 'Colors', 'legend-colors')}
    <p>Colors are automatically referenced from the chart config.</p>

    ${heading(toc, 3, 'Custom', 'legend-custom')}
    <p>To use a custom key for legend names, use the <code>nameKey</code> option.</p>
    ${codeFigure(`const chartData = [
  { browser: 'chrome', visitors: 187, fill: 'var(--color-chrome)' },
  { browser: 'safari', visitors: 200, fill: 'var(--color-safari)' },
];

const chartConfig = {
  chrome: {
    label: 'Chrome',
    color: 'var(--chart-1)',
  },
  safari: {
    label: 'Safari',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;`, { lineNumbers: true })}
    ${codeFigure(`legend: { nameKey: 'browser' }`, { title: 'components/example-chart.ts' })}
    <p>This will use <code>Chrome</code> and <code>Safari</code> for the legend names.</p>

    ${heading(toc, 2, 'Accessibility')}
    <p>A chart with a tooltip has an accessible layer by default, Recharts' <code>accessibilityLayer</code>: it takes focus, the arrow keys step through its points, Home and End jump to the first and last, Escape hides the tooltip, and each step is announced to screen readers. Pass <code>accessibilityLayer: false</code> to turn it off.</p>
    <p>Give every chart a <code>title</code>, which names it for screen readers, and keep its numbers in the text around it for a reader who cannot use the chart.</p>
    ${codeFigure(`\${lineChart({ config, data, title: 'Visitors by month', tooltip: {}, lines })}`, { title: 'components/example-chart.ts' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>. The legend and the tooltip follow the <code>dir</code> attribute, and <code>reversed</code> on the x axis runs the categories from the right.</p>
    ${await componentPreview('chart-rtl', { direction: 'rtl', previewClass: 'h-92' })}
  `;
}
