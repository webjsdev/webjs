import { WebComponent, html } from '@webjsdev/core';

/**
 * `<tasks-table>` is the script half of the tasks example (#1666). The table
 * itself is server markup driven by the query string, and every control
 * already works as a link or a GET form field with JavaScript off. This adds
 * what a script is for:
 *
 * - submitting the form as a filter changes (a faceted checkbox, rows per
 *   page, the title filter after a pause), as shadcn's table filters live;
 * - toggling a faceted checkbox from the keyboard, where the command list
 *   keeps focus in its input and fires `ui-select` instead of a click;
 * - the row selection: the "N of M row(s) selected" count, the select-all
 *   box's checked and indeterminate states, and the selected rows' shading;
 * - `aria-expanded` and `data-state` on a popover's button, from the
 *   popover's own `toggle` event;
 * - leaving an empty filter and the default page size out of the URL;
 * - carrying the reader's place across the swap each submission makes:
 *   focus and caret back in the title filter, so typing carries on, and a
 *   faceted filter's popover open again with focus in its search, so several
 *   values can be picked in a row as in shadcn's.
 *
 * The client router applies each submission in place. With JavaScript off a
 * faceted filter is applied by its Apply button, and the page that comes back
 * has it closed, since a popover cannot be served open.
 */

/** What to restore once the submission it started has been applied. */
let restore: { input?: { id: string; caret: number }; popover?: string } | null = null;

function restorePlace(): void {
  const r = restore;
  restore = null;
  if (r?.popover) {
    const pop = document.getElementById(r.popover);
    const source = document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(r.popover)}"]`);
    if (pop && !pop.matches(':popover-open')) {
      // `source` anchors it to its button as a click would (the position-area
      // classes need that anchor); an engine without the option opens it anyway.
      try {
        (pop as HTMLElement & { showPopover(o?: { source?: HTMLElement }): void }).showPopover({ source: source ?? undefined });
      } catch {
        pop.showPopover();
      }
    }
    pop?.querySelector<HTMLInputElement>('ui-command-input input')?.focus();
  }
  if (r?.input) {
    const input = document.getElementById(r.input.id) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(r.input.caret, r.input.caret);
    }
  }
}
export class TasksTable extends WebComponent {
  _timer: ReturnType<typeof setTimeout> | undefined;
  _pointerItem: Element | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
    this.addEventListener('input', this._onInput);
    this.addEventListener('ui-select', this._onSelect);
    this.addEventListener('click', this._onClickCapture, true);
    this.addEventListener('toggle', this._onToggle, true);
    this.addEventListener('formdata', this._onFormData);
    document.addEventListener('webjs:navigate', restorePlace);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('ui-select', this._onSelect);
    this.removeEventListener('click', this._onClickCapture, true);
    this.removeEventListener('toggle', this._onToggle, true);
    this.removeEventListener('formdata', this._onFormData);
    document.removeEventListener('webjs:navigate', restorePlace);
    clearTimeout(this._timer);
    super.disconnectedCallback();
  }

  // The markup is the server's; the element only listens.
  render() {
    return html`<slot></slot>`;
  }

  _form(): HTMLFormElement | null {
    return this.querySelector<HTMLFormElement>('form[data-tasks-form]');
  }

  _submit(): void {
    clearTimeout(this._timer);
    this._form()?.requestSubmit();
  }

  /** Submit a facet's change, reopening its popover once the page is swapped. */
  _submitFrom(el: Element): void {
    const pop = el.closest<HTMLElement>('[popover]');
    if (pop?.id) restore = { popover: pop.id };
    this._submit();
  }

  _onChange = (e: Event): void => {
    const el = e.target as HTMLInputElement;
    if (el.matches('[data-filter]')) this._submitFrom(el);
    else if (el.matches('select[name="size"]')) this._submit();
    else if (el.matches('[data-select]')) this._syncSelection(el);
  };

  _onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('[data-filter-text]')) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      restore = { input: { id: input.id, caret: input.selectionStart ?? input.value.length } };
      this._submit();
    }, 400);
  };

  // The URL carries only what differs from the defaults (state.ts reads a
  // missing field as its default), as the server's own links do.
  _onFormData = (e: Event): void => {
    const data = (e as FormDataEvent).formData;
    if (!String(data.get('q') ?? '').trim()) data.delete('q');
    if (data.get('size') === '25') data.delete('size');
  };

  // A click on a faceted item's label toggles its checkbox natively (and the
  // change submits). Remember which item that click was on, so its ui-select
  // does not toggle the box a second time.
  _onClickCapture = (e: Event): void => {
    const target = e.target as Element;
    this._pointerItem = target.closest('label') ? target.closest('ui-command-item') : null;
    // A facet's Clear filters link keeps its popover open too, as shadcn's does.
    const pop = target.closest('a[href]')?.closest<HTMLElement>('[popover][id^="filter-"]');
    if (pop) restore = { popover: pop.id };
  };

  _onSelect = (e: Event): void => {
    const item = (e.target as Element).closest('ui-command-item');
    if (!item) return;
    if (item === this._pointerItem) {
      this._pointerItem = null;
      return;
    }
    const box = item.querySelector<HTMLInputElement>('input[data-filter]');
    if (box) {
      box.checked = !box.checked;
      this._submitFrom(box);
    }
  };

  _onToggle = (e: Event): void => {
    const pop = e.target as HTMLElement;
    if (!pop.id) return;
    const open = (e as ToggleEvent).newState === 'open';
    for (const btn of Array.from(this.querySelectorAll<HTMLElement>(`[popovertarget="${CSS.escape(pop.id)}"]`))) {
      btn.setAttribute('aria-expanded', String(open));
      btn.dataset.state = open ? 'open' : 'closed';
    }
  };

  _syncSelection(changed: HTMLInputElement): void {
    const rows = Array.from(this.querySelectorAll<HTMLInputElement>('input[data-select="row"]'));
    const all = this.querySelector<HTMLInputElement>('input[data-select="all"]');
    if (changed === all) for (const r of rows) r.checked = all.checked;
    const n = rows.filter((r) => r.checked).length;
    for (const r of rows) {
      const tr = r.closest('tr');
      if (tr) r.checked ? tr.setAttribute('data-state', 'selected') : tr.removeAttribute('data-state');
    }
    if (all) {
      all.checked = n > 0 && n === rows.length;
      all.indeterminate = n > 0 && n < rows.length;
    }
    const out = this.querySelector('[data-selected-count]');
    if (out) out.textContent = String(n);
  }
}

TasksTable.register('tasks-table');
