// #197: a committed vendor pin is pruned to the specifiers still reachable
// from non-elided modules, so a pinned app serves the same import map an
// unpinned app would. A vendor package whose ONLY importer is a display-only
// (elided) component must NOT appear in the served importmap, even when it is
// in the committed pin file. This mirrors the #170 elision e2e but with a pin.

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

// Display-only: a vendor package used only in render (a binding import, NOT an
// interactivity signal), so the component is elidable and `pad` is its only
// importer.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
import pad from 'leftpad';
class Badge extends WebComponent {
  render() { return html\`<span>\${pad('x', 3)}</span>\`; }
}
Badge.register('x-badge');
`;

const PAGE = `
import { html } from '@webjsdev/core';
import '../components/badge.ts';
export default () => html\`<x-badge></x-badge>\`;
`;

const PIN = JSON.stringify({
  imports: { leftpad: 'https://ga.jspm.io/npm:leftpad@1.0.0/index.js' },
  integrity: { 'https://ga.jspm.io/npm:leftpad@1.0.0/index.js': 'sha384-x' },
});

async function importmapOf(appDir) {
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const resp = await app.handle(new Request('http://x/'));
  const html = await resp.text();
  const m = html.match(/<script type="importmap"[^>]*>([^<]*)<\/script>/);
  return m ? JSON.parse(m[1]) : { imports: {} };
}

test('a pinned vendor dep used only by an elided component is pruned from the served map', async () => {
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    '.webjs/vendor/importmap.json': PIN,
  });
  const map = await importmapOf(appDir);
  assert.ok(
    !Object.keys(map.imports).some((k) => k === 'leftpad' || k.startsWith('leftpad/')),
    `leftpad should be pruned (its only importer is elided), got keys: ${Object.keys(map.imports).join(', ')}`,
  );
});

test('a pinned vendor dep used by a NON-elided (interactive) component is kept', async () => {
  // Same component but with a @click handler, so it ships and `pad` stays reachable.
  const INTERACTIVE_BADGE = BADGE.replace(
    'render() { return html`<span>${pad(\'x\', 3)}</span>`; }',
    'render() { return html`<button @click=${() => {}}>${pad(\'x\', 3)}</button>`; }',
  );
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': INTERACTIVE_BADGE,
    '.webjs/vendor/importmap.json': PIN,
  });
  const map = await importmapOf(appDir);
  assert.ok(
    Object.keys(map.imports).includes('leftpad'),
    `leftpad should be kept (imported by a shipping component), got keys: ${Object.keys(map.imports).join(', ')}`,
  );
});
