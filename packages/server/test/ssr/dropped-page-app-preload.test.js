/**
 * App-module modulepreload over-fetch (#780): the app-module analog of the #754
 * vendor over-fetch. `deduplicatedPreloads` must walk from the boot's SHIPPED
 * module set (`moduleUrls`, which already drops an inert page/layout and
 * substitutes an import-only page with its components), NOT the raw route entries
 * `[route.file, ...route.layouts]`. Rooting at the raw entries walks a dropped
 * page's SSR-only subtree and emits a `<link rel="modulepreload">` for an APP
 * MODULE nothing that ships imports (a wasted speculative fetch + a misleading
 * network tab). The #754 vendor fix only closed this for the reached VENDOR; the
 * dropped page's SSR-only relative-helper APP MODULE was still over-hinted.
 * Rooting at the shipped set closes that gap while still hinting every module
 * that genuinely ships (no under-fetch), matching the vendor walk.
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
const DAYJS_URL = 'https://ga.jspm.io/npm:dayjs@1.11.21/dayjs.min.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-app-preload-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

/** A local stub so a bare `import dayjs from 'dayjs'` resolves for SSR. */
function writeVendorStub(appDir, name) {
  const pkgDir = join(appDir, 'node_modules', name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.js' }));
  writeFileSync(join(pkgDir, 'index.js'), `export default function stub() { return {}; }\n`);
}

/** Build an app on disk from a `{ relpath: contents }` map, pinning dayjs. */
function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const all = {
    'package.json': JSON.stringify({ name: 'fixture', type: 'module' }),
    'app/layout.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default ({ children }) => html\`<main>\${children}</main>\`;\n`,
    ...files,
  };
  for (const [rel, body] of Object.entries(all)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  writeVendorStub(appDir, 'dayjs');
  const vdir = join(appDir, '.webjs', 'vendor');
  mkdirSync(vdir, { recursive: true });
  writeFileSync(join(vdir, 'importmap.json'),
    JSON.stringify({ imports: { dayjs: DAYJS_URL }, integrity: { [DAYJS_URL]: 'sha384-TEST' } }));
  return appDir;
}

function preloadHrefs(html) {
  return [...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
}

test('a dropped page does not preload its SSR-only relative-helper app module (#780)', async () => {
  // `/` is an inert page whose module is dropped from the boot: it imports a
  // relative helper `./fmt.js` used ONLY to build the SSR string. `fmt.js` is a
  // real app module (it happens to pull a bare vendor, the same arrangement the
  // committed #754 round-2 test uses to get the page dropped). Under the raw-entry
  // walk, `/` collected `fmt.js` from the dropped page and over-hinted it; the
  // #754 fix only stopped the reached VENDOR from being preloaded, not the app
  // module `fmt.js` itself. Rooting at the shipped set closes that.
  const appDir = makeApp({
    'app/fmt.js': `import dayjs from 'dayjs';\nexport const fmt = () => typeof dayjs;\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { fmt } from './fmt.js';\n` +
      `export default () => html\`<main>built (\${fmt()})</main>\`;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();
  const hrefs = preloadHrefs(html);

  // Precondition: the inert page module is dropped from the boot (so this
  // exercises the dropped-subtree gap, not a shipped page).
  assert.ok(!hrefs.some((h) => h.includes('/app/page.js')),
    'the inert page module is dropped from the boot');
  // Precondition: fmt.js is a real, servable app module (the old over-fetch was
  // reachable, not a phantom); the walk just must not ROOT at the dropped page.
  assert.equal((await app.handle(new Request('http://x/app/fmt.js'))).status, 200,
    'fmt.js is a servable app module');
  // The fix: the dropped page's SSR-only relative-helper APP MODULE is not hinted.
  assert.ok(!hrefs.some((h) => h.includes('/app/fmt.js')),
    "the dropped page's SSR-only relative helper is NOT preloaded (no over-fetch)");
});

test('a SHIPPED page still preloads its transitive relative-helper app modules (#780 under-fetch guard)', async () => {
  // The under-fetch guard for the roots change: this is what would break if the
  // moduleUrls -> absolute-path round-trip failed to match the graph's node keys
  // and the walk from `shippedRoots` silently dropped a genuinely-shipped dep.
  // A page that imports a pure relative helper `./fmt.js` (used as a value) SHIPS,
  // so `page.js` is a boot module. `fmt.js` and its own helper `./deep.js` are
  // NOT boot modules; their preloads come ONLY from `deduplicatedPreloads` walking
  // the transitive closure from `shippedRoots` (the boot-module preload loop
  // covers `page.js`, not its deps, and `deduplicatedPreloads` excludes
  // `moduleUrls` via `seen`). So asserting the helper chain IS preloaded actually
  // exercises the changed walk (a component here would not: an import-only page's
  // component is preloaded by the separate boot-module loop regardless).
  const appDir = makeApp({
    'app/deep.js': `export const deep = (x) => x + 1;\n`,
    'app/fmt.js': `import { deep } from './deep.js';\nexport const fmt = (x) => deep(x);\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import { fmt } from './fmt.js';\n` +
      `export default () => html\`<p>\${fmt(1)}</p>\`;\n`,
  });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();
  const html = await (await app.handle(new Request('http://x/'))).text();
  const hrefs = preloadHrefs(html);

  // Precondition: the page SHIPS (so its helper chain is a walk from a real root).
  assert.ok(hrefs.some((h) => h.includes('/app/page.js')), 'the page ships (boot module)');
  // The guard: the walk from shippedRoots reaches the shipped page's direct AND
  // transitive relative helpers, so both keep their hint (no under-fetch).
  assert.ok(hrefs.some((h) => h.includes('/app/fmt.js')),
    'the shipped page\'s direct relative helper IS preloaded');
  assert.ok(hrefs.some((h) => h.includes('/app/deep.js')),
    'the shipped page\'s TRANSITIVE relative helper IS preloaded');
});
