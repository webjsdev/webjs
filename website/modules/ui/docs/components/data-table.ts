import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { commandBlock, packageCommands } from '#lib/ui/docs/install.ts';

/**
 * The Data Table docs page, ported from shadcn's
 * content/docs/components/radix/data-table.mdx (#1666): the same sections in
 * the same order. shadcn's page is a guide to building a data table with
 * TanStack Table in React. This one builds the same table the WebJs way (D1):
 * the data is read on the server, the table is the kit's table helpers
 * rendered by the server, the table's state (page, sort, filter, hidden
 * columns) lives in the query string so every control is a link or a GET form
 * that works with JavaScript off, and row selection, the one piece of state
 * that belongs to the reader alone, is a checkbox in a form with a small
 * element for the live count. The lead demo and the RTL demo are the same
 * payments table as shadcn's.
 */
export const demo = 'data-table-demo';

const PAYMENT_DATA = `type Payment = {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
};

export const payments: Payment[] = [
  {
    id: '728ed52f',
    amount: 100,
    status: 'pending',
    email: 'm@example.com',
  },
  {
    id: '489e1d42',
    amount: 125,
    status: 'processing',
    email: 'example@gmail.com',
  },
  // ...
];`;

const PROJECT_STRUCTURE = `app
└── payments
    └── page.ts
modules
└── payments
    ├── components
    │   ├── columns.ts
    │   └── data-table.ts
    ├── queries
    │   └── get-payments.server.ts
    └── utils
        └── data-table-state.ts`;

const TABLE_STATE = `import type { Payment } from './columns.ts';

// The table's state, read from the query string, so a link or a GET form is
// all it takes to change it, and the server renders every state.
export interface TableState {
  q: string;                      // the email filter
  sortBy: keyof Payment;          // the sorted column
  sort: 'asc' | 'desc' | null;    // its direction
  page: number;                   // zero-based
  pageSize: number;
  hidden: string[];               // hidden column ids
}

export function readTableState(params: URLSearchParams): TableState {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    sortBy: (['status', 'email', 'amount'] as const).find((k) => k === params.get('sortBy')) ?? 'email',
    sort: sort === 'asc' || sort === 'desc' ? sort : null,
    page: Math.max(0, Number(params.get('page') ?? 0) || 0),
    pageSize: [10, 20, 30, 40, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10,
    hidden: params.getAll('hide'),
  };
}

/** A link to the same table with some of its state changed. */
export function tableHref(state: TableState, change: Partial<TableState>): string {
  const next = { ...state, ...change };
  const p = new URLSearchParams();
  if (next.q) p.set('q', next.q);
  if (next.sort) p.set('sort', next.sort);
  if (next.sort && next.sortBy !== 'email') p.set('sortBy', next.sortBy);
  if (next.page) p.set('page', String(next.page));
  if (next.pageSize !== 10) p.set('size', String(next.pageSize));
  for (const id of next.hidden) p.append('hide', id);
  const qs = p.toString();
  return qs ? '?' + qs : '?';
}

/** Filter, sort and paginate: the row models, in the order TanStack runs them. */
export function applyTableState(rows: Payment[], state: TableState) {
  const q = state.q.toLowerCase();
  const filtered = q ? rows.filter((r) => r.email.toLowerCase().includes(q)) : rows;
  const sorted = state.sort
    ? [...filtered].sort((a, b) => (state.sort === 'asc' ? 1 : -1) * String(a[state.sortBy]).localeCompare(String(b[state.sortBy]), 'en', { sensitivity: 'base', numeric: true }))
    : filtered;
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  const page = Math.min(state.page, pageCount - 1);
  return {
    rows: sorted.slice(page * state.pageSize, (page + 1) * state.pageSize),
    filteredCount: sorted.length,
    page,
    pageCount,
  };
}`;

