/**
 * Drift guard (#310): the set of named exports declared in `index.d.ts` MUST
 * exactly match the named runtime exports of `index.js`. So a future export
 * added to index.js without a matching type (or a type left behind after a
 * runtime export is removed) is caught here, not by an app hitting TS7016.
 *
 * The runtime side is authoritative: we import the module and read its keys.
 * The type side is parsed statically from `index.d.ts`, expanding the
 * `export * from './src/testing.d.ts'` re-export by also parsing that file
 * (the testing helpers ship from both entry points).
 *
 * Type-only re-exports (e.g. `export type { PageProps } from '@webjsdev/core'`)
 * and local helper TYPE aliases (Middleware, ActionResult, CacheStore, …) are
 * NOT runtime exports, so they are excluded from the comparison: the contract
 * is "every runtime export has a declaration", not "the files are identical".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as server from '../../index.js';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '../..');

/**
 * Collect the names a `.d.ts` declares as RUNTIME-VALUE exports:
 *   - `export declare function NAME`
 *   - `export declare const NAME`
 *   - `export declare class NAME`
 * Pure type exports (`export type`, `export interface`) are values-of-types and
 * are intentionally skipped.
 */
function declaredValueExports(dtsPath) {
  const src = readFileSync(dtsPath, 'utf8');
  const names = new Set();
  const re = /export\s+declare\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return names;
}

test('index.d.ts declares every runtime export of index.js (no drift)', () => {
  const runtime = new Set(Object.keys(server).filter((k) => k !== 'default'));

  const declared = declaredValueExports(join(serverDir, 'index.d.ts'));
  // `export * from './src/testing.d.ts'` pulls the testing helpers in.
  for (const n of declaredValueExports(join(serverDir, 'src/testing.d.ts'))) {
    declared.add(n);
  }

  const missing = [...runtime].filter((n) => !declared.has(n)).sort();
  const extra = [...declared].filter((n) => !runtime.has(n)).sort();

  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    `index.d.ts drifted from index.js.\n` +
      (missing.length ? `  Runtime exports with NO declaration: ${missing.join(', ')}\n` : '') +
      (extra.length ? `  Declarations with NO runtime export: ${extra.join(', ')}\n` : ''),
  );
});
