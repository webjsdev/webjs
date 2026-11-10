import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass,
  tableRowClass, tableHeadClass, tableCellClass,
} from '#modules/ui/components/table.ts';
import { ArrowUpDown, ChevronDown, MoreHorizontal } from '#lib/ui/lucide.ts';

/**
 * shadcn's payments data table (apps/v4/examples/radix/data-table-demo.tsx),
 * the Data Table docs page's lead demo and its RTL demo (#1666). The table is
 * kit table helpers rendered by the server in its first state: every row in
 * data order, nothing selected, every column shown, page one. The
 * <data-table-demo> element (components/data-table-demo.ts) adds the email
 * filter, the email sort, the column visibility menu, row selection and
 * pagination, reading the rows from this markup, so with JavaScript off the
 * table still reads in full.
 *
 * Each row carries its values as data attributes, and each cell names its
 * column with `data-col`, which is all the element needs.
 */

export interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
}

export const payments: Payment[] = [
  { id: 'm5gr84i9', amount: 316, status: 'success', email: 'ken99@example.com' },
  { id: '3u1reuv4', amount: 242, status: 'success', email: 'Abe45@example.com' },
  { id: 'derv1ws0', amount: 837, status: 'processing', email: 'Monserrat44@example.com' },
  { id: '5kma53ae', amount: 874, status: 'success', email: 'Silas22@example.com' },
  { id: 'bhqecj4p', amount: 721, status: 'failed', email: 'carmella@example.com' },
];

/** The strings the table shows, shadcn's translations shape. */
export interface DataTableStrings {
  filterEmails: string;
  columns: string;
  status: string;
  email: string;
  amount: string;
  actions: string;
  copyPaymentId: string;
  viewCustomer: string;
  viewPaymentDetails: string;
  selectAll: string;
  selectRow: string;
  openMenu: string;
  noResults: string;
  rowsSelected: string;
  rowsSelectedSuffix: string;
  previous: string;
  next: string;
  success: string;
  processing: string;
  failed: string;
  pending: string;
}

export const EN: DataTableStrings = {
  filterEmails: 'Filter emails...',
  columns: 'Columns',
  status: 'Status',
  email: 'Email',
  amount: 'Amount',
  actions: 'Actions',
  copyPaymentId: 'Copy payment ID',
  viewCustomer: 'View customer',
  viewPaymentDetails: 'View payment details',
  selectAll: 'Select all',
  selectRow: 'Select row',
  openMenu: 'Open menu',
  noResults: 'No results.',
  rowsSelected: 'of',
  rowsSelectedSuffix: 'row(s) selected.',
  previous: 'Previous',
  next: 'Next',
  success: 'success',
  processing: 'processing',
  failed: 'failed',
  pending: 'pending',
};

export interface PaymentsTableOptions {
  t?: DataTableStrings;
  dir?: 'ltr' | 'rtl';
  lang?: string;
  /** The locale the amounts are formatted in. */
  locale?: string;
  /** Rows per page, TanStack's default of 10. */
  pageSize?: number;
  data?: Payment[];
}

