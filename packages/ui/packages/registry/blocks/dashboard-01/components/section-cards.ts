/**
 * The dashboard-01 section cards: four headline metrics, each with its
 * trend badge and a two-line footer. A fragment helper. Ported from
 * shadcn/ui's dashboard-01.
 *
 * The figures are sample data. Compute them on the server (a query in a
 * `'use server'` file) and pass them in.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardActionClass,
  cardClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const TrendingUpIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path></svg>`;
const TrendingDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 17h6v-6"></path><path d="m22 17-8.5-8.5-5 5L2 7"></path></svg>`;

interface Metric {
  label: string;
  value: string;
  change: string;
  trend: (cls?: string) => TemplateResult;
  summary: string;
  detail: string;
}

const metrics: Metric[] = [
  { label: 'Total Revenue', value: '$1,250.00', change: '+12.5%', trend: TrendingUpIcon, summary: 'Trending up this month', detail: 'Visitors for the last 6 months' },
  { label: 'New Customers', value: '1,234', change: '-20%', trend: TrendingDownIcon, summary: 'Down 20% this period', detail: 'Acquisition needs attention' },
  { label: 'Active Accounts', value: '45,678', change: '+12.5%', trend: TrendingUpIcon, summary: 'Strong user retention', detail: 'Engagement exceed targets' },
  { label: 'Growth Rate', value: '4.5%', change: '+4.5%', trend: TrendingUpIcon, summary: 'Steady performance increase', detail: 'Meets growth projections' },
];

export function sectionCards() {
  return html`
    <div class="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      ${metrics.map((m) => html`
        <div data-slot="card" data-size="default" class=${cn(cardClass(), '@container/card')}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-description" class=${cardDescriptionClass()}>${m.label}</div>
            <div data-slot="card-title" class=${cn(cardTitleClass(), 'text-2xl font-semibold tabular-nums @[250px]/card:text-3xl')}>${m.value}</div>
            <div data-slot="card-action" class=${cardActionClass()}>
              <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>${m.trend()}${m.change}</span>
            </div>
          </div>
          <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col items-start gap-1.5 text-sm')}>
            <div class="line-clamp-1 flex gap-2 font-medium">${m.summary} ${m.trend('size-4')}</div>
            <div class="text-muted-foreground">${m.detail}</div>
          </div>
        </div>
      `)}
    </div>
  `;
}
