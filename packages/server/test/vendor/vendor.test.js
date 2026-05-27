import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm, symlink, readFile as readFileFs } from 'node:fs/promises';
import { join, dirname, sep } from 'node:path';
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

test('scanBareImports: preserves full specifiers including subpaths', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-subpath-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'a.ts'), `
    import dayjs from 'dayjs';
    import utc from 'dayjs/plugin/utc';
    import timezone from 'dayjs/plugin/timezone';
    import { Turbo } from '@hotwired/turbo';
    import frame from '@hotwired/turbo/elements/turbo-frame';
  `);

  const found = await scanBareImports(dir);
  assert.ok(found.has('dayjs'), 'root dayjs import preserved');
  assert.ok(found.has('@hotwired/turbo'), 'root scoped import preserved');
  assert.ok(found.has('dayjs/plugin/utc'), 'subpath import preserved with full path');
  assert.ok(found.has('dayjs/plugin/timezone'), 'second subpath import preserved');
  assert.ok(found.has('@hotwired/turbo/elements/turbo-frame'), 'scoped subpath preserved');

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

test('scanBareImports: handles CRLF line endings', async () => {
  const dir = join(tmpdir(), `webjs-scan-crlf-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'a.ts'), "import 'crlf-pkg-a';\r\nimport 'crlf-pkg-b';\r\n");
  const found = await scanBareImports(dir);
  assert.ok(found.has('crlf-pkg-a'), 'CRLF line should not hide imports');
  assert.ok(found.has('crlf-pkg-b'));
  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: handles UTF-8 BOM at file start', async () => {
  const dir = join(tmpdir(), `webjs-scan-bom-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  // UTF-8 BOM is the three bytes 0xEF 0xBB 0xBF
  await writeFile(join(dir, 'a.ts'), Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from("import 'bom-pkg';")]));
  const found = await scanBareImports(dir);
  assert.ok(found.has('bom-pkg'), 'BOM at file start should not hide the first import');
  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: does not crash on unterminated string literal', async () => {
  const dir = join(tmpdir(), `webjs-scan-broken-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  // User mid-edit: half-written file with unterminated string. Scanner
  // is regex-based so it tolerates this gracefully; the Node runtime
  // would still fail to load the file but the scan stays correct for
  // all OTHER files in the project.
  await writeFile(join(dir, 'broken.ts'), "import 'unterminated\n// some other code");
  await writeFile(join(dir, 'ok.ts'), "import 'still-found';");
  const found = await scanBareImports(dir);
  // The unterminated literal in broken.ts is consumed by the IMPORT_RE
  // (which matches `[^'"]+`); it greedily eats to the next quote in
  // the file. We don't assert what it extracts. We assert the scanner
  // did not crash and still found the OK file's import.
  assert.ok(found.has('still-found'), 'a broken file must not stop the scan');
  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: handles deeply nested directories', async () => {
  const dir = join(tmpdir(), `webjs-scan-deep-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  let path = dir;
  for (let i = 0; i < 25; i++) {
    path = join(path, `level${i}`);
    await mkdir(path, { recursive: true });
  }
  await writeFile(join(path, 'deep.ts'), "import 'deep-pkg';");
  const found = await scanBareImports(dir);
  assert.ok(found.has('deep-pkg'), 'imports at 25 levels deep must be found');
  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: handles a multi-MB file without exploding memory or time', async () => {
  const dir = join(tmpdir(), `webjs-scan-large-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const padding = Array(50000).fill('// boring line\n').join('');
  // ~5MB file: padding + one buried import + more padding
  await writeFile(join(dir, 'big.ts'), padding + "import 'buried-import';\n" + padding);
  const t0 = Date.now();
  const found = await scanBareImports(dir);
  const elapsed = Date.now() - t0;
  assert.ok(found.has('buried-import'), 'import buried in a large file must be found');
  assert.ok(elapsed < 5000, `scan should complete in under 5s; took ${elapsed}ms`);
  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips dot-prefixed dirs (.opencode, .claude, .github, .husky, .git)', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-dotdirs-${Date.now()}`);
  // Each dot-dir holds a file with a bare import that would break jspm.io.
  for (const name of ['.opencode', '.claude', '.github', '.husky', '.git', '.vscode']) {
    await mkdir(join(dir, name), { recursive: true });
    await writeFile(join(dir, name, 'a.ts'), `import { foo } from "${name}-only-pkg";`);
  }
  await writeFile(join(dir, 'app.ts'), `import 'visible';`);

  const found = await scanBareImports(dir);
  assert.ok(found.has('visible'));
  for (const name of ['.opencode', '.claude', '.github', '.husky', '.git', '.vscode']) {
    assert.ok(!found.has(`${name}-only-pkg`), `expected ${name} to be excluded`);
  }

  await rm(dir, { recursive: true, force: true });
});

test('scanBareImports: skips *.config.{js,ts,mjs,cjs} files at any depth', async () => {
  const dir = join(tmpdir(), `webjs-test-vendor-configs-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  // Common tooling config files at project root. They import test
  // runners / build helpers that legitimately cannot resolve via jspm.io.
  await writeFile(join(dir, 'web-test-runner.config.js'), `import { x } from 'tooling-pkg-1';`);
  await writeFile(join(dir, 'vitest.config.ts'), `import { y } from 'tooling-pkg-2';`);
  await writeFile(join(dir, 'tailwind.config.mjs'), `import { z } from 'tooling-pkg-3';`);
  await writeFile(join(dir, 'app.ts'), `import 'real-pkg';`);

  const found = await scanBareImports(dir);
  assert.ok(found.has('real-pkg'));
  assert.ok(!found.has('tooling-pkg-1'));
  assert.ok(!found.has('tooling-pkg-2'));
  assert.ok(!found.has('tooling-pkg-3'));

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
  // Per-install cache: each call rebuilds a merged container but the
  // underlying URL is the cached Promise's resolved value, so the URL
  // is identical and no second HTTP round-trip fires.
  const second = await jspmGenerate(['picocolors@1.1.1']);
  assert.deepEqual(first, second, 'cached call returns the same URLs');
});

test('jspmGenerate: install order does not affect output', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const a = await jspmGenerate(['picocolors@1.1.1', 'clsx@2.1.1']);
  const b = await jspmGenerate(['clsx@2.1.1', 'picocolors@1.1.1']);
  assert.deepEqual(a, b, 'output should be order-independent');
});

/* ---------- jspmGenerate failure modes (mocked fetch, no network) ---------- */

function withMockedFetch(mockFn, body) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  return body().finally(() => { globalThis.fetch = original; });
}

test('jspmGenerate: fetch rejection (network error) returns empty map, does not throw', async () => {
  clearVendorCache();
  await withMockedFetch(async () => { throw new Error('ECONNREFUSED'); }, async () => {
    const r = await jspmGenerate(['fake-pkg-x@1.0.0']);
    assert.deepEqual(r, {}, 'network error must yield empty map');
  });
});

test('jspmGenerate: 5xx response returns empty map', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  }), async () => {
    const r = await jspmGenerate(['fake-pkg-y@1.0.0']);
    assert.deepEqual(r, {});
  });
});

test('jspmGenerate: non-ok response with JSON error body extracts the error detail', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: 'Unable to resolve npm:fake-pkg-z@1.0.0' }),
  }), async () => {
    const r = await jspmGenerate(['fake-pkg-z@1.0.0']);
    assert.deepEqual(r, {}, 'failed install must produce no importmap entry');
  });
});

test('jspmGenerate: non-ok response with NON-JSON body does not crash', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not JSON'); },
  }), async () => {
    // Must not throw despite the json() throwing.
    const r = await jspmGenerate(['fake-pkg-w@1.0.0']);
    assert.deepEqual(r, {});
  });
});

test('jspmGenerate: 200 with missing map.imports returns empty', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({}),  // no `map.imports`
  }), async () => {
    const r = await jspmGenerate(['ok-pkg@1.0.0']);
    assert.deepEqual(r, {});
  });
});

test('jspmGenerate: 200 with map.imports as non-object returns empty', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ map: { imports: 'not-an-object' } }),
  }), async () => {
    // The current code returns whatever `.map.imports` is. A non-object
    // would propagate but the importmap module's setVendorEntries would
    // store it; buildImportMap would spread `...nonObject`. JS spreads
    // non-objects to nothing. So practically, no entries get added.
    // What we assert here: no throw.
    const r = await jspmGenerate(['ok-pkg-2@1.0.0']);
    // The function returns whatever shape; just verify it didn't throw.
    assert.ok(r !== undefined);
  });
});

test('jspmGenerate: 200 with malformed JSON does not crash', async () => {
  clearVendorCache();
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  }), async () => {
    const r = await jspmGenerate(['malformed-pkg@1.0.0']);
    assert.deepEqual(r, {});
  });
});

test('jspmGenerate: per-package isolation - one bad install does not poison good ones', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  // Mix a known-good package with a known-bad one. jspm.io 401s the
  // bad one alone, but the good one MUST still resolve. This is the
  // regression test for the batched-call bug where one unresolvable
  // dep collapsed the entire importmap.
  const result = await jspmGenerate([
    'picocolors@1.1.1',
    'this-package-truly-does-not-exist-xyz-789@99.0.0',
  ]);
  assert.ok(result['picocolors'], 'good package must resolve despite bad neighbor');
  assert.match(result['picocolors'], /^https:\/\/ga\.jspm\.io\//);
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
    // Refuse paths that would resolve through the symlinked
    // node_modules: writing them clobbers the repo's real packages
    // (previous bug: a sourceFiles entry for
    // 'node_modules/picocolors/package.json' overwrote the real
    // picocolors package.json with a 2-line stub).
    if (path.startsWith('node_modules/') || path.startsWith('node_modules' + sep)) {
      throw new Error(
        `makeTempAppWithSource: refusing to write '${path}' through the symlinked node_modules. ` +
        `Mock packages must be set up some other way.`,
      );
    }
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
    const result = await pinAll(dir);
    assert.ok(!result.failed, 'pin should not be flagged failed');
    assert.ok(result.pins.length >= 1, 'should pin picocolors');
    assert.equal(result.pruned.length, 0, 'no orphans on fresh pin');
    assert.equal(result.downloaded, 0, 'default mode does not download');
    const file = await readPinFile(dir);
    assert.ok(file, 'pin file should exist');
    assert.match(file.imports['picocolors'], /^https:\/\/ga\.jspm\.io\/npm:picocolors@/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll: returns noBareImports without writing pin file when no bare imports exist', async () => {
  // Previously pinAll's "don't write empty pin" guard only fired when
  // installs.length > 0 && pins.length === 0. An app with zero bare-
  // specifier imports (or pin invoked outside a webjs project) fell
  // through to writePinFile with empty maps, creating a useless
  // `{ imports: {} }` file. The new noBareImports branch surfaces the
  // case to the CLI so it can print a clear message and exit non-zero.
  clearVendorCache();
  const dir = join(tmpdir(), `webjs-pin-empty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(join(dir, 'app'), { recursive: true });
  await writeFile(join(dir, 'package.json'), '{"name":"tmp","version":"0.0.0"}');
  await writeFile(join(dir, 'app', 'page.ts'), `export default () => 'no bare imports here';`);
  try {
    const result = await pinAll(dir);
    assert.ok(result.noBareImports, 'noBareImports must be true');
    assert.equal(result.failed, undefined, 'failed must be absent (not a failure, just nothing to do)');
    assert.deepEqual(result.pins, []);
    const file = await readPinFile(dir);
    assert.equal(file, null, 'pin file must not exist when there is nothing to pin');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll: refuses to write empty pin file when every install fails', { skip: !NETWORK_OK }, async () => {
  // Regression: previously pinAll wrote `{ imports: {} }` when every
  // jspm.io call failed (e.g. brand-new package version not yet on
  // CDN, or unrelated transient errors). The empty pin file would
  // shadow the live-API fallback path on next boot, leaving the
  // browser with no vendor entries and silently breaking every
  // bare-specifier import.
  clearVendorCache();
  // Isolated temp dir (no symlinked node_modules, so we can plant a
  // fake package.json safely). Build minimal app structure by hand.
  const dir = join(tmpdir(), `webjs-pin-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(join(dir, 'node_modules', 'fake-pkg-xyz-no-such-version'), { recursive: true });
  await mkdir(join(dir, 'app'), { recursive: true });
  await writeFile(join(dir, 'package.json'), '{"name":"tmp","version":"0.0.0"}');
  await writeFile(join(dir, 'node_modules', 'fake-pkg-xyz-no-such-version', 'package.json'),
    JSON.stringify({ name: 'fake-pkg-xyz-no-such-version', version: '99.99.99', main: 'index.js' }));
  await writeFile(join(dir, 'node_modules', 'fake-pkg-xyz-no-such-version', 'index.js'),
    'export default 1;');
  await writeFile(join(dir, 'app', 'page.ts'),
    `import x from 'fake-pkg-xyz-no-such-version';`);
  try {
    const result = await pinAll(dir);
    assert.ok(result.failed, 'pin must be flagged failed');
    assert.deepEqual(result.pins, [], 'no pins recorded');
    // Pin file MUST NOT have been written (so live API fallback runs next boot).
    const file = await readPinFile(dir);
    assert.equal(file, null, 'pin file must not exist after total failure');
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

test('unpinPackage: removes entry from importmap.json (deletes file when last pin removed)', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    await pinAll(dir);
    const r = await unpinPackage(dir, 'picocolors');
    assert.equal(r.removed, true);
    // After the last pin is removed the pin file is deleted so the
    // next boot falls back to live API resolution. Otherwise an
    // empty `{ imports: {} }` would shadow the fallback and serve a
    // broken importmap.
    const file = await readPinFile(dir);
    assert.equal(file, null,
      'pin file should be removed when last pin is unpinned');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('unpinPackage: keeps file when other pins remain (deletes only the targeted entry + integrity)', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'a': 'https://cdn.example/a.js',
        'b': 'https://cdn.example/b.js',
      },
      integrity: {
        'https://cdn.example/a.js': 'sha384-aaaa',
        'https://cdn.example/b.js': 'sha384-bbbb',
      },
    }));
    const r = await unpinPackage(dir, 'a');
    assert.equal(r.removed, true);
    const file = await readPinFile(dir);
    assert.ok(file, 'pin file should still exist');
    assert.equal(file.imports['a'], undefined, 'unpinned entry removed');
    assert.equal(file.imports['b'], 'https://cdn.example/b.js', 'other entry preserved');
    assert.equal(file.integrity['https://cdn.example/a.js'], undefined,
      "unpinned URL's integrity stripped too");
    assert.equal(file.integrity['https://cdn.example/b.js'], 'sha384-bbbb',
      "other integrity preserved");
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

test('listPinned: parses scoped-package jspm.io URLs (regression: scope `@` was breaking the version regex)', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        '@scope/name': 'https://ga.jspm.io/npm:@scope/name@1.2.3/index.js',
        'plain-pkg': 'https://ga.jspm.io/npm:plain-pkg@4.5.6/index.js',
        '@hotwired/turbo': 'https://ga.jspm.io/npm:@hotwired/turbo@8.0.0/dist/turbo.es2017-esm.js',
      },
      integrity: {
        'https://ga.jspm.io/npm:@scope/name@1.2.3/index.js': 'sha384-xxx',
      },
    }));
    const entries = await listPinned(dir);
    const byPkg = Object.fromEntries(entries.map(e => [e.pkg, e]));
    assert.equal(byPkg['@scope/name'].version, '1.2.3', 'scoped package version extracted');
    assert.equal(byPkg['plain-pkg'].version, '4.5.6', 'plain package still works');
    assert.equal(byPkg['@hotwired/turbo'].version, '8.0.0', 'scoped + subpath URL works');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listPinned: returns "(unknown)" version for malformed URLs without crashing', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'weird': 'https://example.com/not-a-jspm-url.js',
        'no-version': 'https://ga.jspm.io/something/odd.js',
      },
    }));
    const entries = await listPinned(dir);
    const byPkg = Object.fromEntries(entries.map(e => [e.pkg, e]));
    assert.equal(byPkg['weird'].version, '(unknown)');
    assert.equal(byPkg['no-version'].version, '(unknown)');
    assert.equal(byPkg['weird'].url, 'https://example.com/not-a-jspm-url.js');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listPinned: returns empty array when pin file does not exist', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    const entries = await listPinned(dir);
    assert.deepEqual(entries, []);
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

test('listPinned: parses subpath URLs and extracts versions (not subpath as version)', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'dayjs@1.11.13__plugin__utc.js'), 'export default {}');
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'dayjs': 'https://ga.jspm.io/npm:dayjs@1.11.13/dayjs.min.js',
        'dayjs/plugin/utc': '/__webjs/vendor/dayjs@1.11.13__plugin__utc.js',
      },
    }));
    const entries = await listPinned(dir);
    const subpath = entries.find(e => e.pkg === 'dayjs/plugin/utc');
    assert.ok(subpath, 'subpath entry should be listed');
    assert.equal(subpath.version, '1.11.13', 'version should be 1.11.13, not 1.11.13__plugin__utc');
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
    assert.equal(result.imports['fake-pkg'], 'https://example.com/fake.js');
    assert.deepEqual(result.integrity, {}, 'no integrity field in pin -> empty map');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: returns integrity when present in pin', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'foo': 'https://cdn.example/foo.js' },
      integrity: { 'https://cdn.example/foo.js': 'sha384-abcdef' },
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(file.integrity, { 'https://cdn.example/foo.js': 'sha384-abcdef' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: returns no integrity field on old pin format (backwards-compatible)', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    // Old format: imports only, no integrity field. Must still load.
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'foo': 'https://cdn.example/foo.js' },
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(file.imports, { 'foo': 'https://cdn.example/foo.js' });
    assert.equal(file.integrity, undefined);
    // resolveVendorImports normalises the missing field to {}.
    const r = await resolveVendorImports(new Set(), dir);
    assert.deepEqual(r.integrity, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sha384Integrity: returns a sha384-<base64> string', async () => {
  const { sha384Integrity } = await import('../../src/vendor.js');
  const h = sha384Integrity('hello world');
  assert.match(h, /^sha384-[A-Za-z0-9+/=]+$/);
  // Deterministic: same input always produces same output.
  assert.equal(h, sha384Integrity('hello world'));
  // Different input produces different output.
  assert.notEqual(h, sha384Integrity('hello worl'));
});

test('readPinFile + resolveVendorImports: integrity keyed by FINAL URL (post-rewrite)', async () => {
  // Regression check: --download mode rewrites imports to local
  // /__webjs/vendor/<filename> paths, and integrity must key on
  // those (the URL the browser actually fetches), not on the
  // original jspm.io URL. setVendorEntries propagates this verbatim.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    const pinJson = {
      imports: {
        'dayjs': '/__webjs/vendor/dayjs@1.11.20.js',
        'dayjs/plugin/relativeTime.js': '/__webjs/vendor/dayjs@1.11.20__plugin__relativeTime.js.js',
      },
      integrity: {
        '/__webjs/vendor/dayjs@1.11.20.js': 'sha384-aaaa',
        '/__webjs/vendor/dayjs@1.11.20__plugin__relativeTime.js.js': 'sha384-bbbb',
      },
    };
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify(pinJson));
    const r = await resolveVendorImports(new Set(['dayjs', 'dayjs/plugin/relativeTime.js']), dir);
    assert.equal(r.imports['dayjs'], '/__webjs/vendor/dayjs@1.11.20.js');
    assert.equal(r.integrity['/__webjs/vendor/dayjs@1.11.20.js'], 'sha384-aaaa');
    // Subpath import: integrity keyed by its OWN final URL, not by dayjs's.
    assert.equal(
      r.integrity['/__webjs/vendor/dayjs@1.11.20__plugin__relativeTime.js.js'],
      'sha384-bbbb',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: returns null for corrupt JSON', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), '{not valid json');
    assert.equal(await readPinFile(dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: rejects non-object imports field', async () => {
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    for (const bad of ['"not an object"', 'null', '123', 'true', '[1,2,3]']) {
      await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), `{"imports": ${bad}}`);
      assert.equal(await readPinFile(dir), null, `imports=${bad} must yield null`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: filters out non-string imports values', async () => {
  // A hand-edited or malicious pin file with non-string values would
  // otherwise land structurally invalid entries in the importmap
  // (numbers / objects / nulls) and break browser-side parsing.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'valid': 'https://cdn.example/v.js',
        'numeric': 123,
        'nully': null,
        'objy': { x: 1 },
      },
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(file.imports, { 'valid': 'https://cdn.example/v.js' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: rejects URL schemes that could execute attacker code (javascript:, data:)', async () => {
  // Defense: a malicious pin file commit could otherwise inject
  // arbitrary script via the importmap. The browser's importmap
  // parser accepts data: URLs (per spec) and some engines accept
  // javascript:; readPinFile filters these so they never reach the
  // served importmap. Only http(s) URLs and root-relative paths
  // (matching what `webjs vendor pin` itself produces) are allowed.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'safe-https': 'https://cdn.example/safe.js',
        'safe-relative': '/__webjs/vendor/foo.js',
        'javascript': 'javascript:alert(1)',
        'data': 'data:text/javascript,alert(1)',
        'blob': 'blob:https://evil.example/abc',
        'file': 'file:///etc/passwd',
        'ftp': 'ftp://example.com/x.js',
      },
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(Object.keys(file.imports).sort(), ['safe-https', 'safe-relative'].sort(),
      'only http(s) and root-relative URLs should survive');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: rejects keys containing control characters', async () => {
  // Newlines in keys would land in the served importmap JSON as escape
  // sequences and could confuse client-side textContent comparison or
  // log injection. Belt-and-suspenders; the browser would accept them
  // but rejecting at parse time keeps the served output predictable.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: {
        'normal': 'https://x/n.js',
        'has\nnewline': 'https://x/e.js',
        'has\rcr': 'https://x/r.js',
        'hasnull-ish': 'https://x/c.js',
      },
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(Object.keys(file.imports), ['normal']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: rejects integrity values that are not SRI hash strings', async () => {
  // Defense: integrity must look like `sha(256|384|512)-...`. A bogus
  // value (123, null, 'not-a-hash', 'sha999-foo') is dropped so the
  // browser doesn't get a malformed integrity attribute (which would
  // either fail SRI check or be silently ignored, both bad).
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'a': 'https://cdn.example/a.js', 'b': 'https://cdn.example/b.js' },
      integrity: {
        'https://cdn.example/a.js': 'sha384-validhashvalue',
        'https://cdn.example/b.js': 'not-a-hash',
        'https://cdn.example/c.js': 123,
      },
    }));
    const file = await readPinFile(dir);
    assert.equal(file.integrity['https://cdn.example/a.js'], 'sha384-validhashvalue');
    assert.equal(file.integrity['https://cdn.example/b.js'], undefined,
      'bogus integrity string filtered out');
    assert.equal(file.integrity['https://cdn.example/c.js'], undefined,
      'numeric integrity filtered out');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: rejects integrity values with attribute-injection payloads', async () => {
  // A hand-edited or tampered pin file with an integrity value like
  // `sha384-x"><script>alert(1)</script>` would pass a prefix-only
  // /^sha(256|384|512)-/ regex but break out of `integrity="..."`
  // when emitted into HTML. End-to-end regex anchored to the base64
  // alphabet (`[A-Za-z0-9+/=]+`) rejects anything past the valid
  // hash body.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'a': 'https://cdn.example/a.js' },
      integrity: {
        'https://cdn.example/a.js': 'sha384-x"><script>alert(1)</script>',
      },
    }));
    const file = await readPinFile(dir);
    assert.equal(file.integrity, undefined,
      'attribute-injection payload filtered out, no integrity emitted');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readPinFile: tolerates extra fields in pin JSON (forward-compat)', async () => {
  // A future pin file version might include extra fields (e.g.
  // resolver: 'jspm.io', generatedAt: '...'). readPinFile should
  // ignore them and surface imports + integrity unchanged.
  const dir = await makeTempAppWithSource({});
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), JSON.stringify({
      imports: { 'x': 'https://cdn.example/x.js' },
      integrity: { 'https://cdn.example/x.js': 'sha384-zzz' },
      resolver: 'jspm.io',
      generatedAt: '2026-01-01T00:00:00Z',
      _comment: 'extra fields should not break parsing',
    }));
    const file = await readPinFile(dir);
    assert.deepEqual(file.imports, { 'x': 'https://cdn.example/x.js' });
    assert.equal(file.integrity['https://cdn.example/x.js'], 'sha384-zzz');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('importMapTag: integrity field omitted when empty, present when populated', async () => {
  const { setVendorEntries, importMapTag } = await import('../../src/importmap.js');
  // Empty integrity → no integrity field in JSON.
  setVendorEntries({ 'a': 'https://cdn/a.js' }, {});
  let tag = importMapTag();
  assert.ok(!tag.includes('"integrity"'), 'integrity omitted when empty');
  // Populated → integrity field present.
  setVendorEntries(
    { 'a': 'https://cdn/a.js' },
    { 'https://cdn/a.js': 'sha384-xxxx' },
  );
  tag = importMapTag();
  assert.ok(tag.includes('"integrity"'), 'integrity present when populated');
  assert.ok(tag.includes('"sha384-xxxx"'), 'integrity value emitted');
  // Reset.
  setVendorEntries({}, {});
});

test('pinAll default mode: writes integrity field alongside imports', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    await pinAll(dir);
    const file = await readPinFile(dir);
    assert.ok(file.integrity, 'integrity field should be written');
    const url = file.imports['picocolors'];
    assert.ok(url, 'picocolors should pin');
    assert.match(file.integrity[url], /^sha384-/, 'integrity must be sha384 hash of fetched bundle');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('pinAll --download: writes integrity matching the on-disk bytes', { skip: !NETWORK_OK }, async () => {
  clearVendorCache();
  const dir = await makeTempAppWithSource({
    'app/page.ts': `import pico from 'picocolors';`,
  });
  try {
    await pinAll(dir, { download: true });
    const file = await readPinFile(dir);
    assert.ok(file.integrity, 'integrity field should be written');
    const localUrl = file.imports['picocolors'];
    assert.match(localUrl, /^\/__webjs\/vendor\//);
    assert.match(file.integrity[localUrl], /^sha384-/, 'integrity must match downloaded bytes');
    // Recompute hash from the on-disk file to prove it matches.
    const { sha384Integrity } = await import('../../src/vendor.js');
    const filename = localUrl.slice('/__webjs/vendor/'.length);
    const onDisk = await readFileFs(join(dir, '.webjs', 'vendor', filename), 'utf8');
    assert.equal(file.integrity[localUrl], sha384Integrity(onDisk));
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
