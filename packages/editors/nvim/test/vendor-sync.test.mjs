/**
 * Drift guard for the vendored @webjsdev/ts-plugin inside webjs.nvim (#398).
 *
 * webjs.nvim bundles a verbatim copy of the standalone ts-plugin (it has no
 * install-time build step) and points tsserver at it. That copy MUST stay in
 * sync with `packages/editors/ts-plugin/src`; this test fails if it drifts, telling you
 * to re-run `node packages/editors/nvim/scripts/vendor-ts-plugin.mjs` then
 * `git add -f packages/editors/nvim/vendor`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const SRC = join(DIR, '../../ts-plugin/src');
const VENDORED = join(DIR, '../vendor/node_modules/@webjsdev/ts-plugin/src');

function walk(root, base = root, out = []) {
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full));
  }
  return out;
}

test('vendored ts-plugin src is byte-identical to packages/editors/ts-plugin/src', () => {
  assert.ok(existsSync(VENDORED), 'vendored src dir exists (run scripts/vendor-ts-plugin.mjs)');
  const srcFiles = walk(SRC).sort();
  const vendoredFiles = walk(VENDORED).sort();
  assert.deepEqual(vendoredFiles, srcFiles, 'same file set (re-run the vendor script)');
  for (const f of srcFiles) {
    assert.equal(
      readFileSync(join(VENDORED, f), 'utf8'),
      readFileSync(join(SRC, f), 'utf8'),
      `vendored ${f} drifted; re-run node packages/editors/nvim/scripts/vendor-ts-plugin.mjs`,
    );
  }
});

test('vendored package.json main resolves to the bundled entry', () => {
  const pkg = JSON.parse(
    readFileSync(join(DIR, '../vendor/node_modules/@webjsdev/ts-plugin/package.json'), 'utf8'),
  );
  assert.equal(pkg.name, '@webjsdev/ts-plugin');
  assert.ok(existsSync(join(DIR, '../vendor/node_modules/@webjsdev/ts-plugin', pkg.main)), 'main entry exists');
});