const COLUMNS = `import type { TemplateResult } from '@webjsdev/core';

// This type is used to define the shape of our data.
// A schema validated in your query can derive it instead.
export type Payment = {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
};

export interface Column {
  id: string;
  header: string;
  cell: (row: Payment) => TemplateResult | string;
}

export const columns: Column[] = [
  { id: 'status', header: 'Status', cell: (row) => row.status },
  { id: 'email', header: 'Email', cell: (row) => row.email },
  { id: 'amount', header: 'Amount', cell: (row) => String(row.amount) },
];`;

const DATA_TABLE = `import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  tableContainerClass,
  tableClass,
  tableHeaderClass,
  tableBodyClass,
  tableRowClass,
  tableHeadClass,
  tableCellClass,
} from '#components/ui/table.ts';
import type { Column, Payment } from './columns.ts';

interface DataTableProps {
  columns: Column[];
  data: Payment[];
}

export function dataTable({ columns, data }: DataTableProps) {
  return html\`
    <div class="overflow-hidden rounded-md border">
      <div class=\${tableContainerClass()}>
        <table class=\${tableClass()}>
          <thead class=\${tableHeaderClass()}>
            <tr class=\${tableRowClass()}>
              \${columns.map((column) => html\`<th scope="col" class=\${tableHeadClass()}>\${column.header}</th>\`)}
            </tr>
          </thead>
          <tbody class=\${tableBodyClass()}>
            \${data.length
              ? data.map((row) => html\`
                  <tr class=\${tableRowClass()}>
                    \${columns.map((column) => html\`<td class=\${tableCellClass()}>\${column.cell(row)}</td>\`)}
                  </tr>\`)
              : html\`
                  <tr class=\${tableRowClass()}>
                    <td colspan=\${columns.length} class=\${cn(tableCellClass(), 'h-24 text-center')}>No results.</td>
                  </tr>\`}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}`;

const PAGE = `import { html } from '@webjsdev/core';
import { columns } from '#modules/payments/components/columns.ts';
import { dataTable } from '#modules/payments/components/data-table.ts';
import { getPayments } from '#modules/payments/queries/get-payments.server.ts';

export default async function PaymentsPage() {
  // A 'use server' query: the real function on the server.
  const data = await getPayments();

  return html\`
    <div class="container mx-auto py-10">
      \${dataTable({ columns, data })}
    </div>
  \`;
}`;

const CELL_FORMATTING = `const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const columns: Column[] = [
  // ...
  {
    id: 'amount',
    header: html\`<div class="text-right">Amount</div>\`,
    cell: (row) => html\`<div class="text-right font-medium">\${usd.format(row.amount)}</div>\`,
  },
];`;

const ROW_ACTIONS = `import { html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dropdown-menu.ts';
import { MoreHorizontalIcon } from '#lib/utils/icons.ts';

export const columns: Column[] = [
  // ...
  {
    id: 'actions',
    header: '',
    cell: (payment) => html\`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger>
          <button type="button" class=\${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
            <span class="sr-only">Open menu</span>
            \${MoreHorizontalIcon()}
          </button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content align="end">
          <ui-dropdown-menu-label>Actions</ui-dropdown-menu-label>
          <ui-dropdown-menu-item value=\${payment.id}>Copy payment ID</ui-dropdown-menu-item>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item>
            <a href=\${'/customers/' + payment.id}>View customer</a>
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            <a href=\${'/payments/' + payment.id}>View payment details</a>
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    \`,
  },
];`;

const PAGINATION_PAGE = `import { readTableState, applyTableState } from '#modules/payments/utils/data-table-state.ts';

export default async function PaymentsPage({ searchParams }: PageProps<'/payments'>) {
  const state = readTableState(new URLSearchParams(await searchParams));
  const table = applyTableState(await getPayments(), state);

  return html\`
    <div class="container mx-auto py-10">
      \${dataTable({ columns, table, state })}
    </div>
  \`;
}`;

