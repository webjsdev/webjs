/**
 * Load the app's own modules through a `Bun.plugin` under `webjs dev` on Bun
 * (#1575), so every load reads the file as it is on disk now.
 *
 * Under `bun --hot`, Bun keeps a per-path copy of a module's source and
 * refreshes it from its file watcher. Once a file is replaced rather than
 * rewritten (an editor's atomic save, `sed -i`, a `git checkout`), that watch
 * is gone and the copy is never refreshed: every later import of that path, a
 * fresh `?t=` query included, evaluates the old source for the rest of the
 * process. Measured on the scaffold: one atomic write to a page, and the page
 * served its previous version through every later edit until a restart. A
 * plugin's `onLoad` is not served from that copy, so it is always fresh.
 *
 * The trade is that `bun --hot` does not watch a module a plugin served
 * (#1550), so the dev server's own watcher asks for the registry reset itself
 * (`pokeHotSentinel` in `dev/hot-host.js`) after an edit to any app module.
 *
 * The filter matches app modules only: never `node_modules`, and never a
 * `*.server.*` module, which the `'use server'` seed plugin serves. When dev
 * source locations are on, their plugin (same filter, registered first) wins
 * and serves annotated source instead, which is just as fresh.
 *
 * @module dev/bun-app-source
 */
import { readFileSync } from 'node:fs';

const ROOTS = Symbol.for('webjs.dev.bunAppSourceRoots');

/** @param {string} s */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The `onLoad` filter for one app root: its JS/TS modules outside
 * `node_modules`, `*.server.*` excluded, with an optional query.
 * @param {string} appDir absolute
 * @returns {RegExp}
 */
export function appSourceFilter(appDir) {
  return new RegExp('^' + escapeRe(appDir) + '/(?:(?!node_modules/)(?!.*\\.server\\.).)*\\.m?[jt]s(\\?.*)?$');
}

/**
 * Install the loader for `appDir`, once per process.
 * @param {string} appDir absolute
 */
export function registerBunAppSource(appDir) {
  const g = /** @type {any} */ (globalThis);
  if (!g.Bun || typeof g.Bun.plugin !== 'function') return;
  if (!(g[ROOTS] instanceof Set)) g[ROOTS] = new Set();
  if (g[ROOTS].has(appDir)) return;
  g[ROOTS].add(appDir);
  const filter = appSourceFilter(appDir);
  g.Bun.plugin({
    name: 'webjs-dev-app-source',
    setup(build) {
      build.onLoad({ filter }, (args) => {
        const abs = args.path.split('?')[0];
        // A read failure (the file is gone) propagates, which Bun reports as
        // the load error it would have raised itself.
        return { contents: readFileSync(abs, 'utf8'), loader: /\.m?ts$/.test(abs) ? 'ts' : 'js' };
      });
    },
  });
}
