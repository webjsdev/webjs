/**
 * `static lazy = true` survives a static import of the component (#1524).
 *
 * A lazy component that a shipping component imports for registration used to
 * load eagerly with its importer's static graph (and be preloaded with its whole
 * subtree), which defeated `static lazy` whenever the class had to be imported
 * at all. The server keeps the import, so SSR still renders the component; the
 * browser copy of the importer serves that line as a lazy-loader registration,
 * and the preload walks skip it.
 *
 * Covers: the pure rewrite (`deferLazyImportsFromSource`), the per-file verdict
 * (`declaresLazy` / `lazyComponentFiles`), and the whole path through
 * `createRequestHandler` (served source, preloads, the import-only frontier).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequestHandler } from '../../src/dev.js';
import { deferLazyImportsFromSource, lazyComponentFiles } from '../../src/component-elision.js';
import { declaresLazy } from '../../src/component-scanner.js';
import { createBrowserTestHandler } from '../../src/testing.js';

// ---- the pure rewrite -------------------------------------------------------

const PANE = '/app/components/pane.js';
const BADGE = '/app/components/badge.js';
const COUNTER = '/app/components/counter.js';
const resolver = (spec) => spec.replace(/^\.\//, '/app/');
const graph = new Map([['/app/shell.js', new Set([PANE, COUNTER])]]);
const lazy = new Map([[PANE, ['x-pane']]]);
const urlFor = (abs) => abs.slice('/app'.length);

test('a side-effect import of a lazy component becomes a lazy-loader registration', () => {
  const src = [
    `import { html } from '@webjsdev/core';`,
    `import './components/pane.js';`,
    `import './components/counter.js';`,
    `export const x = 1;`,
  ].join('\n');
  const out = deferLazyImportsFromSource(src, '/app/shell.js', graph, lazy, resolver, '/app', urlFor);
  assert.doesNotMatch(out, /import '\.\/components\/pane\.js'/, 'the eager import is gone');
  assert.match(out, /import\('@webjsdev\/core\/lazy-loader'\)\.then\(\(m\) => m\.observeLazy\(\{"x-pane":"\/components\/pane\.js"\}\)\);/);
  assert.match(out, /import '\.\/components\/counter\.js';/, 'a non-lazy import is untouched');
  assert.equal(out.split('\n').length, src.split('\n').length, 'line count is preserved');
});

test('a binding import of a lazy component stays eager (the importer needs the value)', () => {
  const src = `import { Pane } from './components/pane.js';\nconsole.log(Pane);`;
  assert.equal(deferLazyImportsFromSource(src, '/app/shell.js', graph, lazy, resolver, '/app', urlFor), src);
});

test('an import-looking line inside a template is never rewritten', () => {
  const src = "import { html } from '@webjsdev/core';\nexport const t = `\nimport './components/pane.js';\n`;";
  const g = new Map([['/app/shell.js', new Set([PANE])]]);
  assert.equal(deferLazyImportsFromSource(src, '/app/shell.js', g, lazy, resolver, '/app', urlFor), src);
});

test('fast paths: no lazy files, or no lazy dependency, return the source unchanged', () => {
  const src = `import './components/pane.js';`;
  assert.equal(deferLazyImportsFromSource(src, '/app/shell.js', graph, new Map(), resolver, '/app', urlFor), src);
  const g = new Map([['/app/shell.js', new Set([COUNTER])]]);
  assert.equal(deferLazyImportsFromSource(`import './components/counter.js';`, '/app/shell.js', g, lazy, resolver, '/app', urlFor), `import './components/counter.js';`);
});

test('a lazy file registering two tags maps both to the module', () => {
  const g = new Map([['/app/shell.js', new Set([PANE])]]);
  const out = deferLazyImportsFromSource(`import './components/pane.js';`, '/app/shell.js', g, new Map([[PANE, ['x-pane', 'x-pane-item']]]), resolver, '/app', urlFor);
  assert.match(out, /\{"x-pane":"\/components\/pane\.js","x-pane-item":"\/components\/pane\.js"\}/);
});

test('declaresLazy reads code, not comments or strings', () => {
  assert.equal(declaresLazy('class A extends WebComponent { static lazy = true; }'), true);
  assert.equal(declaresLazy('class A extends WebComponent { static lazy: boolean = true; }'), true);
  assert.equal(declaresLazy('class A extends WebComponent { static override lazy = true; }'), true);
  assert.equal(declaresLazy('class A extends WebComponent { static lazy = false; }'), false);
  assert.equal(declaresLazy('// static lazy = true\nclass A extends WebComponent {}'), false);
  assert.equal(declaresLazy("const s = 'static lazy = true';"), false);
});

test('lazyComponentFiles keeps lazy files only, and leaves an elided one to the strip', () => {
  const comps = [
    { tag: 'x-pane', file: PANE, lazy: true },
    { tag: 'x-badge', file: BADGE, lazy: true },
    { tag: 'x-counter', file: COUNTER, lazy: false },
  ];
  const out = lazyComponentFiles(comps, new Set([BADGE]));
  assert.deepEqual([...out.entries()], [[PANE, ['x-pane']]]);
});

// ---- through the request handler -------------------------------------------

const REPO_NODE_MODULES = join(process.cwd(), 'node_modules');

function makeApp(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-lazy-import-'));
  symlinkSync(REPO_NODE_MODULES, join(dir, 'node_modules'), 'dir');
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return dir;
}

const LAYOUT = `import { html } from '@webjsdev/core';
export default ({ children }) => html\`<main>\${children}</main>\`;`;

// A lazy pane with a helper only it imports: the helper must not be preloaded.
const PANE_SRC = (tag) => `import { WebComponent, html } from '@webjsdev/core';
import { label } from './pane-helper.ts';
class Pane extends WebComponent {
  static lazy = true;
  render() { return html\`<button @click=\${() => {}}>\${label}</button>\`; }
}
Pane.register('${tag}');`;
const HELPER = `export const label = 'pane ready';`;
// The interactive shell that renders the pane hidden and imports it.
const SHELL_SRC = (shellTag, paneTag) => `import { WebComponent, html } from '@webjsdev/core';
import './pane.ts';
class Shell extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>open</button><${paneTag} hidden></${paneTag}>\`; }
}
Shell.register('${shellTag}');`;

function preloads(html) {
  return [...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
}
function bootOf(html) {
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
}

for (const dev of [true, false]) {
  test(`a shipping component's import of a lazy component is deferred, SSR intact (${dev ? 'dev' : 'prod'})`, async () => {
    const shellTag = `x-lazy-shell-${dev ? 'd' : 'p'}`;
    const paneTag = `x-lazy-pane-${dev ? 'd' : 'p'}`;
    const dir = makeApp({
      'app/layout.ts': LAYOUT,
      'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/shell.ts';
export default () => html\`<${shellTag}></${shellTag}>\`;`,
      'components/shell.ts': SHELL_SRC(shellTag, paneTag),
      'components/pane.ts': PANE_SRC(paneTag),
      'components/pane-helper.ts': HELPER,
    });
    try {
      const app = await createRequestHandler({ appDir: dir, dev });
      if (app.warmup) await app.warmup();
      const html = await (await app.handle(new Request('http://x/'))).text();
      // SSR still renders the lazy component (the server kept the import).
      assert.match(html, /pane ready/, 'the lazy pane is server-rendered');
      // Nothing under the lazy pane is preloaded or booted.
      const hints = preloads(html);
      assert.ok(hints.some((h) => h.includes('/components/shell.ts')), 'the shell is preloaded');
      assert.ok(!hints.some((h) => h.includes('/components/pane')), `no preload for the pane or its helper: ${hints.join(', ')}`);
      assert.doesNotMatch(bootOf(html).replace(/observeLazy\([^)]*\)/, ''), /\/components\/pane/, 'the boot does not import the pane');
      // The served shell registers the pane with the lazy loader instead.
      const shellUrl = hints.find((h) => h.includes('/components/shell.ts'));
      const served = await (await app.handle(new Request('http://x' + shellUrl))).text();
      assert.doesNotMatch(served, /import '\.\/pane\.ts'/, 'the eager import is gone from the served shell');
      const m = served.match(/m\.observeLazy\((\{[^)]*\})\)/);
      assert.ok(m, 'the served shell registers the pane lazily');
      const entries = JSON.parse(m[1]);
      assert.ok(entries[paneTag] && entries[paneTag].startsWith('/components/pane.ts'), `pane url: ${m[1]}`);
      if (!dev) assert.match(entries[paneTag], /\?v=[0-9a-f]+$/, 'prod fingerprints the lazy url like the boot does');
      // The url the shell registers is servable.
      const pane = await app.handle(new Request('http://x' + entries[paneTag]));
      assert.equal(pane.status, 200);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('an import-only page registers a lazy frontier component instead of importing it', async () => {
  const dir = makeApp({
    'app/layout.ts': LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/pane.ts';
export default () => html\`<p>the pane appears later</p>\`;`,
    'components/pane.ts': PANE_SRC('x-lazy-frontier'),
    'components/pane-helper.ts': HELPER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    const boot = bootOf(html);
    assert.doesNotMatch(boot, /import "\/components\/pane\.ts"/, 'the pane is not imported by the boot');
    assert.match(boot, /observeLazy\(\{"x-lazy-frontier":"\/components\/pane\.ts"\}\)/, 'the pane is registered with the loader');
    assert.ok(!preloads(html).some((h) => h.includes('/components/pane')), 'nothing under the pane is preloaded');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a non-lazy component imported the same way still loads eagerly (control)', async () => {
  const dir = makeApp({
    'app/layout.ts': LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/shell.ts';
export default () => html\`<x-eager-shell></x-eager-shell>\`;`,
    'components/shell.ts': SHELL_SRC('x-eager-shell', 'x-eager-pane'),
    'components/pane.ts': PANE_SRC('x-eager-pane').replace('static lazy = true;', ''),
    'components/pane-helper.ts': HELPER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    assert.ok(preloads(html).some((h) => h.includes('/components/pane.ts')), 'an eager pane is preloaded');
    const served = await (await app.handle(new Request('http://x/components/shell.ts'))).text();
    assert.match(served, /import '\.\/pane\.ts';/, 'and its import is served as written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the browser test handler serves a lazy import as written (a test imports what it tests)', async () => {
  const dir = makeApp({
    'app/layout.ts': LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/shell.ts';
export default () => html\`<x-test-shell></x-test-shell>\`;`,
    'components/shell.ts': SHELL_SRC('x-test-shell', 'x-test-pane'),
    'components/pane.ts': PANE_SRC('x-test-pane'),
    'components/pane-helper.ts': HELPER,
  });
  try {
    const t = await createBrowserTestHandler(dir);
    const served = await (await t.handle(new Request('http://x/components/shell.ts'))).text();
    assert.match(served, /import '\.\/pane\.ts';/, 'the import is served as written');
    assert.doesNotMatch(served, /observeLazy/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
