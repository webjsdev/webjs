/**
 * The preview-02 savings progress card: a donut chart of saved against
 * remaining with the total in its centre, over three summary rows. A
 * fragment helper; the chart is the kit's `<ui-chart>`, drawn by the server.
 * Installed at `components/preview-02/savings-progress.ts`. Ported from
 * shadcn/ui's preview-02.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass, cardContentClass, cardFooterClass } from '../../../components/card.ts';
import { pieChart, type ChartConfig } from '../../../components/chart.ts';
import { separatorClass } from '../../../components/separator.ts';

const chartData = [
  { name: 'saved', value: 24000, fill: 'var(--color-saved)' },
  { name: 'remaining', value: 6000, fill: 'var(--color-remaining)' },
];

const chartConfig: ChartConfig = {
  saved: { label: 'Saved', color: 'var(--chart-2)' },
  remaining: { label: 'Remaining', color: 'var(--chart-1)' },
};

const separator = () => html`<div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>`;

function row(label: string, value: string, numeric = false) {
  return html`<div class="flex w-full items-center justify-between py-3">
    <span class="text-sm text-muted-foreground">${label}</span>
    <span class=${numeric ? 'text-sm font-semibold tabular-nums' : 'text-sm font-semibold'}>${value}</span>
  </div>`;
}

export function savingsProgress() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-content" class=${cardContentClass()}>
        ${pieChart({
          config: chartConfig,
          data: chartData,
          title: 'Savings progress: $24,000 saved, 80% of $30,000',
          class: 'mx-auto aspect-square max-h-[220px]',
          tooltip: { cursor: false, hideLabel: true },
          pies: [{
            dataKey: 'value',
            nameKey: 'name',
            innerRadius: 70,
            outerRadius: 95,
            strokeWidth: 0,
            startAngle: 90,
            endAngle: -270,
            center: ({ cx, cy }) => svg`
              <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="middle">
                <tspan x=${cx} y=${cy - 12} class="fill-foreground text-2xl font-bold">$24,000</tspan>
                <tspan x=${cx} y=${cy + 12} class="fill-muted-foreground text-xs">80% of $30,000</tspan>
              </text>`,
          }],
        })}
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-0')}>
        ${row('Projected Finish', 'October 2024')}
        ${separator()}
        ${row('Monthly Average', '$1,250', true)}
        ${separator()}
        ${row('Top Contributor', 'Auto-Transfer')}
      </div>
    </div>
  `;
}
