import { WebComponent, html } from '@webjsdev/core';

/**
 * `<data-table-demo>` adds the behaviour to the Data Table docs demos,
 * shadcn's TanStack Table payments table (#1666). The table, its toolbar and
 * its footer are server markup (lib/ui/data-table-demo.ts) in their first
 * state, so the page reads in full with JavaScript off. This element keeps the
 * table's state and re-applies it to that markup, the way TanStack Table's
 * features do in shadcn's demo:
 *
 * - the email filter (case-insensitive substring, TanStack's includesString),
 *   which returns to page one, as TanStack's autoResetPageIndex does;
 * - the Email sort, ascending on the first press and then alternating;
 * - column visibility from the Columns menu's checkbox items;
 * - row selection, the header checkbox selecting the rows of the current page
 *   (checked when all are, indeterminate when some are) and the footer's
 *   "n of m row(s) selected" over the filtered rows;
 * - Previous / Next over pages of `page-size` rows;
 * - each row menu's "Copy payment ID".
 *
 * Rows are moved and hidden in place rather than re-rendered, so each row's
 * dropdown menu keeps its element.
 */
export class DataTableDemo extends WebComponent {
  _filter = '';
  _sort: 'asc' | 'desc' | null = null;
  _page = 0;
  _selected = new Set<string>();
  _hidden = new Set<string>();

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('input', this._onInput);
    this.addEventListener('change', this._onChange);
    this.addEventListener('click', this._onClick);
    this.addEventListener('ui-item-select', this._onItemSelect);
    this._apply();
  }

  disconnectedCallback() {
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('ui-item-select', this._onItemSelect);
    super.disconnectedCallback();
  }

  get pageSize(): number {
    const n = Number(this.getAttribute('page-size'));
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  _rows(): HTMLTableRowElement[] {
    return Array.from(this.querySelectorAll<HTMLTableRowElement>('tr[data-table-row]'));
  }

  /** The filtered rows in display order. */
  _visibleRows(): HTMLTableRowElement[] {
    const q = this._filter.trim().toLowerCase();
    const rows = this._rows().filter((r) => !q || (r.dataset.email ?? '').toLowerCase().includes(q));
    if (this._sort) {
      const dir = this._sort === 'asc' ? 1 : -1;
      rows.sort((a, b) => dir * (a.dataset.email ?? '').localeCompare(b.dataset.email ?? '', 'en', { sensitivity: 'base', numeric: true }));
    }
    return rows;
  }

  _apply(): void {
    const all = this._rows();
    const rows = this._visibleRows();
    const size = this.pageSize;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    this._page = Math.min(this._page, pages - 1);
    const start = this._page * size;
    const page = new Set(rows.slice(start, start + size));

    // Order: sorted (or data) order for the filtered rows, the rest after.
    const body = all[0]?.parentElement;
    const empty = this.querySelector<HTMLTableRowElement>('tr[data-table-empty]');
    if (body) {
      for (const r of [...rows, ...all.filter((r) => !rows.includes(r))]) body.insertBefore(r, empty);
    }
    for (const r of all) {
      r.hidden = !page.has(r);
      const on = this._selected.has(r.dataset.id ?? '');
      if (on) r.dataset.state = 'selected';
      else delete r.dataset.state;
      const box = r.querySelector<HTMLInputElement>('input[data-table-select-row]');
      if (box) box.checked = on;
    }
    if (empty) empty.hidden = rows.length > 0;

    // Column visibility, on every header and cell naming a column.
    for (const el of Array.from(this.querySelectorAll<HTMLElement>('[data-col]'))) {
      el.hidden = this._hidden.has(el.dataset.col ?? '');
    }
    const visibleCols = this.querySelectorAll('thead th:not([hidden])').length;
    empty?.querySelector('td')?.setAttribute('colspan', String(visibleCols));

    // The header checkbox reflects the current page.
    const onPage = [...page];
    const picked = onPage.filter((r) => this._selected.has(r.dataset.id ?? '')).length;
    const all_ = this.querySelector<HTMLInputElement>('input[data-table-select-all]');
    if (all_) {
      all_.checked = onPage.length > 0 && picked === onPage.length;
      all_.indeterminate = picked > 0 && picked < onPage.length;
    }

    const selectedCount = rows.filter((r) => this._selected.has(r.dataset.id ?? '')).length;
    const sel = this.querySelector('[data-table-selected]');
    if (sel) sel.textContent = String(selectedCount);
    const filtered = this.querySelector('[data-table-filtered]');
    if (filtered) filtered.textContent = String(rows.length);

    const prev = this.querySelector<HTMLButtonElement>('[data-table-page="prev"]');
    const next = this.querySelector<HTMLButtonElement>('[data-table-page="next"]');
    if (prev) prev.disabled = this._page === 0;
    if (next) next.disabled = this._page >= pages - 1;

    const th = this.querySelector<HTMLElement>('th[data-col="email"]');
    th?.setAttribute('aria-sort', this._sort === 'asc' ? 'ascending' : this._sort === 'desc' ? 'descending' : 'none');
  }

  _onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (!input.hasAttribute?.('data-table-filter')) return;
    this._filter = input.value;
    this._page = 0;
    this._apply();
  };

  _onChange = (e: Event): void => {
    const box = e.target as HTMLInputElement;
    if (box.hasAttribute?.('data-table-select-all')) {
      const rows = this._rows().filter((r) => !r.hidden);
      for (const r of rows) {
        const id = r.dataset.id ?? '';
        if (box.checked) this._selected.add(id);
        else this._selected.delete(id);
      }
      this._apply();
    } else if (box.hasAttribute?.('data-table-select-row')) {
      const id = box.closest<HTMLElement>('tr[data-table-row]')?.dataset.id ?? '';
      if (box.checked) this._selected.add(id);
      else this._selected.delete(id);
      this._apply();
    }
  };

  _onClick = (e: Event): void => {
    const button = (e.target as Element).closest?.('button');
    if (!button || !this.contains(button)) return;
    if (button.hasAttribute('data-table-sort')) {
      this._sort = this._sort === 'asc' ? 'desc' : 'asc';
      this._apply();
    } else if (button.dataset.tablePage === 'prev') {
      this._page = Math.max(0, this._page - 1);
      this._apply();
    } else if (button.dataset.tablePage === 'next') {
      this._page += 1;
      this._apply();
    }
  };

  _onItemSelect = (e: Event): void => {
    const item = e.target as HTMLElement;
    const col = item.getAttribute?.('data-table-column-toggle');
    if (col) {
      const checked = (e as CustomEvent<{ checked: boolean }>).detail?.checked;
      if (checked) this._hidden.delete(col);
      else this._hidden.add(col);
      this._apply();
      return;
    }
    const id = item.getAttribute?.('data-table-copy');
    if (id) navigator.clipboard?.writeText(id).catch(() => {});
  };

  render() {
    return html`<slot></slot>`;
  }
}
DataTableDemo.register('data-table-demo');
