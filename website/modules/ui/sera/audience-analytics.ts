/**
 * The Sera page's Audience Analytics screen, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/audience-analytics/ (index.tsx, the preview
 * header, the metrics grid, the traffic overview, demographics and top
 * editorials) element for element as server markup. The line chart is the
 * kit's server-rendered SVG, so it needs no deferred load.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  cardClass, cardContentClass, cardDescriptionClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { lineChart, type ChartConfig } from '#modules/ui/components/chart.ts';
import { progressClass } from '#modules/ui/components/progress.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import {
  tableBodyClass, tableCellClass, tableClass, tableContainerClass,
  tableHeadClass, tableHeaderClass, tableRowClass,
} from '#modules/ui/components/table.ts';
import { MoreHorizontalIcon } from '#lib/ui/lucide.ts';

// lucide icons written out so a button's icon can carry the data-icon
// attribute the sera button sizes key their padding on.
const icon = (paths: unknown, opts: { dataIcon?: string; cls?: string } = {}) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon=${opts.dataIcon ?? null} class=${opts.cls ?? null}>${paths}</svg>`;
const chevronDown = svg`<path d="m6 9 6 6 6-6"></path>`;
const download = svg`<path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path>`;
const trendingUp = svg`<path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path>`;
const trendingDown = svg`<path d="M16 17h6v-6"></path><path d="m22 17-8.5-8.5-5 5L2 7"></path>`;
const moveRight = svg`<path d="M18 8L22 12L18 16"></path><path d="M2 12H22"></path>`;
const arrowDown = svg`<path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>`;

const DATE_OPTIONS = [
  { label: 'Last 7 days', value: 'last-7-days' },
  { label: 'Last 30 days', value: 'last-30-days' },
  { label: 'This month', value: 'this-month' },
  { label: 'Last month', value: 'last-month' },
];

// The trigger shows the initial choice, Last 30 days; the menu checks the
// picked range, and the label does not follow it, since the page has no
// script of its own.
function previewHeader() {
  return html`<header>
    <div class="container flex flex-col items-center justify-center gap-(--gap) py-(--gap) sm:flex-row sm:justify-between">
      <div class="flex flex-col gap-2 text-center sm:text-left">
        <h1 class="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">Audience Analytics</h1>
        <div class="line-clamp-1 text-sm font-medium tracking-wider text-muted-foreground uppercase">Editorial Performance Dashboard</div>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'gap-2 sm:ml-auto md:gap-4')}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'bg-background hover:bg-background/80 data-popup-open:bg-background')}>
              Last 30 days ${icon(chevronDown, { dataIcon: 'inline-end' })}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align="end">
            <ui-dropdown-menu-group aria-label="Date range">
              ${DATE_OPTIONS.map((o) => html`<ui-dropdown-menu-item type="radio" value=${o.value} ?checked=${o.value === 'last-30-days'}>${o.label}</ui-dropdown-menu-item>`)}
            </ui-dropdown-menu-group>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>
          ${icon(download, { dataIcon: 'inline-start' })}
          <span class="lg:hidden">Export</span>
          <span class="hidden lg:inline">Export Report</span>
        </button>
      </div>
    </div>
  </header>`;
}

interface Metric {
  label: string;
  value: string;
  comparison: string;
  change: string;
  trend: 'up' | 'down';
}

const METRIC_CARDS: Metric[] = [
  { label: 'Total visitors', value: '248.5k', comparison: '12.4%', change: 'vs last period', trend: 'up' },
  { label: 'Unique readers', value: '182.1k', comparison: '8.7%', change: 'vs last period', trend: 'up' },
  { label: 'Avg. time on page', value: '3m 42s', comparison: '1.2%', change: 'vs last period', trend: 'down' },
  { label: 'Bounce rate', value: '42.8%', comparison: '3.5%', change: 'vs last period', trend: 'down' },
];

function metricCard(m: Metric) {
  return html`<div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-full gap-0 md:col-span-6 lg:col-span-3')}>
    <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-2')}>
      <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'text-xs uppercase')}>${m.label}</div>
      <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-5xl tracking-tight lowercase')}>${m.value}</div>
      <div data-slot="card-description" class=${cardDescriptionClass()}>
        ${icon(m.trend === 'up' ? trendingUp : trendingDown, { cls: 'inline-block size-2.5 text-muted-foreground' })}
        <span class="text-foreground">${m.comparison}</span>
        <span>${m.change}</span>
      </div>
    </div>
  </div>`;
}

const TRAFFIC_DATA = [
  { date: '2025-10-01', views: 2600, unique: 1600 },
  { date: '2025-10-04', views: 4500, unique: 3000 },
  { date: '2025-10-08', views: 3500, unique: 2500 },
  { date: '2025-10-10', views: 6400, unique: 4500 },
  { date: '2025-10-13', views: 5400, unique: 4000 },
  { date: '2025-10-15', views: 8300, unique: 6500 },
  { date: '2025-10-17', views: 7400, unique: 6000 },
  { date: '2025-10-18', views: 9240, unique: 7105 },
  { date: '2025-10-22', views: 7700, unique: 6400 },
  { date: '2025-10-26', views: 8800, unique: 7000 },
  { date: '2025-10-29', views: 9800, unique: 8400 },
];

const TRAFFIC_CONFIG = {
  views: { label: 'Views', theme: { light: 'var(--chart-5)', dark: 'var(--chart-1)' } },
  unique: { label: 'Unique', theme: { light: 'var(--chart-1)', dark: 'var(--chart-2)' } },
} satisfies ChartConfig;

const X_AXIS_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function formatXAxisTick(value: unknown): string {
  const date = new Date(`${String(value)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : X_AXIS_DATE.format(date);
}

// shadcn marks the peak with a Recharts ReferenceDot; here the views line
// draws that one dot itself.
const PEAK_DATE = '2025-10-18';

function trafficOverview() {
  return html`<div class="col-span-full md:col-span-6 lg:col-span-8">
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl')}>Traffic Overview</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Traffic for the last 30 days has increased by 12.4% compared to the previous period.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${lineChart({
          config: TRAFFIC_CONFIG,
          data: TRAFFIC_DATA,
          class: 'h-82 w-full',
          // Recharts fills the card at any width; the SVG keeps one aspect,
          // so its viewBox is the card's shape at a desktop width.
          width: 760,
          height: 328,
          title: 'Views and unique readers, October 1 to October 29',
          grid: { vertical: false, strokeDasharray: '3 6', class: 'stroke-border' },
          xAxis: { dataKey: 'date', tickLine: false, axisLine: false, interval: 'preserveStartEnd', tickMargin: 10, tickFormatter: formatXAxisTick },
          yAxis: { tickLine: false, axisLine: false, width: 44, domain: [0, 10000], hide: true },
          lines: [
            {
              dataKey: 'views',
              type: 'linear',
              stroke: 'var(--color-views)',
              strokeWidth: 2.2,
              dot: (p) => p.datum.date === PEAK_DATE
                ? svg`<circle cx=${p.cx} cy=${p.cy} r="2.5" fill="var(--color-views)" stroke="var(--color-views)"></circle>`
                : '',
              activeDot: { r: 3.5, fill: 'var(--color-views)' },
            },
            { dataKey: 'unique', type: 'linear', stroke: 'var(--color-unique)', strokeWidth: 2, strokeDasharray: '4 6', dot: false, activeDot: false },
          ],
        })}
      </div>
    </div>
  </div>`;
}

const DEMOGRAPHIC_DATA = [
  { age: '18 - 24', percentage: 22 },
  { age: '25 - 34', percentage: 64 },
  { age: '35 - 44', percentage: 12 },
  { age: '45+', percentage: 5 },
];

function demographics() {
  return html`<div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-full md:col-span-6 lg:col-span-4')}>
    <div data-slot="card-header" class=${cardHeaderClass()}>
      <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl')}>Demographics</div>
      <div data-slot="card-description" class=${cardDescriptionClass()}>Reader Profile</div>
    </div>
    <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-10')}>
      ${DEMOGRAPHIC_DATA.map((item, i) => html`
        <div data-slot="progress" class="flex flex-wrap gap-3">
          <span data-slot="progress-label" id=${`sera-demographics-${i}`} class="text-xs font-semibold tracking-wide uppercase">${item.age}</span>
          <span data-slot="progress-value" class="ml-auto text-sm text-muted-foreground tabular-nums">${item.percentage}%</span>
          <progress data-slot="progress-track" value=${item.percentage} max="100" aria-labelledby=${`sera-demographics-${i}`} class=${progressClass()}></progress>
        </div>`)}
    </div>
    <div data-slot="card-footer" class=${cardFooterClass()}>
      <button type="button" data-slot="button" data-variant="link" data-size="default" class=${cn(buttonClass({ variant: 'link' }), 'w-full')}>
        View all source ${icon(moveRight, { dataIcon: 'inline-end' })}
      </button>
    </div>
  </div>`;
}

interface EditorialRow {
  rank: number;
  title: string;
  author: string;
  published: string;
  pageviews: string;
  avgTime: string;
}

const EDITORIAL_ROWS: EditorialRow[] = [
  { rank: 1, title: 'The New Vanguard of Minimalist Architecture', author: 'Elena Rostova', published: 'Oct 12', pageviews: '45.2k', avgTime: '04:15' },
  { rank: 2, title: 'Autumn Sartorial Code: Deconstructed Classics', author: 'Julian Vance', published: 'Oct 05', pageviews: '38.9k', avgTime: '03:42' },
  { rank: 3, title: 'Interview: Director Sofia Coppola on The Aesthetics of Isolation', author: 'Marcus Trent', published: 'Sep 28', pageviews: '31.4k', avgTime: '06:20' },
  { rank: 4, title: "Sourcing Ceramics from Kyoto's Oldest Kilns", author: 'Sarah Lin', published: 'Oct 18', pageviews: '22.1k', avgTime: '02:55' },
  { rank: 5, title: 'Field Notes from Copenhagen Design Week', author: 'Noah Bennett', published: 'Oct 21', pageviews: '19.7k', avgTime: '03:18' },
  { rank: 6, title: "A Studio Visit with Milan's Most Elusive Lighting Designer", author: 'Claire Duval', published: 'Oct 09', pageviews: '17.4k', avgTime: '04:02' },
  { rank: 7, title: 'Collecting the New Avant-Garde in Contemporary Furniture', author: 'Tommy Rhodes', published: 'Sep 30', pageviews: '15.9k', avgTime: '03:36' },
  { rank: 8, title: "Inside Lisbon's Quiet Culinary Renaissance", author: 'Amara Iqbal', published: 'Oct 14', pageviews: '14.2k', avgTime: '05:08' },
  { rank: 9, title: 'Why Slow Interiors Are Defining the Next Luxury Wave', author: 'Henry Vale', published: 'Oct 03', pageviews: '12.7k', avgTime: '03:11' },
  { rank: 10, title: 'The Return of Print: Independent Magazine Covers to Watch', author: 'Mina Okafor', published: 'Sep 26', pageviews: '11.3k', avgTime: '02:49' },
];

const INITIAL_ROWS = 5;

function editorialRow(row: EditorialRow) {
  // A row past the first five shows once Load more is checked.
  const later = row.rank > INITIAL_ROWS;
  return html`<tr data-slot="table-row" class=${cn(tableRowClass(), later && 'hidden group-has-[[data-load-more]:checked]/editorial:table-row')}>
    <td data-slot="table-cell" class=${cn(tableCellClass(), 'translate-y-1 align-text-top')}>${row.rank}</td>
    <td data-slot="table-cell" class=${tableCellClass()}>
      <div class="flex flex-col gap-2">
        <p class="font-heading text-xl tracking-tight text-foreground">${row.title}</p>
        <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">By ${row.author}</p>
      </div>
    </td>
    <td data-slot="table-cell" class=${tableCellClass()}>${row.published}</td>
    <td data-slot="table-cell" class=${tableCellClass()}>${row.pageviews}</td>
    <td data-slot="table-cell" class=${tableCellClass()}>${row.avgTime}</td>
    <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger>
          <button type="button" aria-label=${`Open actions for ${row.title}`} data-slot="button" data-variant="ghost" data-size="icon-xs" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
            ${MoreHorizontalIcon()}
          </button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content align="end">
          <ui-dropdown-menu-item>Edit</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Publish</ui-dropdown-menu-item>
          <ui-dropdown-menu-item variant="destructive">Delete</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    </td>
  </tr>`;
}

// shadcn's Load more waits two seconds behind a spinner and then shows the
// rest. Here a checkbox shows them at once, so it works with no script.
function topEditorial() {
  return html`<div data-slot="card" data-size="default" class=${cn(cardClass(), 'group/editorial col-span-full')}>
    <div data-slot="card-header" class=${cardHeaderClass()}>
      <div class="flex flex-col gap-(--gap) sm:flex-row">
        <div class="flex flex-col gap-1.5">
          <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl')}>Top Editorials</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Ranked by engagement</div>
        </div>
        <ui-toggle-group type="single" value="views" variant="outline" aria-label="Top editorials metric selector" class="w-full sm:ml-auto sm:w-fit">
          <ui-toggle-group-item value="views" class="flex-1">VIEWS</ui-toggle-group-item>
          <ui-toggle-group-item value="time" class="flex-1">TIME</ui-toggle-group-item>
          <ui-toggle-group-item value="shares" class="flex-1">SHARES</ui-toggle-group-item>
        </ui-toggle-group>
      </div>
    </div>
    <div data-slot="card-content" class=${cn(cardContentClass(), 'flex-1 **:data-[slot=table-container]:no-scrollbar **:data-[slot=table-container]:overflow-y-hidden')}>
      <div data-slot="table-container" class=${tableContainerClass()}>
        <table data-slot="table" class=${tableClass()}>
          <thead data-slot="table-header" class=${tableHeaderClass()}>
            <tr data-slot="table-row" class=${tableRowClass()}>
              <th data-slot="table-head" scope="col" class=${tableHeadClass()}>#</th>
              <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Title</th>
              <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Published</th>
              <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Page Views</th>
              <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Read Time</th>
              <th data-slot="table-head" scope="col" class=${cn(tableHeadClass(), 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody data-slot="table-body" class=${tableBodyClass()}>
            ${EDITORIAL_ROWS.map(editorialRow)}
          </tbody>
        </table>
      </div>
    </div>
    <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-center group-has-[[data-load-more]:checked]/editorial:hidden')}>
      <input type="checkbox" id="sera-top-editorial-more" data-load-more class="peer sr-only">
      <label for="sera-top-editorial-more" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'cursor-pointer peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50')}>
        Load more content ${icon(arrowDown, { dataIcon: 'inline-end' })}
      </label>
    </div>
  </div>`;
}

export function audienceAnalytics() {
  return html`<div class="preview theme-taupe @container/preview w-full flex-1 bg-muted pt-4 font-sans ring-1 ring-foreground/5 [--gap:--spacing(4)] sm:pt-0 md:[--gap:--spacing(6)] xl:[--gap:--spacing(8)] 2xl:py-8 **:[.container]:px-(--gap)">
    ${previewHeader()}
    <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'hidden sm:block')}></div>
    <div class="container grid grid-cols-12 gap-(--gap) py-(--gap)">
      ${METRIC_CARDS.map(metricCard)}
      ${trafficOverview()}
      ${demographics()}
      ${topEditorial()}
    </div>
  </div>`;
}
