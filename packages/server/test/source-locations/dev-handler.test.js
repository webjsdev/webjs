/**
 * Integration tests for dev source locations (#1499) through the real request
 * pipeline (`createRequestHandler`).
 *
 * With `WEBJS_SOURCE_LOCATIONS=1` under dev, the SSR HTML of a page, its layout
 * and the components it renders carries `data-webjs-src="<file>:<line>"`, and
 * the component module the dev server serves to the browser carries the SAME
 * annotation, so a client re-render matches what SSR produced. The
 * counterfactuals: without the variable, and in production with it, nothing is
 * annotated and the output matches the plain render.
 *
 * The SSR half is a process-global load hook scoped to registered app roots,
 * which is why the plain app here lives in a different directory and why this
 * file runs in its own process (node:test isolates files).
 *
 * The apps live under this test directory, not the OS temp dir, so the bare
 * `@webjsdev/core` specifier resolves through the repo's node_modules.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const FILES = {
  'package.json': JSON.stringify({ name: 'srcloc', type: 'module' }),
  'app/layout.ts': [
    "import { html } from '@webjsdev/core';",
    'export default function Layout({ children }: { children: unknown }) {',
    '  return html`<div class="shell">',
    '    ${children}',
    '  </div>`;',
    '}',
    '',
  ].join('\n'),
  'app/page.ts': [
    "import { html } from '@webjsdev/core';",
    "import '../components/hello-card.ts';",
    'export default function Page() {',
    '  return html`',
    '    <main>',
    '      <hello-card name="x"></hello-card>',
    '    </main>`;',
    '}',
    '',
  ].join('\n'),
  'components/hello-card.ts': [
    "import { WebComponent, html } from '@webjsdev/core';",
    'export class HelloCard extends WebComponent({ name: String }) {',
    '  render() {',
    '    return html`<p class="greet" @click=${() => {}}>',
    '      Hello <strong>${this.name}</strong>',
    '    </p>`;',
    '  }',
    '}',
    "HelloCard.register('hello-card');",
    '',
  ].join('\n'),
};

const dirs = [];
function makeApp() {
  const appDir = mkdtempSync(join(HERE, '.tmp-app-'));
  dirs.push(appDir);
  for (const [rel, body] of Object.entries(FILES)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

let prevEnv;
before(() => { prevEnv = process.env.WEBJS_SOURCE_LOCATIONS; });
after(() => {
  if (prevEnv === undefined) delete process.env.WEBJS_SOURCE_LOCATIONS;
  else process.env.WEBJS_SOURCE_LOCATIONS = prevEnv;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

async function render(appDir, opts) {
  const app = await createRequestHandler({ appDir, ...opts });
  await app.warmup?.();
  const page = await (await app.handle(new Request('http://x/'))).text();
  const modRes = await app.handle(new Request('http://x/components/hello-card.ts'));
  return { page, mod: await modRes.text(), modStatus: modRes.status };
}

// The importmap <script> already carries an unrelated `data-webjs-src` (the
// app-source id, #899), so match the file:line VALUE shape only.
const LOC = /data-webjs-src="[^"]*:\d+"/;
const strip = (s) => s.replace(/ data-webjs-src="[^"]*:\d+"/g, '');

let annotated;
let plain;

test('SSR output carries data-webjs-src for the layout, the page and the component', async () => {
  const appDir = makeApp();
  process.env.WEBJS_SOURCE_LOCATIONS = '1';
  annotated = await render(appDir, { dev: true });
  delete process.env.WEBJS_SOURCE_LOCATIONS;
  const { page } = annotated;
  assert.match(page, /<div data-webjs-src="app\/layout\.ts:3" class="shell">/, 'layout element, its own line');
  assert.match(page, /<main data-webjs-src="app\/page\.ts:5">/, 'page element on line 5');
  assert.match(page, /<hello-card data-webjs-src="app\/page\.ts:6" name="x"/, 'the custom element tag in the page');
  assert.match(page, /<p data-webjs-src="components\/hello-card\.ts:4" class="greet"/, 'the component render, SSR');
  assert.match(page, /<strong data-webjs-src="components\/hello-card\.ts:5">/, 'a nested element on the next line');
});

test('the served component module carries the same annotation as its SSR render', () => {
  const { mod, modStatus } = annotated;
  assert.equal(modStatus, 200);
  assert.match(mod, /html`<p data-webjs-src="components\/hello-card\.ts:4" class="greet" @click=\$\{/);
  assert.match(mod, /<strong data-webjs-src="components\/hello-card\.ts:5">/);
  assert.match(mod, /render\(\)/, 'the module body is served');
});

test('counterfactual: without the variable nothing is annotated, and the output is otherwise identical', async () => {
  const appDir = makeApp();
  plain = await render(appDir, { dev: true });
  assert.doesNotMatch(plain.page, LOC);
  assert.doesNotMatch(plain.mod, LOC);
  assert.equal(strip(annotated.mod), plain.mod, 'the served module differs only by the attributes');
  assert.equal(strip(annotated.page), plain.page, 'the SSR page differs only by the attributes');
});

test('production never annotates, even with the variable set', async () => {
  const appDir = makeApp();
  process.env.WEBJS_SOURCE_LOCATIONS = '1';
  try {
    const prod = await render(appDir, { dev: false });
    assert.doesNotMatch(prod.page, LOC);
    assert.doesNotMatch(prod.mod, LOC);
  } finally {
    delete process.env.WEBJS_SOURCE_LOCATIONS;
  }
});
