import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass, tableRowClass, tableHeadClass, tableCellClass,
} from '#modules/ui/components/table.ts';
import {
  dropdownMenuItemClass, dropdownMenuCheckboxItemClass, dropdownMenuLabelClass, dropdownMenuSeparatorClass,
} from '#modules/ui/components/dropdown-menu.ts';
import { labels, statuses, priorities, type Option, type Task } from './data.ts';
import { PATH, PAGE_SIZES, HIDEABLE, hrefFor, applyState, type Column, type TasksState, type TasksView } from './state.ts';
import {
  ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, EyeOffIcon, CirclePlusIcon, XIcon, Settings2Icon, CheckIcon,
  EllipsisIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon,
} from './icons.ts';

/**
 * shadcn/ui's tasks example (apps/v4/app/(app)/examples/tasks, #1666): a task
 * tracker over a data table. shadcn builds the table with TanStack Table in
 * React state; here the server builds it from the query string (state.ts),
 * so every control is a link or a field of one GET form, and filtering,
 * sorting, hiding columns and paging work with JavaScript off.
 *
 * The menus that change the table (a column's sort menu, View, the faceted
 * filters) are native popovers, which open with no script, holding links or
 * form fields. The menus that only act on a row or the account (the row
 * actions, the user menu) are the kit's <ui-dropdown-menu>, as in shadcn.
 * <tasks-table> (./tasks-table.ts) adds what needs a script: submitting the
 * form as a filter changes, and the row selection count.
 */

const ghostSm = buttonClass({ variant: 'ghost', size: 'sm' });
const outlineSm = buttonClass({ variant: 'outline', size: 'sm' });
const menuPanel = (align: 'start' | 'end', width: string) =>
  cn(popoverContentClass({ side: 'bottom', align }), 'p-1', width);
const menuItem = cn(dropdownMenuItemClass(), 'no-underline text-popover-foreground');

/** shadcn's UserNav: the avatar button and the account menu. */
function userNav() {
  return html`<ui-dropdown-menu>
    <ui-dropdown-menu-trigger>
      <button type="button" class=${cn(buttonClass({ variant: 'ghost' }), 'relative h-8 w-8 rounded-full')} aria-label="Account">
        <span data-slot="avatar" class=${cn(avatarClass(), 'h-9 w-9')}>
          <img data-slot="avatar-image" class=${avatarImageClass()} src="/public/avatars/vivek.jpg" alt="@vivek">
          <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
        </span>
      </button>
    </ui-dropdown-menu-trigger>
    <ui-dropdown-menu-content class="w-56" align="end">
      <ui-dropdown-menu-label class="font-normal">
        <div class="flex flex-col space-y-1">
          <p class="text-sm leading-none font-medium">shadcn</p>
          <p class="text-xs leading-none text-muted-foreground">m@example.com</p>
        </div>
      </ui-dropdown-menu-label>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-group>
        <ui-dropdown-menu-item>Profile<ui-dropdown-menu-shortcut>⇧⌘P</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
        <ui-dropdown-menu-item>Billing<ui-dropdown-menu-shortcut>⌘B</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
        <ui-dropdown-menu-item>Settings<ui-dropdown-menu-shortcut>⌘S</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
        <ui-dropdown-menu-item>New Team</ui-dropdown-menu-item>
      </ui-dropdown-menu-group>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-item>Log out<ui-dropdown-menu-shortcut>⇧⌘Q</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
    </ui-dropdown-menu-content>
  </ui-dropdown-menu>`;
}

