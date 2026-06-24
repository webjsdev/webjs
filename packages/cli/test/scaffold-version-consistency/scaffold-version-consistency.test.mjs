/**
 * #692: a Node scaffold and a Bun scaffold must resolve IDENTICAL dependency
 * versions, and the runtime-critical deps must be EXACT-pinned (a `^` range
 * diverges across runtimes: npm takes latest-in-range, bun zero-install takes
 * absolute latest, #690). Scaffolds both runtimes (no install) and compares.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldApp } from '../../lib/create.js';

const isExact = (v) => typeof v === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v);

test('npm and bun scaffolds resolve identical dependency versions, exact-pinned (#692)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-vc-'));
  try {
    await scaffoldApp('node-app', root, { template: 'api', runtime: 'node', install: false });
    await scaffoldApp('bun-app', root, { template: 'api', runtime: 'bun', install: false });
    const node = JSON.parse(readFileSync(join(root, 'node-app', 'package.json'), 'utf8'));
    const bun = JSON.parse(readFileSync(join(root, 'bun-app', 'package.json'), 'utf8'));

    // Identical versions across runtimes (only the run scripts differ by runtime).
    assert.deepEqual(node.dependencies, bun.dependencies, 'dependencies identical across npm/bun scaffolds');
    assert.deepEqual(node.devDependencies, bun.devDependencies, 'devDependencies identical across npm/bun scaffolds');

    // Runtime-critical deps are EXACT (so bun zero-install resolves the same as npm).
    for (const d of ['drizzle-orm', '@webjsdev/core', '@webjsdev/server', '@webjsdev/cli']) {
      assert.ok(isExact(node.dependencies[d]), `${d} must be exact-pinned, got "${node.dependencies[d]}"`);
    }
    assert.ok(isExact(node.devDependencies['drizzle-kit']), `drizzle-kit must be exact-pinned, got "${node.devDependencies['drizzle-kit']}"`);
    // drizzle is the 1.0 relations-v2 RC the db code targets, not the 0.x `latest` tag.
    assert.match(node.dependencies['drizzle-orm'], /^1\.0\.0-rc\./, 'drizzle-orm pinned to the 1.0 RC line');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
