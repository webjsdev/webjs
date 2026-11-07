/**
 * The preview block's invoice card: the line items, subtotal, tax and total
 * in a table, with download and pay buttons. A fragment helper, rendered by
 * the server. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/invoice.ts`. Ported from shadcn/ui's preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  tableBodyClass,
  tableCellClass,
  tableClass,
  tableContainerClass,
  tableHeadClass,
  tableHeaderClass,
  tableRowClass,
} from '../../../components/table.ts';

const INVOICE_ITEMS = [
  { item: 'Design System License', qty: 1, unitPrice: 499 },
  { item: 'Priority Support', qty: 12, unitPrice: 99 },
  { item: 'Custom Components', qty: 3, unitPrice: 250 },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

export function invoice() {
  const subtotal = INVOICE_ITEMS.reduce((sum, row) => sum + row.qty * row.unitPrice, 0);
  const totalDue = subtotal;
  const total = (label: string, value: string) => html`
    <tr data-slot="table-row" class=${tableRowClass()}>
      <td data-slot="table-cell" colspan="3" class=${cn(tableCellClass(), 'text-right')}>${label}</td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right tabular-nums')}>${value}</td>
    </tr>
  `;
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Invoice #INV-2847</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Due March 30, 2026</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>Pending</span>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="table-container" class=${tableContainerClass()}>
          <table data-slot="table" class=${tableClass()}>
            <thead data-slot="table-header" class=${tableHeaderClass()}>
              <tr data-slot="table-row" class=${tableRowClass()}>
                <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Item</th>
                <th data-slot="table-head" scope="col" class=${cn(tableHeadClass(), 'text-right')}>Qty</th>
                <th data-slot="table-head" scope="col" class=${cn(tableHeadClass(), 'text-right')}>Rate</th>
                <th data-slot="table-head" scope="col" class=${cn(tableHeadClass(), 'text-right')}>Amount</th>
              </tr>
            </thead>
            <tbody data-slot="table-body" class=${tableBodyClass()}>
              ${INVOICE_ITEMS.map((row) => html`
                <tr data-slot="table-row" class=${tableRowClass()}>
                  <td data-slot="table-cell" class=${tableCellClass()}>${row.item}</td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right tabular-nums')}>${row.qty}</td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right tabular-nums')}>${formatCurrency(row.unitPrice)}</td>
                  <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right tabular-nums')}>${formatCurrency(row.qty * row.unitPrice)}</td>
                </tr>
              `)}
              ${total('Subtotal', formatCurrency(subtotal))}
              ${total('Tax', '$0.00')}
              ${total('Total Due', formatCurrency(totalDue))}
            </tbody>
          </table>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Download PDF</button>
        <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(buttonClass({ size: 'sm' }), 'ml-auto')}>Pay Now</button>
      </div>
    </div>
  `;
}
