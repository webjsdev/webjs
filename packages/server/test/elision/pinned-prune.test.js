// #197: a committed vendor pin is pruned to the specifiers the browser can
// reach, so a pinned app serves the same import map an unpinned app would. A
// vendor package whose ONLY importer is a page (which never ships, #1686) must
// NOT appear in the served importmap, even when it is in the committed pin file.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-pinprune-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

// A component using a vendor package in its render: it ships, so `pad` is
// reachable from the browser.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
import pad from 'leftpad';
class Badge extends WebComponent {
  render() { return html\`<span>\${pad('x', 3)}</span>\`; }
}
Badge.register('x-badge');
`;

// A page that uses the vendor package itself: it runs only on the server.
const PAGE = `
import { html } from '@webjsdev/core';
import pad from 'leftpad';
export default () => html\`<p>\${pad('x', 3)}</p>\`;
`;

const PIN = JSON.stringify({
  imports: { leftpad: 'https://ga.jspm.io/npm:leftpad@1.0.0/index.js' },
  integrity: { 'https://ga.jspm.io/npm:leftpad@1.0.0/index.js': 'sha384-x' },
});

async function importmapFromHandler(app) {
  const resp = await app.handle(new Request('http://x/'));
  const html = await resp.text();
  const m = html.match(/<script type="importmap"[^>]*>([^<]*)<\/script>/);
  return m ? JSON.parse(m[1]) : { imports: {} };
}

async function importmapOf(appDir) {
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  return importmapFromHandler(app);
}

test('a pinned vendor dep used only by a page is pruned from the served map', async () => {
  const appDir = makeApp({
    'app/page.ts': PAGE,
    '.webjs/vendor/importmap.json': PIN,
  });
  const map = await importmapOf(appDir);
  assert.ok(
    !Object.keys(map.imports).some((k) => k === 'leftpad' || k.startsWith('leftpad/')),
    `leftpad should be pruned (its only importer is a page), got keys: ${Object.keys(map.imports).join(', ')}`,
  );
});

test('the prune survives a rebuild (the pinned map does not regrow)', async () => {
  // After an fs.watch rebuild the vendor stage re-runs; it must re-prune, not
  // re-apply the full pin. (Regression guard: an earlier version pruned only on
  // first warm, so a rebuild regrew the page-only dep.)
  const appDir = makeApp({
    'app/page.ts': PAGE,
    '.webjs/vendor/importmap.json': PIN,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();
  let map = await importmapFromHandler(app);
  assert.ok(!Object.keys(map.imports).includes('leftpad'), 'pruned on first warm');

  await app.rebuild();
  map = await importmapFromHandler(app);
  assert.ok(!Object.keys(map.imports).includes('leftpad'),
    `still pruned after rebuild, got keys: ${Object.keys(map.imports).join(', ')}`);
});

test('a pinned vendor dep a component uses is kept', async () => {
  // Every component ships, so `pad` stays reachable from the browser.
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    '.webjs/vendor/importmap.json': PIN,
  });
  const map = await importmapOf(appDir);
  assert.ok(
    Object.keys(map.imports).includes('leftpad'),
    `leftpad should be kept (imported by a shipping component), got keys: ${Object.keys(map.imports).join(', ')}`,
  );
});