const PAGINATION_CONTROLS = `import { buttonClass } from '#components/ui/button.ts';
import { tableHref, type TableState } from '../utils/data-table-state.ts';

export function dataTable({ columns, table, state }: DataTableProps) {
  const prev = table.page > 0;
  const next = table.page < table.pageCount - 1;
  return html\`
    <div>
      <div class="overflow-hidden rounded-md border">
        <!-- the table, as before, over table.rows -->
      </div>
      <div class="flex items-center justify-end space-x-2 py-4">
        <a
          class=\${buttonClass({ variant: 'outline', size: 'sm' })}
          href=\${prev ? tableHref(state, { page: table.page - 1 }) : null}
          aria-disabled=\${prev ? null : 'true'}
        >Previous</a>
        <a
          class=\${buttonClass({ variant: 'outline', size: 'sm' })}
          href=\${next ? tableHref(state, { page: table.page + 1 }) : null}
          aria-disabled=\${next ? null : 'true'}
        >Next</a>
      </div>
    </div>
  \`;
}`;

const SORTING_TABLE = `export function dataTable({ columns, table, state }: DataTableProps) {
  return html\`
    <thead class=\${tableHeaderClass()}>
      <tr class=\${tableRowClass()}>
        \${columns.map((column) => html\`
          <th
            scope="col"
            class=\${tableHeadClass()}
            aria-sort=\${column.id === 'email' && state.sort ? (state.sort === 'asc' ? 'ascending' : 'descending') : null}
          >\${typeof column.header === 'function' ? column.header(state) : column.header}</th>\`)}
      </tr>
    </thead>
  \`;
}`;

const SORTING_HEADER = `import { ArrowUpDownIcon } from '#lib/utils/icons.ts';
import { tableHref } from '../utils/data-table-state.ts';

export const columns: Column[] = [
  // ...
  {
    id: 'email',
    header: (state) => html\`
      <a
        class=\${buttonClass({ variant: 'ghost' })}
        href=\${tableHref(state, { sort: state.sort === 'asc' ? 'desc' : 'asc', page: 0 })}
      >
        Email
        \${ArrowUpDownIcon()}
      </a>
    \`,
    cell: (row) => html\`<div class="lowercase">\${row.email}</div>\`,
  },
];`;

const FILTERING = `import { inputClass } from '#components/ui/input.ts';

export function dataTable({ columns, table, state }: DataTableProps) {
  return html\`
    <div>
      <form method="get" class="flex items-center py-4">
        <input
          type="search"
          name="q"
          value=\${state.q}
          placeholder="Filter emails..."
          aria-label="Filter emails"
          class=\${cn(inputClass(), 'max-w-sm')}
        >
        \${state.sort ? html\`<input type="hidden" name="sort" value=\${state.sort}>\` : ''}
        \${state.hidden.map((id) => html\`<input type="hidden" name="hide" value=\${id}>\`)}
      </form>
      <div class="overflow-hidden rounded-md border">
        <!-- the table, as before -->
      </div>
    </div>
  \`;
}`;

const VISIBILITY = `import '#components/ui/dropdown-menu.ts';
import { ChevronDownIcon } from '#lib/utils/icons.ts';

export function dataTable({ columns, table, state }: DataTableProps) {
  const shown = columns.filter((column) => !state.hidden.includes(column.id));
  const hideable = columns.filter((column) => column.hideable !== false);

  return html\`
    <div>
      <div class="flex items-center py-4">
        <!-- the filter form, as before -->
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger class="ms-auto">
            <button type="button" class=\${buttonClass({ variant: 'outline' })}>
              Columns \${ChevronDownIcon()}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align="end">
            \${hideable.map((column) => {
              const hidden = state.hidden.includes(column.id);
              const href = tableHref(state, {
                hidden: hidden ? state.hidden.filter((id) => id !== column.id) : [...state.hidden, column.id],
              });
              return html\`
                <ui-dropdown-menu-item type="checkbox" ?checked=\${!hidden} class="capitalize">
                  <a href=\${href}>\${column.id}</a>
                </ui-dropdown-menu-item>\`;
            })}
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </div>
      <div class="overflow-hidden rounded-md border">
        <!-- the table, rendering only the shown columns -->
      </div>
    </div>
  \`;
}`;

