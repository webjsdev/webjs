/**
 * HTTP-layer integration tests for content-hash asset URLs (issue #243,
 * feature 1), exercised through `createRequestHandler` against minimal app
 * fixtures. Web-standard Request/Response, no real HTTP server.
 *
 * The headline behaviours, proven at the strongest layer (served bytes):
 *   - PROD: every SAME-ORIGIN importmap target / modulepreload href / boot
 *     specifier carries `?v=<hash>`; a cross-origin vendor target does NOT.
 *     GET each fingerprinted url -> 200 + immutable; GET it WITHOUT `?v` ->
 *     the 1h fallback.
 *   - DEPLOY-BUSTS: changing a module's bytes changes its emitted `?v`.
 *   - DEV: emits NO `?v` and serves `no-cache`; the dev SSR HTML is
 *     byte-identical to before this feature.
 *   - basePath composes: `<basePath>/app/foo.js?v=hash` serves immutable.
 *
 * Module-state note: the importmap base path AND the asset-hash roots are
 * process-global (set at each handler's boot, like setCoreInstall). node:test
 * runs a file's tests serially, so a handler's requests always see its own
 * boot state.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_SRC = resolve(__dirname, '../../../core/src');
const HTML_URL = pathToFileURL(join(CORE_SRC, 'html.js')).toString();
const COMPONENT_URL = pathToFileURL(join(CORE_SRC, 'component.js')).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-conthash-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp({ basePath } = {}) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const webjs = basePath != null ? { basePath } : undefined;
  const files = {
    'package.json': JSON.stringify({ name: 'fixture', type: 'module', webjs }),
    'app/layout.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default ({ children }) => html\`<main>\${children}</main>\`;\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import './widget.js';\n` +
      `export default () => html\`<x-widget></x-widget>\`;\n`,
    // An interactive component (a @click handler) so it is NOT elided and ships
    // a module the boot path imports + a modulepreload hint.
    'app/widget.js':
      `import { WebComponent } from ${JSON.stringify(COMPONENT_URL)};\n` +
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export class XWidget extends WebComponent {\n` +
      `  render() { return html\`<button @click=\${() => 1}>hi</button>\`; }\n` +
      `}\n` +
      `XWidget.register('x-widget');\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

function importmapTargets(html) {
  const m = html.match(/<script type="importmap"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  return Object.values(JSON.parse(m[1]).imports || {});
}
function modulepreloadHrefs(html) {
  return [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
}
function bootImportSpecifiers(html) {
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  return [...m[1].matchAll(/import\s+"([^"]+)";/g)].map((x) => x[1]);
}

/* ---------------- PROD fingerprinting: emit + resolve + immutable ---------------- */

test('PROD: same-origin emitted urls carry ?v and serve immutable; ?v-less is the 1h fallback', async () => {
  const appDir = makeApp({});
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const res = await app.handle(new Request('http://x/'));
  assert.equal(res.status, 200);
  const html = await res.text();

  const targets = importmapTargets(html);
  const preloads = modulepreloadHrefs(html);
  const boot = bootImportSpecifiers(html);
  assert.ok(targets.length && preloads.length && boot.length, 'urls emitted');

  // Every SAME-ORIGIN module url carries ?v (a bare /__webjs/core/... target).
  // Prefix-only importmap entries (target ends in `/`, a directory mapping) are
  // not a fetchable file and carry no ?v.
  const sameOriginFiles = [...targets, ...preloads, ...boot].filter(
    (u) => u.startsWith('/') && !u.endsWith('/'),
  );
  assert.ok(sameOriginFiles.length, 'there are same-origin file urls');
  for (const u of sameOriginFiles) {
    assert.match(u, /\?v=[0-9a-f]{6,}$/, `same-origin url is fingerprinted: ${u}`);
  }

  // GET each fingerprinted url -> 200 + immutable 1-year cache.
  for (const u of new Set(sameOriginFiles)) {
    const r = await app.handle(new Request('http://x' + u));
    assert.equal(r.status, 200, `fingerprinted url resolves: ${u}`);
    assert.equal(
      r.headers.get('cache-control'),
      'public, max-age=31536000, immutable',
      `fingerprinted url is immutable: ${u}`,
    );
  }

  // The SAME url WITHOUT ?v -> the 1h fallback (still 200, but not immutable).
  for (const u of new Set(sameOriginFiles)) {
    const bare = u.replace(/\?v=[0-9a-f]+$/, '');
    const r = await app.handle(new Request('http://x' + bare));
    assert.equal(r.status, 200, `un-fingerprinted url still resolves: ${bare}`);
    assert.equal(
      r.headers.get('cache-control'),
      'public, max-age=3600',
      `un-fingerprinted url keeps the 1h fallback: ${bare}`,
    );
  }
});

