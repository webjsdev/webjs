import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass,
  tableRowClass, tableHeadClass, tableCellClass,
} from '#modules/ui/components/table.ts';
import { MoreHorizontalIcon } from '#lib/ui/lucide.ts';

const products = [
  { name: 'Wireless Mouse', price: '$29.99' },
  { name: 'Mechanical Keyboard', price: '$129.99' },
  { name: 'USB-C Hub', price: '$49.99' },
];

export default function TableActions() {
  return html`
    <div data-slot="table-container" class=${tableContainerClass()}>
      <table data-slot="table" class=${tableClass()}>
        <thead data-slot="table-header" class=${tableHeaderClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Product</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Price</th>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody data-slot="table-body" class=${tableBodyClass()}>
          ${products.map((product) => html`
            <tr data-slot="table-row" class=${tableRowClass()}>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'font-medium')}>${product.name}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${product.price}</td>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-8')}>
                      ${MoreHorizontalIcon()}
                      <span class="sr-only">Open menu</span>
                    </button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content align="end">
                    <ui-dropdown-menu-item>Edit</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>Duplicate</ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item variant="destructive">
                      Delete
                    </ui-dropdown-menu-item>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}
