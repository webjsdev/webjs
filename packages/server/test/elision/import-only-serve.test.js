/**
 * Integration test for import-only route-module elision (#605), through the
 * real `createRequestHandler` render path. A page / layout whose only client
 * relevance is importing shipping components is dropped from the boot script
 * and replaced by its component imports directly, so the browser fetches only
 * the interactive leaves, never the page / layout module.
 *
 * The synthetic app lives in a temp dir with a `node_modules` symlink back to
 * the repo, so the page module's `@webjsdev/core` import resolves during SSR
 * (serve.test.js only requests served source, which never executes the import).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequestHandler } from '../../src/dev.js';

const REPO_NODE_MODULES = join(process.cwd(), 'node_modules');

function makeApp(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-importonly-'));
  symlinkSync(REPO_NODE_MODULES, join(dir, 'node_modules'), 'dir');
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return dir;
}

const COUNTER = `import { WebComponent, html } from '@webjsdev/core';
class C extends WebComponent { render() { return html\`<button @click=\${() => {}}>+</button>\`; } }
C.register('x-counter');`;

const INERT_LAYOUT = `import { html } from '@webjsdev/core';
export default ({ children }) => html\`<main>\${children}</main>\`;`;

const ROUTER_LAYOUT = `import '@webjsdev/core/client-router';
import { html } from '@webjsdev/core';
export default ({ children }) => html\`<main>\${children}</main>\`;`;

function bootOf(html) {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
}

test('an import-only page boots its component directly, not the page or inert layout module (#605)', async () => {
  const dir = makeApp({
    'app/layout.ts': INERT_LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/counter.ts';
export default () => html\`<x-counter></x-counter>\`;`,
    'components/counter.ts': COUNTER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    const boot = bootOf(html);
    assert.match(boot, /\/components\/counter\.ts/, 'the interactive component is emitted');
    assert.doesNotMatch(boot, /\/app\/page\.ts/, 'the import-only page module is dropped');
    assert.doesNotMatch(boot, /\/app\/layout\.ts/, 'the inert layout module is dropped');
    // Progressive enhancement is unaffected: the component is still SSR'd.
    assert.match(html, /<x-counter>/, 'the component still renders server-side');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Strip the parts elision is ALLOWED to change (the boot module script + the
// modulepreload hints) so the rest of the document can be compared byte for byte.
function maskJsSet(html) {
  return html
    .replace(/<script type="module">[\s\S]*?<\/script>/g, '<script type="module"></script>')
    .replace(/<link[^>]+rel=["']modulepreload["'][^>]*>\s*/g, '');
}

test('import-only elision does not change the SSR body (on vs off, #605)', async () => {
  const files = {
    'app/layout.ts': INERT_LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/counter.ts';
export default () => html\`<x-counter>seed</x-counter><p>static copy</p>\`;`,
    'components/counter.ts': COUNTER,
  };
  const onDir = makeApp(files);
  const offDir = makeApp(files);
  const prev = process.env.WEBJS_ELIDE;
  try {
    const onApp = await createRequestHandler({ appDir: onDir, dev: false });
    if (onApp.warmup) await onApp.warmup();
    const onHtml = await (await onApp.handle(new Request('http://x/'))).text();

    process.env.WEBJS_ELIDE = '0';
    const offApp = await createRequestHandler({ appDir: offDir, dev: false });
    if (offApp.warmup) await offApp.warmup();
    const offHtml = await (await offApp.handle(new Request('http://x/'))).text();

    // Sanity: the two really did diverge in the JS set (otherwise the mask is
    // vacuous and the equality below proves nothing).
    assert.notEqual(onHtml, offHtml, 'precondition: on and off differ in the JS set');
    assert.equal(maskJsSet(onHtml), maskJsSet(offHtml), 'the SSR body is identical apart from the boot JS set');
  } finally {
    if (prev === undefined) delete process.env.WEBJS_ELIDE; else process.env.WEBJS_ELIDE = prev;
    rmSync(onDir, { recursive: true, force: true });
    rmSync(offDir, { recursive: true, force: true });
  }
});

test('a layout importing the client router keeps its module in the boot (#605)', async () => {
  const dir = makeApp({
    'app/layout.ts': ROUTER_LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '../components/counter.ts';
export default () => html\`<x-counter></x-counter>\`;`,
    'components/counter.ts': COUNTER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    const boot = bootOf(html);
    assert.match(boot, /\/app\/layout\.ts/, 'the client-router layout module must ship');
    assert.match(boot, /\/components\/counter\.ts/, 'the component still loads');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- #623: route-module false positives no longer pin the boot --------------

test('a page registering a component via a `#` alias is dropped from the boot (#623)', async () => {
  const dir = makeApp({
    'package.json': JSON.stringify({ name: 'fp-app', type: 'module', imports: { '#*': './*' } }),
    'app/layout.ts': INERT_LAYOUT,
    'app/page.ts': `import { html } from '@webjsdev/core';
import '#components/counter.ts';
export default () => html\`<x-counter></x-counter>\`;`,
    'components/counter.ts': COUNTER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    const boot = bootOf(html);
    assert.doesNotMatch(boot, /\/app\/page\.ts/, 'the page module must be dropped (the # import is local, not npm)');
    assert.doesNotMatch(boot, /\/app\/layout\.ts/, 'the inert layout is dropped too');
    assert.match(boot, /\/components\/counter\.ts/, 'only the interactive leaf is emitted');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a layout whose template has an inline <script> using document is dropped from the boot (#623)', async () => {
  const dir = makeApp({
    'package.json': JSON.stringify({ name: 'fp-app2', type: 'module', imports: { '#*': './*' } }),
    'app/layout.ts': `import { html } from '@webjsdev/core';
import '#components/counter.ts';
export default ({ children }) => html\`
  <script>
    (function () {
      var t = localStorage.getItem('theme');
      if (t) document.documentElement.dataset.theme = t;
      document.addEventListener('click', function () {});
    })();
  </script>
  <x-counter></x-counter>
  \${children}
\`;`,
    'app/page.ts': `import { html } from '@webjsdev/core';
export default () => html\`<p>hello</p>\`;`,
    'components/counter.ts': COUNTER,
  });
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const html = await (await app.handle(new Request('http://x/'))).text();
    const boot = bootOf(html);
    assert.doesNotMatch(boot, /\/app\/layout\.ts/, 'inline-script globals in a template must not pin the layout');
    assert.match(boot, /\/components\/counter\.ts/, 'the interactive leaf is emitted');
    // The inline script itself must still be present in the served HTML (it runs from there).
    assert.match(html, /localStorage\.getItem\('theme'\)/, 'the inline bootstrap script is still in the SSR HTML');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