test('PROD: a /public/* asset is fingerprinted + served immutable when ?v is present', async () => {
  const appDir = makeApp({});
  mkdirSync(join(appDir, 'public'), { recursive: true });
  writeFileSync(join(appDir, 'public', 'logo.svg'), '<svg></svg>');
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const withV = await app.handle(new Request('http://x/public/logo.svg?v=abc123'));
  assert.equal(withV.status, 200);
  assert.equal(withV.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const noV = await app.handle(new Request('http://x/public/logo.svg'));
  assert.equal(noV.status, 200);
  assert.equal(noV.headers.get('cache-control'), 'public, max-age=3600');
});

/* ---------------- deploy-busts regression ---------------- */

test('DEPLOY-BUSTS: changing a module byte changes its emitted ?v', async () => {
  const appDir = makeApp({});
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const before = modulepreloadHrefs(await (await app.handle(new Request('http://x/'))).text())
    .find((u) => u.includes('/app/widget.js'));
  assert.ok(before, 'widget.js is a modulepreload href');
  const vBefore = (before.match(/\?v=([0-9a-f]+)/) || [])[1];
  assert.ok(vBefore, 'widget.js carries a ?v');

  // A deploy ships different bytes at the same url; rebuild() re-hashes.
  writeFileSync(
    join(appDir, 'app', 'widget.js'),
    `import { WebComponent } from ${JSON.stringify(COMPONENT_URL)};\n` +
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export class XWidget extends WebComponent {\n` +
    `  render() { return html\`<button @click=\${() => 999}>changed</button>\`; }\n` +
    `}\n` +
    `XWidget.register('x-widget');\n`,
  );
  await app.rebuild();

  const after = modulepreloadHrefs(await (await app.handle(new Request('http://x/'))).text())
    .find((u) => u.includes('/app/widget.js'));
  const vAfter = (after.match(/\?v=([0-9a-f]+)/) || [])[1];
  assert.ok(vAfter, 'widget.js still carries a ?v after the change');
  assert.notEqual(vAfter, vBefore, 'the ?v changed with the bytes (no stale-immutable)');
});

/* ---------------- DEV is unchanged ---------------- */

test('DEV: no ?v is emitted and modules serve no-cache (byte-identical to before)', async () => {
  const appDir = makeApp({});
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup();

  const html = await (await app.handle(new Request('http://x/'))).text();
  const all = [...importmapTargets(html), ...modulepreloadHrefs(html), ...bootImportSpecifiers(html)];
  for (const u of all) {
    assert.ok(!u.includes('?v='), `dev emits no ?v: ${u}`);
  }

  // A dev module serve is no-cache (page.js is a boot specifier; widget.js
  // rides a modulepreload). Pick any same-origin app module url emitted.
  const appModule = [...bootImportSpecifiers(html), ...modulepreloadHrefs(html)]
    .find((u) => u.startsWith('/app/'));
  assert.ok(appModule, 'an app module url is emitted');
  const r = await app.handle(new Request('http://x' + appModule));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-cache');
});

test('DEV vs PROD HTML differs ONLY by the ?v query (dev is the un-fingerprinted form)', async () => {
  // Two apps, identical source. The dev body, with any ?v stripped, must equal
  // the prod body with any ?v stripped (modulo the per-deploy build-id /
  // tmpdir-name noise the base-path test also normalizes). This proves
  // fingerprinting is purely additive and the inert (dev) path is unchanged.
  const devApp = makeApp({});
  const devH = await createRequestHandler({ appDir: devApp, dev: true });
  await devH.warmup();
  const devHtml = await (await devH.handle(new Request('http://x/'))).text();

  const prodApp = makeApp({});
  const prodH = await createRequestHandler({ appDir: prodApp, dev: false });
  await prodH.warmup();
  const prodHtml = await (await prodH.handle(new Request('http://x/'))).text();

  const norm = (s) => s
    .replace(/\?v=[0-9a-f]+/g, '')                 // strip fingerprints
    .replace(/app-[^/"]+/g, 'APP')                 // tmpdir app-dir name
    .replace(/data-webjs-build="[^"]*"/g, 'BUILD') // per-deploy build id
    .replace(/"NODE_ENV":"(development|production)"/g, '"NODE_ENV":"ENV"') // dev vs prod env shim
    .replace(/<script type="module"[^>]*src="[^"]*reload[^"]*"[^>]*><\/script>/g, ''); // dev-only reload script

  assert.equal(norm(devHtml), norm(prodHtml), 'dev and prod bodies match once the ?v is stripped');
});

/* ---------------- basePath composes ---------------- */

test('basePath composes: <basePath>/app/widget.js?v=hash serves immutable', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const html = await (await app.handle(new Request('http://x/app/'))).text();
  const sameOrigin = [...importmapTargets(html), ...modulepreloadHrefs(html), ...bootImportSpecifiers(html)]
    .filter((u) => u.startsWith('/') && !u.endsWith('/'));
  assert.ok(sameOrigin.length);
  for (const u of sameOrigin) {
    assert.ok(u.startsWith('/app/'), `prefixed with basePath: ${u}`);
    assert.match(u, /\?v=[0-9a-f]{6,}$/, `AND fingerprinted: ${u}`);
    const r = await app.handle(new Request('http://x' + u));
    assert.equal(r.status, 200, `prefixed+fingerprinted url resolves: ${u}`);
    assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  }
});
