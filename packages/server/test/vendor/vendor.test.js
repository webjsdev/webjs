import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm, symlink, readFile as readFileFs } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractPackageName,
  scanBareImports,
  vendorImportMapEntries,
  getPackageVersion,
  jspmGenerate,
  clearVendorCache,
  pinAll,
  unpinPackage,
  listPinned,
  readPinFile,
  resolveVendorImports,
  serveDownloadedBundle,
} from '../../src/vendor.js';

// --- extractPackageName ---

test('extractPackageName: plain package', () => {
  assert.equal(extractPackageName('dayjs'), 'dayjs');
});

test('extractPackageName: scoped package', () => {
  assert.equal(extractPackageName('@tanstack/query-core'), '@tanstack/query-core');
});

test('extractPackageName: deep path returns root', () => {
  assert.equal(extractPackageName('dayjs/locale/en'), 'dayjs');
});

test('extractPackageName: scoped deep path returns scope/name', () => {
  assert.equal(extractPackageName('@tanstack/query-core/utils'), '@tanstack/query-core');
});

test('extractPackageName: relative import returns null', () => {
  assert.equal(extractPackageName('./foo'), null);
  assert.equal(extractPackageName('../bar'), null);
});

test('extractPackageName: absolute import returns null', () => {
  assert.equal(extractPackageName('/baz'), null);
});

test('extractPackageName: protocol URL returns null', () => {
  assert.equal(extractPackageName('https://cdn.example.com/lib.js'), null);
  assert.equal(extractPackageName('data:text/javascript,1'), null);
});

test('extractPackageName: empty string returns null', () => {
  assert.equal(extractPackageName(''), null);
});

test('extractPackageName: __webjs-prefixed specifier returns null', () => {
  assert.equal(extractPackageName('__webjs/vendor/x'), null);
});

test('extractPackageName: lone @scope with no package name returns null', () => {
  assert.equal(extractPackageName('@scope'), null);
});

// --- scanBareImports ---

test('scanBareImports: finds bare specifiers in source files', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'a.js'), `
    import dayjs from 'dayjs';
    import { something } from '@scope/lib';
    import './local.js';
  `);
  await writeFile(join(dir, 'b.ts'), `
    import { z } from 'zod';
    const d = await import('dynamic-pkg');
  `);
  await writeFile(join(dir, 'c.server.ts'), `
    import pg from 'pg';
  `);

  const found = await scanBareImports(dir);

  assert.ok(found.has('dayjs'));
  assert.ok(found.has('@scope/lib'));
  assert.ok(found.has('zod'));
  assert.ok(found.has('dynamic-pkg'));
  assert.ok(!found.has('pg'), 'server-only imports should be skipped');
  assert.ok(!found.has('./local.js'), 'relative imports should be excluded');
  assert.ok(!found.has('@webjsdev/core'));

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips route.ts and middleware.ts (file-router server-only convention)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-router-skip-${Date.now()}`);
  await mkdir(join(dir, 'app', 'api', 'posts'), { recursive: true });
  await mkdir(join(dir, 'app', 'dashboard'), { recursive: true });

  await writeFile(
    join(dir, 'app', 'api', 'posts', 'route.ts'),
    `import { PrismaClient } from '@prisma/client';
     import 'server-only-helper';`,
  );

  await writeFile(
    join(dir, 'app', 'dashboard', 'middleware.ts'),
    `import { WebSocketServer } from 'ws';
     import 'another-server-thing';`,
  );

  await writeFile(
    join(dir, 'middleware.ts'),
    `import 'root-mw-server-only';`,
  );

  await writeFile(
    join(dir, 'app', 'dashboard', 'page.ts'),
    `import dayjs from 'dayjs';`,
  );

  const found = await scanBareImports(dir);

  assert.ok(found.has('dayjs'), 'page.ts imports should be scanned');
  assert.ok(!found.has('@prisma/client'), 'route.ts imports must be skipped');
  assert.ok(!found.has('server-only-helper'), 'route.ts imports must be skipped');
  assert.ok(!found.has('ws'), 'middleware.ts imports must be skipped');
  assert.ok(!found.has('another-server-thing'), 'middleware.ts imports must be skipped');
  assert.ok(!found.has('root-mw-server-only'), 'root middleware.ts imports must be skipped');

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips test/ and tests/ directories', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-test-skip-${Date.now()}`);
  await mkdir(join(dir, 'test'), { recursive: true });
  await mkdir(join(dir, 'tests'), { recursive: true });

  await writeFile(join(dir, 'test', 'a.test.ts'), `import 'test-only-pkg';`);
  await writeFile(join(dir, 'tests', 'b.test.ts'), `import 'another-test-pkg';`);
  await writeFile(join(dir, 'app.ts'), `import 'real-dep';`);

  const found = await scanBareImports(dir);
  assert.ok(found.has('real-dep'));
  assert.ok(!found.has('test-only-pkg'));
  assert.ok(!found.has('another-test-pkg'));

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips import type statements (TS erases them)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-typeimport-skip-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'a.ts'), `
    import type { WebSocket } from 'ws';
    import type { User } from '@prisma/client';
    import dayjs from 'dayjs';
  `);

  const found = await scanBareImports(dir);
  assert.ok(found.has('dayjs'), 'real value imports remain');
  assert.ok(!found.has('ws'), 'type-only imports must be skipped');
  assert.ok(!found.has('@prisma/client'), 'type-only imports must be skipped');

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips import strings inside comments (JSDoc examples etc.)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-comments-skip-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'a.ts'), `
    /**
     * Example usage:
     *   import { clsx } from 'clsx';
     *   import { twMerge } from 'tailwind-merge';
     */
    // import 'commented-out-pkg';
    import real from 'real-only-pkg';
  `);

  const found = await scanBareImports(dir);
  assert.ok(found.has('real-only-pkg'));
  assert.ok(!found.has('clsx'), 'JSDoc-comment imports must be skipped');
  assert.ok(!found.has('tailwind-merge'), 'JSDoc-comment imports must be skipped');
  assert.ok(!found.has('commented-out-pkg'), 'line-comment imports must be skipped');

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips node_modules and _private dirs', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-skip-${Date.now()}`);
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await mkdir(join(dir, '_private'), { recursive: true });

  await writeFile(join(dir, 'node_modules', 'x.js'), `import 'should-not-find';`);
  await writeFile(join(dir, '_private', 'y.js'), `import 'also-hidden';`);
  await writeFile(join(dir, 'app.js'), `import 'visible';`);

  const found = await scanBareImports(dir);
  assert.ok(found.has('visible'));
  assert.ok(!found.has('should-not-find'));
  assert.ok(!found.has('also-hidden'));

  await rm(dir, { recursive: true, force: true });
});

