import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass, tableFooterClass,
  tableRowClass, tableHeadClass, tableCellClass, tableCaptionClass,
} from '#modules/ui/components/table.ts';

const invoices = [
  {
    invoice: 'INV001',
    paymentStatus: 'Paid',
    totalAmount: '$250.00',
    paymentMethod: 'Credit Card',
  },
  {
    invoice: 'INV002',
    paymentStatus: 'Pending',
    totalAmount: '$150.00',
    paymentMethod: 'PayPal',
  },
  {
    invoice: 'INV003',
    paymentStatus: 'Unpaid',
    totalAmount: '$350.00',
    paymentMethod: 'Bank Transfer',
  },
  {
    invoice: 'INV004',
    paymentStatus: 'Paid',
    totalAmount: '$450.00',
    paymentMethod: 'Credit Card',
  },
  {
    invoice: 'INV005',
    paymentStatus: 'Paid',
    totalAmount: '$550.00',
    paymentMethod: 'PayPal',
  },
  {
    invoice: 'INV006',
    paymentStatus: 'Pending',
    totalAmount: '$200.00',
    paymentMethod: 'Bank Transfer',
  },
  {
    invoice: 'INV007',
    paymentStatus: 'Unpaid',
    totalAmount: '$300.00',
    paymentMethod: 'Credit Card',
  },
];

export default function TableDemo() {
  return html`
    <div data-slot="table-container" class=${tableContainerClass()}>
      <table data-slot="table" class=${tableClass()}>
        <caption data-slot="table-caption" class=${tableCaptionClass()}>A list of your recent invoices.</caption>
        <thead data-slot="table-header" class=${tableHeaderClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[100px]')}>Invoice</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Status</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Method</th>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody data-slot="table-body" class=${tableBodyClass()}>
          ${invoices.map((invoice) => html`
            <tr data-slot="table-row" class=${tableRowClass()}>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'font-medium')}>${invoice.invoice}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${invoice.paymentStatus}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${invoice.paymentMethod}</td>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>${invoice.totalAmount}</td>
            </tr>
          `)}
        </tbody>
        <tfoot data-slot="table-footer" class=${tableFooterClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <td colspan="3" data-slot="table-cell" class=${tableCellClass()}>Total</td>
            <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>$2,500.00</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
