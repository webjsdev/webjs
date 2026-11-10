/**
 * The dashboard-01 data table: the document's outline sections under a row of
 * view tabs, with a columns menu, row selection, drag-to-reorder, inline
 * target and limit fields, a reviewer picker, a row actions menu, pagination,
 * and a drawer that opens a section for editing. Ported from shadcn/ui's
 * dashboard-01, which builds it on TanStack Table and dnd-kit.
 *
 * The server renders the first page of 10 rows, so the first paint is
 * shadcn's and reads with JavaScript off, and the document holds only the
 * rows on screen. Every row rides on the element's `rows` attribute, and
 * `<dashboard-01-data-table>` (below) renders the current page's rows from
 * it on each change, with no third-party code: the page buttons and the page
 * size, the row checkboxes with select-all and the "n of m row(s) selected"
 * count, the columns menu, dragging a row by its handle (or moving it with
 * the arrow keys while the handle has focus), the view select on a narrow
 * card, and the one drawer that every row's title fills and opens. The order,
 * the selection and the edited cells live in the element, so they hold across
 * pages.
 *
 * The forms have no action yet. Bind a server action from a `'use server'`
 * file to the inline target and limit forms and to the drawer's form
 * (`<form action=${saveSection}>`), and render the rows from your own query
 * in place of `dashboardData`. Until then the inline forms submit as a GET
 * back to the page.
 */
import { WebComponent, html, prop, render, repeat, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';
import { buttonClass } from '../../../components/button.ts';
import { areaChart, type ChartConfig } from '../../../components/chart.ts';
import { checkboxClass } from '../../../components/checkbox.ts';
import {
  drawerDescriptionClass,
  drawerFooterClass,
  drawerHeaderClass,
  drawerTitleClass,
} from '../../../components/drawer.ts';
import { inputClass } from '../../../components/input.ts';
import { labelClass } from '../../../components/label.ts';
import { selectTriggerClass } from '../../../components/select.ts';
import { separatorClass } from '../../../components/separator.ts';
import {
  tableBodyClass,
  tableCellClass,
  tableClass,
  tableContainerClass,
  tableHeadClass,
  tableHeaderClass,
  tableRowClass,
} from '../../../components/table.ts';
import '../../../components/checkbox.ts';
import '../../../components/drawer.ts';
import '../../../components/dropdown-menu.ts';
import '../../../components/select.ts';
import '../../../components/tabs.ts';
import type { DashboardRow } from './dashboard-data.ts';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, CircleCheckIcon, Columns3Icon, EllipsisVerticalIcon, GripVerticalIcon, LoaderIcon, PlusIcon, TrendingUpIcon } from '../../../lib/icons.ts';

/** The columns the columns menu can hide, shadcn's hideable accessor columns. */
const HIDEABLE = ['type', 'status', 'target', 'limit', 'reviewer'];

const VIEWS = [
  { value: 'outline', label: 'Outline' },
  { value: 'past-performance', label: 'Past Performance', count: 3 },
  { value: 'key-personnel', label: 'Key Personnel', count: 2 },
  { value: 'focus-documents', label: 'Focus Documents' },
];

const PAGE_SIZES = [10, 20, 30, 40, 50];

const SECTION_TYPES = ['Table of Contents', 'Executive Summary', 'Technical Approach', 'Design', 'Capabilities', 'Focus Documents', 'Narrative', 'Cover Page'];
const STATUSES = ['Done', 'In Progress', 'Not Started'];
const REVIEWERS = ['Eddie Lake', 'Jamik Tashpulatov', 'Emily Whalen'];

const INLINE_INPUT = 'h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30';

const head = (cls = '') => cn(tableHeadClass(), cls);
const cell = (cls = '') => cn(tableCellClass(), cls);

/** What the row edits in place: the inline fields and the reviewer pick. */
type RowEdit = Partial<Pick<DashboardRow, 'target' | 'limit' | 'reviewer'>>;

/** How one row renders: selected or not, its edits, the hidden columns. */
interface RowState {
  selected: boolean;
  edit: RowEdit;
  hidden: ReadonlySet<string>;
}

const FIRST_PAINT: RowState = { selected: false, edit: {}, hidden: new Set() };

