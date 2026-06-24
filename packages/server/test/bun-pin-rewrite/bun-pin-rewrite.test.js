// Unit tests for the runtime-neutral specifier-rewrite core (#685). The Bun
// onLoad supplies Bun.Transpiler.scanImports + resolved versions; here we pass
// the scanned-imports list + a versions map directly, so the transform is
// exercised without Bun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteDepSpecifiers, packageNameOf } from '../../src/bun-pin-rewrite.js';

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

test('rewrites export ... from and bare import', () => {
  const src = "export { a } from 'pg';\nimport 'side-effect-pkg';";
  const out = rewriteDepSpecifiers(src, imp('pg', 'side-effect-pkg'), { pg: '8.13.0', 'side-effect-pkg': '1.2.3' });
  assert.equal(out, "export { a } from 'pg@8.13.0';\nimport 'side-effect-pkg@1.2.3';");
});

test('no matching deps returns the source unchanged (identity)', () => {
  const src = "import { z } from 'zod';";
  assert.equal(rewriteDepSpecifiers(src, imp('zod'), {}), src);
});

test('packageNameOf: scoped, subpath, bare', () => {
  assert.equal(packageNameOf('zod'), 'zod');
  assert.equal(packageNameOf('lodash/fp'), 'lodash');
  assert.equal(packageNameOf('@scope/pkg/sub'), '@scope/pkg');
  assert.equal(packageNameOf('@scope'), null);
});
