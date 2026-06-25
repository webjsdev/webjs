/**
 * #700: the scaffold ships `@webjsdev/*` (and `pg`) as idiomatic caret ranges.
 * Bun zero-install resolves a normal caret range correctly since #698, so the
 * #692 exact-pin is no longer needed for them. Drizzle stays EXACT: its 1.0 line
 * is a prerelease RC (`1.0.0-rc.3`), and bun ENOENTs on a caret-prerelease inline
 * specifier (`drizzle-orm@^1.0.0-rc.3`), so a range would break it. A Node and a
 * Bun scaffold still emit IDENTICAL specifiers (only the run scripts differ).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldApp } from '../../lib/create.js';

const isExact = (v) => typeof v === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v);
const isCaret = (v) => typeof v === 'string' && /^\^\d/.test(v);

test('npm and bun scaffolds emit identical specifiers; @webjsdev/* ranged, drizzle exact (#700)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-vc-'));
  try {
    await scaffoldApp('node-app', root, { template: 'api', runtime: 'node', install: false });
    await scaffoldApp('bun-app', root, { template: 'api', runtime: 'bun', install: false });
    const node = JSON.parse(readFileSync(join(root, 'node-app', 'package.json'), 'utf8'));
    const bun = JSON.parse(readFileSync(join(root, 'bun-app', 'package.json'), 'utf8'));

    // Identical specifiers across runtimes (only the run scripts differ by runtime).
    assert.deepEqual(node.dependencies, bun.dependencies, 'dependencies identical across npm/bun scaffolds');
    assert.deepEqual(node.devDependencies, bun.devDependencies, 'devDependencies identical across npm/bun scaffolds');

    // @webjsdev/* are caret ranges now (#700): bun resolves a normal caret correctly since #698.
    for (const d of ['@webjsdev/core', '@webjsdev/server', '@webjsdev/cli']) {
      assert.ok(isCaret(node.dependencies[d]), `${d} should be a caret range, got "${node.dependencies[d]}"`);
    }

    // Drizzle stays EXACT: a caret-prerelease (drizzle-orm@^1.0.0-rc.3) ENOENTs under bun zero-install.
    assert.ok(isExact(node.dependencies['drizzle-orm']), `drizzle-orm must stay exact, got "${node.dependencies['drizzle-orm']}"`);
    assert.ok(isExact(node.devDependencies['drizzle-kit']), `drizzle-kit must stay exact, got "${node.devDependencies['drizzle-kit']}"`);
    assert.match(node.dependencies['drizzle-orm'], /^1\.0\.0-rc\./, 'drizzle-orm pinned to the 1.0 RC line');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
