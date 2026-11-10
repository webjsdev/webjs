/**
 * `analyzeRouteModules` (#1686): every page, layout and boundary with its kind,
 * the components the boot loads in its place (`emits`), and hints about code
 * in it that looks meant for the browser, plus every orphan component class.
 * The report is the doctor's single input, so its shape is the contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { analyzeRouteModules } from '../../src/route-report.js';

/** @param {Record<string, string>} files  app-relative path -> source */
async function withApp(files, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-route-report-'));
  try {
    for (const [rel, src] of Object.entries(files)) {
      const abs = join(dir, rel);
      await mkdir(join(abs, '..'), { recursive: true });
      await writeFile(abs, src);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Fixture sources are template literals, never plain strings: the
// scanner-fuzz corpus sweep reads every file under `test/elision`, and a plain
// string body keeps its html-template backtick in the mask.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
export class Badge extends WebComponent {
  render() { return html\`<span>verified</span>\`; }
}
Badge.register('my-badge');
`;

/** A badge registered with a COMPUTED tag, which the scanner never sees. */
const BADGE_COMPUTED_TAG = `
import { WebComponent, html } from '@webjsdev/core';
const TAG = 'dyn-' + 'badge';
export class DynBadge extends WebComponent {
  render() { return html\`<span>x</span>\`; }
}
DynBadge.register(TAG);
`;

/** Every string value anywhere in the report, for the no-absolute-path sweep. */
function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) allStrings(v, out);
  return out;
}

test('the full shape: rows, sorting, summary, and no absolute path anywhere', async () => {
  await withApp({
    'components/badge.js': BADGE,
    'app/layout.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nexport default ({ children }) => html`<my-badge></my-badge>${children}`;",
    'app/page.js': "import { html } from '@webjsdev/core';\nexport default () => html`<p>home</p>`;",
    'app/about/page.js': "import { html } from '@webjsdev/core';\nexport default () => html`<p>about</p>`;",
  }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    assert.equal(r.analysed, true);
    assert.equal(r.skipped, null);
    assert.deepEqual(r.routeModules, [
      { file: 'app/about/page.js', kind: 'page', emits: [], hints: [] },
      { file: 'app/layout.js', kind: 'layout', emits: ['components/badge.js'], hints: [] },
      { file: 'app/page.js', kind: 'page', emits: [], hints: [] },
    ]);
    assert.deepEqual(r.summary, { routeModules: 3, zeroJs: 2, carriers: 1, orphans: 0 });
    for (const s of allStrings(r)) assert.ok(!s.includes(dir), `absolute path leaked: ${s}`);
  });
});

test('browser-meant code in a route module is a hint (#1686)', async () => {
  // A BINDING import (track) is not hinted; the side-effect import of
  // lib/boot.js is, since whatever it sets up happens on the server only.
  await withApp({
    'lib/track.js': 'window.__hits = (window.__hits || 0) + 1;\nexport const track = () => {};',
    'lib/boot.js': 'document.title = "set at load";\nexport {};',
    'app/page.js': "import { html } from '@webjsdev/core';\nimport { track } from '../lib/track.js';\nimport '../lib/boot.js';\nexport default () => html`<p>${String(track)}</p>`;",
  }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    const home = r.routeModules.find((m) => m.file === 'app/page.js');
    assert.deepEqual(home.emits, [], 'a route module never ships, whatever it imports');
    assert.equal(home.hints.length, 1, JSON.stringify(home.hints));
    assert.match(home.hints[0], /`\.\.\/lib\/boot\.js` runs only on the server/);
  });
});

test('every route-module kind is reported, never global-error', async () => {
  await withApp({
    'app/page.js': 'export default () => null;',
    'app/layout.js': 'export default ({ children }) => children;',
    'app/error.js': 'export default () => null;',
    'app/loading.js': 'export default () => null;',
    'app/not-found.js': 'export default () => null;',
    'app/forbidden.js': 'export default () => null;',
    'app/unauthorized.js': 'export default () => null;',
    'app/global-error.js': 'export default () => null;',
  }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    const kinds = Object.fromEntries(r.routeModules.map((m) => [m.file, m.kind]));
    assert.deepEqual(kinds, {
      'app/error.js': 'error',
      'app/forbidden.js': 'forbidden',
      'app/layout.js': 'layout',
      'app/loading.js': 'loading',
      'app/not-found.js': 'not-found',
      'app/page.js': 'page',
      'app/unauthorized.js': 'unauthorized',
    });
  });
});

test('a server-only component (.server file) is not in any frontier', async () => {
  await withApp({
    'components/badge.server.js': BADGE,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.server.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    assert.deepEqual(r.routeModules, [{ file: 'app/page.js', kind: 'page', emits: [], hints: [] }]);
  });
});

test('an orphan class is reported', async () => {
  await withApp({
    'components/dyn-badge.js': BADGE_COMPUTED_TAG,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/dyn-badge.js';\nexport default () => html`<p>hi</p>`;",
  }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    assert.deepEqual(r.orphans, [{ file: 'components/dyn-badge.js', className: 'DynBadge' }]);
    assert.equal(r.summary.orphans, 1);
  });
});

test('a relative app dir reports the same rows as an absolute one', async () => {
  await withApp({
    'components/badge.js': BADGE,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const abs = await analyzeRouteModules(dir);
    const rel = await analyzeRouteModules(relative(process.cwd(), dir));
    assert.deepEqual(rel, abs);
    assert.deepEqual(abs.routeModules[0].emits, ['components/badge.js']);
  });
});

test('skipped: no-app carries the empty shape', async () => {
  await withApp({ 'components/badge.js': BADGE }, async (dir) => {
    const r = await analyzeRouteModules(dir);
    assert.equal(r.analysed, false);
    assert.equal(r.skipped, 'no-app');
    assert.deepEqual({ routeModules: r.routeModules, orphans: r.orphans, summary: r.summary }, {
      routeModules: [], orphans: [], summary: { routeModules: 0, zeroJs: 0, carriers: 0, orphans: 0 },
    });
  });
});

test('a malformed app degrades to a report rather than throwing', async () => {
  for (const files of [
    { app: 'not a directory' },
    { 'app/page.js': 'export default () => null;', 'app/route.js': 'export const GET = () => new Response(1);' },
    { 'package.json': '{"name":"x","imports":"nope"}', 'app/page.js': 'export default () => null;' },
  ]) {
    await withApp(files, async (dir) => {
      const r = await analyzeRouteModules(dir);
      assert.ok(Array.isArray(r.routeModules) && Array.isArray(r.orphans));
      assert.equal(typeof r.summary.routeModules, 'number');
      assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
    });
  }
});
