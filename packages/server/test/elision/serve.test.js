/**
 * End-to-end test of display-only component elision through the dev
 * request handler. Pins the acceptance criterion: a display-only
 * component's module is never imported by the served page source (so the
 * browser never downloads it), while an interactive component's import
 * survives untouched.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-elide-')); });
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

// A purely presentational component: static markup, no reactive props,
// no events, no lifecycle hooks, no slot. Elidable.
const BADGE = `
import { WebComponent, html } from '@webjsdev/core';
class Badge extends WebComponent {
  render() { return html\`<span class="badge">verified</span>\`; }
}
Badge.register('x-badge');
`;

// An interactive component: a click handler. Must ship.
const COUNTER = `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('x-counter');
`;

const PAGE = `
import { html } from '@webjsdev/core';
import '../components/badge.ts';
import '../components/counter.ts';
export default () => html\`<x-badge>hi</x-badge><x-counter></x-counter>\`;
`;

test('display-only import is stripped from the served page, interactive import kept', async () => {
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });

  const resp = await app.handle(new Request('http://x/app/page.ts'));
  assert.equal(resp.status, 200, 'page module should be served');
  const code = await resp.text();

  assert.doesNotMatch(code, /badge\.ts/, 'display-only badge import must be elided');
  assert.match(code, /webjs: elided display-only component/);
  assert.match(code, /counter\.ts/, 'interactive counter import must survive');
});

test('the elidable component module is still servable if requested directly', async () => {
  // Elision drops the import, not the file. A stray direct request still
  // resolves (harmless); nothing in the graph triggers it after stripping.
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/components/badge.ts'));
  assert.equal(resp.status, 200);
});

test('a single @click flips the verdict: counterpart import is NOT stripped', async () => {
  // Counterfactual guard. Make badge interactive and confirm it ships.
  const interactiveBadge = BADGE.replace(
    '<span class="badge">verified</span>',
    '<span @click=${() => {}}>verified</span>',
  );
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': interactiveBadge,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/app/page.ts'));
  const code = await resp.text();
  assert.match(code, /badge\.ts/, 'an interactive badge must keep its import');
});

test('webjs.elide: false disables elision app-wide (display-only import survives)', async () => {
  // Project-level opt-out. With the switch off, the display-only badge that
  // would normally be stripped keeps its import, like before the feature.
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'opt-out-app', webjs: { elide: false } }),
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/app/page.ts'));
  assert.equal(resp.status, 200);
  const code = await resp.text();
  assert.match(code, /badge\.ts/, 'elision disabled: display-only import must survive');
  assert.match(code, /counter\.ts/, 'interactive import survives regardless');
  assert.doesNotMatch(code, /webjs: elided display-only component/, 'no strip marker when disabled');
});

test('webjs.elide omitted keeps elision on (default), proving the switch is opt-out only', async () => {
  // Counterfactual: a package.json WITHOUT the key behaves exactly like no
  // package.json at all. Guards against reading the key as a fail-closed flag.
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'default-app' }),
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/app/page.ts'));
  const code = await resp.text();
  assert.doesNotMatch(code, /badge\.ts/, 'default (no key): display-only import still elided');
});

test('rebuild re-applies elision after a component becomes interactive', async () => {
  // doRebuild re-runs analyzeElision; a file edit that adds interactivity must
  // flip the verdict so the now-interactive component ships.
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  let code = await (await app.handle(new Request('http://x/app/page.ts'))).text();
  assert.doesNotMatch(code, /badge\.ts/, 'badge elided at boot');

  writeFileSync(
    join(appDir, 'components/badge.ts'),
    BADGE.replace('<span class="badge">verified</span>', '<span @click=${() => {}}>verified</span>'),
  );
  await app.rebuild();

  code = await (await app.handle(new Request('http://x/app/page.ts'))).text();
  assert.match(code, /badge\.ts/, 'badge ships after rebuild picks up the @click');
});

test('rebuild picks up webjs.elide: false toggled on after boot', async () => {
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  let code = await (await app.handle(new Request('http://x/app/page.ts'))).text();
  assert.doesNotMatch(code, /badge\.ts/, 'badge elided while elision is on');

  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', webjs: { elide: false } }));
  await app.rebuild();

  code = await (await app.handle(new Request('http://x/app/page.ts'))).text();
  assert.match(code, /badge\.ts/, 'rebuild re-reads the switch and disables elision');
});
