import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass,
  tableRowClass, tableHeadClass, tableCellClass,
} from '#modules/ui/components/table.ts';

const tableData = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'Admin' },
  { id: '2', name: 'Marcus Rodriguez', email: 'marcus.rodriguez@example.com', role: 'User' },
  { id: '3', name: 'Priya Patel', email: 'priya.patel@example.com', role: 'User' },
  { id: '4', name: 'David Kim', email: 'david.kim@example.com', role: 'Editor' },
];

// The first row starts selected. data-state="selected" is what the row's
// selected style keys on, so it travels with the checked box.
const selected = new Set(['1']);

export default function CheckboxTable() {
  return html`
    <div data-slot="table-container" class=${tableContainerClass()}>
      <table data-slot="table" class=${tableClass()}>
        <thead data-slot="table-header" class=${tableHeaderClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-8')}>
              <input
                type="checkbox"
                data-slot="checkbox"
                id="select-all-checkbox"
                name="select-all-checkbox"
                aria-label="Select all"
                ?checked=${selected.size === tableData.length}
                class=${checkboxClass()}
              >
            </th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Name</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Email</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Role</th>
          </tr>
        </thead>
        <tbody data-slot="table-body" class=${tableBodyClass()}>
          ${tableData.map((row) => html`
            <tr data-slot="table-row" data-state=${selected.has(row.id) ? 'selected' : nothing} class=${tableRowClass()}>
              <td data-slot="table-cell" class=${tableCellClass()}>
                <input
                  type="checkbox"
                  data-slot="checkbox"
                  id=${`row-${row.id}-checkbox`}
                  name=${`row-${row.id}-checkbox`}
                  aria-label=${`Select ${row.name}`}
                  ?checked=${selected.has(row.id)}
                  class=${checkboxClass()}
                >
              </td>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'font-medium')}>${row.name}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${row.email}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${row.role}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}