const SELECTION_COLUMNS = `import { checkboxClass } from '#components/ui/checkbox.ts';

export const columns: Column[] = [
  {
    id: 'select',
    hideable: false,
    header: () => html\`
      <input type="checkbox" data-slot="checkbox" data-select-all aria-label="Select all" class=\${checkboxClass()}>
    \`,
    cell: (row) => html\`
      <input type="checkbox" data-slot="checkbox" name="selected" value=\${row.id} aria-label="Select row" class=\${checkboxClass()}>
    \`,
  },
  // ...
];`;

const SELECTION_TABLE = `import { deletePayments } from '../actions/delete-payments.server.ts';
import './row-selection.ts';

export function dataTable({ columns, table, state }: DataTableProps) {
  return html\`
    <form action=\${deletePayments}>
      <row-selection>
        <div class="overflow-hidden rounded-md border">
          <!-- the table, as before, with the select column first -->
        </div>
      </row-selection>
      <button class=\${buttonClass({ variant: 'outline', size: 'sm' })}>Delete selected</button>
    </form>
  \`;
}`;

const SELECTION_ELEMENT = `import { WebComponent, html } from '@webjsdev/core';

// The header checkbox and the live count. The checkboxes themselves are the
// state, so the form posts the selection with or without this element.
export class RowSelection extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
    this._sync();
  }

  _boxes() {
    return Array.from(this.querySelectorAll<HTMLInputElement>('input[name="selected"]'));
  }

  _onChange = (e: Event) => {
    const box = e.target as HTMLInputElement;
    if (box.hasAttribute('data-select-all')) {
      for (const row of this._boxes()) row.checked = box.checked;
    }
    this._sync();
  };

  _sync() {
    const boxes = this._boxes();
    const picked = boxes.filter((b) => b.checked).length;
    const all = this.querySelector<HTMLInputElement>('input[data-select-all]');
    if (all) {
      all.checked = boxes.length > 0 && picked === boxes.length;
      all.indeterminate = picked > 0 && picked < boxes.length;
    }
    for (const b of boxes) b.closest('tr')?.toggleAttribute('data-state', b.checked);
    const count = this.querySelector('[data-selected-count]');
    if (count) count.textContent = String(picked);
  }

  render() {
    return html\`<slot></slot>\`;
  }
}
RowSelection.register('row-selection');`;

const SELECTED_COUNT = `<div class="flex-1 text-sm text-muted-foreground" aria-live="polite">
  <span data-selected-count>0</span> of \${table.filteredCount} row(s) selected.
</div>`;

const COLUMN_HEADER = `import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dropdown-menu.ts';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, EyeOffIcon } from '#lib/utils/icons.ts';
import { tableHref, type TableState } from '../utils/data-table-state.ts';

interface ColumnHeaderProps {
  id: string;
  title: string;
  state: TableState;
  sortable?: boolean;
  class?: string;
}

export function dataTableColumnHeader({ id, title, state, sortable = true, class: cls }: ColumnHeaderProps) {
  if (!sortable) return html\`<div class=\${cls ?? ''}>\${title}</div>\`;
  const sorted = state.sortBy === id ? state.sort : null;
  return html\`
    <div class=\${cn('flex items-center gap-2', cls)}>
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger>
          <button type="button" class=\${cn(buttonClass({ variant: 'ghost', size: 'sm' }), '-ml-3 h-8')}>
            <span>\${title}</span>
            \${sorted === 'desc' ? ArrowDownIcon() : sorted === 'asc' ? ArrowUpIcon() : ChevronsUpDownIcon()}
          </button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content align="start">
          <ui-dropdown-menu-item><a href=\${tableHref(state, { sortBy: id, sort: 'asc', page: 0 })}>\${ArrowUpIcon()} Asc</a></ui-dropdown-menu-item>
          <ui-dropdown-menu-item><a href=\${tableHref(state, { sortBy: id, sort: 'desc', page: 0 })}>\${ArrowDownIcon()} Desc</a></ui-dropdown-menu-item>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-item><a href=\${tableHref(state, { hidden: [...state.hidden, id] })}>\${EyeOffIcon()} Hide</a></ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    </div>
  \`;
}`;

