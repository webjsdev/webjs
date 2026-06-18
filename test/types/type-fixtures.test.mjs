/**
 * Runs `tsc --noEmit` over the compile-time type fixtures in this folder so
 * the public type surface is verified in `npm test`, not only in an editor.
 *
 * Each `*.test-d.ts` fixture asserts the typed shape: a valid object compiles,
 * and every `// @ts-expect-error` line is a genuine error (tsc reports an
 * "unused @ts-expect-error" if the type ever widens to accept the bad value,
 * so the fixtures are self-checking counterfactuals).
 *
 * `--skipLibCheck` is on because the framework runtime is JSDoc-typed `.js`
 * (no per-module `.d.ts`), which under `--strict` would otherwise flag the
 * library's own implicit-any imports. That noise is unrelated to the fixtures;
 * the fixtures themselves are still fully type-checked.
 *
 * RETRY on a TRANSIENT resolution failure (#566). Under `node --test` cross-file
 * concurrency the spawned `tsc` intermittently fails to resolve a workspace
 * package's types, e.g. `@webjsdev/server` momentarily resolves to its `.js`
 * (untyped) instead of `index.d.ts`, so a fixture importing a type-only export
 * (`AuthInstance`, the generic `createAuth<TUser>`) fails with TS7016 /
 * TS2305 / TS2665, non-deterministically and shifting between sibling fixtures
 * across runs (green on main, flaky on branches that perturb test timing,
 * #563/#565). The package types are correct, so the SAME compile succeeds on a
 * fresh `tsc` process a moment later. A genuine type error in a fixture fails
 * every attempt and is still reported; only a transient race is retried, so the
 * retry cannot hide a real regression.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tscBin = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url));

const fixtures = readdirSync(here).filter((f) => f.endsWith('.test-d.ts'));

/** Run tsc once over a single fixture; returns the spawnSync result. */
function compile(fixture) {
  return spawnSync(
    process.execPath,
    [
      tscBin,
      '--noEmit',
      '--strict',
      '--target', 'esnext',
      '--module', 'esnext',
      '--moduleResolution', 'bundler',
      '--lib', 'esnext,dom',
      '--skipLibCheck',
      '--allowJs',
      join(here, fixture),
    ],
    { encoding: 'utf8' },
  );
}

// A failure that names a workspace `@webjsdev/*` package is the transient
// resolution race, not a fixture error: retry it. A real fixture type error
// points at the fixture file itself (and persists across attempts anyway).
const TRANSIENT = /@webjsdev\/(core|server)/;

for (const fixture of fixtures) {
  test(`type fixture compiles clean: ${fixture}`, () => {
    let res = compile(fixture);
    for (let attempt = 1; attempt < 4 && res.status !== 0 && TRANSIENT.test(`${res.stdout}${res.stderr}`); attempt++) {
      res = compile(fixture);
    }
    assert.equal(
      res.status,
      0,
      `tsc reported errors for ${fixture}:\n${res.stdout}${res.stderr}`,
    );
  });
}
