// Regression guard for issue #418.
//
// The auto-release workflow's wrapper lockstep step bumps `create-webjs` +
// `webjsdev` to match `@webjsdev/cli` before publishing, reading each
// manifest by a templated path (`./packages/.../<pkg>/package.json`). The
// #404 reorg moved both wrappers into `packages/wrappers/`, but the workflow
// line kept the old `./packages/<pkg>/package.json` path. The publish calls
// are name-based (dir-move-safe), so nothing failed until a CLI release fired
// the lockstep, at which point the `node -e` would ENOENT. Same class as #409
// (the Dockerfile stale `packages/ts-plugin` COPY).
//
// This resolves the workflow's templated wrapper path for each wrapper and
// asserts the manifest exists, so a future move of the wrappers fails CI
// immediately instead of only at the next CLI release.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRAPPERS = ['create-webjs', 'webjsdev'];

test('the release workflow wrapper-lockstep manifest path resolves for each wrapper', () => {
  const yml = readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf8');

  // The templated manifest path the lockstep `node -e` reads, e.g.
  // `const path = './packages/wrappers/${pkg}/package.json';`
  const m = yml.match(/const path = '(\.\/packages\/[^']*\$\{pkg\}\/package\.json)'/);
  assert.ok(m, 'could not find the wrapper-lockstep manifest path in release.yml');

  for (const pkg of WRAPPERS) {
    const rel = m[1].replace('${pkg}', pkg).replace(/^\.\//, '');
    assert.ok(
      existsSync(join(ROOT, rel)),
      `release.yml wrapper lockstep reads ${rel}, which does not exist (a moved wrapper?)`,
    );
  }
});

test('the wrapper publish calls stay name-based (dir-move-safe)', () => {
  const yml = readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf8');
  // `npm publish --workspace="${pkg}"` targets by npm name, so a dir move
  // never breaks the publish itself (only the manifest read, guarded above).
  assert.match(
    yml,
    /npm publish --workspace="\$\{pkg\}"/,
    'wrapper publish should target the workspace by name, not a path',
  );
});