/** shadcn's DataTableFacetedFilter: a dashed button opening a searchable list of checkboxes. */
function facetedFilter(s: TasksState, key: 'status' | 'priority', title: string, options: Option[], facets: Map<string, number>) {
  const selected = new Set(s[key]);
  const id = `filter-${key}`;
  const chosen = options.filter((o) => selected.has(o.value));
  return html`<button type="button" popovertarget=${id} aria-haspopup="dialog" data-slot="button" class=${cn(outlineSm, 'h-8 border-dashed')}>
      ${CirclePlusIcon()}
      ${title}
      ${selected.size ? html`
        <div role="none" data-slot="separator" class="mx-2 h-4 w-px shrink-0 bg-border"></div>
        <span data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'rounded-sm px-1 font-normal lg:hidden')}>${selected.size}</span>
        <div class="hidden gap-1 lg:flex">
          ${selected.size > 2
            ? html`<span data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'rounded-sm px-1 font-normal')}>${selected.size} selected</span>`
            : chosen.map((o) => html`<span data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'rounded-sm px-1 font-normal')}>${o.label}</span>`)}
        </div>` : ''}
    </button>
    <div id=${id} popover role="dialog" aria-label=${title} class=${cn(popoverContentClass({ side: 'bottom', align: 'start' }), 'w-[200px] p-0')}>
      <ui-command label=${title}>
        <ui-command-input placeholder=${title}></ui-command-input>
        <ui-command-list>
          <ui-command-empty>No results found.</ui-command-empty>
          <ui-command-group>
            ${options.map((o) => html`<ui-command-item value=${o.label}>
              <label class="flex flex-1 items-center gap-2">
                <input type="checkbox" name=${key} value=${o.value} ?checked=${selected.has(o.value)} data-filter class="peer sr-only">
                <span class="flex size-4 items-center justify-center rounded-[4px] border border-input peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 [&_svg]:invisible peer-checked:[&_svg]:visible">${CheckIcon('size-3.5 text-primary-foreground')}</span>
                ${o.icon ? o.icon('size-4 text-muted-foreground') : ''}
                <span>${o.label}</span>
                ${facets.get(o.value) ? html`<span class="ms-auto flex size-4 items-center justify-center font-mono text-xs text-muted-foreground">${facets.get(o.value)}</span>` : ''}
              </label>
            </ui-command-item>`)}
          </ui-command-group>
          ${selected.size ? html`
            <ui-command-separator></ui-command-separator>
            <ui-command-group>
              <ui-command-item value="Clear filters" class="justify-center text-center"><a href=${hrefFor(s, { [key]: [], page: 1 })} class="flex-1 text-center no-underline">Clear filters</a></ui-command-item>
            </ui-command-group>` : ''}
        </ui-command-list>
      </ui-command>
      <noscript><div class="border-t p-1"><button class=${cn(ghostSm, 'w-full')}>Apply</button></div></noscript>
    </div>`;
}

/** shadcn's DataTableViewOptions: the View menu with one checkbox per hideable column. */
function viewOptions(s: TasksState) {
  return html`<button type="button" popovertarget="view-options" aria-haspopup="dialog" data-slot="button" class=${cn(outlineSm, 'ml-auto hidden h-8 lg:flex')}>${Settings2Icon()} View</button>
    <div id="view-options" popover role="dialog" aria-labelledby="view-options-label" class=${menuPanel('end', 'w-[150px]')}>
      <div id="view-options-label" class=${dropdownMenuLabelClass()}>Toggle columns</div>
      <div role="none" class=${dropdownMenuSeparatorClass()}></div>
      ${HIDEABLE.map((col) => {
        const visible = !s.hide.includes(col);
        const hide = visible ? [...s.hide, col] : s.hide.filter((c) => c !== col);
        return html`<a href=${hrefFor(s, { hide })} role="menuitemcheckbox" aria-checked=${visible ? 'true' : 'false'} class=${cn(dropdownMenuCheckboxItemClass(), 'capitalize no-underline text-popover-foreground')}>
          <span class="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center">${visible ? CheckIcon('size-4') : ''}</span>
          ${col}
        </a>`;
      })}
    </div>`;
}

/** shadcn's DataTableToolbar: the title filter, the faceted filters, Reset, View and Add Task. */
function toolbar(s: TasksState, v: TasksView) {
  const filtered = !!(s.q || s.status.length || s.priority.length);
  return html`<div class="flex items-center justify-between">
    <div class="flex flex-1 items-center gap-2">
      <label for="tasks-q" class="sr-only">Filter tasks</label>
      <input id="tasks-q" name="q" type="search" value=${s.q} placeholder="Filter tasks..." autocomplete="off" data-slot="input" data-filter-text class=${cn(inputClass(), 'h-8 w-[150px] lg:w-[250px]')}>
      ${facetedFilter(s, 'status', 'Status', statuses, v.facets.status)}
      ${facetedFilter(s, 'priority', 'Priority', priorities, v.facets.priority)}
      ${filtered ? html`<a href=${hrefFor(s, { q: '', status: [], priority: [], page: 1 })} data-slot="button" class=${cn(ghostSm, 'no-underline')}>Reset ${XIcon()}</a>` : ''}
    </div>
    <div class="flex items-center gap-2">
      ${viewOptions(s)}
      <button type="button" data-slot="button" class=${buttonClass({ size: 'sm' })}>Add Task</button>
    </div>
  </div>`;
}