// --- getPackageVersion ---

test('getPackageVersion: returns installed version for a known package', () => {
  // picocolors is installed in this repo. The exact version varies
  // across npm bumps; assert the shape and non-empty value.
  const v = getPackageVersion('picocolors', process.cwd());
  assert.ok(v, 'expected a version string');
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('getPackageVersion: returns null for unresolvable package', () => {
  const v = getPackageVersion('this-package-truly-does-not-exist-xyz-123', process.cwd());
  assert.equal(v, null);
});

// --- jspmGenerate (network-gated) ---
//
// These tests hit api.jspm.io. Skip via WEBJS_SKIP_NETWORK_TESTS=1 in
// air-gapped CI.

const NETWORK_OK = !process.env.WEBJS_SKIP_NETWORK_TESTS;

test('jspmGenerate: empty install list returns empty map', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const result = await jspmGenerate([]);
  assert.deepEqual(result, {});
});

test('jspmGenerate: resolves a real package to a CDN URL', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const result = await jspmGenerate(['picocolors@1.1.1']);
  const url = result['picocolors'];
  assert.ok(url, 'expected picocolors entry in result');
  assert.match(url, /^https:\/\/ga\.jspm\.io\/npm:picocolors@1\.1\.1/);
});

test('jspmGenerate: second call with same installs hits in-process cache', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const first = await jspmGenerate(['picocolors@1.1.1']);
  // No second network round-trip (cache hit). We can verify by
  // ensuring the response is the same object reference.
  const second = await jspmGenerate(['picocolors@1.1.1']);
  assert.equal(first, second, 'cached call should return same object reference');
});

test('jspmGenerate: install order does not affect cache key', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const a = await jspmGenerate(['picocolors@1.1.1', 'clsx@2.1.1']);
  // Second call with reordered installs should hit the same cache entry.
  const b = await jspmGenerate(['clsx@2.1.1', 'picocolors@1.1.1']);
  assert.equal(a, b, 'cache should be order-independent');
});

// --- vendorImportMapEntries (network-gated) ---

test('vendorImportMapEntries: skips built-ins', async () => {
  clearVendorCache();
  const entries = await vendorImportMapEntries(new Set(['@webjsdev/core']), process.cwd());
  assert.ok(!('@webjsdev/core' in entries), '@webjsdev/core is built-in, not vendored');
});

test('vendorImportMapEntries: skips packages with no installed version', async () => {
  clearVendorCache();
  const entries = await vendorImportMapEntries(
    new Set(['this-package-does-not-exist-xyz-456']),
    process.cwd(),
  );
  assert.equal(entries['this-package-does-not-exist-xyz-456'], undefined);
});

test('vendorImportMapEntries: resolves installed packages to jspm.io URLs', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const entries = await vendorImportMapEntries(new Set(['picocolors']), process.cwd());
  const url = entries['picocolors'];
  assert.ok(url, 'expected picocolors entry');
  assert.match(url, /^https:\/\/ga\.jspm\.io\/npm:picocolors@/);
});