const COLUMN_HEADER_USE = `export const columns: Column[] = [
  {
    id: 'email',
    header: (state) => dataTableColumnHeader({ id: 'email', title: 'Email', state }),
    cell: (row) => html\`<div class="lowercase">\${row.email}</div>\`,
  },
];`;

const PAGINATION_COMPONENT = `import { html } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { nativeSelectClass } from '#components/ui/native-select.ts';
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from '#lib/utils/icons.ts';
import { tableHref, type TableState } from '../utils/data-table-state.ts';

interface PaginationProps {
  state: TableState;
  page: number;
  pageCount: number;
  filteredCount: number;
}

export function dataTablePagination({ state, page, pageCount, filteredCount }: PaginationProps) {
  const link = (to: number, label: string, icon: unknown, cls = '') => html\`
    <a
      class=\${buttonClass({ variant: 'outline', size: 'icon-sm' }) + ' ' + cls}
      href=\${to >= 0 && to < pageCount && to !== page ? tableHref(state, { page: to }) : null}
      aria-disabled=\${to >= 0 && to < pageCount && to !== page ? null : 'true'}
    ><span class="sr-only">\${label}</span>\${icon}</a>\`;

  return html\`
    <div class="flex items-center justify-between px-2">
      <div class="flex-1 text-sm text-muted-foreground" aria-live="polite">
        <span data-selected-count>0</span> of \${filteredCount} row(s) selected.
      </div>
      <div class="flex items-center space-x-6 lg:space-x-8">
        <form method="get" class="flex items-center space-x-2">
          <label for="page-size" class="text-sm font-medium">Rows per page</label>
          <select id="page-size" name="size" class=\${nativeSelectClass()}>
            \${[10, 20, 30, 40, 50].map((n) => html\`<option value=\${n} ?selected=\${n === state.pageSize}>\${n}</option>\`)}
          </select>
          <button class=\${buttonClass({ variant: 'outline', size: 'sm' })}>Apply</button>
        </form>
        <div class="flex w-[100px] items-center justify-center text-sm font-medium">
          Page \${page + 1} of \${pageCount}
        </div>
        <div class="flex items-center space-x-2">
          \${link(0, 'Go to first page', ChevronsLeftIcon(), 'hidden lg:flex')}
          \${link(page - 1, 'Go to previous page', ChevronLeftIcon())}
          \${link(page + 1, 'Go to next page', ChevronRightIcon())}
          \${link(pageCount - 1, 'Go to last page', ChevronsRightIcon(), 'hidden lg:flex')}
        </div>
      </div>
    </div>
  \`;
}`;

const PAGINATION_USE = `\${dataTablePagination({ state, page: table.page, pageCount: table.pageCount, filteredCount: table.filteredCount })}`;

const VIEW_OPTIONS = `import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dropdown-menu.ts';
import { Settings2Icon } from '#lib/utils/icons.ts';
import { tableHref, type TableState } from '../utils/data-table-state.ts';
import type { Column } from './columns.ts';

export function dataTableViewOptions({ columns, state }: { columns: Column[]; state: TableState }) {
  return html\`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger class="ms-auto hidden lg:block">
        <button type="button" class=\${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'h-8')}>
          \${Settings2Icon()}
          View
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content align="end" class="w-[150px]">
        <ui-dropdown-menu-label>Toggle columns</ui-dropdown-menu-label>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        \${columns
          .filter((column) => column.hideable !== false)
          .map((column) => {
            const hidden = state.hidden.includes(column.id);
            const hiddenNext = hidden ? state.hidden.filter((id) => id !== column.id) : [...state.hidden, column.id];
            return html\`
              <ui-dropdown-menu-item type="checkbox" ?checked=\${!hidden} class="capitalize">
                <a href=\${tableHref(state, { hidden: hiddenNext })}>\${column.id}</a>
              </ui-dropdown-menu-item>\`;
          })}
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  \`;
}`;

