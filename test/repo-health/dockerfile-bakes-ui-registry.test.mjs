/**
 * Regression guard for issue #526.
 *
 * The ui-website's component DETAIL pages
 * (`packages/ui/packages/website/app/docs/components/[name]/page.ts`) statically
 * import the component SOURCES from `components/ui/*.ts`. Those files do not
 * exist in a fresh tree: the npm `prestart` hook generates them by copying out
 * of the registry (`scripts/copy-registry.js`).
 *
 * The deploy image serves each app with a direct `bun .../webjs.js start`, which
 * BYPASSES npm `prestart`. So the generated `components/ui/` sources have to be
 * baked into the image at BUILD time (exactly like the Tailwind css is), or every
 * component page 500s in production with `Cannot find module
 * '../../../../components/ui/<name>.ts'`. That is what happened on the Bun
 * cutover (#522): the home pages worked, the component pages did not, and a
 * home-route-only smoke missed it.
 *
 * This asserts the Dockerfile bakes the registry copy at build time, so removing
 * that step (or never adding it) fails CI here instead of only at deploy time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');

test('the Dockerfile bakes the ui-website registry components at build time (#526)', () => {
  // A RUN step must invoke the registry-copy script. Match the script name
  // rather than an exact command so a future `cd`/path tweak does not falsely
  // fail, while a dropped bake step (the actual regression) does.
  const runsCopyRegistry = /^RUN\b.*copy-registry\.js/m.test(dockerfile);
  assert.ok(
    runsCopyRegistry,
    'Dockerfile must RUN scripts/copy-registry.js so components/ui/*.ts ship in the image; ' +
      'without it the ui-website component pages 500 when served directly on Bun (bypassing npm prestart, #526).',
  );
});

test('the registry-copy script the bake depends on still exists', () => {
  // If the script moves/renames, the Dockerfile RUN above silently no-ops at
  // build (a missing script is a hard `docker build` error, but this catches a
  // rename in the repo before the image build does).
  const script = join(ROOT, 'packages', 'ui', 'packages', 'website', 'scripts', 'copy-registry.js');
  assert.ok(existsSync(script), `copy-registry.js must exist at ${script} for the Dockerfile bake to work`);
});
