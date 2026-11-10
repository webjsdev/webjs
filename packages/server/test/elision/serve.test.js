/**
 * What the dev request handler serves for a component (#1686). Every component
 * in an ordinary file ships, as in Lit, so a served component keeps every
 * import of another component exactly as written: nothing is stripped. A page
 * never loads in the browser, so its source is never served at all, and a
 * component in a `.server` file is the server-only kind, served only as a stub.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-serve-')); });
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

// A purely presentational component: static markup, no events.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
class Badge extends WebComponent {
  render() { return html\`<span class="badge">verified</span>\`; }
}
Badge.register('x-badge');
`;

const COUNTER = `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('x-counter');
`;

// The served importer: a component that side-effect-imports both.
const PANEL = `
import { WebComponent, html } from '@webjsdev/core';
import './badge.ts';
import './counter.ts';
class Panel extends WebComponent {
  render() { return html\`<x-badge></x-badge><x-counter></x-counter>\`; }
}
Panel.register('x-panel');
`;

test('a served component keeps every component import, display-only ones included', async () => {
  const appDir = makeApp({
    'app/page.ts': `import { html } from '@webjsdev/core';\nimport '../components/panel.ts';\nexport default () => html\`<x-panel></x-panel>\`;\n`,
    'components/panel.ts': PANEL,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });

  assert.equal((await app.handle(new Request('http://x/app/page.ts'))).status, 404,
    'the page itself is never served (#1686)');
  const resp = await app.handle(new Request('http://x/components/panel.ts'));
  assert.equal(resp.status, 200, 'the component module is served');
  const code = await resp.text();
  assert.match(code, /import '\.\/badge\.ts'/, 'the display-only badge import is kept');
  assert.match(code, /import '\.\/counter\.ts'/, 'the interactive counter import is kept');
  for (const url of ['http://x/components/badge.ts', 'http://x/components/counter.ts']) {
    assert.equal((await app.handle(new Request(url))).status, 200, `${url} is servable`);
  }
});

test('a component in a .server file is never served as source', async () => {
  const appDir = makeApp({
    'app/page.ts': `import { html } from '@webjsdev/core';\nimport '../components/badge.server.ts';\nexport default () => html\`<x-badge></x-badge>\`;\n`,
    'components/badge.server.ts': BADGE,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const html = await (await app.handle(new Request('http://x/'))).text();
  assert.doesNotMatch(html, /badge\.server\.ts/, 'the boot never names the server-only component');
  assert.equal((await app.handle(new Request('http://x/components/badge.server.ts'))).status, 404,
    'nothing the browser loads imports it, so it is not servable');
});
