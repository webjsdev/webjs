/**
 * The dashboard-01 visitors chart: a stacked area chart of desktop and mobile
 * visitors, with a time-range control (a toggle group on a wide card, a
 * select on a narrow one) that narrows it to the last 3 months, 30 days or 7
 * days. Ported from shadcn/ui's dashboard-01.
 *
 * The server draws all three ranges with the kit's `areaChart` and shows the
 * 3-month one, so the first paint is the complete chart and it reads with
 * JavaScript off. The `<dashboard-01-chart-range>` element below only swaps
 * which range is shown and keeps the two controls in step. shadcn also starts
 * a phone on the 7-day range; here a phone starts on 3 months like any other
 * screen, since the server cannot know the width.
 *
 * The figures are sample data. Query your own on the server and pass them to
 * the chart the same way.
 */
import { WebComponent, html, svg } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { areaChart, type ChartConfig } from '../../../components/chart.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import '../../../components/select.ts';
import '../../../components/toggle-group.ts';

export const description = 'An interactive area chart';

const chartData: { date: string; desktop: number; mobile: number }[] = [
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
    color: 'var(--primary)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

const RANGES = [
  { value: '90d', days: 90, label: 'Last 3 months' },
  { value: '30d', days: 30, label: 'Last 30 days' },
  { value: '7d', days: 7, label: 'Last 7 days' },
];

const DAY = 24 * 60 * 60 * 1000;
const REFERENCE = Date.parse('2024-06-30');

// The dates are calendar dates, so they are read and written in UTC: a server
// west of Greenwich would otherwise print every tick a day early.
const shortDate = (value: unknown) =>
  new Date(String(value)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function rangeChart(range: (typeof RANGES)[number]) {
  const start = REFERENCE - range.days * DAY;
  const data = chartData.filter((item) => Date.parse(item.date) >= start);
  // Gradient ids are per range, since all three charts sit on one page.
  const desktop = `fillDesktop-${range.value}`;
  const mobile = `fillMobile-${range.value}`;
  return areaChart({
    config: chartConfig,
    data,
    title: `Desktop and mobile visitors, ${range.label.toLowerCase()}`,
    class: 'aspect-auto h-[250px] w-full',
    width: 1046,
    height: 250,
    defs: svg`
      <linearGradient id=${desktop} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stop-color="var(--color-desktop)" stop-opacity="1"></stop>
        <stop offset="95%" stop-color="var(--color-desktop)" stop-opacity="0.1"></stop>
      </linearGradient>
      <linearGradient id=${mobile} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stop-color="var(--color-mobile)" stop-opacity="0.8"></stop>
        <stop offset="95%" stop-color="var(--color-mobile)" stop-opacity="0.1"></stop>
      </linearGradient>
    `,
    grid: { vertical: false },
    xAxis: { dataKey: 'date', tickLine: false, axisLine: false, tickMargin: 8, minTickGap: 32, tickFormatter: shortDate },
    tooltip: { cursor: false, indicator: 'dot', labelFormatter: shortDate },
    areas: [
      { dataKey: 'mobile', type: 'natural', fill: `url(#${mobile})`, stroke: 'var(--color-mobile)', stackId: 'a' },
      { dataKey: 'desktop', type: 'natural', fill: `url(#${desktop})`, stroke: 'var(--color-desktop)', stackId: 'a' },
    ],
  });
}

export function chartAreaInteractive() {
  return html`
    <dashboard-01-chart-range>
      <div data-slot="card" data-size="default" class=${cn(cardClass(), '@container/card')}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Total Visitors</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>
            <span class="hidden @[540px]/card:block">Total for the last 3 months</span>
            <span class="@[540px]/card:hidden">Last 3 months</span>
          </div>
          <div data-slot="card-action" class=${cardActionClass()}>
            <ui-toggle-group type="single" value="90d" variant="outline" spacing="0" class="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex">
              ${RANGES.map((r) => html`<ui-toggle-group-item value=${r.value}>${r.label}</ui-toggle-group-item>`)}
            </ui-toggle-group>
            <ui-select size="sm">
              <select aria-label="Select a value" class=${cn(selectTriggerClass(), 'flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden')}>
                ${RANGES.map((r) => html`<option value=${r.value} ?selected=${r.value === '90d'}>${r.label}</option>`)}
              </select>
            </ui-select>
          </div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'px-2 pt-4 sm:px-6 sm:pt-6')}>
          ${RANGES.map((r) => html`<div data-range=${r.value} ?hidden=${r.value !== '90d'}>${rangeChart(r)}</div>`)}
        </div>
      </div>
    </dashboard-01-chart-range>
  `;
}

/**
 * `<dashboard-01-chart-range>`: shows the range the toggle group or the select
 * picks, and moves the other control to match. The charts themselves are the
 * server's; nothing is redrawn here.
 */
export class Dashboard01ChartRange extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-value-change', this._onToggle);
    this.addEventListener('change', this._onSelect);
  }

  disconnectedCallback() {
    this.removeEventListener('ui-value-change', this._onToggle);
    this.removeEventListener('change', this._onSelect);
    super.disconnectedCallback();
  }

  _show(value: string): void {
    if (!RANGES.some((r) => r.value === value)) return;
    for (const panel of Array.from(this.querySelectorAll<HTMLElement>('[data-range]'))) {
      panel.hidden = panel.dataset.range !== value;
    }
    const group = this.querySelector('ui-toggle-group') as (HTMLElement & { value: string }) | null;
    if (group && group.value !== value) group.value = value;
    const select = this.querySelector<HTMLSelectElement>('ui-select select');
    if (select && select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // A single toggle group can be emptied by pressing the active item; the
  // range then stays where it was, so put the pressed state back.
  _onToggle = (e: Event): void => {
    const target = e.target as Element;
    if (target.tagName !== 'UI-TOGGLE-GROUP') return;
    const value = String((e as CustomEvent<{ value: string }>).detail?.value ?? '');
    if (value) this._show(value);
    else this._show(this.querySelector<HTMLElement>('[data-range]:not([hidden])')?.dataset.range ?? '90d');
  };

  _onSelect = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    if (select.tagName === 'SELECT') this._show(select.value);
  };

  render() {
    return html`<slot></slot>`;
  }
}
Dashboard01ChartRange.register('dashboard-01-chart-range');
