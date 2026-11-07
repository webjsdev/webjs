import { html, svg } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { sheetDescriptionClass, sheetHeaderClass, sheetTitleClass } from '#modules/ui/components/sheet.ts';
import { renderChart, type RenderedChart } from '#modules/ui/queries/charts.server.ts';
import { extraStyleLinks } from '#lib/ui/style-links.ts';
import { uiPageHeader, pageNav } from '#lib/ui/ui-page-header.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The /ui/charts pages, shadcn/ui's apps/v4/app/(app)/charts (#1666): the
 * layout's page header and chart-type nav (components/charts-nav.tsx), and
 * one ChartDisplay per chart (components/chart-display.tsx, chart-toolbar.tsx
 * and chart-code-viewer.tsx).
 *
 * shadcn shows each chart in an iframe of /view/<style>/<name>, 460 pixels
 * tall; here the chart is rendered in place, in the same 460 pixel frame,
 * since a WebJs chart is server markup and needs no page of its own. The
 * toolbar's copy button and the View Code sheet are the kit's own elements,
 * which /ui registers on every page.
 *
 * A fragment each page renders rather than a layout, for the reason the
 * blocks pages give: the nav marks the current type, and a layout is not
 * re-rendered on a soft navigation between two types.
 */

export const CHARTS_TITLE = 'Beautiful Charts & Graphs';
export const CHARTS_DESCRIPTION =
  'A collection of ready-to-use chart components, drawn as SVG on the server. From basic charts to rich data displays, copy and paste into your apps.';

/** shadcn's chart types, its nav labels, and the charts of each in its order (app/(app)/charts/charts.tsx). */
export const CHART_TYPES: Array<{ type: string; name: string; charts: Array<{ id: string; fullWidth?: boolean }> }> = [
  {
    type: 'area', name: 'Area Charts', charts: [
      { id: 'chart-area-interactive', fullWidth: true }, { id: 'chart-area-default' }, { id: 'chart-area-linear' },
      { id: 'chart-area-step' }, { id: 'chart-area-legend' }, { id: 'chart-area-stacked' },
      { id: 'chart-area-stacked-expand' }, { id: 'chart-area-icons' }, { id: 'chart-area-gradient' }, { id: 'chart-area-axes' },
    ],
  },
  {
    type: 'bar', name: 'Bar Charts', charts: [
      { id: 'chart-bar-interactive', fullWidth: true }, { id: 'chart-bar-default' }, { id: 'chart-bar-horizontal' },
      { id: 'chart-bar-multiple' }, { id: 'chart-bar-stacked' }, { id: 'chart-bar-label' }, { id: 'chart-bar-label-custom' },
      { id: 'chart-bar-mixed' }, { id: 'chart-bar-active' }, { id: 'chart-bar-negative' },
    ],
  },
  {
    type: 'line', name: 'Line Charts', charts: [
      { id: 'chart-line-interactive', fullWidth: true }, { id: 'chart-line-default' }, { id: 'chart-line-linear' },
      { id: 'chart-line-step' }, { id: 'chart-line-multiple' }, { id: 'chart-line-dots' }, { id: 'chart-line-dots-custom' },
      { id: 'chart-line-dots-colors' }, { id: 'chart-line-label' }, { id: 'chart-line-label-custom' },
    ],
  },
  {
    type: 'pie', name: 'Pie Charts', charts: [
      { id: 'chart-pie-simple' }, { id: 'chart-pie-separator-none' }, { id: 'chart-pie-label' }, { id: 'chart-pie-label-custom' },
      { id: 'chart-pie-label-list' }, { id: 'chart-pie-legend' }, { id: 'chart-pie-donut' }, { id: 'chart-pie-donut-active' },
      { id: 'chart-pie-donut-text' }, { id: 'chart-pie-stacked' }, { id: 'chart-pie-interactive' },
    ],
  },
  {
    type: 'radar', name: 'Radar Charts', charts: [
      { id: 'chart-radar-default' }, { id: 'chart-radar-dots' }, { id: 'chart-radar-lines-only' }, { id: 'chart-radar-label-custom' },
      { id: 'chart-radar-grid-custom' }, { id: 'chart-radar-grid-none' }, { id: 'chart-radar-grid-circle' },
      { id: 'chart-radar-grid-circle-no-lines' }, { id: 'chart-radar-grid-circle-fill' }, { id: 'chart-radar-grid-fill' },
      { id: 'chart-radar-multiple' }, { id: 'chart-radar-legend' }, { id: 'chart-radar-icons' }, { id: 'chart-radar-radius' },
    ],
  },
  {
    type: 'radial', name: 'Radial Charts', charts: [
      { id: 'chart-radial-simple' }, { id: 'chart-radial-label' }, { id: 'chart-radial-grid' }, { id: 'chart-radial-text' },
      { id: 'chart-radial-shape' }, { id: 'chart-radial-stacked' },
    ],
  },
  {
    type: 'tooltip', name: 'Tooltips', charts: [
      { id: 'chart-tooltip-default' }, { id: 'chart-tooltip-indicator-line' }, { id: 'chart-tooltip-indicator-none' },
      { id: 'chart-tooltip-label-custom' }, { id: 'chart-tooltip-label-formatter' }, { id: 'chart-tooltip-label-none' },
      { id: 'chart-tooltip-formatter' }, { id: 'chart-tooltip-icons' }, { id: 'chart-tooltip-advanced' },
    ],
  },
];

// The lucide icons the toolbar names a chart with (lucide 1.21.0, ISC), local
// for the reason lib/ui/block-viewer.ts gives.
const icon = (body: unknown) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const AXES = svg`<path d="M3 3v16a2 2 0 0 0 2 2h16"></path>`;
const TITLES: Record<string, { label: string; icon: () => unknown }> = {
  area: { label: 'Area Chart', icon: () => icon(svg`${AXES}<path d="M7 11.207a.5.5 0 0 1 .146-.353l2-2a.5.5 0 0 1 .708 0l3.292 3.292a.5.5 0 0 0 .708 0l4.292-4.292a.5.5 0 0 1 .854.353V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"></path>`) },
  bar: { label: 'Bar Chart', icon: () => icon(svg`${AXES}<rect x="15" y="5" width="4" height="12" rx="1"></rect><rect x="7" y="8" width="4" height="9" rx="1"></rect>`) },
  line: { label: 'Line Chart', icon: () => icon(svg`${AXES}<path d="m19 9-5 5-4-4-3 3"></path>`) },
  pie: { label: 'Pie Chart', icon: () => icon(svg`<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"></path><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>`) },
  radar: { label: 'Radar Chart', icon: () => icon(svg`<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>`) },
  radial: { label: 'Radial Chart', icon: () => icon(svg`<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"></path><path d="M4 6h.01"></path><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"></path><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"></path><path d="M12 18h.01"></path><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"></path><circle cx="12" cy="12" r="2"></circle><path d="m13.41 10.59 5.66-5.66"></path>`) },
  tooltip: { label: 'Tooltip', icon: () => icon(svg`<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"></path>`) },
};

const NAV_LINK = 'flex h-7 shrink-0 items-center justify-center px-4 text-center text-base font-medium text-muted-foreground no-underline transition-colors hover:text-primary data-[active=true]:text-primary';

/** shadcn's ChartsNav: one link per chart type. */
function chartsNav(current: string) {
  return html`<nav aria-label="Chart types" class="relative overflow-hidden">
    <div class="no-scrollbar max-w-[600px] overflow-x-auto lg:max-w-none">
      <div class="flex items-center">
        ${CHART_TYPES.map((t) => {
          const active = t.type === current;
          return html`<a href=${`/ui/charts/${t.type}#charts`} class=${NAV_LINK} data-active=${active ? 'true' : 'false'} aria-current=${active ? 'page' : null}>${t.name}</a>`;
        })}
      </div>
    </div>
  </nav>`;
}

/** shadcn's ChartToolbar and ChartCodeViewer: the title, the copy button and View Code. */
function toolbar(chart: RenderedChart) {
  const title = TITLES[chart.type] ?? TITLES.area;
  return html`<div class="relative z-20 flex items-center justify-end gap-2 px-3 py-2.5">
    <div class="flex items-center gap-1.5 pl-1 text-[13px] text-muted-foreground [&>svg]:h-[0.9rem] [&>svg]:w-[0.9rem]">${title.icon()} ${title.label}</div>
    <div class="ml-auto flex items-center gap-2">
      <ui-code-block-copy-button value=${chart.source} class="[&_button]:h-6 [&_button]:w-6 [&_button]:rounded-[6px] [&_button]:bg-transparent [&_button]:text-foreground [&_button]:shadow-none [&_button]:hover:bg-muted [&_svg]:h-3 [&_svg]:w-3"></ui-code-block-copy-button>
      <div role="none" data-slot="separator" data-orientation="vertical" class="mx-0 hidden h-4 w-px shrink-0 bg-border md:flex"></div>
      <ui-sheet>
        <ui-sheet-trigger>
          <button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'h-6 rounded-[6px] border bg-transparent px-2 text-xs text-foreground shadow-none hover:bg-muted dark:text-foreground')}>View Code</button>
        </ui-sheet-trigger>
        <ui-sheet-content side="right" class="flex flex-col gap-0 border-l-0 p-0 sm:max-w-sm md:w-[700px] md:max-w-[700px] dark:border-l">
          <div data-slot="sheet-header" class=${cn(sheetHeaderClass(), 'sr-only')}>
            <h2 data-slot="sheet-title" class=${sheetTitleClass()}>Code</h2>
            <p data-slot="sheet-description" class=${sheetDescriptionClass()}>View the code for the chart.</p>
          </div>
          <div class="flex min-h-0 flex-1 flex-col gap-0">
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
              <div class="flex h-12 shrink-0 items-center gap-2 border-b py-2 pr-2 pl-4 text-sm text-foreground">
                ${chart.target}
                <ui-code-block-copy-button class="ml-auto" value=${chart.source}></ui-code-block-copy-button>
              </div>
              <div class="no-scrollbar min-h-0 flex-1 overflow-y-auto">${codeFigure(chart.source)}</div>
            </div>
          </div>
        </ui-sheet-content>
      </ui-sheet>
    </div>
  </div>`;
}

/** shadcn's ChartDisplay: the toolbar over the chart's 460 pixel frame. */
export async function chartDisplay(name: string, opts: { fullWidth?: boolean } = {}) {
  const chart = await renderChart(name);
  if (!chart) return '';
  return html`<div data-chart-name=${chart.name} class=${cn('themes-wrapper group relative flex flex-col overflow-hidden rounded-xl transition-all duration-200 ease-in-out hover:z-30', opts.fullWidth && 'md:col-span-2 lg:col-span-3')}>
    ${toolbar(chart)}
    <div class="relative z-10 h-[460px] overflow-hidden rounded-xl bg-background">${unsafeHTML(chart.html)}</div>
  </div>`;
}

/** A charts page: the header, the type nav with `current` active, then `content`. */
export function chartsShell(pathname: string, current: string, content: unknown) {
  return html`
    ${extraStyleLinks(pathname)}
    <main id="main" class="flex flex-1 flex-col">
      ${uiPageHeader({
        title: CHARTS_TITLE,
        description: CHARTS_DESCRIPTION,
        actions: html`<span class="style-luma contents">
          <a href="#charts" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Browse Charts</a>
          <a href="/ui/docs/components/chart" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>Documentation</a>
        </span>`,
      })}
      ${pageNav(chartsNav(current), { id: 'charts' })}
      <div class="container-wrapper flex-1">
        <div class="container pb-6 style-new-york">
          <section class="theme-container">${content}</section>
        </div>
      </div>
    </main>
  `;
}