/** One inline field (target or limit), a form of its own as in shadcn. */
function inlineField(row: DashboardRow, key: 'target' | 'limit', label: string, edit: RowEdit) {
  return html`<form>
    <label for=${`${row.id}-${key}`} data-slot="label" class=${cn(labelClass(), 'sr-only')}>${label}</label>
    <input id=${`${row.id}-${key}`} name=${key} value=${edit[key] ?? row[key]} data-row-edit=${key} data-slot="input" class=${cn(inputClass(), INLINE_INPUT)}>
  </form>`;
}

function reviewerCell(row: DashboardRow, edit: RowEdit) {
  if (row.reviewer !== 'Assign reviewer') return row.reviewer;
  const picked = edit.reviewer ?? '';
  return html`
    <label for=${`${row.id}-reviewer`} data-slot="label" class=${cn(labelClass(), 'sr-only')}>Reviewer</label>
    <ui-select size="sm" placeholder="Assign reviewer">
      <select id=${`${row.id}-reviewer`} name="reviewer" data-row-edit="reviewer" class=${cn(selectTriggerClass(), 'w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate')}>
        <option value="" disabled hidden ?selected=${!picked}>Assign reviewer</option>
        <option value="Eddie Lake" ?selected=${picked === 'Eddie Lake'}>Eddie Lake</option>
        <option value="Jamik Tashpulatov" ?selected=${picked === 'Jamik Tashpulatov'}>Jamik Tashpulatov</option>
      </select>
    </ui-select>
  `;
}

function row(r: DashboardRow, state: RowState) {
  const { selected, edit, hidden } = state;
  return html`
    <tr data-slot="table-row" data-row-id=${String(r.id)} data-dragging="false" data-state=${selected ? 'selected' : nothing} class=${cn(tableRowClass(), 'relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80')}>
      <td data-slot="table-cell" class=${cell()}>
        <button type="button" draggable="true" data-drag-handle data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-7 cursor-grab text-muted-foreground hover:bg-transparent')}>
          ${GripVerticalIcon('size-3 text-muted-foreground')}
          <span class="sr-only">Drag to reorder</span>
        </button>
      </td>
      <td data-slot="table-cell" class=${cell()}>
        <div class="flex items-center justify-center">
          ${state === FIRST_PAINT
            // The first paint is part of the PAGE's template (the page never
            // hydrates), so it states the checkbox as an attribute; a page
            // template may not carry a `.prop` binding. The element's own
            // repaints set the live property, which a box the user has
            // toggled still follows.
            ? html`<input type="checkbox" data-slot="checkbox" data-row-select class=${checkboxClass()} aria-label="Select row" ?checked=${selected}>`
            : html`<input type="checkbox" data-slot="checkbox" data-row-select class=${checkboxClass()} aria-label="Select row" .checked=${selected}>`}
        </div>
      </td>
      <td data-slot="table-cell" class=${cell()}>
        <button type="button" data-row-open data-slot="button" data-variant="link" class=${cn(buttonClass({ variant: 'link' }), 'w-fit px-0 text-left text-foreground')}>${r.header}</button>
      </td>
      <td data-slot="table-cell" data-column="type" class=${cell()} ?hidden=${hidden.has('type')}>
        <div class="w-32">
          <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'px-1.5 text-muted-foreground')}>${r.type}</span>
        </div>
      </td>
      <td data-slot="table-cell" data-column="status" class=${cell()} ?hidden=${hidden.has('status')}>
        <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'px-1.5 text-muted-foreground')}>
          ${r.status === 'Done' ? CircleCheckIcon('fill-green-500 dark:fill-green-400') : LoaderIcon()}
          ${r.status}
        </span>
      </td>
      <td data-slot="table-cell" data-column="target" class=${cell()} ?hidden=${hidden.has('target')}>${inlineField(r, 'target', 'Target', edit)}</td>
      <td data-slot="table-cell" data-column="limit" class=${cell()} ?hidden=${hidden.has('limit')}>${inlineField(r, 'limit', 'Limit', edit)}</td>
      <td data-slot="table-cell" data-column="reviewer" class=${cell()} ?hidden=${hidden.has('reviewer')}>${reviewerCell(r, edit)}</td>
      <td data-slot="table-cell" class=${cell()}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'flex size-8 text-muted-foreground aria-expanded:bg-muted')}>
              ${EllipsisVerticalIcon()}
              <span class="sr-only">Open menu</span>
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align="end" class="w-32">
            <ui-dropdown-menu-item>Edit</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Make a copy</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Favorite</ui-dropdown-menu-item>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item variant="destructive">Delete</ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </td>
    </tr>
  `;
}

