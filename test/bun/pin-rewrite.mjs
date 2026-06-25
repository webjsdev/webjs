/**
 * Cross-runtime proof of the Bun zero-install version-pin rewrite (#685). webjs
 * runs on Node 24+ OR Bun; the pin rewrite is the Bun zero-install mechanism
 * (Bun honors an inline version in a specifier, so an onLoad transform that
 * rewrites a bare `import 'zod'` to `import 'zod@<pinned>'` makes auto-install
 * fetch the pinned version instead of latest, #684). The runtime-sensitive piece
 * is `Bun.Transpiler.scanImports` (the AST source of truth for which specifiers
 * are real imports), so this asserts the rewrite under whichever runtime runs it:
 *
 *   node test/bun/pin-rewrite.mjs
 *   bun  test/bun/pin-rewrite.mjs
 *
 * Offline by design (it exercises the transform + the resolver, not a registry
 * fetch; the fetch-pins-the-version half is proven end-to-end separately). Run
 * from the repo root.
 */
import assert from 'node:assert/strict';
import { resolveDepVersions, rewriteDepSpecifiers } from '../../packages/server/src/bun-pin-rewrite.js';

// 1. resolveDepVersions: bun.lock exact pin wins; a dep absent from the lock
//    keeps its package.json value (exact OR an inline-safe range); only declared
//    deps are returned; a protocol range is left bare.
const PKG = JSON.stringify({
  dependencies: { zod: '^3.0.0', 'date-fns': '^3.0.0', 'rc-exact': '1.0.0-rc.3', 'rc-range': '^1.0.0-rc.3' },
  devDependencies: { 'drizzle-orm': '0.44.0', local: 'workspace:*' },
});
const LOCK = '{\n  "packages": {\n    "zod": ["zod@3.22.4", "", {}, "sha512-x"],\n    "left-pad": ["left-pad@1.3.0"]\n  }\n}';
const versions = resolveDepVersions(PKG, LOCK);
assert.equal(versions.zod, '3.22.4', 'bun.lock exact version pins zod (lock wins over the range)');
assert.equal(versions['date-fns'], '^3.0.0', 'a caret range with no lock entry forwards as-is (Bun resolves it inline)');
assert.equal(versions['drizzle-orm'], '0.44.0', 'package.json exact value for a dep not in the lock');
assert.equal(versions.local, undefined, 'a workspace: protocol range is left bare (not inline-safe)');
assert.equal(versions['rc-exact'], '1.0.0-rc.3', 'an exact prerelease forwards (Bun resolves it inline)');
assert.equal(versions['rc-range'], undefined, 'a caret-prerelease is left bare (Bun ENOENTs on it, #703)');
assert.equal(versions['left-pad'], undefined, 'a lock-only transitive dep is not pinned');

const SRC = "import { z } from 'zod';\nimport { sql } from 'drizzle-orm';\nimport { addDays } from 'date-fns';\nimport rel from './local.ts';\nconst label = 'zod';\n";

// 2. The runtime-agnostic core, with a hand-built scanImports-shaped list.
const handBuilt = [
  { kind: 'import-statement', path: 'zod' },
  { kind: 'import-statement', path: 'drizzle-orm' },
  { kind: 'import-statement', path: 'date-fns' },
  { kind: 'import-statement', path: './local.ts' },
];
const out = rewriteDepSpecifiers(SRC, handBuilt, versions);
assert.match(out, /from 'zod@3\.22\.4'/, 'zod pinned to the bun.lock version');
assert.match(out, /from 'drizzle-orm@0\.44\.0'/, 'drizzle-orm pinned to the package.json version');
assert.match(out, /from 'date-fns@\^3\.0\.0'/, 'a caret range forwards into the inline specifier');
assert.match(out, /from '\.\/local\.ts'/, 'a relative import is left alone');
assert.match(out, /const label = 'zod';/, 'a non-import string literal is left alone');

// 3. On Bun, the REAL Bun.Transpiler.scanImports drives the same rewrite (the
//    exact production path the onLoad uses). Node has no Bun.Transpiler; the
//    hand-built list above covers the core there.
if (typeof Bun !== 'undefined') {
  const imports = new Bun.Transpiler({ loader: 'ts' }).scanImports(SRC);
  const bunOut = rewriteDepSpecifiers(SRC, imports, versions);
  assert.match(bunOut, /from 'zod@3\.22\.4'/, 'Bun.Transpiler.scanImports + rewrite pins zod');
  assert.match(bunOut, /from 'drizzle-orm@0\.44\.0'/, 'Bun path pins drizzle-orm');
  assert.match(bunOut, /const label = 'zod';/, 'Bun path leaves the non-import string alone');
  console.log('[pin-rewrite] Bun.Transpiler.scanImports path OK');
}
console.log('[pin-rewrite] OK on ' + (typeof Bun !== 'undefined' ? 'bun' : 'node'));
