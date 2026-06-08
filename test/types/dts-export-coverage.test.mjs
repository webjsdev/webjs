/**
 * Drift guard for issue #388: each published package's hand-maintained `.d.ts`
 * overlay must declare a SUPERSET of its runtime named exports, so every
 * `import { x } from '<pkg>'` that works at runtime also type-checks. The
 * `@webjsdev/core` overlay had drifted (36 of 82 runtime exports missing, incl.
 * `WebComponent`, `signal`, the whole directive set, the serializer).
 *
 * For each entry point below it reads the runtime export names DYNAMICALLY (so
 * the guard can never go stale as exports are added), then tsc-checks a fixture
 * that imports every one from the package's PUBLIC type entry. A missing
 * declaration surfaces as a `no exported member` error naming the symbol. The
 * counterfactual is built in: drop any export from the `.d.ts` and this fails
 * with that name.
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

// Each published entry point with a hand-maintained `.d.ts` overlay, plus a
// minimum-count sanity bound so a botched runtime import (0 names) can't make
// the guard vacuously pass.
const ENTRIES = [
  { spec: '@webjsdev/core', min: 50 },
  { spec: '@webjsdev/server', min: 50 },
  { spec: '@webjsdev/server/testing', min: 5 },
];

for (const { spec, min } of ENTRIES) {
  test(`${spec}: .d.ts declares every runtime named export (#388)`, async () => {
    const mod = await import(spec);
    const names = Object.keys(mod).filter((n) => n !== 'default');
    assert.ok(names.length >= min, `expected >= ${min} exports from ${spec}, got ${names.length}`);

    const fixture = join(here, `_export-coverage.${spec.replace(/[@/]/g, '_')}.generated.ts`);
    const src =
      `import {\n  ${names.join(',\n  ')},\n} from '${spec}';\n` +
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
        `${spec} .d.ts is missing declarations for runtime exports: ${missing.join(', ')}`,
      );
      assert.equal(res.status, 0, `tsc reported errors for ${spec}:\n${out}`);
    } finally {
      rmSync(fixture, { force: true });
    }
  });
}