/** The body's rows, keyed by id so a reorder moves the row's own element. */
const bodyRows = (rows: DashboardRow[], stateOf: (r: DashboardRow) => RowState) =>
  html`${repeat(rows, (r) => r.id, (r) => row(r, stateOf(r)))}`;

const pageButton = (action: string, label: string, icon: unknown, cls: string, disabled: boolean) =>
  html`<button type="button" data-page=${action} data-slot="button" data-variant="outline" class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), cls)} ?disabled=${disabled}>
    <span class="sr-only">${label}</span>${icon}
  </button>`;

// The drawer's chart, shadcn's TableCellViewer chart.
const drawerChartData = [
  { month: 'January', desktop: 186, mobile: 80 },
  { month: 'February', desktop: 305, mobile: 200 },
  { month: 'March', desktop: 237, mobile: 120 },
  { month: 'April', desktop: 73, mobile: 190 },
  { month: 'May', desktop: 209, mobile: 130 },
  { month: 'June', desktop: 214, mobile: 140 },
];

const drawerChartConfig = {
  desktop: { label: 'Desktop', color: 'var(--primary)' },
  mobile: { label: 'Mobile', color: 'var(--primary)' },
} satisfies ChartConfig;

function drawerSelect(id: string, label: string, placeholder: string, options: string[], current: string) {
  return html`<div class="flex flex-col gap-3">
    <label for=${id} data-slot="label" class=${labelClass()}>${label}</label>
    <ui-select placeholder=${placeholder}>
      <select id=${id} name=${id.replace('drawer-', '')} class=${cn(selectTriggerClass(), 'w-full')}>
        <option value="" disabled hidden ?selected=${!options.includes(current)}>${placeholder}</option>
        ${options.map((o) => html`<option value=${o} ?selected=${o === current}>${o}</option>`)}
      </select>
    </ui-select>
  </div>`;
}

function drawerInput(id: string, label: string, value: string) {
  return html`<div class="flex flex-col gap-3">
    <label for=${id} data-slot="label" class=${labelClass()}>${label}</label>
    <input id=${id} name=${id.replace('drawer-', '')} value=${value} data-slot="input" class=${inputClass()}>
  </div>`;
}

/**
 * shadcn's TableCellViewer, rendered once: every row's title opens this
 * drawer, and the element fills it with that row's values first. shadcn hides
 * the chart on a phone, where the drawer comes up from the bottom; here it
 * always slides in from the right and the chart hides below md.
 */
function rowDrawer(first: DashboardRow) {
  return html`
    <ui-drawer data-row-drawer>
      <ui-drawer-content direction="right">
        <div data-slot="drawer-header" class=${cn(drawerHeaderClass(), 'gap-1')}>
          <h2 data-slot="drawer-title" data-drawer-title class=${drawerTitleClass()}>${first.header}</h2>
          <p data-slot="drawer-description" class=${drawerDescriptionClass()}>Showing total visitors for the last 6 months</p>
        </div>
        <div class="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div class="hidden flex-col gap-4 md:flex">
            ${areaChart({
              config: drawerChartConfig,
              data: drawerChartData,
              title: 'Desktop and mobile visitors, January to June',
              margin: { left: 0, right: 10 },
              grid: { vertical: false },
              xAxis: { dataKey: 'month', tickLine: false, axisLine: false, tickMargin: 8, tickFormatter: (value) => String(value).slice(0, 3), hide: true },
              tooltip: { cursor: false, indicator: 'dot' },
              areas: [
                { dataKey: 'mobile', type: 'natural', fill: 'var(--color-mobile)', fillOpacity: 0.6, stroke: 'var(--color-mobile)', stackId: 'a' },
                { dataKey: 'desktop', type: 'natural', fill: 'var(--color-desktop)', fillOpacity: 0.4, stroke: 'var(--color-desktop)', stackId: 'a' },
              ],
            })}
            <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
            <div class="grid gap-2">
              <div class="flex gap-2 leading-none font-medium">Trending up by 5.2% this month ${TrendingUpIcon('size-4')}</div>
              <div class="text-muted-foreground">Showing total visitors for the last 6 months. This is just some random text to test the layout. It spans multiple lines and should wrap around.</div>
            </div>
            <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
          </div>
          <form id="drawer-form" class="flex flex-col gap-4">
            ${drawerInput('drawer-header', 'Header', first.header)}
            <div class="grid grid-cols-2 gap-4">
              ${drawerSelect('drawer-type', 'Type', 'Select a type', SECTION_TYPES, first.type)}
              ${drawerSelect('drawer-status', 'Status', 'Select a status', STATUSES, first.status)}
            </div>
            <div class="grid grid-cols-2 gap-4">
              ${drawerInput('drawer-target', 'Target', first.target)}
              ${drawerInput('drawer-limit', 'Limit', first.limit)}
            </div>
            ${drawerSelect('drawer-reviewer', 'Reviewer', 'Select a reviewer', REVIEWERS, first.reviewer)}
          </form>
        </div>
        <div data-slot="drawer-footer" class=${drawerFooterClass()}>
          <button type="submit" form="drawer-form" data-slot="button" class=${buttonClass()}>Submit</button>
          <ui-drawer-close><button type="button" data-slot="button" data-variant="outline" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>Done</button></ui-drawer-close>
        </div>
      </ui-drawer-content>
    </ui-drawer>
  `;
}