/** shadcn's DataTableColumnHeader: a ghost button opening Asc, Desc and Hide. */
function columnHeader(s: TasksState, col: Column, title: string) {
  const dir = s.sort?.id === col ? (s.sort.desc ? 'desc' : 'asc') : null;
  const id = `sort-${col}`;
  return html`<div class="flex items-center gap-2">
    <button type="button" popovertarget=${id} aria-haspopup="dialog" data-slot="button" class=${cn(ghostSm, '-ml-3 h-8 data-[state=open]:bg-accent')}>
      <span>${title}</span>
      ${dir === 'desc' ? ArrowDownIcon() : dir === 'asc' ? ArrowUpIcon() : ChevronsUpDownIcon()}
      <span class="sr-only">${dir ? `, sorted ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}</span>
    </button>
    <div id=${id} popover role="dialog" aria-label=${`${title} column`} class=${cn(menuPanel('start', 'w-32'), 'font-normal')}>
      <a href=${hrefFor(s, { sort: { id: col, desc: false } })} class=${menuItem} aria-current=${dir === 'asc' ? 'true' : null}>${ArrowUpIcon()} Asc</a>
      <a href=${hrefFor(s, { sort: { id: col, desc: true } })} class=${menuItem} aria-current=${dir === 'desc' ? 'true' : null}>${ArrowDownIcon()} Desc</a>
      <div role="none" class=${dropdownMenuSeparatorClass()}></div>
      <a href=${hrefFor(s, { hide: [...s.hide, col] })} class=${menuItem}>${EyeOffIcon()} Hide</a>
    </div>
  </div>`;
}

/** shadcn's DataTableRowActions: the row's menu (it acts on nothing, as in shadcn). */
function rowActions(task: Task) {
  return html`<ui-dropdown-menu>
    <ui-dropdown-menu-trigger>
      <button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-8 data-[state=open]:bg-muted')}>${EllipsisIcon()}<span class="sr-only">Open menu</span></button>
    </ui-dropdown-menu-trigger>
    <ui-dropdown-menu-content align="end" class="w-[160px]">
      <ui-dropdown-menu-item>Edit</ui-dropdown-menu-item>
      <ui-dropdown-menu-item>Make a copy</ui-dropdown-menu-item>
      <ui-dropdown-menu-item>Favorite</ui-dropdown-menu-item>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-sub>
        <ui-dropdown-menu-sub-trigger>Labels</ui-dropdown-menu-sub-trigger>
        <ui-dropdown-menu-sub-content>
          <ui-dropdown-menu-group>
            ${labels.map((l) => html`<ui-dropdown-menu-item type="radio" value=${l.value} ?checked=${l.value === task.label}>${l.label}</ui-dropdown-menu-item>`)}
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-sub-content>
      </ui-dropdown-menu-sub>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-item variant="destructive">Delete<ui-dropdown-menu-shortcut>⌘⌫</ui-dropdown-menu-shortcut></ui-dropdown-menu-item>
    </ui-dropdown-menu-content>
  </ui-dropdown-menu>`;
}

function optionCell(options: Option[], value: string, cls: string) {
  const o = options.find((x) => x.value === value);
  if (!o) return '';
  return html`<div class=${cn('flex items-center gap-2', cls)}>${o.icon ? o.icon('size-4 text-muted-foreground') : ''}<span>${o.label}</span></div>`;
}

/** shadcn's DataTable and columns.tsx: select, Task, Title, Status, Priority, actions. */
function table(s: TasksState, v: TasksView) {
  const shown = (col: Column) => !s.hide.includes(col);
  const span = 3 + (['title', 'status', 'priority'] as Column[]).filter(shown).length;
  const check = (label: string, attr: string) => html`<input type="checkbox" data-slot="checkbox" class=${cn(checkboxClass(), 'm-0 translate-y-[2px]')} aria-label=${label} data-select=${attr}>`;
  return html`<div class="overflow-hidden rounded-md border">
    <div data-slot="table-container" class=${tableContainerClass()}>
      <table data-slot="table" class=${tableClass()}>
        <thead data-slot="table-header" class=${tableHeaderClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <th data-slot="table-head" scope="col" class=${cn(tableHeadClass(), 'pe-0')}>${check('Select all', 'all')}</th>
            <th data-slot="table-head" scope="col" class=${tableHeadClass()}>Task</th>
            ${shown('title') ? html`<th data-slot="table-head" scope="col" class=${tableHeadClass()}>${columnHeader(s, 'title', 'Title')}</th>` : ''}
            ${shown('status') ? html`<th data-slot="table-head" scope="col" class=${tableHeadClass()}>${columnHeader(s, 'status', 'Status')}</th>` : ''}
            ${shown('priority') ? html`<th data-slot="table-head" scope="col" class=${tableHeadClass()}>${columnHeader(s, 'priority', 'Priority')}</th>` : ''}
            <th data-slot="table-head" scope="col" class=${tableHeadClass()}><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody data-slot="table-body" class=${tableBodyClass()}>
          ${v.rows.length ? v.rows.map((t) => {
            const label = labels.find((l) => l.value === t.label);
            return html`<tr data-slot="table-row" class=${tableRowClass()}>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'pe-0')}>${check(`Select ${t.id}`, 'row')}</td>
              <td data-slot="table-cell" class=${tableCellClass()}><div class="w-[80px]">${t.id}</div></td>
              ${shown('title') ? html`<td data-slot="table-cell" class=${tableCellClass()}><div class="flex gap-2">
                ${label ? html`<span data-slot="badge" class=${badgeClass({ variant: 'outline' })}>${label.label}</span>` : ''}
                <span class="max-w-[500px] truncate font-medium">${t.title}</span>
              </div></td>` : ''}
              ${shown('status') ? html`<td data-slot="table-cell" class=${tableCellClass()}>${optionCell(statuses, t.status, 'w-[100px]')}</td>` : ''}
              ${shown('priority') ? html`<td data-slot="table-cell" class=${tableCellClass()}>${optionCell(priorities, t.priority, '')}</td>` : ''}
              <td data-slot="table-cell" class=${tableCellClass()}>${rowActions(t)}</td>
            </tr>`;
          }) : html`<tr data-slot="table-row" class=${tableRowClass()}><td data-slot="table-cell" colspan=${span} class=${cn(tableCellClass(), 'h-24 text-center')}>No results.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

/** shadcn's DataTablePagination: the selection count, rows per page, the page and its four buttons. */
function pagination(s: TasksState, v: TasksView) {
  const iconBtn = (href: string | null, label: string, icon: unknown, cls = '') => href
    ? html`<a href=${href} data-slot="button" class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'size-8 no-underline', cls)}><span class="sr-only">${label}</span>${icon}</a>`
    : html`<button type="button" disabled data-slot="button" class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'size-8', cls)}><span class="sr-only">${label}</span>${icon}</button>`;
  const prev = v.page > 1;
  const next = v.page < v.pageCount;
  return html`<div class="flex items-center justify-between px-2">
    <div class="flex-1 text-sm text-muted-foreground" aria-live="polite"><span data-selected-count>0</span> of ${v.filtered} row(s) selected.</div>
    <div class="flex items-center space-x-6 lg:space-x-8">
      <div class="flex items-center space-x-2">
        <label for="tasks-size" class="text-sm font-medium">Rows per page</label>
        <ui-select>
          <select id="tasks-size" name="size" class=${cn(selectTriggerClass(), 'h-8 w-[70px]')}>
            ${PAGE_SIZES.map((n) => html`<option value=${String(n)} ?selected=${n === s.size}>${n}</option>`)}
          </select>
        </ui-select>
        <noscript><button class=${ghostSm}>Apply</button></noscript>
      </div>
      <div class="flex w-[100px] items-center justify-center text-sm font-medium">Page ${v.page} of ${v.pageCount}</div>
      <div class="flex items-center space-x-2">
        ${iconBtn(prev ? hrefFor(s, { page: 1 }) : null, 'Go to first page', ChevronsLeftIcon(), 'hidden lg:flex')}
        ${iconBtn(prev ? hrefFor(s, { page: v.page - 1 }) : null, 'Go to previous page', ChevronLeftIcon())}
        ${iconBtn(next ? hrefFor(s, { page: v.page + 1 }) : null, 'Go to next page', ChevronRightIcon())}
        ${iconBtn(next ? hrefFor(s, { page: v.pageCount }) : null, 'Go to last page', ChevronsRightIcon(), 'hidden lg:flex')}
      </div>
    </div>
  </div>`;
}

export function tasksExample(tasks: Task[], s: TasksState) {
  const v = applyState(tasks, s);
  return html`<div class="flex h-full flex-1 flex-col gap-8 p-8">
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-semibold tracking-tight">Welcome back!</h2>
        <p class="text-muted-foreground">Here&apos;s a list of your tasks for this month.</p>
      </div>
      <div class="flex items-center gap-2">${userNav()}</div>
    </div>
    <tasks-table>
      <form method="get" action=${PATH} class="flex flex-col gap-4" data-tasks-form>
        ${s.sort ? html`<input type="hidden" name="sort" value=${`${s.sort.id}.${s.sort.desc ? 'desc' : 'asc'}`}>` : ''}
        ${s.hide.map((h) => html`<input type="hidden" name="hide" value=${h}>`)}
        ${toolbar(s, v)}
        ${table(s, v)}
        ${pagination(s, v)}
      </form>
    </tasks-table>
  </div>`;
}
