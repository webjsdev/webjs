/**
 * The Data Table docs page (#1666): /ui/docs/components/data-table. The lead
 * demo and the RTL demo are server markup in their first state, so the table
 * reads with JavaScript off, and the page carries every section of shadcn's
 * guide, in order.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let html = '';

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  const res = await app.handle(new Request('http://localhost/ui/docs/components/data-table'));
  assert.equal(res.status, 200, 'the page renders');
  html = await res.text();
});

/** The first <data-table-demo> element's markup (the lead demo). */
const lead = () => html.match(/<data-table-demo[\s\S]*?<\/data-table-demo>/)?.[0] ?? '';

test('the lead demo is the payments table in its first state', () => {
  const demo = lead();
  assert.ok(demo, 'the demo element is on the page');
  const rows = [...demo.matchAll(/<tr[^>]*data-table-row[^>]*>/g)].map((m) => m[0]);
  assert.equal(rows.length, 5, "shadcn's five payments");
  assert.ok(rows.every((r) => !/\shidden/.test(r)), 'all five fit on the first page of 10');
  for (const email of ['ken99@example.com', 'Abe45@example.com', 'Monserrat44@example.com', 'Silas22@example.com', 'carmella@example.com']) {
    assert.match(demo, new RegExp(`data-email="${email}"`), `${email} in data order`);
  }
  assert.match(demo, /data-table-filter[^>]*placeholder="Filter emails\.\.\."/, 'the email filter');
  assert.match(demo, /Columns/, 'the Columns menu trigger');
  for (const col of ['status', 'email', 'amount']) {
    assert.match(demo, new RegExp(`<ui-dropdown-menu-item type="checkbox" value="${col}" checked`), `${col} is a visible, toggleable column`);
  }
  assert.match(demo, /data-table-sort="email"/, 'the sortable Email header');
  assert.match(demo, /aria-label="Select all"/, 'the select-all checkbox');
  assert.match(demo, /<span data-table-selected>0<\/span> of <span data-table-filtered>5<\/span> row\(s\) selected\./, 'the selected count');
  assert.match(demo, /\$316\.00/, 'amounts formatted as dollars');
  assert.match(demo, /data-table-page="prev"[^>]*disabled/, 'Previous starts disabled');
  assert.match(demo, /data-table-copy="m5gr84i9"/, 'each row has its actions menu');
});

test('the RTL demo is the same table in Arabic, right to left', () => {
  const demos = html.match(/<data-table-demo[\s\S]*?<\/data-table-demo>/g) ?? [];
  assert.equal(demos.length, 2, 'the lead demo and the RTL demo');
  const rtl = demos[1];
  assert.match(rtl, /dir="rtl"/);
  assert.match(rtl, /تصفية البريد الإلكتروني\.\.\./, 'the Arabic filter placeholder');
  assert.match(rtl, /الأعمدة/, 'the Arabic Columns label');
});

test("every section of shadcn's guide is on the page, in order", () => {
  const ids = [
    'introduction', 'table-of-contents', 'installation', 'prerequisites', 'project-structure',
    'set-up-table-features', 'basic-table', 'column-definitions', 'datatable-fragment', 'render-the-table',
    'cell-formatting', 'row-actions', 'pagination', 'pagination-is-already-enabled', 'add-pagination-controls',
    'sorting', 'make-header-cell-sortable', 'filtering', 'visibility', 'row-selection',
    'update-column-definitions', 'show-selected-rows', 'reusable-components', 'column-header',
    'reusable-pagination', 'column-toggle', 'rtl',
  ];
  let at = -1;
  for (const id of ids) {
    const i = html.indexOf(`id="${id}"`);
    assert.ok(i > at, `section ${id} is present and in order`);
    at = i;
  }
});
