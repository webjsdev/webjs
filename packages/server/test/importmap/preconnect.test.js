/**
 * Tests for preconnect / dnsPrefetch metadata + auto vendor preconnect
 * (issue #243, feature 2).
 *
 *  - `vendorPreconnectOrigins` (unit): derives the cross-origin vendor CDN
 *    origins from the resolved vendor map, most-common first, bounded; returns
 *    [] for a same-origin / empty map.
 *  - `metadata.preconnect` / `metadata.dnsPrefetch` render the link rels
 *    (escaped, crossorigin where set), proven at the HTTP layer through
 *    `createRequestHandler`.
 *  - the auto vendor preconnect: an unpinned cross-origin app emits one
 *    `<link rel=preconnect href=<vendor origin> crossorigin>`, deduped against
 *    an author-declared one; a same-origin (no cross-origin vendor) app emits
 *    NONE.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import {
  setVendorEntries,
  setCoreInstall,
  vendorPreconnectOrigins,
} from '../../src/importmap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_SRC = resolve(__dirname, '../../../core/src');
const CORE_DIR = resolve(__dirname, '../../../core');
const HTML_URL = pathToFileURL(join(CORE_SRC, 'html.js')).toString();
const COMPONENT_URL = pathToFileURL(join(CORE_SRC, 'component.js')).toString();

/* ---------------- vendorPreconnectOrigins (unit) ---------------- */

test('vendorPreconnectOrigins derives cross-origin origins, most common first', async () => {
  await setVendorEntries({
    lit: 'https://ga.jspm.io/npm:lit@3.1.0/index.js',
    'lit/directives': 'https://ga.jspm.io/npm:lit@3.1.0/directives.js',
    dayjs: 'https://cdn.jsdelivr.net/npm/dayjs@1/index.js',
  });
  const origins = vendorPreconnectOrigins();
  assert.deepEqual(origins, ['https://ga.jspm.io', 'https://cdn.jsdelivr.net'],
    'jspm (2 entries) ranks before jsdelivr (1)');
  await setVendorEntries({}); // reset shared module state
});

test('vendorPreconnectOrigins returns [] for a same-origin (pinned --download) map', async () => {
  await setVendorEntries({
    lit: '/__webjs/vendor/lit@3.1.0.js',
  });
  assert.deepEqual(vendorPreconnectOrigins(), [], 'a same-origin /__webjs/vendor target has no cross-origin to warm');
  await setVendorEntries({});
});

test('vendorPreconnectOrigins returns [] for an empty vendor map', async () => {
  await setVendorEntries({});
  assert.deepEqual(vendorPreconnectOrigins(), []);
});

test('vendorPreconnectOrigins bounds the number of origins', async () => {
  await setVendorEntries({
    a: 'https://a.example/x.js',
    b: 'https://b.example/x.js',
    c: 'https://c.example/x.js',
  });
  assert.equal(vendorPreconnectOrigins(2).length, 2, 'capped at the requested max');
  await setVendorEntries({});
  // The core install was clobbered for this file's tests; restore it so the
  // bare specifier targets the right entry for any later cross-file run.
  await setCoreInstall(CORE_DIR, true);
});

