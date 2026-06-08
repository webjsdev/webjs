/**
 * Drift guard for issue #388: the hand-maintained `packages/core/index.d.ts`
 * overlay must declare a SUPERSET of `index.js`'s runtime named exports, so
 * every `import { x } from '@webjsdev/core'` that works at runtime also
 * type-checks. The overlay had drifted (36 of 82 runtime exports missing,
 * incl. `WebComponent`, `signal`, the whole directive set, the serializer).
 *
 * This reads the runtime export names DYNAMICALLY (so it can never go stale as
 * exports are added) and tsc-checks a fixture that imports every one of them
 * from the package's PUBLIC type entry. A missing declaration surfaces as a
 * `no exported member` error naming the symbol. The counterfactual is built
 * in: drop any export from index.d.ts and this test fails with that name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

test('index.d.ts declares every @webjsdev/core runtime named export (#388)', async () => {
  const core = await import('@webjsdev/core');
  // Runtime named exports (skip `default` if any; only real named bindings).
  const names = Object.keys(core).filter((n) => n !== 'default');
  assert.ok(names.length > 50, `expected the full core surface, got ${names.length}`);

  const fixture = join(here, '_core-export-coverage.generated.ts');
  // One import binding per runtime export; referencing each as a value forces
  // tsc to resolve the binding (a type-only declaration would still satisfy an
  // import, but every name here IS a runtime value, so this is sound).
  const src =
    `import {\n  ${names.join(',\n  ')},\n} from '@webjsdev/core';\n` +
    `void [\n  ${names.join(',\n  ')},\n];\n`;
  writeFileSync(fixture, src);
  try {
    const res = spawnSync(
      process.execPath,
      [
        tscBin, '--noEmit', '--strict',
        '--target', 'esnext', '--module', 'esnext',
        '--moduleResolution', 'bundler', '--lib', 'esnext,dom',
        '--skipLibCheck', '--allowJs', fixture,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const out = `${res.stdout || ''}${res.stderr || ''}`;
    const missing = [...out.matchAll(/no exported member(?: named)? '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(
      missing,
      [],
      `index.d.ts is missing declarations for runtime exports: ${missing.join(', ')}`,
    );
    assert.equal(res.status, 0, `tsc reported errors:\n${out}`);
  } finally {
    rmSync(fixture, { force: true });
  }
});
