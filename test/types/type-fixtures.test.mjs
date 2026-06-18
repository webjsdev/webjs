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
 * Resolution is `nodenext`, NOT `bundler` (#566). `bundler` intermittently
 * resolved `@webjsdev/server` to its `default` export condition (`index.js`,
 * untyped) instead of the `types` condition (`index.d.ts`) under `node --test`
 * cross-file concurrency, so a fixture importing a type-only export
 * (`AuthInstance`, the generic `createAuth<TUser>`) failed with "no exported
 * member" / "module resolves to an untyped module", non-deterministically and
 * shifting between sibling fixtures across runs. `nodenext` honors the package
 * `exports` `types` condition deterministically, which is how a typed Node
 * consumer resolves the package, so the bare `@webjsdev/*` specifiers always
 * land on the `.d.ts`. `--allowJs` is also dropped (no fixture imports a `.js`;
 * with it, resolution could treat `index.js` as a module). Do NOT switch back
 * to `bundler` here or re-add `--allowJs`.
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

for (const fixture of fixtures) {
  test(`type fixture compiles clean: ${fixture}`, () => {
    const res = spawnSync(
      process.execPath,
      [
        tscBin,
        '--noEmit',
        '--strict',
        '--target', 'esnext',
        '--module', 'nodenext',
        '--moduleResolution', 'nodenext',
        '--lib', 'esnext,dom',
        '--skipLibCheck',
        join(here, fixture),
      ],
      { encoding: 'utf8' },
    );
    assert.equal(
      res.status,
      0,
      `tsc reported errors for ${fixture}:\n${res.stdout}${res.stderr}`,
    );
  });
}
