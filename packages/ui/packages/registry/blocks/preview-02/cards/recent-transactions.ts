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
import { CarIcon, CoffeeIcon, MoreHorizontalIcon, ShoppingCartIcon, TvIcon, WalletIcon } from '../../../lib/icons.ts';

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
