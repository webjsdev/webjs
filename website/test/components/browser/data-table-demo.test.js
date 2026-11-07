/**
 * Browser tests for <data-table-demo>, the Data Table docs demos' behaviour
 * (#1666). The markup is the server fragment's shape (lib/ui/data-table-demo.ts)
 * reduced to what the element reads, with twelve rows so a second page
 * exists. The Columns menu is the kit's dropdown in the real page; here its
 * checkbox item is stood in for by an element that dispatches the same
 * `ui-item-select` event, which is the contract the element listens to.
 */
import '#components/data-table-demo.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const EMAILS = [
  'ken99@example.com', 'Abe45@example.com', 'Monserrat44@example.com', 'Silas22@example.com',
  'carmella@example.com', 'zed@example.com', 'bob@example.com', 'dana@example.com',
  'eve@example.com', 'fay@example.com', 'gus@example.com', 'hal@example.com',
];

const row = (email, i) => `
  <tr data-table-row data-id="id${i}" data-email="${email}" ${i >= 10 ? 'hidden' : ''}>
    <td><input type="checkbox" data-table-select-row aria-label="Select row"></td>
    <td data-col="status">success</td>
    <td data-col="email">${email}</td>
    <td data-col="amount">$1.00</td>
  </tr>`;

const MARKUP = `
<data-table-demo page-size="10">
  <input type="search" data-table-filter aria-label="Filter emails">
  <div id="status-toggle" data-table-column-toggle="status"></div>
  <table>
    <thead><tr>
      <th><input type="checkbox" data-table-select-all aria-label="Select all"></th>
      <th data-col="status">Status</th>
      <th data-col="email" aria-sort="none"><button type="button" data-table-sort="email">Email</button></th>
      <th data-col="amount">Amount</th>
    </tr></thead>
    <tbody>
      ${EMAILS.map(row).join('')}
      <tr data-table-empty hidden><td colspan="4">No results.</td></tr>
    </tbody>
  </table>
  <div><span data-table-selected>0</span> of <span data-table-filtered>12</span> row(s) selected.</div>
  <button type="button" data-table-page="prev" disabled>Previous</button>
  <button type="button" data-table-page="next">Next</button>
</data-table-demo>`;

suite('data-table-demo', () => {
  let host;
  let el;

  setup(async () => {
    host = document.createElement('div');
    host.innerHTML = MARKUP;
    document.body.appendChild(host);
    el = host.querySelector('data-table-demo');
    await el.updateComplete;
  });

  teardown(() => host.remove());

  const shown = () => Array.from(el.querySelectorAll('tr[data-table-row]')).filter((r) => !r.hidden).map((r) => r.dataset.email);
  const text = (sel) => el.querySelector(sel).textContent.trim();

  test('the filter narrows the rows and the filtered count, case-insensitively', async () => {
    const input = el.querySelector('[data-table-filter]');
    input.value = 'MON';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    assert.equal(shown().join(), 'Monserrat44@example.com');
    assert.equal(text('[data-table-filtered]'), '1');
    input.value = 'nobody';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    assert.equal(shown().length, 0);
    assert.ok(!el.querySelector('tr[data-table-empty]').hidden, 'the No results row shows');
  });

  test('the Email header sorts ascending, then toggles to descending', async () => {
    const sort = el.querySelector('[data-table-sort]');
    sort.click();
    await tick();
    assert.equal(shown()[0], 'Abe45@example.com', 'ascending, case-insensitive');
    assert.equal(el.querySelector('th[data-col="email"]').getAttribute('aria-sort'), 'ascending');
    sort.click();
    await tick();
    assert.equal(shown()[0], 'zed@example.com', 'descending');
    assert.equal(el.querySelector('th[data-col="email"]').getAttribute('aria-sort'), 'descending');
  });

  test('select-all selects the page and updates the count', async () => {
    const all = el.querySelector('[data-table-select-all]');
    all.click();
    await tick();
    assert.equal(text('[data-table-selected]'), '10', 'the ten rows of page one');
    assert.ok(el.querySelector('tr[data-table-row]').dataset.state === 'selected');
    const first = el.querySelector('[data-table-select-row]');
    first.click();
    await tick();
    assert.equal(text('[data-table-selected]'), '9');
    assert.ok(all.indeterminate, 'some selected: indeterminate');
  });

  test('a column hides from the Columns menu and comes back', async () => {
    const toggle = el.querySelector('#status-toggle');
    toggle.dispatchEvent(new CustomEvent('ui-item-select', { bubbles: true, detail: { checked: false } }));
    await tick();
    assert.ok(Array.from(el.querySelectorAll('[data-col="status"]')).every((c) => c.hidden), 'every status cell hides');
    assert.ok(!el.querySelector('th[data-col="email"]').hidden, 'other columns stay');
    toggle.dispatchEvent(new CustomEvent('ui-item-select', { bubbles: true, detail: { checked: true } }));
    await tick();
    assert.ok(!el.querySelector('th[data-col="status"]').hidden, 'and shows again');
  });

  test('Next and Previous page through the rows', async () => {
    const next = el.querySelector('[data-table-page="next"]');
    const prev = el.querySelector('[data-table-page="prev"]');
    assert.equal(shown().length, 10);
    next.click();
    await tick();
    assert.equal(shown().join(), 'gus@example.com,hal@example.com', 'page two');
    assert.ok(next.disabled, 'Next disables on the last page');
    assert.ok(!prev.disabled, 'Previous enables');
    prev.click();
    await tick();
    assert.equal(shown().length, 10);
    assert.ok(prev.disabled);
  });
});