export function paymentsTable(opts: PaymentsTableOptions = {}) {
  const t = opts.t ?? EN;
  const rtl = opts.dir === 'rtl';
  const data = opts.data ?? payments;
  const pageSize = opts.pageSize ?? 10;
  const money = new Intl.NumberFormat(opts.locale ?? 'en-US', { style: 'currency', currency: 'USD' });
  const firstPage = data.slice(0, pageSize);
  // The hideable columns, in shadcn's order; the column id is what the menu shows.
  const hideable = ['status', 'email', 'amount'];
  const amountAlign = rtl ? 'text-start' : 'text-right';

  return html`
    <data-table-demo class="w-full" page-size=${pageSize} dir=${opts.dir ?? nothing} lang=${opts.lang ?? nothing}>
      <div class=${cn('flex items-center py-4', rtl ? 'gap-2' : '')}>
        <input type="search" data-slot="input" data-table-filter aria-label=${t.filterEmails} placeholder=${t.filterEmails} class=${cn(inputClass(), 'max-w-sm')}>
        <ui-dropdown-menu class="ms-auto">
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
              ${t.columns} ${ChevronDown()}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align=${rtl ? 'start' : 'end'}>
            <ui-dropdown-menu-group>
              ${hideable.map((col) => html`<ui-dropdown-menu-item type="checkbox" value=${col} checked class="capitalize" data-table-column-toggle=${col}>${col}</ui-dropdown-menu-item>`)}
            </ui-dropdown-menu-group>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </div>
      <div class="overflow-hidden rounded-md border">
        <div data-slot="table-container" class=${tableContainerClass()}>
          <table data-slot="table" class=${tableClass()}>
            <thead data-slot="table-header" class=${tableHeaderClass()}>
              <tr data-slot="table-row" class=${tableRowClass()}>
                <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'pr-0')}>
                  <input type="checkbox" data-slot="checkbox" data-table-select-all aria-label=${t.selectAll} class=${checkboxClass()}>
                </th>
                <th scope="col" data-slot="table-head" data-col="status" class=${tableHeadClass()}>${t.status}</th>
                <th scope="col" data-slot="table-head" data-col="email" aria-sort="none" class=${tableHeadClass()}>
                  <button type="button" data-slot="button" data-variant="ghost" data-size="default" data-table-sort="email" class=${buttonClass({ variant: 'ghost' })}>
                    ${t.email} ${ArrowUpDown()}
                  </button>
                </th>
                <th scope="col" data-slot="table-head" data-col="amount" class=${tableHeadClass()}><div class=${amountAlign}>${t.amount}</div></th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}><span class="sr-only">${t.actions}</span></th>
              </tr>
            </thead>
            <tbody data-slot="table-body" class=${tableBodyClass()}>
              ${data.map((p, i) => html`
                <tr data-slot="table-row" data-table-row data-id=${p.id} data-email=${p.email} ?hidden=${i >= pageSize} class=${tableRowClass()}>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'pr-0')}>
                    <input type="checkbox" data-slot="checkbox" data-table-select-row aria-label=${t.selectRow} class=${checkboxClass()}>
                  </td>
                  <td data-slot="table-cell" data-col="status" class=${tableCellClass()}><div class="capitalize">${t[p.status]}</div></td>
                  <td data-slot="table-cell" data-col="email" class=${tableCellClass()}><div class="lowercase">${p.email}</div></td>
                  <td data-slot="table-cell" data-col="amount" class=${tableCellClass()}><div class=${cn(amountAlign, 'font-medium')}>${money.format(p.amount)}</div></td>
                  <td data-slot="table-cell" class=${tableCellClass()}>
                    <ui-dropdown-menu>
                      <ui-dropdown-menu-trigger>
                        <button type="button" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
                          <span class="sr-only">${t.openMenu}</span>
                          ${MoreHorizontal()}
                        </button>
                      </ui-dropdown-menu-trigger>
                      <ui-dropdown-menu-content align="end" class="w-40">
                        <ui-dropdown-menu-group>
                          <ui-dropdown-menu-label>${t.actions}</ui-dropdown-menu-label>
                          <ui-dropdown-menu-item data-table-copy=${p.id}>${t.copyPaymentId}</ui-dropdown-menu-item>
                        </ui-dropdown-menu-group>
                        ${rtl ? html`<ui-dropdown-menu-separator></ui-dropdown-menu-separator>` : ''}
                        <ui-dropdown-menu-group>
                          <ui-dropdown-menu-item>${t.viewCustomer}</ui-dropdown-menu-item>
                          <ui-dropdown-menu-item>${t.viewPaymentDetails}</ui-dropdown-menu-item>
                        </ui-dropdown-menu-group>
                      </ui-dropdown-menu-content>
                    </ui-dropdown-menu>
                  </td>
                </tr>`)}
              <tr data-slot="table-row" data-table-empty ?hidden=${data.length > 0} class=${tableRowClass()}>
                <td data-slot="table-cell" colspan="5" class=${cn(tableCellClass(), 'h-24 text-center')}>${t.noResults}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class=${cn('flex items-center justify-end py-4', rtl ? 'gap-2' : 'space-x-2')}>
        <div class="flex-1 text-sm text-muted-foreground" aria-live="polite">
          <span data-table-selected>0</span> ${t.rowsSelected} <span data-table-filtered>${data.length}</span> ${t.rowsSelectedSuffix}
        </div>
        <div class=${rtl ? 'flex gap-2' : 'space-x-2'}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" data-table-page="prev" disabled class=${buttonClass({ variant: 'outline', size: 'sm' })}>${t.previous}</button>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" data-table-page="next" ?disabled=${firstPage.length >= data.length} class=${buttonClass({ variant: 'outline', size: 'sm' })}>${t.next}</button>
        </div>
      </div>
    </data-table-demo>
  `;
}
