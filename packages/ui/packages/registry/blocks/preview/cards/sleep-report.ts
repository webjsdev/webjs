/**
 * The preview block's sleep report card: last night's sleep stages as a
 * stacked bar chart, the time in each stage, and a score. A fragment helper;
 * the chart is the kit's `barChart`, drawn by the server. Installed by
 * `npx @webjsdev/ui add preview` at `components/preview/sleep-report.ts`.
 * Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { barChart, type ChartConfig } from '../../../components/chart.ts';

const sleepChartData = [
  { hour: '10pm', deep: 0, light: 30, rem: 0 },
  { hour: '11pm', deep: 20, light: 10, rem: 0 },
  { hour: '12am', deep: 40, light: 0, rem: 10 },
  { hour: '1am', deep: 30, light: 5, rem: 15 },
  { hour: '2am', deep: 10, light: 20, rem: 30 },
  { hour: '3am', deep: 25, light: 10, rem: 20 },
  { hour: '4am', deep: 15, light: 25, rem: 10 },
  { hour: '5am', deep: 5, light: 35, rem: 15 },
  { hour: '6am', deep: 0, light: 20, rem: 25 },
];

const sleepChartConfig: ChartConfig = {
  deep: { label: 'Deep', color: 'var(--chart-1)' },
  light: { label: 'Light', color: 'var(--chart-2)' },
  rem: { label: 'REM', color: 'var(--chart-3)' },
};

const STATS = [
  { label: 'Deep', value: '2h 10m' },
  { label: 'Light', value: '3h 48m' },
  { label: 'REM', value: '1h 26m' },
  { label: 'Score', value: '84' },
];

export function sleepReport() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Sleep Report</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Last night · 7h 24m</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-3')}>
        ${barChart({
          config: sleepChartConfig,
          data: sleepChartData,
          class: 'h-32 w-full',
          title: 'Sleep stages by hour, last night',
          width: 330,
          height: 128,
          margin: { left: 0, right: 0, top: 0, bottom: 0 },
          tooltip: false,
          bars: [
            { dataKey: 'deep', stackId: 'a', fill: 'var(--color-deep)', radius: 0, barSize: 16 },
            { dataKey: 'light', stackId: 'a', fill: 'var(--color-light)', radius: 0, barSize: 16 },
            { dataKey: 'rem', stackId: 'a', fill: 'var(--color-rem)', radius: [2, 2, 0, 0], barSize: 16 },
          ],
        })}
        <div class="grid grid-cols-4 gap-2">
          ${STATS.map((s) => html`
            <div class="text-center">
              <div class="text-sm font-medium tabular-nums">${s.value}</div>
              <div class="text-xs text-muted-foreground">${s.label}</div>
            </div>
          `)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>Good</span>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'ml-auto')}>Details</button>
      </div>
    </div>
  `;
}