/* ---------------- metadata.preconnect / dnsPrefetch (HTTP) ---------------- */

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-preconnect-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp({ pageMeta = '', pin = null } = {}) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const files = {
    'package.json': JSON.stringify({ name: 'fixture', type: 'module' }),
    'app/layout.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default ({ children }) => html\`<main>\${children}</main>\`;\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `${pageMeta}\n` +
      `export default () => html\`<p>hi</p>\`;\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  if (pin) {
    const dir = join(appDir, '.webjs', 'vendor');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'importmap.json'), JSON.stringify(pin));
  }
  return appDir;
}

/**
 * Write an INTERACTIVE component (a `@click` handler, so the elision analyser
 * keeps it) that imports the bare `dayjs` specifier, so the committed pin's
 * cross-origin dayjs entry stays reachable in the pruned vendor map and the
 * auto vendor preconnect fires.
 */
function writeVendorWidget(appDir) {
  writeFileSync(
    join(appDir, 'app', 'widget.js'),
    `import { WebComponent } from ${JSON.stringify(COMPONENT_URL)};\n` +
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `import dayjs from 'dayjs';\n` +
    `export class XWidget extends WebComponent {\n` +
    `  render() { return html\`<button @click=\${() => dayjs()}>hi</button>\`; }\n` +
    `}\n` +
    `XWidget.register('x-widget');\n`,
  );
}

function preconnectLinks(html) {
  return [...html.matchAll(/<link rel="preconnect"[^>]*>/g)].map((m) => m[0]);
}
function dnsPrefetchLinks(html) {
  return [...html.matchAll(/<link rel="dns-prefetch"[^>]*>/g)].map((m) => m[0]);
}

test('metadata.preconnect / dnsPrefetch render the link rels (escaped, crossorigin where set)', async () => {
  const appDir = makeApp({
    pageMeta:
      `export const metadata = {\n` +
      `  preconnect: ['https://api.example.com', { url: 'https://fonts.gstatic.com', crossorigin: true }],\n` +
      `  dnsPrefetch: 'https://analytics.example.com',\n` +
      `};`,
  });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();

  const pc = preconnectLinks(html);
  assert.ok(
    pc.some((l) => l.includes('href="https://api.example.com"') && !l.includes('crossorigin')),
    'plain preconnect without crossorigin',
  );
  assert.ok(
    pc.some((l) => l.includes('href="https://fonts.gstatic.com"') && /crossorigin(>|\s)/.test(l)),
    'preconnect with crossorigin',
  );
  assert.ok(
    dnsPrefetchLinks(html).some((l) => l.includes('href="https://analytics.example.com"')),
    'dns-prefetch link rendered (never carries crossorigin)',
  );
});

test('metadata.preconnect href is HTML-escaped', async () => {
  const appDir = makeApp({
    pageMeta: `export const metadata = { preconnect: 'https://x.example/?a=1&b=2' };`,
  });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();
  assert.ok(html.includes('href="https://x.example/?a=1&amp;b=2"'), 'the & is escaped');
});

test('auto vendor preconnect: an unpinned cross-origin app emits ONE preconnect to the CDN origin', async () => {
  // A committed pin with a cross-origin target is the deterministic stand-in
  // for "unpinned app that resolved vendors live from a cross-origin CDN":
  // both put a https:// target in the served vendor map, which is what drives
  // the auto preconnect. The page imports the bare specifier so elision keeps
  // it in the served map.
  const appDir = makeApp({
    pin: { imports: { dayjs: 'https://ga.jspm.io/npm:dayjs@1.11.21/dayjs.min.js' } },
  });
  // An INTERACTIVE component (@click) that imports the bare dep, so it is not
  // elided and dayjs stays reachable in the pruned vendor map. The page renders
  // its tag.
  writeVendorWidget(appDir);
  writeFileSync(
    join(appDir, 'app', 'page.js'),
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `import './widget.js';\n` +
    `export default () => html\`<x-widget></x-widget>\`;\n`,
  );
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();

  const pc = preconnectLinks(html);
  const auto = pc.filter((l) => l.includes('href="https://ga.jspm.io"'));
  assert.equal(auto.length, 1, 'exactly one auto preconnect to the vendor CDN origin');
  assert.match(auto[0], /crossorigin(>|\s)/, 'the auto vendor preconnect carries crossorigin');
});

test('auto vendor preconnect is deduped against an author-declared preconnect to the same origin', async () => {
  const appDir = makeApp({
    pin: { imports: { dayjs: 'https://ga.jspm.io/npm:dayjs@1.11.21/dayjs.min.js' } },
  });
  writeVendorWidget(appDir);
  writeFileSync(
    join(appDir, 'app', 'page.js'),
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `import './widget.js';\n` +
    `export const metadata = { preconnect: { url: 'https://ga.jspm.io', crossorigin: true } };\n` +
    `export default () => html\`<x-widget></x-widget>\`;\n`,
  );
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();

  const toOrigin = preconnectLinks(html).filter((l) => l.includes('href="https://ga.jspm.io"'));
  assert.equal(toOrigin.length, 1, 'no duplicate: the author one wins, the auto one is suppressed');
});

test('a same-origin app (no cross-origin vendor) emits NO auto vendor preconnect', async () => {
  const appDir = makeApp({}); // no vendor imports at all
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();
  assert.equal(preconnectLinks(html).length, 0, 'no preconnect links at all');
});
