/**
 * The preview-02 Upcoming Payments card: a month calendar over the payments
 * scheduled next. A fragment helper; the calendar is the kit's
 * `<ui-calendar>`, opened on today. Installed by
 * `npx @webjsdev/ui add preview-02` at
 * `components/preview-02/upcoming-payments.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The payments below are sample data. List the ones scheduled around the
 * selected day from your own data.
 */
import { html } from '@webjsdev/core';
import { badgeClass } from '../../../components/badge.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  itemClass,
  itemContentClass,
  itemDescriptionClass,
  itemGroupClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/calendar.ts';

const PAYMENTS = [
  { title: 'Netflix Subscription', date: 'Apr 15, 2024', amount: '$19.99' },
  { title: 'Rent Payment', date: 'Apr 1, 2024', amount: '$2,400.00' },
  { title: 'Auto Insurance', date: 'Apr 22, 2024', amount: '$186.00' },
];

/** Today as the calendar's value, "YYYY-MM-DD". */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function upcomingPayments() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Upcoming Payments</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Select a date to view scheduled payments.</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div data-slot="item" data-variant="outline" data-size="default" class=${cn(itemClass({ variant: 'outline' }), 'justify-center')}>
          <ui-calendar mode="single" value=${today()} aria-label="Payment date" class="w-full [--cell-size:--spacing(8)] md:[--cell-size:--spacing(10)] style-sera:md:[--cell-size:--spacing(9)]"></ui-calendar>
        </div>
        <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'w-full')}>
          ${PAYMENTS.map((p) => html`
            <div role="listitem" data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
              <div data-slot="item-content" class=${itemContentClass()}>
                <div data-slot="item-title" class=${itemTitleClass()}>${p.title}</div>
                <p data-slot="item-description" class=${itemDescriptionClass()}>${p.date}</p>
              </div>
              <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>${p.amount}</span>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
