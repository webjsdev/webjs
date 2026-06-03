/**
 * Runs `tsc --noEmit` over the `@webjsdev/server` type fixture (#310) under
 * `strict` + `nodenext` (the SAME resolution a scaffolded app's tsconfig uses,
 * see packages/cli/lib/create.js), proving the public server surface is typed
 * and the bare import no longer emits TS7016.
 *
 * Three assertions:
 *  1. The full fixture compiles clean (every export typed, the two
 *     `@ts-expect-error` counterfactuals genuinely error).
 *  2. COUNTERFACTUAL: with `index.d.ts` temporarily moved aside, the same
 *     server import errors TS7016 and tsc exits non-zero. This proves the
 *     overlay (not something else) is what fixes the gap.
 *  3. The overlay restored, the bare import is clean again.
 *
 * `--skipLibCheck` is on for the same reason as the root type-fixtures runner:
 * the framework runtime is JSDoc-typed `.js`, so its implicit-any internals are
 * noise unrelated to the fixture's own checks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const tscBin = join(repoRoot, 'node_modules/typescript/bin/tsc');
const indexDts = join(repoRoot, 'packages/server/index.d.ts');

const TSC_FLAGS = [
  '--noEmit',
  '--strict',
  '--target', 'esnext',
  '--module', 'nodenext',
  '--moduleResolution', 'nodenext',
  '--lib', 'esnext,dom',
  '--skipLibCheck',
];

function runTsc(file) {
  return spawnSync(process.execPath, [tscBin, ...TSC_FLAGS, file], { encoding: 'utf8' });
}

test('server type fixture compiles clean under strict + nodenext', () => {
  assert.ok(existsSync(tscBin), 'typescript must be installed');
  const res = runTsc(join(here, 'server-exports.test-d.ts'));
  assert.equal(
    res.status,
    0,
    `tsc reported errors for the server type fixture:\n${res.stdout}${res.stderr}`,
  );
});

test('TS7016 counterfactual: removing index.d.ts breaks the bare server import', () => {
  // A minimal import-only fixture. It must live INSIDE the repo tree so
  // nodenext resolution finds the workspace `node_modules/@webjsdev/server`.
  const probe = join(here, '.ts7016-probe.ts');
  writeFileSync(
    probe,
    `import { createRequestHandler } from '@webjsdev/server';\nvoid createRequestHandler;\n`,
  );

  // Sanity: with the overlay present the probe is clean.
  const withOverlay = runTsc(probe);
  assert.equal(
    withOverlay.status,
    0,
    `expected the probe to type-check WITH index.d.ts present:\n${withOverlay.stdout}${withOverlay.stderr}`,
  );

  // Move the overlay aside and confirm TS7016 fires. Restore in `finally` so a
  // failure can never leave the repo without its declaration file.
  const stash = indexDts + '.ts7016-stash';
  renameSync(indexDts, stash);
  try {
    const withoutOverlay = runTsc(probe);
    assert.notEqual(
      withoutOverlay.status,
      0,
      'expected tsc to FAIL without index.d.ts (TS7016)',
    );
    assert.match(
      withoutOverlay.stdout + withoutOverlay.stderr,
      /TS7016/,
      'expected a TS7016 "could not find a declaration file" error',
    );
  } finally {
    renameSync(stash, indexDts);
    rmSync(probe, { force: true });
  }

  // The overlay restored, the bare import is clean again.
  const restored = runTsc(join(here, 'server-exports.test-d.ts'));
  assert.equal(restored.status, 0, 'fixture should be clean again after restore');
});
