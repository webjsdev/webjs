/**
 * The served importmap is memoized per build epoch (#1644). Before, every page
 * render rebuilt it two or three times, each pass running `withAssetHash` over
 * every target, and the trailing-slash DIRECTORY targets (the core `src/`
 * catch-all, every `#<dir>/` alias scope) hit the filesystem on every pass
 * because a read failure was never memoized.
 *
 * These are the counterfactuals: with the memo removed, the second
 * `buildImportMap()` reads the filesystem again and the identity assertions
 * fail; with the EISDIR memo removed, the directory target reads twice.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildImportMap,
  importMapTag,
  setCoreInstall,
  setVendorEntries,
  setImportAliasEntries,
  setBasePath,
  vendorPreconnectOrigins,
  publishBuildId,
} from '../../src/importmap.js';
import { setAssetRoots, clearAssetHashCache, setElisionFingerprint } from '../../src/asset-hash.js';

let root;
let appDir;
let coreDir;

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'webjs-importmap-memo-'));
  appDir = join(root, 'app-root');
  coreDir = join(root, 'core-root');
  mkdirSync(join(appDir, 'lib'), { recursive: true });
  mkdirSync(join(coreDir, 'src'), { recursive: true });
  // A minimal core package: one real file target, plus the `src/` catch-all
  // that resolves to a DIRECTORY (the shape that threw EISDIR per request).
  writeFileSync(join(coreDir, 'package.json'), JSON.stringify({
    name: '@webjsdev/core',
    version: '0.0.0-test',
    exports: {
      '.': { browser: './index-browser.js', source: './index-browser.js', default: './index-browser.js' },
      './*': { source: './src/*.js', default: './src/*.js' },
    },
  }));
  writeFileSync(join(coreDir, 'index-browser.js'), 'export const a = 1;\n');
  writeFileSync(join(appDir, 'lib', 'x.js'), 'export const x = 1;\n');
  await setCoreInstall(coreDir, false);
  await setVendorEntries({});
  // Alias scope -> a directory target too.
  await setImportAliasEntries({ '#lib/': '/lib/' });
  setAssetRoots({ appDir, coreDir, enabled: true });
  clearAssetHashCache();
});

after(async () => {
  setAssetRoots({ appDir: '', coreDir: '', enabled: false });
  setElisionFingerprint('');
  clearAssetHashCache();
  await setImportAliasEntries({});
  await setVendorEntries({});
  await setBasePath('');
  rmSync(root, { recursive: true, force: true });
});

/**
 * Count `readFileSync` calls across `fn`. Patching the `fs` namespace object
 * and calling `syncBuiltinESMExports()` is what makes the named-import binding
 * `asset-hash.js` holds see the wrapper.
 */
function countReads(fn) {
  const real = fs.readFileSync;
  let n = 0;
  fs.readFileSync = function (...args) { n++; return real.apply(this, args); };
  syncBuiltinESMExports();
  try { fn(); } finally { fs.readFileSync = real; syncBuiltinESMExports(); }
  return n;
}

test('buildImportMap: the second call in a build reads nothing and returns the same object', () => {
  clearAssetHashCache();
  const firstReads = countReads(() => buildImportMap());
  assert.ok(firstReads >= 1, 'the first build hashes at least one file target');
  const first = buildImportMap();
  const secondReads = countReads(() => buildImportMap());
  assert.equal(secondReads, 0, 'the memoized map runs no withAssetHash pass, so no filesystem reads');
  assert.equal(buildImportMap(), first, 'same object identity within a build');
  // The directory-shaped targets are present and carry no `?v` (a directory
  // has no content hash), exactly as before the memo.
  assert.equal(first.imports['@webjsdev/core/'], '/__webjs/core/src/');
  assert.equal(first.imports['#lib/'], '/lib/');
  // The file target does carry one.
  assert.match(first.imports['@webjsdev/core'], /\?v=[0-9a-f]{12}$/);
});

