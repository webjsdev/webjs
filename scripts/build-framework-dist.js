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
 * stable bundle filename in `packages/core/dist/`.
 *
 * Deliberately MINIMAL. The browser surface ships as ONE self-contained
 * bundle, `webjs-core-browser.js` (built from `index-browser.js`, which
 * already re-exports the whole browser API: html/render/WebComponent, the
 * client router and its top-level auto-enable, directives, context, task,
 * signals, the frame). So the per-subpath browser entries that used to
 * exist (directives / context / task / client-router) are GONE: the
 * package.json `exports` `default` for those subpaths points at
 * `webjs-core-browser.js`, and each `import` just picks its named exports
 * from the one file. That collapses the browser to a single framework
 * request instead of a fan of code-split chunks. Splitting is off (below)
 * so the browser bundle is one file with no `chunk-*.js`.
 *
 * What stays its own file:
 * - `webjs-core` (built from `index.js`): the full surface for Node `.`
 *   resolution (keeps `renderToString` / `expose` / `setCspNonceProvider`).
 * - `webjs-core-lazy-loader`: loaded on-demand for `static lazy = true`
 *   components, not on the always-load path, so it is NOT folded in.
 * - `webjs-core-testing`: test-only, never browser-shipped in prod.
 */
const ENTRIES = [
  { in: 'index.js',                  out: 'webjs-core' },
  { in: 'index-browser.js',          out: 'webjs-core-browser' },
  { in: 'src/lazy-loader.js',        out: 'webjs-core-lazy-loader' },
  { in: 'src/testing.js',            out: 'webjs-core-testing' },
];

async function main() {
  const dist = join(CORE, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // Splitting OFF: each entry is a single self-contained file with no
  // shared `chunk-*.js`. The browser surface is one request
  // (`webjs-core-browser.js`); the handful of other entries (the Node
  // full bundle, the on-demand lazy loader, the test helpers) duplicate
  // the small amount of code they share, which is a cheap tarball cost
  // (never shipped to a browser) in exchange for a clean, waterfall-free
  // network graph. The few entries mean little duplication in practice.
  const result = await build({
    entryPoints: ENTRIES.map((e) => ({ in: join(CORE, e.in), out: e.out })),
    outdir: dist,
    bundle: true,
    splitting: false,
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
