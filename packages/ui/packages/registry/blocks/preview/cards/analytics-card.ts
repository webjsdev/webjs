/**
 * The preview block's analytics card: monthly visitors as an area chart under
 * a headline figure. A fragment helper; the chart is the kit's `areaChart`,
 * drawn by the server, with March's tooltip showing from the first paint.
 * Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/analytics-card.ts`. Ported from shadcn/ui's preview
 * block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { areaChart, type ChartConfig } from '../../../components/chart.ts';

// Monthly visitor data for the area chart.
const chartData = [
  { month: 'January', visitors: 186 },
  { month: 'February', visitors: 305 },
  { month: 'March', visitors: 237 },
  { month: 'April', visitors: 73 },
  { month: 'May', visitors: 209 },
  { month: 'June', visitors: 214 },
];

// Chart configuration for the visitors dataset.
const chartConfig: ChartConfig = {
  visitors: { label: 'Visitors', color: 'var(--chart-1)' },
};

export function analyticsCard() {
  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-full max-w-sm data-[size=sm]:pb-0')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Analytics</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          418.2K Visitors <span data-slot="badge" data-variant="default" class=${badgeClass()}>+10%</span>
        </div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>View Analytics</button>
        </div>
      </div>
      ${areaChart({
        config: chartConfig,
        data: chartData,
        class: 'aspect-[1/0.35]',
        title: 'Visitors by month, January to June',
        width: 384,
        height: 134,
        margin: { left: 0, right: 0 },
        tooltip: { cursor: false, indicator: 'line', hideLabel: true, defaultIndex: 2 },
        areas: [
          { dataKey: 'visitors', type: 'linear', fill: 'var(--color-visitors)', fillOpacity: 0.4, stroke: 'var(--color-visitors)' },
        ],
      })}
    </div>
  `;
}
