/**
 * The preview-02 "Recent Transactions" card: a table of the latest account
 * activity, each row with an actions menu. A fragment helper; the menus are
 * the kit's `<ui-dropdown-menu>`. Installed at
 * `components/preview-02/recent-transactions.ts`. Ported from shadcn/ui's
 * preview-02.
 *
 * The transactions are sample data. Replace them with your own and make each
 * menu item a link or a form posting to the matching action.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  tableBodyClass,
  tableCellClass,
  tableClass,
  tableContainerClass,
  tableRowClass,
} from '../../../components/table.ts';
import '../../../components/dropdown-menu.ts';

const CoffeeIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v2"></path><path d="M14 2v2"></path><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"></path><path d="M6 2v2"></path></svg>`;
const ShoppingCartIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>`;
const WalletIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>`;
const CarIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>`;
const TvIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2-5 5-5-5"></path><rect width="20" height="15" x="2" y="7" rx="2"></rect></svg>`;
const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

interface Transaction {
  icon: (cls?: string) => TemplateResult;
  name: string;
  category: string;
  date: string;
  amount: string;
  income?: boolean;
}

const TRANSACTIONS: Transaction[] = [
  { icon: CoffeeIcon, name: 'Blue Bottle Coffee', category: 'Food & Drink', date: 'Today, 10:24 AM', amount: '-$6.50' },
  { icon: ShoppingCartIcon, name: 'Whole Foods Market', category: 'Groceries', date: 'Yesterday', amount: '-$142.30' },
  { icon: WalletIcon, name: 'Stripe Payout', category: 'Income', date: 'Oct 12', amount: '+$4,200.00', income: true },
  { icon: CarIcon, name: 'Uber Technologies', category: 'Transport', date: 'Oct 11', amount: '-$24.10' },
  { icon: TvIcon, name: 'Netflix Subscription', category: 'Entertainment', date: 'Oct 10', amount: '-$19.99' },
];

export function recentTransactions() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Recent Transactions</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Your latest account activity.</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <a href="#" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>View All</a>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="table-container" class=${tableContainerClass()}>
          <table data-slot="table" class=${tableClass()}>
            <tbody data-slot="table-body" class=${tableBodyClass()}>
              ${TRANSACTIONS.map((t) => html`
                <tr data-slot="table-row" class=${tableRowClass()}>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'w-10')}>
                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">${t.icon('size-4 shrink-0')}</div>
                  </td>
                  <td data-slot="table-cell" class=${tableCellClass()}>
                    <div class="flex flex-col">
                      <span class="font-medium">${t.name}</span>
                      <span class="text-sm text-muted-foreground">${t.category}</span>
                    </div>
                  </td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-sm text-muted-foreground')}>${t.date}</td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>
                    <span class=${cn('text-sm font-semibold tabular-nums', t.income && 'text-emerald-500')}>${t.amount}</span>
                  </td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'w-8')}>
                    <ui-dropdown-menu>
                      <ui-dropdown-menu-trigger>
                        <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label=${`Actions for ${t.name}`} class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>${MoreHorizontalIcon()}</button>
                      </ui-dropdown-menu-trigger>
                      <ui-dropdown-menu-content align="end">
                        <ui-dropdown-menu-item>View details</ui-dropdown-menu-item>
                        <ui-dropdown-menu-item>Add note</ui-dropdown-menu-item>
                        <ui-dropdown-menu-item>Categorize</ui-dropdown-menu-item>
                        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                        <ui-dropdown-menu-item>Dispute</ui-dropdown-menu-item>
                      </ui-dropdown-menu-content>
                    </ui-dropdown-menu>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
