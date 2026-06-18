/**
 * Runs `tsc --noEmit` over the `@webjsdev/server` type fixture (#310) under
 * `strict` + `nodenext` (the SAME resolution a scaffolded app's tsconfig uses,
 * see packages/cli/lib/create.js), proving the public server surface is typed
 * and the bare import no longer emits TS7016.
 *
 * Three assertions:
 *  1. The full fixture compiles clean against the REAL package (every export
 *     typed, the two `@ts-expect-error` counterfactuals genuinely error).
 *  2. COUNTERFACTUAL: with `index.d.ts` removed, the same server import errors
 *     TS7016 and tsc exits non-zero. This proves the overlay (not something
 *     else) is what fixes the gap.
 *  3. With the overlay present, the bare import is clean again.
 *
 * The counterfactual runs against an ISOLATED COPY of the package in a temp
 * `node_modules`, NEVER the live `packages/server/index.d.ts` (#566). Moving
 * the live declaration aside raced with other test files: `node --test` runs
 * files concurrently, so while the overlay was moved away (a ~2.5s window, one
 * full tsc run) any concurrent fixture compilation in `type-fixtures.test.mjs`
 * resolved `@webjsdev/server` untyped and failed non-deterministically (TS7016 /
 * TS2305 / TS2322 on an augmentation fixture, shifting between siblings run to
 * run). Operating on a private copy keeps the live file untouched, so concurrent
 * resolvers always see the real, present overlay.
 *
 * `--skipLibCheck` is on for the same reason as the root type-fixtures runner:
 * the framework runtime is JSDoc-typed `.js`, so its implicit-any internals are
 * noise unrelated to the fixture's own checks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, cpSync, rmSync, symlinkSync, writeFileSync, realpathSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tscBin = join(repoRoot, 'node_modules/typescript/bin/tsc');
const serverPkg = join(repoRoot, 'packages/server');
const corePkg = join(repoRoot, 'packages/core');

const TSC_FLAGS = [
  '--noEmit',
  '--strict',
  '--target', 'esnext',
  '--module', 'nodenext',
  '--moduleResolution', 'nodenext',
  '--lib', 'esnext,dom',
  '--skipLibCheck',
];

function runTsc(file, cwd) {
  return spawnSync(process.execPath, [tscBin, ...TSC_FLAGS, file], { encoding: 'utf8', cwd });
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

/**
 * Build an isolated temp project whose `node_modules/@webjsdev/server` is a COPY
 * of the real package (so its `index.d.ts` can be removed without touching the
 * live file) and whose `@webjsdev/core` is symlinked to the real package (never
 * mutated). Returns the project dir + the copied overlay path.
 */
function makeIsolatedProject() {
  const proj = mkdtempSync(join(tmpdir(), 'webjs-server-types-'));
  const nm = join(proj, 'node_modules', '@webjsdev');
  mkdirSync(nm, { recursive: true });

  // Copy only what nodenext type-resolution reads: the package manifest, the
  // overlay + its `export *` targets under src/, and index.js (the `default`
  // target that, with the overlay gone, resolves to an untyped .js -> TS7016).
  const dest = join(nm, 'server');
  mkdirSync(dest, { recursive: true });
  for (const f of ['package.json', 'index.d.ts', 'index.js']) {
    cpSync(join(serverPkg, f), join(dest, f));
  }
  cpSync(join(serverPkg, 'src'), join(dest, 'src'), { recursive: true });

  // Core is read-only here (the overlay imports its types); symlink the real
  // package so resolution is byte-identical to production.
  symlinkSync(realpathSync(corePkg), join(nm, 'core'), 'dir');

  // A type:module manifest so nodenext resolves the probe + bare imports.
  writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'probe', type: 'module' }));
  const probe = join(proj, 'probe.ts');
  writeFileSync(
    probe,
    `import { createRequestHandler } from '@webjsdev/server';\nvoid createRequestHandler;\n`,
  );
  return { proj, probe, overlay: join(dest, 'index.d.ts') };
}

test('TS7016 counterfactual: removing index.d.ts breaks the bare server import', () => {
  const { proj, probe, overlay } = makeIsolatedProject();
  try {
    // Sanity: with the overlay present the probe is clean.
    const withOverlay = runTsc(probe, proj);
    assert.equal(
      withOverlay.status,
      0,
      `expected the probe to type-check WITH index.d.ts present:\n${withOverlay.stdout}${withOverlay.stderr}`,
    );

    // Remove the overlay from the COPY and confirm TS7016 fires.
    rmSync(overlay, { force: true });
    const withoutOverlay = runTsc(probe, proj);
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
    rmSync(proj, { recursive: true, force: true });
  }
});

test('the bare import is clean against the real overlay', () => {
  const restored = runTsc(join(here, 'server-exports.test-d.ts'));
  assert.equal(restored.status, 0, 'fixture should be clean against the live overlay');
});
