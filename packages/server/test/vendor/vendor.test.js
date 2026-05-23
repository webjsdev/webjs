import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  extractPackageName,
  extractSubpath,
  scanBareImports,
  vendorImportMapEntries,
  serveVendorBundle,
  pinPackage,
  removeFromCache,
  listCache,
  isWorkspaceDep,
  getPackageVersion,
  clearVendorCache,
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

// --- extractSubpath ---

test('extractSubpath: bare package returns empty', () => {
  assert.equal(extractSubpath('dayjs'), '');
});

test('extractSubpath: package with subpath returns leading-slash subpath', () => {
  assert.equal(extractSubpath('dayjs/locale/en'), '/locale/en');
});

test('extractSubpath: scoped package without subpath returns empty', () => {
  assert.equal(extractSubpath('@scope/pkg'), '');
});

test('extractSubpath: scoped package with subpath returns leading-slash subpath', () => {
  assert.equal(extractSubpath('@scope/pkg/sub/path'), '/sub/path');
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
  assert.ok(!found.has('@webjsdev/core'));

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips route.ts and middleware.ts (server-only by file-router convention)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-router-skip-${Date.now()}`);
  await mkdir(join(dir, 'app', 'api', 'posts'), { recursive: true });
  await mkdir(join(dir, 'app', 'dashboard'), { recursive: true });

  // route.ts: server-only by file-router convention. @prisma/client and
  // node:crypto here should NOT enter the vendor pipeline.
  await writeFile(
    join(dir, 'app', 'api', 'posts', 'route.ts'),
    `import { PrismaClient } from '@prisma/client';
     import { randomUUID } from 'node:crypto';
     import 'server-only-helper';`,
  );

  // middleware.ts: server-only. ws here should NOT enter vendor pipeline.
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

  // A regular page.ts: bare imports SHOULD enter the vendor pipeline.
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

// --- vendorImportMapEntries (new URL shape: includes @version) ---

test('vendorImportMapEntries: emits /__webjs/vendor/<pkg>@<version>.js URLs', () => {
  // The function reads installed versions from the appDir's node_modules.
  // Use the repo root where picocolors is hoisted.
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

test('vendorImportMapEntries: skips packages with no installed version', () => {
  const entries = vendorImportMapEntries(new Set(['this-package-does-not-exist-xyz']), process.cwd());
  assert.ok(!('this-package-does-not-exist-xyz' in entries));
});

// --- workspace detection + version reading ---

test('isWorkspaceDep: monorepo @webjsdev/core resolves inside repo, true', () => {
  // The repo root is a npm workspace root; @webjsdev/core points back at
  // packages/core via the workspace link.
  assert.equal(isWorkspaceDep('@webjsdev/core', process.cwd()), true);
});

test('isWorkspaceDep: real node_modules package resolves outside repo, false', () => {
  assert.equal(isWorkspaceDep('picocolors', process.cwd()), false);
});

test('getPackageVersion: returns version for installed package', () => {
  const v = getPackageVersion('picocolors', process.cwd());
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('getPackageVersion: returns null for missing package', () => {
  assert.equal(getPackageVersion('this-pkg-not-installed-xyz', process.cwd()), null);
});

// --- pinPackage + serveVendorBundle (these hit esm.sh) ---
//
// These exercise the CDN fetch + cache path against a tiny, well-known
// package (picocolors). Each test requires network access to esm.sh.
// Skip via WEBJS_SKIP_NETWORK_TESTS=1 in air-gapped CI environments.

const NETWORK_OK = !process.env.WEBJS_SKIP_NETWORK_TESTS;

test('pinPackage: fetches a real package from esm.sh and writes cache', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());
  // Unpin first so we exercise the fetch path, not the cache path.
  await removeFromCache(process.cwd(), 'picocolors', version);
  const result = await pinPackage(process.cwd(), 'picocolors', version);
  assert.equal(result.ok, true, `pin failed: ${result.error}`);
  assert.ok(result.bytes > 0, 'expected non-empty bundle');
});

test('serveVendorBundle: known package returns 200 JS response with cache headers', { skip: !NETWORK_OK }, async () => {
  const version = getPackageVersion('picocolors', process.cwd());
  const id = `picocolors@${version}`;
  const resp = await serveVendorBundle(id, process.cwd(), false);
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('content-type'), 'application/javascript; charset=utf-8');
  assert.equal(resp.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const body = await resp.text();
  assert.ok(body.length > 0);
});

test('serveVendorBundle: dev=true uses no-cache header', { skip: !NETWORK_OK }, async () => {
  const version = getPackageVersion('picocolors', process.cwd());
  const id = `picocolors@${version}`;
  const resp = await serveVendorBundle(id, process.cwd(), true);
  assert.equal(resp.status, 200);
  assert.equal(resp.headers.get('cache-control'), 'no-cache');
});

test('serveVendorBundle: malformed id returns 404', async () => {
  // No `@version` segment in the id: the parser rejects it before
  // touching the network.
  const resp = await serveVendorBundle('not-a-valid-id', process.cwd(), false);
  assert.equal(resp.status, 404);
  const body = await resp.text();
  assert.ok(body.includes('malformed vendor id'));
});

// Note: a "nonexistent package returns 404" assertion is intentionally
// omitted. The CDN fallback chain (esm.sh then jspm.io) handles unknown
// packages inconsistently: esm.sh returns 404, but jspm.io returns 200
// with a 5-byte redirect stub. Asserting "404 for nonexistent" would
// be testing CDN behavior rather than webjs's logic, and the negative
// path is already covered by the "malformed id" test above which
// rejects before any network call.

// --- cache lifecycle ---

test('listCache + removeFromCache: round-trip', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const version = getPackageVersion('picocolors', process.cwd());

  // Populate
  await pinPackage(process.cwd(), 'picocolors', version);

  // List should include picocolors at the pinned version
  const entries = await listCache(process.cwd());
  const pico = entries.find((e) => e.pkg === 'picocolors' && e.version === version && e.subpath === '');
  assert.ok(pico, `picocolors@${version} should appear in cache listing`);
  assert.ok(pico.bytes > 0);

  // Remove
  await removeFromCache(process.cwd(), 'picocolors', version);
  const afterRemove = await listCache(process.cwd());
  const stillThere = afterRemove.find((e) => e.pkg === 'picocolors' && e.version === version && e.subpath === '');
  assert.equal(stillThere, undefined, 'picocolors should be gone after removeFromCache');
});
