import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../lib/create.js';

/**
 * Scaffold-integrity gate (#807). webjs is no-build, so every `.ts` / `.mts`
 * file a fresh `webjs create` emits IS the runtime source: if any of them fails
 * `module.stripTypeScriptTypes`, the freshly-scaffolded app breaks the moment
 * that file is loaded, and a weak agent cannot tell the framework's breakage
 * from its own.
 *
 * This generates each template (install: false, so no network) and strips EVERY
 * emitted `.ts`/`.mts` file. It is broader than the static `template-strip`
 * test: it also covers the files `create.js` GENERATES as strings (app/page.ts,
 * db/*.server.ts, the per-feature modules), not only the verbatim templates.
 *
 * Guards the shipped bug this PR fixes (the e2e template's block-comment glob)
 * plus any future generated file that fails its own strip.
 */

async function collectTsFiles(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) await collectTsFiles(abs, out);
    else if (/\.m?ts$/.test(ent.name) && !/\.d\.ts$/.test(ent.name)) out.push(abs);
  }
  return out;
}

for (const template of ['full-stack', 'api', 'saas']) {
  test(`scaffolded ${template} app: every generated .ts/.mts strips cleanly (#807)`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), `webjs-scaffold-strip-${template}-`));
    try {
      await scaffoldApp('app', cwd, { template });
      const appDir = join(cwd, 'app');
      const files = await collectTsFiles(appDir);
      assert.ok(files.length > 0, `expected the ${template} scaffold to emit .ts files`);
      const failures = [];
      for (const abs of files) {
        const src = await readFile(abs, 'utf8');
        try {
          stripTypeScriptTypes(src, { mode: 'strip' });
        } catch (err) {
          failures.push(`${relative(appDir, abs)}: ${String(err.message).split('\n')[0]}`);
        }
      }
      assert.deepEqual(
        failures,
        [],
        `the ${template} scaffold emits .ts files that fail TypeScript stripping and would break a fresh app:\n  ${failures.join('\n  ')}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
