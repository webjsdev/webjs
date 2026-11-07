/**
 * The /ui charts pages (#1666): /ui/charts and /ui/charts/<type>. The chart
 * list comes from the real registry (the `registry:block` items whose
 * categories are `chart` plus a type), so a chart added there is covered
 * here with no edit.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { CHART_TYPES } from '#lib/ui/charts-shell.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY = resolve(WEBSITE_ROOT, '..', 'packages', 'ui', 'packages', 'registry');
let handle: (path: string) => Promise<Response>;

interface ManifestItem { name: string; type: string; categories?: string[] }
const manifest = JSON.parse(readFileSync(join(REGISTRY, 'registry.json'), 'utf8')) as { items: ManifestItem[] };
const charts = manifest.items.filter((i) => i.type === 'registry:block' && (i.categories || []).includes('chart'));

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

/** The charts on a page, in order. */
const shown = (html: string) => [...html.matchAll(/data-chart-name="([^"]+)"/g)].map((m) => m[1]);

test('every chart block names a type the pages know, and is in that type\'s order', () => {
  assert.ok(charts.length >= 10, `expected chart blocks, found ${charts.length}`);
  for (const c of charts) {
    const type = (c.categories || []).find((x) => x !== 'chart');
    const entry = CHART_TYPES.find((t) => t.type === type);
    assert.ok(entry, `${c.name}: type ${type} has a page`);
    assert.ok(entry.charts.some((x) => x.id === c.name), `${c.name} is in the ${type} order`);
  }
});

test('/ui/charts opens on the area charts', async () => {
  const res = await handle('/ui/charts');
  assert.ok(res.status >= 300 && res.status < 400, `a redirect, got ${res.status}`);
  assert.equal(new URL(res.headers.get('location') ?? '', 'http://localhost').pathname, '/ui/charts/area');
});

test('each type page shows its charts in shadcn\'s order, each drawn on the server with its code', async () => {
  for (const type of CHART_TYPES) {
    const expected = type.charts.map((c) => c.id).filter((id) => charts.some((c) => c.name === id));
    const res = await handle(`/ui/charts/${type.type}`);
    if (!expected.length) {
      assert.equal(res.status, 404, `/ui/charts/${type.type} has no charts yet`);
      continue;
    }
    assert.equal(res.status, 200, `/ui/charts/${type.type} renders`);
    const html = await res.text();
    assert.deepEqual(shown(html), expected, `${type.type}: the charts, in order`);
    assert.match(html, /Beautiful Charts &amp; Graphs/);
    assert.match(html, new RegExp(`<a href="/ui/charts/${type.type}#charts"[^>]*data-active="true"`), 'its nav link is current');
    assert.equal((html.match(/<ui-chart data-slot="chart"/g) || []).length >= expected.length, true, 'every chart is a served <ui-chart>');
    assert.equal((html.match(/>View Code<\/button>/g) || []).length, expected.length, 'one View Code per chart');
  }
});

test('the header links Charts after Blocks', async () => {
  const html = await (await handle('/ui/charts/area')).text();
  const nav = html.slice(html.indexOf('>Blocks</a>'), html.indexOf('>Blocks</a>') + 400);
  assert.match(nav, /href="\/ui\/charts"[^>]*>Charts<\/a>/);
});
