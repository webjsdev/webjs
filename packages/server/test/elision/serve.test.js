/**
 * End-to-end test of display-only component elision through the dev
 * request handler. Pins the acceptance criterion: a display-only
 * component's module is never imported by the served source of a module that
 * does ship (so the browser never downloads it), while an interactive
 * component's import survives untouched. The importer here is a shipping
 * component: a page never loads in the browser (#1686), so its source is
 * never served at all.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
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

/**
 * The served importer: a shipping component that side-effect-imports the
 * badge (registering it, the barrel shape) and the counter, and renders only
 * the counter. The page renders the badge. A shipping component that RENDERS a
 * tag forces that component to ship, so the panel must not render the badge
 * for the badge to stay display-only.
 */
const panel = (badgeFile = './badge.ts') => `
import { WebComponent, html } from '@webjsdev/core';
import '${badgeFile}';
import './counter.ts';
class Panel extends WebComponent {
  render() { return html\`<x-counter @click=\${() => {}}></x-counter>\`; }
}
Panel.register('x-panel');
`;

const panelPage = (badgeTag = 'x-badge') => `
import { html } from '@webjsdev/core';
import '../components/panel.ts';
export default () => html\`<${badgeTag}>hi</${badgeTag}><x-panel></x-panel>\`;
`;
const PANEL_PAGE = panelPage();

const PANEL = 'http://x/components/panel.ts';

test('display-only import is stripped from the served component, interactive import kept', async () => {
  const appDir = makeApp({
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });

  assert.equal((await app.handle(new Request('http://x/app/page.ts'))).status, 404,
    'the page itself is never served (#1686)');
  const resp = await app.handle(new Request(PANEL));
  assert.equal(resp.status, 200, 'the shipping component module is served');
  const code = await resp.text();

  assert.doesNotMatch(code, /badge\.ts/, 'display-only badge import must be elided');
  assert.match(code, /webjs: elided display-only component/);
  assert.match(code, /counter\.ts/, 'interactive counter import must survive');
});

// The same display-only component in the enforced declare-free factory DX
// (#604): an empty factory call, no attribute / event / lifecycle. It must elide
// through the real serve path exactly like the callless BADGE above, proving
// the factory-form fix end to end (not just at the analyser).
const FACTORY_BADGE = `
import { WebComponent, html } from '@webjsdev/core';
class FactoryBadge extends WebComponent({}) {
  render() { return html\`<span class="badge">verified</span>\`; }
}
FactoryBadge.register('x-factory-badge');
`;


test('a display-only FACTORY-form component is stripped from the served component (#604)', async () => {
  const appDir = makeApp({
    'app/page.ts': panelPage('x-factory-badge'),
    'components/panel.ts': panel('./factory-badge.ts'),
    'components/factory-badge.ts': FACTORY_BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(PANEL));
  assert.equal(resp.status, 200, 'the shipping component module is served');
  const code = await resp.text();
  assert.doesNotMatch(code, /factory-badge\.ts/, 'display-only factory component import must be elided');
  assert.match(code, /counter\.ts/, 'interactive import must survive');
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
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': interactiveBadge,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(PANEL));
  const code = await resp.text();
  assert.match(code, /badge\.ts/, 'an interactive badge must keep its import');
});

test('a display-only component observed via whenDefined is NOT stripped (#169)', async () => {
  // Through the full dev handler: a helper the shipping counter imports calls
  // whenDefined('x-badge'), so the badge must register client-side and boot
  // (otherwise customElements.define never runs and whenDefined never
  // resolves). The observer rides the counter, not the page: a page never
  // loads in the browser (#1686), so an observer only it imports observes
  // nothing. Counterfactual is the first test in this file, where the same
  // display-only badge with no observer IS stripped.
  const observer = `
    customElements.whenDefined('x-badge').then(() => {});
    export const ready = true;
  `;
  const appDir = makeApp({
    'app/page.ts': PAGE,
    'components/badge.ts': BADGE,
    'components/counter.ts': `import '../lib/observe.ts';\n${COUNTER}`,
    'lib/observe.ts': observer,
  });
  // The page renders here (SSR imports core), so it needs the repo's packages.
  symlinkSync(join(process.cwd(), 'node_modules'), join(appDir, 'node_modules'), 'dir');
  const app = await createRequestHandler({ appDir, dev: true });
  const html = await (await app.handle(new Request('http://x/'))).text();
  const boot = (html.match(/<script type="module">([\s\S]*?)<\/script>/) || [])[1] || '';
  assert.match(boot, /\/components\/badge\.ts/, 'an observed display-only badge must boot');
  assert.match(boot, /\/components\/counter\.ts/, 'and so does the counter carrying the observer');
});

test('webjs.elide: false disables elision app-wide (display-only import survives)', async () => {
  // Project-level opt-out. With the switch off, the display-only badge that
  // would normally be stripped keeps its import, like before the feature.
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'opt-out-app', webjs: { elide: false } }),
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(PANEL));
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
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request(PANEL));
  const code = await resp.text();
  assert.doesNotMatch(code, /badge\.ts/, 'default (no key): display-only import still elided');
});

test('rebuild re-applies elision after a component becomes interactive', async () => {
  // doRebuild re-runs analyzeElision; a file edit that adds interactivity must
  // flip the verdict so the now-interactive component ships.
  const appDir = makeApp({
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  let code = await (await app.handle(new Request(PANEL))).text();
  assert.doesNotMatch(code, /badge\.ts/, 'badge elided at boot');

  writeFileSync(
    join(appDir, 'components/badge.ts'),
    BADGE.replace('<span class="badge">verified</span>', '<span @click=${() => {}}>verified</span>'),
  );
  await app.rebuild();

  code = await (await app.handle(new Request(PANEL))).text();
  assert.match(code, /badge\.ts/, 'badge ships after rebuild picks up the @click');
});

test('rebuild picks up webjs.elide: false toggled on after boot', async () => {
  const appDir = makeApp({
    'app/page.ts': PANEL_PAGE,
    'components/panel.ts': panel(),
    'components/badge.ts': BADGE,
    'components/counter.ts': COUNTER,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  let code = await (await app.handle(new Request(PANEL))).text();
  assert.doesNotMatch(code, /badge\.ts/, 'badge elided while elision is on');

  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', webjs: { elide: false } }));
  await app.rebuild();

  code = await (await app.handle(new Request(PANEL))).text();
  assert.match(code, /badge\.ts/, 'rebuild re-reads the switch and disables elision');
});
