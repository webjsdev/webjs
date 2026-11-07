/**
 * The preview block's usage card: this billing cycle's usage, one row per
 * meter with a small circular gauge. A fragment helper, rendered by the
 * server. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/usage-card.ts`. Ported from shadcn/ui's preview block.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { cardClass, cardContentClass, cardHeaderClass, cardTitleClass } from '../../../components/card.ts';
import {
  itemActionsClass,
  itemClass,
  itemContentClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';

// Usage items with percentage and value.
const items = [
  { name: 'Edge Requests', value: '$1.83K', percentage: 67.34 },
  { name: 'Fast Data Transfer', percentage: 52.18, value: '$952.51' },
  { name: 'Monitoring data points', percentage: 89.42, value: '$901.20' },
  { name: 'Web Analytics Events', percentage: 45.67, value: '$603.71' },
  { name: 'ISR Writes', percentage: 26.23, value: '524.52K / 2M' },
  { name: 'Function Duration', percentage: 5.11, value: '5.11 GB Hrs / 1K GB Hrs' },
];

/** A 16px ring filled to `percentage`. */
function circularGauge(percentage: number) {
  const normalized = Math.min(Math.max(percentage, 0), 100);
  const circumference = 2 * Math.PI * 42.5;
  const strokePercent = (normalized / 100) * circumference;
  return html`<svg aria-hidden="true" fill="none" height="16" width="16" stroke-width="2" viewBox="0 0 100 100" class="-rotate-90">${svg`
    <circle cx="50" cy="50" r="42.5" stroke-width="12" stroke-dashoffset="0" stroke-linecap="round" stroke-linejoin="round" class="opacity-20" stroke="currentColor" style=${`stroke-dasharray: ${circumference} ${circumference}`}></circle>
    <circle cx="50" cy="50" r="42.5" stroke-width="12" stroke-dashoffset="0" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor" class="transition-all duration-300" style=${`stroke-dasharray: ${strokePercent} ${circumference}`}></circle>
  `}</svg>`;
}

export function usageCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'w-full max-w-sm gap-4')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cn(cardTitleClass(), 'px-1 text-sm')}>5 days remaining in cycle</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'gap-0')}>
          ${items.map((item) => html`
            <a href="#" role="listitem" data-slot="item" data-variant="default" data-size="xs" class=${cn(itemClass({ size: 'xs' }), 'px-0 group-hover/item-group:bg-transparent')}>
              <div data-slot="item-media" data-variant="icon" class=${cn(itemMediaClass({ variant: 'icon' }), 'text-primary')}>${circularGauge(item.percentage)}</div>
              <div data-slot="item-content" class=${cn(itemContentClass(), 'inline-block truncate')}>
                <div data-slot="item-title" class=${cn(itemTitleClass(), 'inline')}>${item.name}</div>
              </div>
              <div data-slot="item-actions" class=${itemActionsClass()}>
                <span class="font-mono text-xs font-medium text-muted-foreground tabular-nums">${item.value}</span>
              </div>
            </a>
          `)}
        </div>
      </div>
    </div>
  `;
}