// --- file-based pin (Rails-style committed importmap.json) ---

async function makeTempAppWithSource(sourceFiles) {
  const dir = join(tmpdir(), `webjs-test-pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(dir, { recursive: true });
  // Symlink node_modules from repo root so picocolors etc. resolve via createRequire.
  await symlink(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'));
  await writeFile(join(dir, 'package.json'), '{"name":"tmp","version":"0.0.0"}');
  for (const [path, body] of Object.entries(sourceFiles)) {
    const full = join(dir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  return dir;
}

test('pinAll default: writes importmap.json with jspm.io URLs', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    const { pins, pruned, downloaded } = await pinAll(dir);
    assert.ok(pins.length >= 1, 'should pin picocolors');
    assert.equal(pruned.length, 0, 'no orphans on fresh pin');
    assert.equal(downloaded, 0, 'default mode does not download');
    const file = await readPinFile(dir);
    assert.ok(file, 'pin file should exist');
    assert.match(file.imports['picocolors'], /^https:\/\/ga\.jspm\.io\/npm:picocolors@/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll --download: writes importmap.json with local URLs + bundle files', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    const { pins, downloaded } = await pinAll(dir, { download: true });
    assert.ok(pins.length >= 1);
    assert.ok(downloaded >= 1, 'should download at least one bundle');
    const file = await readPinFile(dir);
    assert.match(file.imports['picocolors'], /^\/__webjs\/vendor\/picocolors@.*\.js$/);
    const bundleFilename = file.imports['picocolors'].slice('/__webjs/vendor/'.length);
    const bytes = await readFileFs(join(dir, '.webjs', 'vendor', bundleFilename), 'utf8');
    assert.ok(bytes.length > 0, 'bundle file must contain bytes');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll: prune removes orphan bundle files from prior pins', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'orphan-package@1.0.0.js'), 'export default {}');
    const { pruned } = await pinAll(dir);
    assert.ok(pruned.includes('orphan-package@1.0.0.js'), `expected orphan in pruned list, got: ${pruned.join(', ')}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll: mode switch from --download to default removes bundles', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    const first = await pinAll(dir, { download: true });
    assert.ok(first.downloaded >= 1);
    const second = await pinAll(dir);
    assert.ok(second.pruned.length >= 1, 'switching to default mode should prune leftover bundle files');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unpinPackage: removes entry from importmap.json', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    await pinAll(dir);
    const r = await unpinPackage(dir, 'picocolors');
    assert.equal(r.removed, true);
    const file = await readPinFile(dir);
    assert.equal(file.imports['picocolors'], undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unpinPackage: returns removed:false for non-existent package', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({ imports: {} }));
    const r = await unpinPackage(dir, 'not-there');
    assert.equal(r.removed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listPinned: parses jspm.io URLs and extracts versions', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'dayjs': 'https://ga.jspm.io/npm:dayjs@1.11.13/dayjs.min.js',
        'clsx': 'https://ga.jspm.io/npm:clsx@2.1.1/dist/clsx.mjs',
      },
    }));
    const entries = await listPinned(dir);
    const dayjs = entries.find(e => e.pkg === 'dayjs');
    assert.ok(dayjs);
    assert.equal(dayjs.version, '1.11.13');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listPinned: returns empty array when no pin file', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    const entries = await listPinned(dir);
    assert.deepEqual(entries, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveVendorImports: prefers committed pin file over live API call', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'fake-pkg': 'https://example.com/fake.js' },
    }));
    const result = await resolveVendorImports(new Set(['unrelated']), dir);
    assert.equal(result['fake-pkg'], 'https://example.com/fake.js');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('serveDownloadedBundle: rejects path-traversal filenames', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    const r1 = await serveDownloadedBundle('../../../etc/passwd.js', dir, false);
    assert.equal(r1.status, 400);
    const r2 = await serveDownloadedBundle('subdir/foo.js', dir, false);
    assert.equal(r2.status, 400);
    const r3 = await serveDownloadedBundle('not-a-js-file.txt', dir, false);
    assert.equal(r3.status, 400);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('serveDownloadedBundle: serves a real file from .webjs/vendor/', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'fake@1.0.0.js'), 'export default 1;');
    const resp = await serveDownloadedBundle('fake@1.0.0.js', dir, false);
    assert.equal(resp.status, 200);
    assert.match(resp.headers.get('content-type') || '', /javascript/);
    const body = await resp.text();
    assert.equal(body, 'export default 1;');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('serveDownloadedBundle: missing file returns 404', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    const resp = await serveDownloadedBundle('not-there@1.0.0.js', dir, false);
    assert.equal(resp.status, 404);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
