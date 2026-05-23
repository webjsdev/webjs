import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractPackageName,
  scanBareImports,
  vendorImportMapEntries,
  parseVendorId,
  bundlePackage,
  serveVendorBundle,
  clearVendorCache,
  getPackageVersion,
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
  // Server files should be skipped
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
  // Built-ins should never appear
  assert.ok(!found.has('@webjsdev/core'));

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips route.ts and middleware.ts (file-router server-only convention)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-router-skip-${Date.now()}`);
  await mkdir(join(dir, 'app', 'api', 'posts'), { recursive: true });
  await mkdir(join(dir, 'app', 'dashboard'), { recursive: true });

  // route.ts: server-only by file-router convention.
  await writeFile(
    join(dir, 'app', 'api', 'posts', 'route.ts'),
    `import { PrismaClient } from '@prisma/client';
     import 'server-only-helper';`,
  );

  // middleware.ts (per-segment): server-only.
  await writeFile(
    join(dir, 'app', 'dashboard', 'middleware.ts'),
    `import { WebSocketServer } from 'ws';
     import 'another-server-thing';`,
  );

  // Root-level middleware.ts: same convention.
  await writeFile(
    join(dir, 'middleware.ts'),
    `import 'root-mw-server-only';`,
  );

  // A regular page.ts: bare imports SHOULD enter the scan.
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

// --- vendorImportMapEntries (with version-in-URL) ---

test('vendorImportMapEntries: emits /__webjs/vendor/<pkg>@<version>.js URLs', () => {
  const entries = vendorImportMapEntries(new Set(['picocolors']), process.cwd());
  const url = entries['picocolors'];
  assert.ok(url, 'picocolors should get an entry');
  assert.match(url, /^\/__webjs\/vendor\/picocolors@\d+\.\d+\.\d+\.js$/);
});

test('vendorImportMapEntries: skips built-ins', () => {
  const entries = vendorImportMapEntries(new Set(['@webjsdev/core', 'picocolors']), process.cwd());
  assert.ok(!('@webjsdev/core' in entries));
  assert.ok('picocolors' in entries);
});

test('vendorImportMapEntries: skips packages whose version cannot be resolved', () => {
  const entries = vendorImportMapEntries(
    new Set(['this-package-does-not-exist-xyz-123']),
    process.cwd(),
  );
  assert.ok(!('this-package-does-not-exist-xyz-123' in entries));
});

// --- parseVendorId ---

test('parseVendorId: plain package', () => {
  assert.deepEqual(parseVendorId('dayjs@1.11.13.js'), { pkgName: 'dayjs', version: '1.11.13' });
});

test('parseVendorId: scoped package using `--` separator', () => {
  assert.deepEqual(
    parseVendorId('@hotwired--turbo@8.0.0.js'),
    { pkgName: '@hotwired/turbo', version: '8.0.0' },
  );
});

test('parseVendorId: missing @version returns null', () => {
  assert.equal(parseVendorId('dayjs.js'), null);
});

test('parseVendorId: works without trailing .js', () => {
  assert.deepEqual(parseVendorId('dayjs@1.11.13'), { pkgName: 'dayjs', version: '1.11.13' });
});

// --- extractPackageName: edge cases ---

test('extractPackageName: __webjs-prefixed specifier returns null', () => {
  // The implementation treats specifiers starting with "__" as non-bundleable
  // (framework-internal URLs like /__webjs/...).
  assert.equal(extractPackageName('__webjs/vendor/x'), null);
});

test('extractPackageName: lone @scope with no package name returns null', () => {
  assert.equal(extractPackageName('@scope'), null);
});

// --- bundlePackage + serveVendorBundle ---
//
// These exercise the esbuild path against a tiny, dependency-free package
// that's already installed in node_modules (`picocolors`). A single esbuild
// invocation usually completes in ~50–150ms.

test('bundlePackage: bundles a real package → ESM source', async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());
  const code = await bundlePackage('picocolors', version, process.cwd(), false);
  assert.equal(typeof code, 'string');
  assert.ok(code.length > 0, 'bundle should be non-empty');
  assert.ok(/export\s*(?:default|{)/.test(code), 'expected ESM exports');
});

test('bundlePackage: second call hits the in-memory cache (keyed by pkg@version)', async () => {
  const version = getPackageVersion('picocolors', process.cwd());
  const first = await bundlePackage('picocolors', version, process.cwd(), false);
  const second = await bundlePackage('picocolors', version, process.cwd(), false);
  assert.equal(first, second);
});

test('bundlePackage: unknown package → null', async () => {
  clearVendorCache();
  const code = await bundlePackage('this-pkg-definitely-does-not-exist-xyz', '1.0.0', process.cwd(), false);
  assert.equal(code, null);
});

test('clearVendorCache: subsequent bundlePackage call re-builds', async () => {
  const version = getPackageVersion('picocolors', process.cwd());
  await bundlePackage('picocolors', version, process.cwd(), false);
  clearVendorCache();
  const code = await bundlePackage('picocolors', version, process.cwd(), false);
  assert.equal(typeof code, 'string');
  assert.ok(code.length > 0);
});

test('serveVendorBundle: known package id → 200 JS response with immutable cache headers', async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());
  const resp = await serveVendorBundle(`picocolors@${version}.js`, process.cwd(), false);
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('content-type'), 'application/javascript; charset=utf-8');
  assert.equal(resp.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const body = await resp.text();
  assert.ok(body.length > 0);
});

test('serveVendorBundle: dev=true uses no-cache', async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());
  const resp = await serveVendorBundle(`picocolors@${version}.js`, process.cwd(), true);
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('cache-control'), 'no-cache');
});

test('serveVendorBundle: malformed id (no @version) → 404', async () => {
  const resp = await serveVendorBundle('not-a-valid-id.js', process.cwd(), false);
  assert.equal(resp.status, 404);
  const body = await resp.text();
  assert.ok(body.includes('malformed vendor id'));
});

test('serveVendorBundle: unknown package id → 404', async () => {
  clearVendorCache();
  const resp = await serveVendorBundle('this-pkg-does-not-exist-abc@1.0.0.js', process.cwd(), false);
  assert.equal(resp.status, 404);
  const body = await resp.text();
  assert.ok(body.includes('this-pkg-does-not-exist-abc'));
});

test('serveVendorBundle: version-in-URL means same pkg different versions cache independently', async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());
  // Real version bundles successfully.
  const resp1 = await serveVendorBundle(`picocolors@${version}.js`, process.cwd(), false);
  assert.equal(resp1.status, 200);
  // Fake "old" version doesn't error; esbuild bundles whatever's in
  // node_modules (the actual installed version). Cache key is the
  // requested version, so this populates a separate cache entry.
  const resp2 = await serveVendorBundle('picocolors@0.0.0-fake.js', process.cwd(), false);
  assert.equal(resp2.status, 200);
});
