/**
 * Resolve the app's `#` subpath imports ourselves under `webjs dev` on Bun
 * (#1575).
 *
 * Bun caches a directory's entries when it resolves through it and, under
 * `bun --hot`, refreshes that cache only for a directory it watches. It does
 * not watch a directory that holds only modules a `Bun.plugin` served (an
 * `actions/` folder of `*.server.ts` files), and a `package.json "imports"`
 * specifier (`#modules/x/new.ts`) resolves through that stale listing, while a
 * relative one does not. So a file an agent added next to an action was
 * "Cannot find module" for the rest of the process, through every reload. This
 * `onResolve` expands the alias through the same map the module graph uses
 * (`expandImportAlias`) and hands Bun an absolute path that exists, which Bun
 * then loads normally (the seed plugin's `onLoad` still applies by path). A
 * specifier it cannot place falls through to Bun's own resolver, so an error
 * reads exactly as it would without it.
 *
 * Dev only (production never reloads) and Bun only (Node's resolver reads the
 * file system on every resolve).
 *
 * @module dev/bun-alias-resolve
 */
import { existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { expandImportAlias } from '../module-graph.js';

const ROOTS = Symbol.for('webjs.dev.bunAliasRoots');

/**
 * Resolve `spec` imported by `importer` against the app's `#` alias map, or
 * null when it is not an app alias or the target is not a file.
 *
 * @param {string} spec
 * @param {string} importer  absolute path, possibly with a query
 * @param {string} appDir  absolute
 * @returns {string | null}
 */
export function resolveAppAlias(spec, importer, appDir) {
  if (!spec.startsWith('#')) return null;
  const from = String(importer || '').split('?')[0];
  if (!from.startsWith(appDir + sep) || from.includes(`${sep}node_modules${sep}`)) return null;
  const rel = expandImportAlias(spec, appDir);
  if (!rel) return null;
  const abs = resolve(appDir, rel);
  try { return existsSync(abs) && statSync(abs).isFile() ? abs : null; } catch { return null; }
}

/**
 * Install the resolver for `appDir`, once per process.
 * @param {string} appDir  absolute
 */
export function registerBunAliasResolver(appDir) {
  const g = /** @type {any} */ (globalThis);
  if (!g.Bun || typeof g.Bun.plugin !== 'function') return;
  if (!(g[ROOTS] instanceof Set)) g[ROOTS] = new Set();
  if (g[ROOTS].has(appDir)) return;
  g[ROOTS].add(appDir);
  g.Bun.plugin({
    name: 'webjs-dev-alias',
    setup(build) {
      build.onResolve({ filter: /^#/ }, (args) => {
        try {
          const path = resolveAppAlias(args.path, args.importer, appDir);
          return path ? { path } : undefined;
        } catch {
          return undefined;
        }
      });
    },
  });
}
