/**
 * The SSR half of dev source locations (#1499): a module load hook that runs
 * `annotateSourceLocations` over every app module the SERVER imports, so SSR
 * output carries the same `data-webjs-src` attributes the browser-served copy
 * of the module renders (the browser half is in `dev/serve.js`).
 *
 * Installed only by the dev handler, only when `WEBJS_SOURCE_LOCATIONS=1`, and
 * before any app module is imported (ESM caches by URL, so a module loaded
 * first would stay unannotated until its next dev cache-bust re-import). The
 * hook is process-global and cannot be uninstalled, so it is scoped to the app
 * roots registered with it: a module outside every registered root is never
 * touched.
 *
 * Node: `module.registerHooks` with a `load` hook that calls `nextLoad` FIRST
 * and transforms its result. That keeps it chained with the `'use server'`
 * seed hook (which it never sees anyway: `*.server.*` modules are excluded) and
 * keeps Node's own TypeScript stripping, since a `.ts` result keeps its
 * `module-typescript` format and Node strips it after the hook.
 *
 * Bun: `Bun.plugin` `onLoad`. A Bun `onLoad` must return contents for every
 * path its filter matches, and when two plugins match the same path the first
 * registered wins, so the filter itself excludes `node_modules` and `*.server.*`
 * (a lookahead, which Bun's filter honours). The seed plugin therefore keeps
 * every server module whatever the registration order.
 */
import * as nodeModule from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { serverRuntime } from './listener-core.js';
import {
  annotateSourceLocations,
  isSourceLocationCandidate,
  sourceLocationFile,
} from './dev-source-locations.js';

/** App roots the hook annotates. */
const _roots = new Set();
let _installed = false;

/**
 * The registered app root containing `abs`, or null.
 * @param {string} abs
 * @returns {string | null}
 */
function rootFor(abs) {
  for (const root of _roots) {
    const rel = relative(root, abs);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return root;
  }
  return null;
}

/**
 * Annotate one module's source, or return null when it is not a candidate.
 * @param {string} abs absolute path, no query
 * @param {string} src
 * @returns {string | null}
 */
export function transformForSsr(abs, src) {
  const root = rootFor(abs);
  if (!root || !isSourceLocationCandidate(abs, root)) return null;
  return annotateSourceLocations(src, sourceLocationFile(abs, root));
}

/**
 * Node `load` hook. Fail-open: any surprise returns `nextLoad`'s result as is.
 * @param {string} url
 * @param {object} context
 * @param {(u: string, c: object) => any} nextLoad
 */
function sourceLocationLoadHook(url, context, nextLoad) {
  const result = nextLoad(url, context);
  try {
    if (!url.startsWith('file:') || !result || result.source == null) return result;
    if (result.format !== 'module' && result.format !== 'module-typescript') return result;
    const abs = fileURLToPath(url.split('?')[0]);
    const src = typeof result.source === 'string'
      ? result.source
      : Buffer.from(result.source).toString('utf8');
    const out = transformForSsr(abs, src);
    if (out == null || out === src) return result;
    return { ...result, source: out };
  } catch {
    return result;
  }
}

/**
 * Escape a string for use inside a RegExp.
 * @param {string} s
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Register `appDir` with the SSR source-location hook, installing the hook on
 * the first call. Idempotent per root.
 *
 * @param {string} appDir absolute app root
 * @returns {boolean} whether the hook is (now) installed
 */
export function registerSourceLocationHook(appDir) {
  if (_roots.has(appDir)) return _installed;
  _roots.add(appDir);
  if (serverRuntime() === 'bun') {
    // One plugin per root, each with a filter that can never match a
    // `node_modules` or `*.server.*` path (see the module comment).
    const filter = new RegExp(
      '^' + escapeRe(appDir) + '/(?:(?!node_modules/)(?!.*\\.server\\.).)*\\.m?[jt]s(\\?.*)?$',
    );
    /** @type {any} */ (globalThis).Bun.plugin({
      name: 'webjs-source-locations',
      setup(build) {
        build.onLoad({ filter }, async (args) => {
          const abs = args.path.split('?')[0];
          const loader = /\.m?ts$/.test(abs) ? 'ts' : 'js';
          const src = readFileSync(abs, 'utf8');
          let contents = src;
          try {
            contents = transformForSsr(abs, src) ?? src;
          } catch { /* fail open: the raw module */ }
          return { contents, loader };
        });
      },
    });
    _installed = true;
    return true;
  }
  if (_installed) return true;
  if (typeof nodeModule.registerHooks !== 'function') {
    console.warn('[webjs] WEBJS_SOURCE_LOCATIONS: this runtime has no module.registerHooks, so SSR output carries no data-webjs-src (client renders still do).');
    return false;
  }
  nodeModule.registerHooks({ load: sourceLocationLoadHook });
  _installed = true;
  return true;
}
