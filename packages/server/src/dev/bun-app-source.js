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
 * (#1550). The dev server's own watcher sees the edit instead, and the served
 * source carries the module versions (#1689): `rewriteAppSource` records each
 * module's import edges and points an import of an edited module, or of a
 * module above one, at its absolute path plus `?webjs-v=<n>`
 * (`dev/esm-hot-hooks.js` holds the versions). Bun keys a module by its query,
 * so the edited chain evaluates fresh while every other module keeps its
 * instance and its module-scope state. Only what versions cannot place (a
 * deleted file, the extensionless temp file `sed -i` renames over a module)
 * still asks `bun --hot` for a registry reset (`pokeHotSentinel` in
 * `dev/hot-host.js`).
 *
 * The filter matches app modules only: never `node_modules`, and never a
 * `*.server.*` module, which the `'use server'` seed plugin serves. When dev
 * source locations are on, their plugin (same filter, registered first) wins
 * and serves annotated source instead, which is just as fresh.
 *
 * @module dev/bun-app-source
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve as resolvePath, isAbsolute } from 'node:path';
import { expandImportAlias, importSpecifierRanges, resolveImport } from '../module-graph.js';
import { moduleVersion, recordModuleImport, recordModuleLoad, isVersionedModule } from './esm-hot-hooks.js';

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
        return { contents: rewriteAppSource(readFileSync(abs, 'utf8'), abs), loader: /\.m?ts$/.test(abs) ? 'ts' : 'js' };
      });
    },
  });
}

/** Static `import`/`export … from '#x'` and `import('#x')` with a literal specifier. */
const ALIAS_SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(#[^'"\s]+)\2/g;

/**
 * Rewrite the app's `#` import specifiers in a module's source to the absolute
 * path they name (#1575), when that file exists. Bun's resolver serves a `#`
 * import of a file created after it listed the directory as "Cannot find
 * module" under `bun --hot`, and a runtime `onResolve` cannot stand in for it:
 * its result reaches a dynamic `import()` as a broken `file:/...` path (the
 * 0.8.85 / 0.8.86 regression). An absolute path resolves through neither.
 * Anything that is not an app alias, or names no file yet, is left as written,
 * so Bun reports a missing module exactly as before.
 *
 * @param {string} src
 * @param {string} file  absolute path of the module
 * @returns {string}
 */
export function rewriteAppAliases(src, file) {
  if (!src.includes('#')) return src;
  const g = /** @type {any} */ (globalThis);
  const roots = g[ROOTS] instanceof Set ? [...g[ROOTS]] : [];
  const appDir = roots.find((r) => file.startsWith(r + '/'));
  if (!appDir || file.includes('/node_modules/')) return src;
  return src.replace(ALIAS_SPEC_RE, (m, lead, q, spec) => {
    const rel = expandImportAlias(spec, appDir);
    if (!rel) return m;
    const abs = resolvePath(appDir, rel);
    try { return existsSync(abs) && statSync(abs).isFile() ? `${lead}${q}${abs}${q}` : m; } catch { return m; }
  });
}

/**
 * Everything the dev server does to an app module's source on Bun before Bun
 * sees it: the `#` alias rewrite, then the module versions (#1689). Every Bun
 * plugin that serves app source in dev calls this one function (this file's,
 * the `'use server'` seed plugin's passthrough, the source-locations plugin),
 * so a module is versioned whichever of them serves it. A no-op outside a
 * registered app root, so production source is untouched.
 *
 * @param {string} src
 * @param {string} file  absolute path of the module, no query
 * @returns {string}
 */
export function rewriteAppSource(src, file) {
  return versionServedImports(rewriteAppAliases(src, file), file);
}

/**
 * Record each import edge of an app module and point every import of a
 * bumped module at its absolute path plus `?webjs-v=<n>` (`&webjs-v=<n>` on a
 * specifier that already has a query), the Bun half of the Node resolve hook in
 * `dev/esm-hot-hooks.js`. Static imports, `export … from` and string-literal
 * dynamic imports count. A type-only clause, a specifier inside a string,
 * template or comment, and a bare specifier are left alone, and so is a target
 * that does not exist, so Bun reports a missing module exactly as before. The
 * absolute path rather than the written spelling, because it is the key Bun
 * gives the module anyway, and a query on `./x.js` naming `x.ts` would be one
 * more resolver path to trust.
 *
 * @param {string} src  source after the alias rewrite
 * @param {string} file  absolute path of the module, no query
 * @returns {string}
 */
export function versionServedImports(src, file) {
  if (!isVersionedModule(file)) return src;
  recordModuleLoad(file);
  const g = /** @type {any} */ (globalThis);
  const roots = g[ROOTS] instanceof Set ? [...g[ROOTS]] : [];
  const appDir = roots.find((r) => file.startsWith(r + '/'));
  if (!appDir) return src;
  /** @type {Array<{ start: number, end: number, text: string }>} */
  const edits = [];
  const seen = new Set();
  for (const { start, end, spec } of importSpecifierRanges(src)) {
    if (seen.has(start)) continue;
    seen.add(start);
    const target = serverTarget(spec, file, appDir);
    if (!target) continue;
    recordModuleImport(file, target);
    const n = moduleVersion(target);
    if (!n) continue;
    let exists = false;
    try { exists = statSync(target).isFile(); } catch { /* missing: leave it */ }
    if (!exists) continue;
    const text = spec.includes('?') ? `${spec}&webjs-v=${n}` : `${target}?webjs-v=${n}`;
    edits.push({ start, end, text });
  }
  if (!edits.length) return src;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const { start, end, text } of edits) out = out.slice(0, start) + text + out.slice(end);
  return out;
}

/**
 * The file an app module's import specifier names, or null for a bare
 * specifier. An absolute specifier is a filesystem path here (the alias
 * rewrite produces them), not the app-root path a browser specifier is, so it
 * is taken as is rather than through `resolveImport`.
 * @param {string} spec
 * @param {string} file
 * @param {string} appDir
 * @returns {string | null}
 */
function serverTarget(spec, file, appDir) {
  const bare = spec.split('?')[0];
  if (isAbsolute(bare)) return bare;
  if (!bare.startsWith('.') && !expandImportAlias(bare, appDir)) return null;
  return resolveImport(bare, file, appDir);
}
