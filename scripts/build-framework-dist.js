/**
 * Publish-time bundler for `@webjsdev/core`.
 *
 * Produces `packages/core/dist/webjs-core{,-...}.js` from the readable
 * `packages/core/src/*.js` sources. The source files stay on disk in
 * the published tarball so AI agents grep them; the dist bundles are
 * what the browser fetches via the new `exports` "default" condition.
 *
 * Runs ONLY at publish time (wired to `prepublishOnly` on the core
 * package). User installs never touch a bundler; the runtime stays
 * no-build.
 *
 * The framework deliberately stayed off bundlers after PR #89
 * eliminated esbuild from the runtime. This script re-introduces
 * esbuild as a publish-time-only devDependency of @webjsdev/core.
 * It does not flow through to user installs.
 *
 * Run from the repo root: `node scripts/build-framework-dist.js`.
 */

import { mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(HERE, '..', 'packages', 'core');

/**
 * Entry points. Each maps a source file in `packages/core/` to a
 * stable bundle filename in `packages/core/dist/`. Filenames match
 * the issue spec so the npm-side `exports` field can point at them
 * via a single rename rule.
 *
 * Note that some subpaths (e.g. `client-router`) map to a renamed
 * source file (`router-client.js`) for historical reasons.
 */
const ENTRIES = [
  { in: 'index.js',                  out: 'webjs-core' },
  // Browser-only entry: same as index.js minus render-server, expose,
  // and setCspNonceProvider. The browser importmap points at this
  // bundle (or the un-bundled `index-browser.js` in workspace dev
  // mode); Node-side consumers keep landing on `webjs-core.js`.
  { in: 'index-browser.js',          out: 'webjs-core-browser' },
  { in: 'src/directives.js',         out: 'webjs-core-directives' },
  { in: 'src/context.js',            out: 'webjs-core-context' },
  { in: 'src/task.js',               out: 'webjs-core-task' },
  { in: 'src/router-client.js',      out: 'webjs-core-client-router' },
  { in: 'src/lazy-loader.js',        out: 'webjs-core-lazy-loader' },
  { in: 'src/testing.js',            out: 'webjs-core-testing' },
];

async function main() {
  const dist = join(CORE, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // Code-split across the entry points so common modules like
  // `html.js` and `registry.js` land in a single shared chunk
  // instead of being duplicated into every entry bundle. The chunks
  // sit alongside the named entries; relative `import './chunk-xxx.js'`
  // statements in each entry resolve to the right URL at fetch time.
  const result = await build({
    entryPoints: ENTRIES.map((e) => ({ in: join(CORE, e.in), out: e.out })),
    outdir: dist,
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    sourcemap: 'linked',
    sourcesContent: false,
    minify: true,
    treeShaking: true,
    metafile: true,
    logLevel: 'info',
    legalComments: 'none',
  });

  // Sanity-check: every entry produced an output file with the
  // expected name. If esbuild ever changes its naming, fail loud
  // before publish rather than ship a broken tarball.
  for (const entry of ENTRIES) {
    const expected = join(dist, `${entry.out}.js`);
    if (!existsSync(expected)) {
      throw new Error(`build-framework-dist: expected ${expected}, missing from build output`);
    }
  }

  // Report total dist size for the npm-pack budget the issue calls out.
  let total = 0;
  for (const outFile of Object.keys(result.metafile.outputs)) {
    total += (await stat(outFile)).size;
  }
  const kb = (total / 1024).toFixed(1);
  console.log(`[build-framework-dist] wrote ${dist} (${kb} KB total across ${Object.keys(result.metafile.outputs).length} files)`);
}

main().catch((err) => {
  console.error('[build-framework-dist] failed:', err);
  process.exit(1);
});
