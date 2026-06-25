// Unit tests for the runtime-neutral specifier-rewrite core (#685). The Bun
// onLoad supplies Bun.Transpiler.scanImports + resolved versions; here we pass
// the scanned-imports list + a versions map directly, so the transform is
// exercised without Bun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteDepSpecifiers, packageNameOf, resolveDepVersions } from '../../src/bun-pin-rewrite.js';

const imp = (...paths) => paths.map((path) => ({ kind: 'import-statement', path }));

test('rewrites a bare dep specifier to name@version', () => {
  const src = "import { z } from 'zod';";
  assert.equal(rewriteDepSpecifiers(src, imp('zod'), { zod: '1.0.0' }), "import { z } from 'zod@1.0.0';");
});

test('keeps a subpath: name/sub -> name@version/sub', () => {
  const src = "import fp from 'lodash/fp';";
  assert.equal(rewriteDepSpecifiers(src, imp('lodash/fp'), { lodash: '4.17.21' }), "import fp from 'lodash@4.17.21/fp';");
});

test('handles a scoped package: @scope/name/sub -> @scope/name@version/sub', () => {
  const src = 'import x from "@scope/pkg/sub";';
  assert.equal(rewriteDepSpecifiers(src, imp('@scope/pkg/sub'), { '@scope/pkg': '2.3.4' }), 'import x from "@scope/pkg@2.3.4/sub";');
});

test('rewrites a dynamic import()', () => {
  const src = "const d = await import('drizzle-orm');";
  assert.equal(rewriteDepSpecifiers(src, imp('drizzle-orm'), { 'drizzle-orm': '1.0.0' }), "const d = await import('drizzle-orm@1.0.0');");
});

test('leaves relative, # alias, node:, and undeclared specifiers untouched', () => {
  const src = "import a from './local.ts';\nimport b from '#lib/x.ts';\nimport c from 'node:fs';\nimport d from 'undeclared';";
  // Only deps map entries are eligible; none of these has one.
  assert.equal(rewriteDepSpecifiers(src, imp('./local.ts', '#lib/x.ts', 'node:fs', 'undeclared'), { zod: '1.0.0' }), src);
});

test('leaves an already-versioned specifier untouched', () => {
  const src = "import { z } from 'zod@3.22.4';";
  assert.equal(rewriteDepSpecifiers(src, imp('zod@3.22.4'), { zod: '1.0.0' }), src);
});

test('anchors on the import form: an identical non-import string is NOT rewritten', () => {
  const src = "import { z } from 'zod';\nconst label = 'zod';";
  // scanImports only reports the real import; the plain string must survive.
  const out = rewriteDepSpecifiers(src, imp('zod'), { zod: '1.0.0' });
  assert.equal(out, "import { z } from 'zod@1.0.0';\nconst label = 'zod';");
});

test('does NOT rewrite a method call or keyword-suffixed identifier (left-anchored)', () => {
  // The real import is rewritten, but a `.from('zod')` method call, an
  // `Array.from`-style member, and an `xfrom 'zod'` identifier must be left
  // alone even though `zod` is a declared, scanned import.
  const src = "import { z } from 'zod';\nconst rows = db.select().from('zod');\nconst a = arr.from('zod');\n";
  const out = rewriteDepSpecifiers(src, imp('zod'), { zod: '1.0.0' });
  assert.equal(out, "import { z } from 'zod@1.0.0';\nconst rows = db.select().from('zod');\nconst a = arr.from('zod');\n");
});

test('keeps an inline-safe caret range AND an exact pin, drops protocol ranges', () => {
  const pkg = JSON.stringify({ dependencies: { local: 'workspace:*', tool: 'file:../tool', zod: '^3.0.0', exact: '2.0.0' } });
  // workspace:/file: are not valid inline specifiers -> dropped; the caret
  // range and the exact pin both forward (Bun resolves `zod@^3.0.0` inline).
  assert.deepEqual(resolveDepVersions(pkg), { zod: '^3.0.0', exact: '2.0.0' });
});

test('rewrites export ... from and bare import', () => {
  const src = "export { a } from 'pg';\nimport 'side-effect-pkg';";
  const out = rewriteDepSpecifiers(src, imp('pg', 'side-effect-pkg'), { pg: '8.13.0', 'side-effect-pkg': '1.2.3' });
  assert.equal(out, "export { a } from 'pg@8.13.0';\nimport 'side-effect-pkg@1.2.3';");
});

test('no matching deps returns the source unchanged (identity)', () => {
  const src = "import { z } from 'zod';";
  assert.equal(rewriteDepSpecifiers(src, imp('zod'), {}), src);
});

test('resolveDepVersions: forwards a caret range AND an exact pin (Bun resolves the range inline)', () => {
  const pkg = JSON.stringify({ dependencies: { zod: '^3.22.0' }, devDependencies: { drizzle: '1.0.0' } });
  // zod is a caret range -> inline-safe -> forwarded (Bun picks the highest 3.x).
  // drizzle is an exact pin -> forwarded.
  assert.deepEqual(resolveDepVersions(pkg), { zod: '^3.22.0', drizzle: '1.0.0' });
});

test('resolveDepVersions: keeps exact + single-token ranges, drops wildcard/dist-tag/multi-token', () => {
  const pkg = JSON.stringify({ dependencies: {
    a: '1.2.3', b: '1.2.3-rc.1', c: '1.2.3+build',          // exact: kept
    d: '^1.0.0', e: '~1.2', k: '>=1.2.3', l: '^3',          // single-token range: kept
    f: '1.x', g: '*', h: 'latest', i: '>=1 <2', j: '1 || 2', // not inline-safe: dropped
  } });
  assert.deepEqual(resolveDepVersions(pkg), {
    a: '1.2.3', b: '1.2.3-rc.1', c: '1.2.3+build',
    d: '^1.0.0', e: '~1.2', k: '>=1.2.3', l: '^3',
  });
});

test('resolveDepVersions: bun.lock exact version overrides the package.json range', () => {
  const pkg = JSON.stringify({ dependencies: { zod: '^3.22.0' } });
  const lock = '{\n  "packages": {\n    "zod": ["zod@3.22.4", "", {}, "sha512-abc=="],\n  }\n}';
  assert.deepEqual(resolveDepVersions(pkg, lock), { zod: '3.22.4' });
});

test('resolveDepVersions: only declared deps are pinned (a lock-only transitive is ignored)', () => {
  const pkg = JSON.stringify({ dependencies: { zod: '^3.22.0' } });
  const lock = '{ "packages": { "zod": ["zod@3.22.4"], "left-pad": ["left-pad@1.3.0"] } }';
  assert.deepEqual(resolveDepVersions(pkg, lock), { zod: '3.22.4' }); // left-pad not declared
});

test('resolveDepVersions: malformed package.json yields an empty map (fail-open)', () => {
  assert.deepEqual(resolveDepVersions('{ not json'), {});
});

test('packageNameOf: scoped, subpath, bare', () => {
  assert.equal(packageNameOf('zod'), 'zod');
  assert.equal(packageNameOf('lodash/fp'), 'lodash');
  assert.equal(packageNameOf('@scope/pkg/sub'), '@scope/pkg');
  assert.equal(packageNameOf('@scope'), null);
});