test('buildImportMap: a directory target is read once per build, not once per call', () => {
  clearAssetHashCache();
  // Warm the map once, then clear only the hash cache (a new build) so the next
  // build re-hashes every target, and count that one against a third build in
  // the same epoch.
  buildImportMap();
  clearAssetHashCache();
  const rehash = countReads(() => buildImportMap());
  // Both the file AND the directory targets are read on the rehash...
  assert.ok(rehash >= 2, `rehash reads file + directory targets (got ${rehash})`);
  // ...and a build that follows another CLEAR reads them again (the clear is a
  // new build), whereas a build with no clear reads nothing. The EISDIR memo
  // is what keeps the directory count at one per build rather than one per
  // withAssetHash call: the map builds the alias scope AND the core catch-all,
  // and `vendorPreloadTargets` / `importMapTag` used to rebuild the whole map.
  assert.equal(countReads(() => buildImportMap()), 0);
});

test('buildImportMap: every setter invalidates the memo', async () => {
  const a = buildImportMap();
  await setVendorEntries({ dayjs: 'https://ga.jspm.io/npm:dayjs@1.11.0/dayjs.min.js' });
  const b = buildImportMap();
  assert.notEqual(b, a, 'setVendorEntries invalidates');
  assert.equal(b.imports.dayjs, 'https://ga.jspm.io/npm:dayjs@1.11.0/dayjs.min.js');
  await setBasePath('/m');
  const c = buildImportMap();
  assert.notEqual(c, b, 'setBasePath invalidates');
  assert.equal(c.imports['#lib/'], '/m/lib/');
  await setBasePath('');
  await setImportAliasEntries({ '#lib/': '/lib/', '#components/': '/components/' });
  const d = buildImportMap();
  assert.notEqual(d, c, 'setImportAliasEntries invalidates');
  assert.equal(d.imports['#components/'], '/components/');
  await setImportAliasEntries({ '#lib/': '/lib/' });
  await setVendorEntries({});
});

test('buildImportMap: a byte change plus clearAssetHashCache moves the ?v in the memoized map', () => {
  const before = buildImportMap().imports['@webjsdev/core'];
  writeFileSync(join(coreDir, 'index-browser.js'), 'export const a = 2;\n');
  assert.equal(buildImportMap().imports['@webjsdev/core'], before, 'no clear, memo still serves the old hash (a deploy restarts)');
  clearAssetHashCache();
  const after = buildImportMap().imports['@webjsdev/core'];
  assert.notEqual(after, before, 'the clear is a new build: the map re-hashes');
  assert.match(after, /\?v=[0-9a-f]{12}$/);
});

test('buildImportMap: the elision fingerprint invalidates on change only', () => {
  const a = buildImportMap();
  setElisionFingerprint('fp-1');
  const b = buildImportMap();
  assert.notEqual(b, a, 'a changed fingerprint is a new build');
  setElisionFingerprint('fp-1');
  assert.equal(buildImportMap(), b, 'the same fingerprint again keeps the memo');
  setElisionFingerprint('');
});

test('importMapTag: the JSON body is memoized while the nonce and build id stay per call', async () => {
  await setVendorEntries({});
  publishBuildId();
  const a = importMapTag({ nonce: 'n1' });
  const b = importMapTag({ nonce: 'n2' });
  const body = (t) => t.slice(t.indexOf('>') + 1);
  assert.equal(body(a), body(b), 'same JSON body within a build');
  assert.match(a, /nonce="n1"/);
  assert.match(b, /nonce="n2"/);
  assert.equal(countReads(() => importMapTag()), 0, 'the tag never rebuilds the map within a build');
});

test('vendorPreconnectOrigins: same array within a build, a new one after setVendorEntries', async () => {
  await setVendorEntries({ a: 'https://ga.jspm.io/npm:a@1/a.js', b: 'https://ga.jspm.io/npm:b@1/b.js' });
  const x = vendorPreconnectOrigins();
  assert.deepEqual(x, ['https://ga.jspm.io']);
  assert.equal(vendorPreconnectOrigins(), x, 'memoized identity');
  assert.notEqual(vendorPreconnectOrigins(1), x, 'a different cap is a different memo entry');
  await setVendorEntries({ a: 'https://cdn.jsdelivr.net/npm/a@1/a.js' });
  const y = vendorPreconnectOrigins();
  assert.notEqual(y, x);
  assert.deepEqual(y, ['https://cdn.jsdelivr.net']);
  await setVendorEntries({});
});
