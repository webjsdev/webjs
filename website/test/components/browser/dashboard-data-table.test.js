/**
 * Browser tests for <dashboard-01-data-table>, the dashboard-01 block's table
 * (#1666). The markup is the block's own `dataTable()` fragment over its
 * sample rows, rendered from the site's mirror of the block, so the element
 * meets exactly what the server sends: the first page's rows in the body and
 * every row on the element's `rows` attribute. The table renders only the
 * current page, and the order, the selection and the edited cells hold as the
 * reader pages.
 */
import { render } from '@webjsdev/core';
import { dataTable } from '#modules/ui/blocks/dashboard-01/components/data-table.ts';
import { dashboardData } from '#modules/ui/blocks/dashboard-01/components/dashboard-data.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

suite('dashboard-01-data-table', () => {
  let host;
  let el;

  setup(async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    render(dataTable({ data: dashboardData }), host);
    el = host.querySelector('dashboard-01-data-table');
    await el.updateComplete;
    await tick();
  });

  teardown(() => host.remove());

  const ids = () => Array.from(el.querySelectorAll('tbody[data-rows] > tr[data-row-id]')).map((r) => r.dataset.rowId);
  const text = (sel) => el.querySelector(sel).textContent.trim();
  const rowEl = (id) => el.querySelector(`tbody[data-rows] > tr[data-row-id="${id}"]`);
  const pageCount = Math.ceil(dashboardData.length / 10);
  const idAt = (i) => String(dashboardData[i].id);
  const press = (target, key) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  test('only the current page is in the document, and the pager walks the pages', async () => {
    assert.equal(ids().length, 10, 'ten rows, not all of them');
    assert.equal(ids()[0], idAt(0));
    assert.equal(text('[data-page-label]'), `Page 1 of ${pageCount}`);
    assert.equal(text('[data-row-count]'), String(dashboardData.length));
    el.querySelector('button[data-page="next"]').click();
    await tick();
    assert.equal(ids().join(), dashboardData.slice(10, 20).map((r) => String(r.id)).join(), 'page two replaces page one');
    assert.equal(text('[data-page-label]'), `Page 2 of ${pageCount}`);
    el.querySelector('button[data-page="last"]').click();
    await tick();
    assert.equal(ids().length, dashboardData.length - (pageCount - 1) * 10, 'the last page holds the remainder');
    assert.ok(el.querySelector('button[data-page="next"]').disabled, 'next is disabled on the last page');
    el.querySelector('button[data-page="first"]').click();
    await tick();
    assert.equal(ids()[0], idAt(0));
    assert.ok(el.querySelector('button[data-page="previous"]').disabled);
  });

  test('a selection holds across pages, and select-all covers the page only', async () => {
    const box = rowEl(idAt(1)).querySelector('input[data-row-select]');
    box.click();
    await tick();
    assert.equal(text('[data-selected-count]'), '1');
    assert.equal(rowEl(idAt(1)).dataset.state, 'selected');
    el.querySelector('button[data-page="next"]').click();
    await tick();
    const all = el.querySelector('input[data-select-all]');
    assert.ok(!all.checked && !all.indeterminate, 'nothing on page two is selected yet');
    all.click();
    await tick();
    assert.equal(text('[data-selected-count]'), '11', 'page two plus the row from page one');
    el.querySelector('button[data-page="previous"]').click();
    await tick();
    assert.ok(rowEl(idAt(1)).querySelector('input[data-row-select]').checked, 'the page-one row is still checked');
    assert.ok(all.indeterminate, 'page one is partly selected');
  });

  test('an edited cell keeps its value after paging away and back', async () => {
    const input = rowEl(idAt(2)).querySelector('input[data-row-edit="target"]');
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.querySelector('button[data-page="next"]').click();
    await tick();
    assert.equal(rowEl(idAt(2)), null, 'the row left the document');
    el.querySelector('button[data-page="previous"]').click();
    await tick();
    assert.equal(rowEl(idAt(2)).querySelector('input[data-row-edit="target"]').value, '99');
  });

  test('the arrow keys move a row across the page edge, and the table follows it', async () => {
    const tenth = idAt(9);
    const handle = rowEl(tenth).querySelector('[data-drag-handle]');
    handle.focus();
    press(handle, 'ArrowDown');
    await tick();
    assert.equal(text('[data-page-label]'), `Page 2 of ${pageCount}`, 'the table pages with the row');
    assert.equal(ids()[0], tenth, 'the row heads page two');
    assert.equal(document.activeElement?.closest('tr')?.dataset.rowId, tenth, 'its handle keeps focus');
    press(document.activeElement, 'ArrowUp');
    await tick();
    assert.equal(text('[data-page-label]'), 'Page 1 of ' + pageCount);
    assert.equal(ids()[9], tenth, 'and moves back');
  });

  test('dragging a row by its handle reorders the page', async () => {
    const first = rowEl(idAt(0));
    const third = rowEl(idAt(2));
    const data = new DataTransfer();
    first.querySelector('[data-drag-handle]').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    const box = third.getBoundingClientRect();
    third.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: box.bottom - 1, dataTransfer: data }));
    first.querySelector('[data-drag-handle]').dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
    await tick();
    assert.equal(ids().slice(0, 3).join(), [idAt(1), idAt(2), idAt(0)].join(), 'the first row now follows the third');
    assert.equal(rowEl(idAt(0)).dataset.dragging, 'false');
  });

  test('the page size and a hidden column apply to every page', async () => {
    const size = el.querySelector('select[data-page-size]');
    size.value = '20';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    assert.equal(ids().length, 20);
    const item = el.querySelector('[data-column-toggle][value="status"]');
    item.dispatchEvent(new CustomEvent('ui-item-select', { bubbles: true, detail: { value: 'status', checked: false } }));
    await tick();
    el.querySelector('button[data-page="next"]').click();
    await tick();
    const cells = Array.from(el.querySelectorAll('tbody [data-column="status"]'));
    assert.ok(cells.length > 0 && cells.every((c) => c.hidden), 'the next page renders the column hidden');
    assert.ok(el.querySelector('thead [data-column="status"]').hidden, 'and its header');
  });
});