export function dataTable({ data }: { data: DashboardRow[] }) {
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZES[0]));
  return html`
    <dashboard-01-data-table rows=${JSON.stringify(data)}>
      <ui-tabs value="outline" class="w-full flex-col justify-start gap-6">
        <div class="flex items-center justify-between px-4 lg:px-6">
          <label for="view-selector" data-slot="label" class=${cn(labelClass(), 'sr-only')}>View</label>
          <ui-select size="sm" placeholder="Select a view">
            <select id="view-selector" data-view-select class=${cn(selectTriggerClass(), 'flex w-fit @4xl/main:hidden')}>
              ${VIEWS.map((v) => html`<option value=${v.value} ?selected=${v.value === 'outline'}>${v.label}</option>`)}
            </select>
          </ui-select>
          <ui-tabs-list class="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
            ${VIEWS.map((v) => html`<ui-tabs-trigger value=${v.value}>${v.label}${v.count ? html` <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>${v.count}</span>` : ''}</ui-tabs-trigger>`)}
          </ui-tabs-list>
          <div class="flex items-center gap-2">
            <ui-dropdown-menu>
              <ui-dropdown-menu-trigger>
                <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
                  ${Columns3Icon()}
                  Columns
                  ${ChevronDownIcon()}
                </button>
              </ui-dropdown-menu-trigger>
              <ui-dropdown-menu-content align="end" class="w-32">
                ${HIDEABLE.map((c) => html`<ui-dropdown-menu-item type="checkbox" value=${c} checked data-column-toggle class="capitalize">${c}</ui-dropdown-menu-item>`)}
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
            <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
              ${PlusIcon()}
              <span class="hidden lg:inline">Add Section</span>
            </button>
          </div>
        </div>
        <ui-tabs-content value="outline" class="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
          <div class="overflow-hidden rounded-lg border">
            <div data-slot="table-container" class=${tableContainerClass()}>
              <table data-slot="table" class=${tableClass()}>
                <thead data-slot="table-header" class=${cn(tableHeaderClass(), 'sticky top-0 z-10 bg-muted')}>
                  <tr data-slot="table-row" class=${tableRowClass()}>
                    <th scope="col" data-slot="table-head" class=${head()}><span class="sr-only">Drag to reorder</span></th>
                    <th scope="col" data-slot="table-head" class=${head()}>
                      <div class="flex items-center justify-center">
                        <input type="checkbox" data-slot="checkbox" data-select-all class=${checkboxClass()} aria-label="Select all">
                      </div>
                    </th>
                    <th scope="col" data-slot="table-head" class=${head()}>Header</th>
                    <th scope="col" data-slot="table-head" data-column="type" class=${head()}>Section Type</th>
                    <th scope="col" data-slot="table-head" data-column="status" class=${head()}>Status</th>
                    <th scope="col" data-slot="table-head" data-column="target" class=${head()}><div class="w-full text-right">Target</div></th>
                    <th scope="col" data-slot="table-head" data-column="limit" class=${head()}><div class="w-full text-right">Limit</div></th>
                    <th scope="col" data-slot="table-head" data-column="reviewer" class=${head()}>Reviewer</th>
                    <th scope="col" data-slot="table-head" class=${head()}><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody data-slot="table-body" data-rows class=${cn(tableBodyClass(), '**:data-[slot=table-cell]:first:w-8')}>
                  ${data.length
                    ? bodyRows(data.slice(0, PAGE_SIZES[0]), () => FIRST_PAINT)
                    : html`<tr data-slot="table-row" class=${tableRowClass()}><td colspan="9" data-slot="table-cell" class=${cell('h-24 text-center')}>No results.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
          <div class="flex items-center justify-between px-4">
            <div class="hidden flex-1 text-sm text-muted-foreground lg:flex" aria-live="polite">
              <span><span data-selected-count>0</span> of <span data-row-count>${data.length}</span> row(s) selected.</span>
            </div>
            <div class="flex w-full items-center gap-8 lg:w-fit">
              <div class="hidden items-center gap-2 lg:flex">
                <label for="rows-per-page" data-slot="label" class=${cn(labelClass(), 'text-sm font-medium')}>Rows per page</label>
                <ui-select size="sm">
                  <select id="rows-per-page" data-page-size class=${cn(selectTriggerClass(), 'w-20')}>
                    ${PAGE_SIZES.map((n) => html`<option value=${String(n)} ?selected=${n === PAGE_SIZES[0]}>${n}</option>`)}
                  </select>
                </ui-select>
              </div>
              <div class="flex w-fit items-center justify-center text-sm font-medium" data-page-label>Page 1 of ${pageCount}</div>
              <div class="ml-auto flex items-center gap-2 lg:ml-0">
                ${pageButton('first', 'Go to first page', ChevronsLeftIcon(), 'hidden h-8 w-8 p-0 lg:flex', true)}
                ${pageButton('previous', 'Go to previous page', ChevronLeftIcon(), 'size-8', true)}
                ${pageButton('next', 'Go to next page', ChevronRightIcon(), 'size-8', pageCount <= 1)}
                ${pageButton('last', 'Go to last page', ChevronsRightIcon(), 'hidden size-8 lg:flex', pageCount <= 1)}
              </div>
            </div>
          </div>
        </ui-tabs-content>
        ${VIEWS.slice(1).map((v) => html`<ui-tabs-content value=${v.value} class="flex flex-col px-4 lg:px-6">
          <div class="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
        </ui-tabs-content>`)}
      </ui-tabs>
      ${data.length ? rowDrawer(data[0]) : ''}
    </dashboard-01-data-table>
  `;
}

type Valued = HTMLElement & { value: string };
type Openable = HTMLElement & { open: boolean };

/**
 * `<dashboard-01-data-table>`: the table's behaviour. It holds every row (the
 * `rows` attribute the server writes) in the order the reader set, with the
 * selection and the edited cells, and renders the current page's rows into
 * the body on each page, page-size, reorder, selection and column change, so
 * the document only ever holds one page.
 */
export class Dashboard01DataTable extends WebComponent({
  rows: prop<DashboardRow[]>(Array),
}) {
  _pageIndex = 0;
  _pageSize = PAGE_SIZES[0];
  _order: DashboardRow[] | null = null;
  _selected = new Set<number>();
  _edits = new Map<number, RowEdit>();
  _hidden = new Set<string>();
  _dragged: number | null = null;

  constructor() {
    super();
    this.rows = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
    this.addEventListener('input', this._onInput);
    this.addEventListener('click', this._onClick);
    this.addEventListener('ui-item-select', this._onItemSelect);
    this.addEventListener('ui-value-change', this._onTabs);
    this.addEventListener('dragstart', this._onDragStart);
    this.addEventListener('dragover', this._onDragOver);
    this.addEventListener('dragend', this._onDragEnd);
    this.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('ui-item-select', this._onItemSelect);
    this.removeEventListener('ui-value-change', this._onTabs);
    this.removeEventListener('dragstart', this._onDragStart);
    this.removeEventListener('dragover', this._onDragOver);
    this.removeEventListener('dragend', this._onDragEnd);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback();
  }

  /** Every row, in the reader's order. */
  _all(): DashboardRow[] {
    return (this._order ??= [...(this.rows || [])]);
  }

  _pageCount(): number {
    return Math.max(1, Math.ceil(this._all().length / this._pageSize));
  }

  _pageRows(): DashboardRow[] {
    const start = this._pageIndex * this._pageSize;
    return this._all().slice(start, start + this._pageSize);
  }

  _rowId(el: Element | null): number | null {
    const id = el?.closest('tr[data-row-id]')?.getAttribute('data-row-id');
    return id == null ? null : Number(id);
  }

  _stateOf = (r: DashboardRow): RowState => ({
    selected: this._selected.has(r.id),
    edit: this._edits.get(r.id) ?? {},
    hidden: this._hidden,
  });

  /** Render the current page's rows, then the pager and the selection text. */
  _update(): void {
    const all = this._all();
    const pageCount = this._pageCount();
    this._pageIndex = Math.min(Math.max(0, this._pageIndex), pageCount - 1);
    const body = this.querySelector<HTMLElement>('tbody[data-rows]');
    if (body && all.length) render(bodyRows(this._pageRows(), this._stateOf), body);
    const label = this.querySelector('[data-page-label]');
    if (label) label.textContent = `Page ${this._pageIndex + 1} of ${pageCount}`;
    const atStart = this._pageIndex === 0;
    const atEnd = this._pageIndex >= pageCount - 1;
    for (const b of Array.from(this.querySelectorAll<HTMLButtonElement>('button[data-page]'))) {
      b.disabled = b.dataset.page === 'first' || b.dataset.page === 'previous' ? atStart : atEnd;
    }
    const count = this.querySelector('[data-selected-count]');
    if (count) count.textContent = String(this._selected.size);
    const total = this.querySelector('[data-row-count]');
    if (total) total.textContent = String(all.length);
    const box = this.querySelector<HTMLInputElement>('input[data-select-all]');
    if (box) {
      const page = this._pageRows().map((r) => this._selected.has(r.id));
      box.checked = page.length > 0 && page.every(Boolean);
      box.indeterminate = !box.checked && page.some(Boolean);
    }
  }

  _onChange = (e: Event): void => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.matches('input[data-select-all]')) {
      for (const r of this._pageRows()) {
        if ((t as HTMLInputElement).checked) this._selected.add(r.id);
        else this._selected.delete(r.id);
      }
      this._update();
    } else if (t.matches('input[data-row-select]')) {
      const id = this._rowId(t);
      if (id != null) {
        if ((t as HTMLInputElement).checked) this._selected.add(id);
        else this._selected.delete(id);
      }
      this._update();
    } else if (t.matches('select[data-row-edit]')) {
      this._edit(t);
    } else if (t.matches('select[data-page-size]')) {
      this._pageSize = Number(t.value) || PAGE_SIZES[0];
      this._pageIndex = 0;
      this._update();
    } else if (t.matches('select[data-view-select]')) {
      const tabs = this.querySelector('ui-tabs') as Valued | null;
      if (tabs && tabs.value !== t.value) tabs.value = t.value;
    }
  };

  // An edited cell is kept with its row, so it holds across pages.
  _onInput = (e: Event): void => {
    const t = e.target as HTMLInputElement;
    if (t.matches?.('input[data-row-edit]')) this._edit(t);
  };

  _edit(field: HTMLInputElement | HTMLSelectElement): void {
    const id = this._rowId(field);
    const key = field.dataset.rowEdit as keyof RowEdit | undefined;
    if (id == null || !key) return;
    this._edits.set(id, { ...this._edits.get(id), [key]: field.value });
  }

  // A tab picked on a wide card moves the narrow card's view select with it.
  _onTabs = (e: Event): void => {
    if ((e.target as Element).tagName !== 'UI-TABS') return;
    const value = String((e as CustomEvent<{ value: string }>).detail?.value ?? '');
    const select = this.querySelector<HTMLSelectElement>('select[data-view-select]');
    if (select && value && select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  _onClick = (e: Event): void => {
    const button = (e.target as Element).closest?.('button');
    if (!button || !this.contains(button)) return;
    const page = button.dataset.page;
    if (page) {
      const last = this._pageCount() - 1;
      this._pageIndex = page === 'first' ? 0 : page === 'previous' ? this._pageIndex - 1 : page === 'next' ? this._pageIndex + 1 : last;
      this._update();
    } else if (button.hasAttribute('data-row-open')) {
      this._openDrawer(button.closest('tr'));
    }
  };

  // The columns menu: each checkbox item shows or hides its column, the
  // header cell here and the body cells on every render.
  _onItemSelect = (e: Event): void => {
    const item = e.target as HTMLElement;
    if (!item.hasAttribute('data-column-toggle')) return;
    const { value, checked } = (e as CustomEvent<{ value: string; checked: boolean }>).detail;
    if (checked) this._hidden.delete(value);
    else this._hidden.add(value);
    for (const c of Array.from(this.querySelectorAll<HTMLElement>(`[data-column="${value}"]`))) c.hidden = !checked;
    this._update();
  };

  /** Fill the shared drawer with one row's values and open it. */
  _openDrawer(row: HTMLTableRowElement | null): void {
    const drawer = this.querySelector('ui-drawer[data-row-drawer]') as Openable | null;
    const id = this._rowId(row);
    const r = this._all().find((x) => x.id === id);
    if (!r || !drawer) return;
    const edit = this._edits.get(r.id) ?? {};
    const values: Record<string, string> = {
      'drawer-header': r.header,
      'drawer-type': r.type,
      'drawer-status': r.status,
      'drawer-target': edit.target ?? r.target,
      'drawer-limit': edit.limit ?? r.limit,
      'drawer-reviewer': edit.reviewer ?? (r.reviewer === 'Assign reviewer' ? '' : r.reviewer),
    };
    const title = drawer.querySelector('[data-drawer-title]');
    if (title) title.textContent = r.header;
    for (const [field, value] of Object.entries(values)) {
      const el = drawer.querySelector<HTMLInputElement | HTMLSelectElement>(`#${field}`);
      if (!el) continue;
      el.value = value;
      if (el instanceof HTMLSelectElement) el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    drawer.open = true;
  }

  /** Move the row with id `id` to `index` in the full order and re-render. */
  _move(id: number, index: number): void {
    const all = this._all();
    const from = all.findIndex((r) => r.id === id);
    if (from < 0) return;
    const to = Math.min(Math.max(0, index), all.length - 1);
    if (from === to) return;
    const [moved] = all.splice(from, 1);
    all.splice(to, 0, moved);
    this._update();
  }

  _onDragStart = (e: DragEvent): void => {
    const handle = (e.target as Element).closest?.('[data-drag-handle]');
    const row = handle?.closest('tr') as HTMLTableRowElement | null;
    const id = this._rowId(row);
    if (!row || id == null) return;
    this._dragged = id;
    row.dataset.dragging = 'true';
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.setDragImage(row, 16, 16);
    }
  };

  // Rows move within the body only, the vertical-axis restriction shadcn sets.
  _onDragOver = (e: DragEvent): void => {
    const dragged = this._dragged;
    const over = (e.target as Element).closest?.('tbody[data-rows] > tr[data-row-id]') as HTMLTableRowElement | null;
    const overId = this._rowId(over);
    if (dragged == null || !over || overId == null) return;
    e.preventDefault();
    if (overId === dragged) return;
    const box = over.getBoundingClientRect();
    const all = this._all();
    const from = all.findIndex((r) => r.id === dragged);
    let to = all.findIndex((r) => r.id === overId);
    if (e.clientY > box.top + box.height / 2) to += 1;
    if (from < to) to -= 1;
    this._move(dragged, to);
  };

  _onDragEnd = (): void => {
    const row = this._dragged == null ? null : this.querySelector<HTMLElement>(`tr[data-row-id="${this._dragged}"]`);
    if (row) row.dataset.dragging = 'false';
    this._dragged = null;
  };

  // The keyboard way to reorder: the arrow keys move the row whose handle has
  // focus, as dnd-kit's keyboard sensor does, across pages too.
  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const handle = (e.target as Element).closest?.('[data-drag-handle]') as HTMLElement | null;
    const id = this._rowId(handle);
    if (!handle || id == null) return;
    e.preventDefault();
    const index = this._all().findIndex((r) => r.id === id) + (e.key === 'ArrowUp' ? -1 : 1);
    if (index < 0 || index >= this._all().length) return;
    this._pageIndex = Math.floor(index / this._pageSize);
    this._move(id, index);
    this.querySelector<HTMLElement>(`tr[data-row-id="${id}"] [data-drag-handle]`)?.focus();
  };

  render() {
    return html`<slot></slot>`;
  }
}
Dashboard01DataTable.register('dashboard-01-data-table');
