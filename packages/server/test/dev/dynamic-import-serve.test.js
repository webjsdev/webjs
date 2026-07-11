/**
 * End-to-end dev-server behaviour for dynamic `import()` (#751): a string-literal
 * `import('./widget.ts')` of an app module is now SERVED by the authorization
 * gate (it used to 404 because the static scanner never discovered it), while a
 * computed `import(expr)` still 404s but with a dev hint pointing at the cause
 * instead of a bare 404.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-dynserve-')); });
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

test('handle: a string-literal dynamic import target is served (no 404)', async () => {
  const appDir = makeApp({
    'app/page.ts': `import '../components/host.ts';\nexport default () => 'ok';\n`,
    'components/host.ts':
      `export class Host { async open() { return import('./widget.ts'); } }\n`,
    'components/widget.ts': `export const widget = (): number => 1;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/components/widget.ts'));
  assert.equal(resp.status, 200, 'the dynamically-imported widget is servable');
  assert.match(await resp.text(), /widget/);
});

test('handle: a dynamic import inside a template ${} hole is served (no 404, #918)', async () => {
  const appDir = makeApp({
    'app/page.ts': `import '../components/host.ts';\nexport default () => 'ok';\n`,
    'components/host.ts':
      `import { html } from '@webjsdev/core';\n` +
      `export class Host { render() { return html\`<div>\${import('./widget.ts')}</div>\`; } }\n`,
    'components/widget.ts': `export const widget = (): number => 1;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/components/widget.ts'));
  assert.equal(resp.status, 200, 'the hole-position dynamic widget is servable');
  assert.match(await resp.text(), /widget/);
});

test('handle: a computed dynamic import target 404s WITH a dev hint', async () => {
  const appDir = makeApp({
    'app/page.ts': `import '../components/host.ts';\nexport default () => 'ok';\n`,
    'components/host.ts':
      `export class Host { load(name: string) { return import('./pages/' + name + '.ts'); } }\n`,
    'components/pages/a.ts': `export const a = (): number => 1;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/components/pages/a.ts'));
  assert.equal(resp.status, 404, 'a computed import target is not statically servable');
  const body = await resp.text();
  assert.match(body, /not reachable from any browser-bound entry/, 'explains the gate');
  assert.match(body, /STRING-LITERAL specifier/, 'recommends a string-literal import');
});

test('handle: the dev hint does NOT fire in prod (bare 404)', async () => {
  const appDir = makeApp({
    'app/page.ts': `import '../components/host.ts';\nexport default () => 'ok';\n`,
    'components/host.ts':
      `export class Host { load(name: string) { return import('./pages/' + name + '.ts'); } }\n`,
    'components/pages/a.ts': `export const a = (): number => 1;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: false });
  const resp = await app.handle(new Request('http://x/components/pages/a.ts'));
  assert.equal(resp.status, 404);
  const body = await resp.text();
  assert.ok(!/STRING-LITERAL specifier/.test(body), 'no dev hint body in prod');
});
