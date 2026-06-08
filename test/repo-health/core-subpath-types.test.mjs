// Regression guard for issue #389.
//
// Documented @webjsdev/core subpaths such as /directives, /task, and /context
// must carry explicit TypeScript declarations under NodeNext/Bundler module
// resolution. A JS-only export target silently drops editor types.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORE_DIR = join(ROOT, 'packages/core');

function exportTargetHasJs(target) {
  if (typeof target === 'string') return target.endsWith('.js');
  if (!target || typeof target !== 'object') return false;
  return Object.values(target).some(exportTargetHasJs);
}

test('every JS-bearing @webjsdev/core export subpath has a resolvable types condition', () => {
  const pkg = JSON.parse(readFileSync(join(CORE_DIR, 'package.json'), 'utf8'));
  const missing = [];

  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === './package.json' || !exportTargetHasJs(target)) continue;
    const types = typeof target === 'object' && target ? target.types : undefined;
    if (!types || !existsSync(join(CORE_DIR, types))) {
      missing.push(`${subpath} -> ${types || '<missing types>'}`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `JS-bearing @webjsdev/core exports without resolvable types: ${missing.join(', ')}`,
  );
});