const VIEW_OPTIONS_USE = `\${dataTableViewOptions({ columns, state })}`;

const TOC_LINKS: Array<[string, string]> = [
  ['Set up Table Features', 'set-up-table-features'],
  ['Basic Table', 'basic-table'],
  ['Row Actions', 'row-actions'],
  ['Pagination', 'pagination'],
  ['Sorting', 'sorting'],
  ['Filtering', 'filtering'],
  ['Visibility', 'visibility'],
  ['Row Selection', 'row-selection'],
  ['Reusable Components', 'reusable-components'],
];

const STEPS = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

/** Everything after the lead demo (a data table has no kit component, so no Installation tabs). */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Introduction')}
    <p>Every data table or datagrid I've created has been unique. They all behave differently, have specific sorting and filtering requirements, and work with different data sources.</p>
    <p>It doesn't make sense to combine all of these variations into a single component. If we do that, we'll lose the flexibility that composing the table yourself provides.</p>
    <p>So instead of a data-table component, I thought it would be more helpful to provide a guide on how to build your own.</p>
    <p>We'll start with the kit's table helpers and build a complex data table from scratch.</p>
    ${callout(html`<strong>Tip:</strong> If you find yourself using the same table in multiple places in your app, you can always extract it into a reusable fragment.`, { className: 'mt-4' })}

    ${heading(toc, 2, 'Table of Contents')}
    <p>This guide will show you how to use the <a href="/ui/docs/components/table">Table</a> helpers to build your own custom data table, rendered by the server, with its state in the URL. We'll cover the following topics:</p>
    <ul>
      ${TOC_LINKS.map(([title, id]) => html`<li><a href=${`#${id}`}>${title}</a></li>`)}
    </ul>

    ${heading(toc, 2, 'Installation')}
    <ol>
      <li><p>Add the table helpers to your project:</p></li>
    </ol>
    ${commandBlock(packageCommands('add table'))}
    <ol start="2">
      <li><p>There is no table library to install. A WebJs page runs on the server, so it filters, sorts and paginates plain arrays before it renders, and the browser receives finished HTML. The few behaviours that need the browser are a small custom element each.</p></li>
    </ol>

    ${heading(toc, 2, 'Prerequisites')}
    <p>We are going to build a table to show recent payments. Here's what our data looks like:</p>
    ${codeFigure(PAYMENT_DATA, { lineNumbers: true })}

    ${heading(toc, 2, 'Project Structure')}
    <p>Start by creating the following file structure:</p>
    ${codeFigure(PROJECT_STRUCTURE, { lang: 'text' })}
    <ul>
      <li><code>columns.ts</code> will contain our column definitions.</li>
      <li><code>data-table-state.ts</code> will contain the table's state, read from the query string, and the functions that filter, sort and paginate the rows.</li>
      <li><code>data-table.ts</code> will contain our <code>dataTable()</code> fragment, which renders the table.</li>
      <li><code>get-payments.server.ts</code> is a <code>'use server'</code> query that reads the data.</li>
      <li><code>page.ts</code> is where we'll fetch data and render our table.</li>
    </ul>

    ${heading(toc, 2, 'Set up Table Features')}
    <p>Every feature in this guide (sorting, filtering, pagination, visibility) is state the reader changes. Put that state in the query string and each feature becomes a link or a GET form: the server reads the state, applies it to the rows, and renders the result. It works with JavaScript off, the back button undoes a change, and a filtered, sorted page is a URL you can share. Declare the state and the row functions in one module that every part of the table reads.</p>
    ${codeFigure(TABLE_STATE, { title: 'modules/payments/utils/data-table-state.ts', lineNumbers: true })}
    ${callout(html`<strong>Note:</strong> The functions run in the order TanStack Table runs its row models: filter, then sort, then paginate, so the page count and the "row(s) selected" total count the filtered rows.`, { className: 'mt-4' })}

    ${heading(toc, 2, 'Basic Table')}
    <p>Let's start by building a basic table.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Column Definitions', 'column-definitions')}
      <p>First, we'll define our columns.</p>
      ${codeFigure(COLUMNS, { title: 'modules/payments/components/columns.ts', lineNumbers: true })}
      ${callout(html`<strong>Note:</strong> Columns are where you define the core of what your table will look like. They define the data that will be displayed, how it will be formatted, sorted and filtered.`, { className: 'mt-4' })}

      ${heading(toc, 3, 'dataTable() fragment', 'datatable-fragment')}
      <p>Next, we'll create a <code>dataTable()</code> fragment to render our table. It is a function returning an <code>html</code> template, so it renders on the server and ships no JavaScript.</p>
      ${codeFigure(DATA_TABLE, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}
      ${callout(html`<strong>Tip:</strong> If you find yourself using <code>dataTable()</code> in multiple places, this is the fragment you could make reusable by giving it generic columns and moving it to <code>components/data-table.ts</code>.`, { className: 'mt-4' })}

      ${heading(toc, 3, 'Render the table', 'render-the-table')}
      <p>Finally, we'll render our table in our page.</p>
      ${codeFigure(PAGE, { title: 'app/payments/page.ts', lineNumbers: true })}
    </div>

    ${heading(toc, 2, 'Cell Formatting')}
    <p>Let's format the amount cell to display the dollar amount. We'll also align the cell to the right.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update columns definition', 'cell-formatting-columns')}
      <p>Update the <code>header</code> and <code>cell</code> definitions for amount as follows:</p>
      ${codeFigure(CELL_FORMATTING, { title: 'modules/payments/components/columns.ts', lineNumbers: true })}
      <p>You can use the same approach to format other cells and headers. The formatter runs on the server, so it ships nothing to the browser.</p>
    </div>

    ${heading(toc, 2, 'Row Actions')}
    <p>Let's add row actions to our table. We'll use a <code>&lt;ui-dropdown-menu&gt;</code> for this.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update columns definition', 'row-actions-columns')}
      <p>Update our columns definition to add a new <code>actions</code> column. The <code>actions</code> cell returns a <code>&lt;ui-dropdown-menu&gt;</code>.</p>
      ${codeFigure(ROW_ACTIONS, { title: 'modules/payments/components/columns.ts', lineNumbers: true })}
      <p>You can access the row data as the <code>cell</code> function's argument. Use it to build the action, for example a <code>&lt;form action=\${deletePayment}&gt;</code> with the row's <code>id</code> in a hidden field, which posts to a server action with or without JavaScript.</p>
    </div>

    ${heading(toc, 2, 'Pagination')}
    <p>Next, we'll add pagination to our table.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Pagination is already enabled', 'pagination-is-already-enabled')}
      <p>Because <code>applyTableState()</code> slices the sorted rows into pages, the table paginates into pages of 10 as soon as the page reads its state. Pass <code>?size=</code> to change the page size.</p>
      ${codeFigure(PAGINATION_PAGE, { title: 'app/payments/page.ts', lineNumbers: true })}

      ${heading(toc, 3, 'Add pagination controls', 'add-pagination-controls')}
      <p>We can add pagination controls to our table with the <code>buttonClass()</code> helper on two links, each pointing at the same page with another <code>page</code> in the query string.</p>
      ${codeFigure(PAGINATION_CONTROLS, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}
      <p>See <a href="#reusable-components">Reusable Components</a> section for a more advanced pagination component.</p>
    </div>

    ${heading(toc, 2, 'Sorting')}
    <p>Let's make the email column sortable.</p>
    <p>The sort is already part of <code>TableState</code> and <code>applyTableState()</code>, so all that's left is a header that links to the other direction.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update dataTable()', 'sorting-update-datatable')}
      ${codeFigure(SORTING_TABLE, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}

      ${heading(toc, 3, 'Make header cell sortable', 'make-header-cell-sortable')}
      <p>We can now update the <code>email</code> header cell to add sorting controls.</p>
      ${codeFigure(SORTING_HEADER, { title: 'modules/payments/components/columns.ts', lineNumbers: true })}
      <p>This will automatically sort the table (asc and desc) when the user follows the header link. The <code>aria-sort</code> on the header tells a screen reader which way the column is sorted.</p>
    </div>

    ${heading(toc, 2, 'Filtering')}
    <p>Let's add a search input to filter emails in our table.</p>
    <p>The filter is already part of the table's state, so we only need to render an input. A GET form with a field named <code>q</code> is the whole wiring: submitting it loads the page with the new filter.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update dataTable()', 'filtering-update-datatable')}
      ${codeFigure(FILTERING, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}
      <p>Filtering is now enabled for the <code>email</code> column. You can add filters to other columns as well: give each its own field and read it in <code>readTableState()</code>. To filter as the reader types, add a small element that submits the form on input, after a short delay.</p>
    </div>

    ${heading(toc, 2, 'Visibility')}
    <p>Adding column visibility is fairly simple: the hidden columns are a list in the query string, and the table renders the other ones.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update dataTable()', 'visibility-update-datatable')}
      ${codeFigure(VISIBILITY, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}
      <p>This adds a dropdown menu that you can use to toggle column visibility.</p>
    </div>

    ${heading(toc, 2, 'Row Selection')}
    <p>Next, we're going to add row selection to our table.</p>
    <p>Selection is the one piece of state that belongs to the reader alone, so it is not in the URL. Each row's checkbox is a named form field, so a form around the table posts the selected ids to a server action with JavaScript off, and a small element adds the select-all checkbox and the count.</p>
    <div class=${STEPS}>
      ${heading(toc, 3, 'Update column definitions', 'update-column-definitions')}
      ${codeFigure(SELECTION_COLUMNS, { title: 'modules/payments/components/columns.ts', lineNumbers: true })}

      ${heading(toc, 3, 'Update dataTable()', 'row-selection-update-datatable')}
      ${codeFigure(SELECTION_TABLE, { title: 'modules/payments/components/data-table.ts', lineNumbers: true })}
      ${codeFigure(SELECTION_ELEMENT, { title: 'modules/payments/components/row-selection.ts', lineNumbers: true })}
      <p>This adds a checkbox to each row and a checkbox in the header to select all rows.</p>

      ${heading(toc, 3, 'Show selected rows', 'show-selected-rows')}
      <p>You can show the number of selected rows with an element the <code>&lt;row-selection&gt;</code> element updates.</p>
      ${codeFigure(SELECTED_COUNT, { lang: 'html' })}
    </div>

    ${heading(toc, 2, 'Reusable Components')}
    <p>Here are some fragments you can use to build your data tables. Each reads the same <code>TableState</code> from <a href="#set-up-table-features">Set up Table Features</a>, so every control is a link that keeps the rest of the table's state.</p>

    ${heading(toc, 3, 'Column header', 'column-header')}
    <p>Make any column header sortable and hideable.</p>
    ${codeFigure(COLUMN_HEADER, { title: 'components/data-table-column-header.ts', lineNumbers: true })}
    ${codeFigure(COLUMN_HEADER_USE)}

    ${heading(toc, 3, 'Pagination', 'reusable-pagination')}
    <p>Add pagination controls to your table including page size and selection count.</p>
    ${codeFigure(PAGINATION_COMPONENT, { title: 'components/data-table-pagination.ts', lineNumbers: true })}
    ${codeFigure(PAGINATION_USE)}

    ${heading(toc, 3, 'Column toggle', 'column-toggle')}
    <p>A fragment to toggle column visibility.</p>
    ${codeFigure(VIEW_OPTIONS, { title: 'components/data-table-view-options.ts', lineNumbers: true })}
    ${codeFigure(VIEW_OPTIONS_USE)}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('data-table-rtl', { direction: 'rtl', align: 'start', previewClass: 'items-start h-auto px-4 md:px-8', hideCode: true })}
  `;
}
