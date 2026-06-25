// The Bun pin transform must only fire under TRUE zero-install (no
// node_modules). When node_modules exists (an installed app, or a workspace
// member like this repo's own examples/blog), Bun resolves bare specifiers
// from it, and injecting an inline version would bypass that and, for a
// workspace-linked dep, swap the local package for the published one (the #698
// blog-on-Bun regression). buildBunPinTransform encodes that gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBunPinTransform } from '../../src/action-seed.js';

const scratch = (pkg, withNodeModules) => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-pin-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  if (withNodeModules) mkdirSync(join(dir, 'node_modules'));
  return dir;
};

test('pin transform is SKIPPED when node_modules exists (not true zero-install)', () => {
  // A pinnable exact dep, but node_modules is present -> Bun uses the installed
  // copy, so no rewrite. This is the #698 regression guard (counterfactual:
  // drop the existsSync gate and this returns a function instead of null).
  const dir = scratch({ dependencies: { a: '1.2.3' } }, true);
  assert.equal(buildBunPinTransform(dir), null);
});

test('pin transform is BUILT under true zero-install (no node_modules)', () => {
  const dir = scratch({ dependencies: { a: '1.2.3' } }, false);
  assert.equal(typeof buildBunPinTransform(dir), 'function');
});

test('pin transform is null when there is nothing inline-safe to pin', () => {
  const dir = scratch({ dependencies: { a: 'workspace:*' } }, false);
  assert.equal(buildBunPinTransform(dir), null);
});
