/**
 * SSR action-result seeding (#472), follow-up to async render (#469).
 *
 * When a component's `async render()` does a bare `const u = await getUser(id)`
 * during SSR, the action runs server-side and its result is baked into the
 * first paint. On HYDRATION the client re-runs `async render()`, which re-calls
 * the action over RPC. Stale-while-revalidate (#470) hides the flicker, but the
 * redundant round-trip still happens once per async component on first load.
 *
 * This module captures each `'use server'` action result invoked DURING SSR and
 * serializes it into the page (one `<script type="application/json">` block).
 * The generated client RPC stub (`actions.js`) reads that seed on its FIRST call
 * with matching args and resolves without the RPC; a later refetch / arg-change
 * goes to the network as normal.
 *
 * ## How the capture works (no source transform, no build step)
 *
 * The framework promise is "what you write is what you see in the browser source
 * tab", not "what you write is the exact function object that runs server-side"
 * (the RPC stub already replaces the action on the client). So we install a
 * SERVER-SIDE transparent facade via Node's synchronous `module.registerHooks`
 * (Node 24+, main-thread): for a `'use server'` `*.server.*` module, the load
 * hook returns a facade that re-exports each function wrapped in a `Proxy`. The
 * Proxy records `(file, fn, args) -> result` into an ambient `AsyncLocalStorage`
 * collector WHENEVER a collector is active, and is a pure passthrough otherwise.
 *
 * Recording is gated entirely by the ALS collector, which is established ONLY
 * around the SSR page render (`collectSeeds`). The RPC endpoint path runs with
 * NO collector, so the Proxy is a transparent passthrough there. The browser
 * NEVER sees this module (it sees the RPC stub), and the on-disk source is
 * unchanged, so the source-fidelity promise holds.
 *
 * ## Safety
 *
 * A key HIT returns the exact SSR value (correct by construction); a key MISS
 * degrades to a normal RPC (never wrong data, only a missed optimization). The
 * whole feature is therefore fail-open: any failure in the hook, the facade, or
 * the serializer simply skips seeding and the client re-fetches as before.
 *
 * Disabled by default-off of the flag removes the hook entirely, so module
 * loading is byte-identical to before the feature.
 */

import * as nodeModule from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stringify } from '@webjsdev/core';
import { hashFile } from './actions.js';
import { isStreamable } from './action-stream.js';

/** Ambient per-render seed collector. `Map<key, value>` or undefined. */
const als = new AsyncLocalStorage();

/** Set once the load hook is installed (the flag is on at boot). */
let _enabled = false;
/** Idempotency guard: `module.registerHooks` must run at most once. */
let _registered = false;

/** Memoized `absPath -> hash` so a hot action call does not re-hash per call. */
const _hashCache = new Map();

/** This module's own URL, embedded into the generated facade's import. */
const SELF_URL = import.meta.url;

/**
 * Whether seeding is active (the load hook is installed). The SSR emitter
 * (`ssr.js`) checks this so a disabled app does ZERO extra work and produces
 * byte-identical output.
 * @returns {boolean}
 */
export function seedingEnabled() {
  return _enabled;
}

/**
 * Compute (and memoize) the action file's hash the SAME way the RPC stub /
 * action index do (`hashFile` over the absolute path string), so the seed key
 * the server emits matches the key the client stub looks up. A path mismatch
 * (e.g. a symlinked appDir whose realpath differs) only yields a key MISS,
 * which safely degrades to a normal RPC.
 * @param {string} absPath
 * @returns {Promise<string>}
 */
async function hashFor(absPath) {
  let h = _hashCache.get(absPath);
  if (h === undefined) {
    h = await hashFile(absPath);
    _hashCache.set(absPath, h);
  }
  return h;
}

/**
 * Record one action call's resolved result into the active collector, keyed
 * `hash/fn/stringify(args)`. The args key uses the SAME serializer the client
 * stub uses to form its lookup key, so they match for identical args. Never
 * throws into the caller's render: a serialization failure just drops the seed
 * (the client re-fetches).
 * @param {Map<string, unknown>} collector
 * @param {string} file absolute action file path
 * @param {string} fnName
 * @param {unknown[]} args
 * @param {unknown} value resolved action result
 */
async function recordSeed(collector, file, fnName, args, value) {
  // A streamed result (#489) is not a serializer-safe value: recording it would
  // make buildSeedScript's stringify throw and drop EVERY seed on the page. A
  // streamed action is never seeded; the client streams it fresh on each call.
  if (isStreamable(value)) return;
  try {
    const hash = await hashFor(file);
    const argsKey = await stringify(args);
    collector.set(`${hash}/${fnName}/${argsKey}`, value);
  } catch {
    // Drop the seed; the client stub falls back to a normal RPC.
  }
}

/**
 * Wrap one exported action function so that, when a collector is active, its
 * resolved result is recorded. Outside a collector (the RPC endpoint path) it is
 * a transparent passthrough. Non-functions (a `const VERSION = '1.0'` export)
 * pass through untouched, and the Proxy forwards property reads, so `expose()` /
 * `validateInput()` metadata stored on the function (`__webjsHttp`) still
 * resolves through `getExposed()`.
 * @param {string} file absolute action file path
 * @param {string} fnName
 * @param {unknown} orig
 * @returns {unknown}
 */
export function __seedWrap(file, fnName, orig) {
  if (typeof orig !== 'function') return orig;
  return new Proxy(orig, {
    apply(target, thisArg, args) {
      const collector = als.getStore();
      const result = Reflect.apply(target, thisArg, args);
      if (!collector) return result;
      if (result && typeof result.then === 'function') {
        // Record the RESOLVED value, and return the same value to the caller so
        // the awaiting `async render()` gets its data unchanged.
        return result.then(async (value) => {
          await recordSeed(collector, file, fnName, args, value);
          return value;
        });
      }
      // A synchronous return (rare for an action): record best-effort. The
      // record is async but fire-and-forget here; collectSeeds awaits the
      // render's own microtasks, and a sync action that the render awaits will
      // have settled the record before the render resolves.
      recordSeed(collector, file, fnName, args, result);
      return result;
    },
  });
}

/**
 * Extract the names of every named export from an action module's source, used
 * to generate the facade's `export const NAME = wrap(...)` lines. Conservative:
 * a name it misses simply is not wrapped (no seed for it, RPC fallback). A
 * `export *` re-export cannot be enumerated statically, so its presence makes
 * the caller skip faceting that module entirely (passthrough = no seeding for
 * it), never producing a broken facade.
 * @param {string} src
 * @returns {{ names: string[], hasDefault: boolean, hasStar: boolean } }
 */
export function extractExportNames(src) {
  const names = new Set();
  let m;
  const reFn = /\bexport\s+(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/g;
  while ((m = reFn.exec(src))) names.add(m[1]);
  const reVar = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = reVar.exec(src))) names.add(m[1]);
  const reClass = /\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = reClass.exec(src))) names.add(m[1]);
  const reList = /\bexport\s*\{([^}]*)\}/g;
  while ((m = reList.exec(src))) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      // `a` or `a as b` (the EXPORTED name is what an importer binds).
      const as = seg.split(/\s+as\s+/);
      const exported = (as[1] || as[0]).trim();
      if (/^[A-Za-z_$][\w$]*$/.test(exported) && exported !== 'default') names.add(exported);
      else if (exported === 'default') names.add('__default__');
    }
  }
  const hasDefault = /\bexport\s+default\b/.test(src) || names.delete('__default__');
  const hasStar = /\bexport\s*\*/.test(src);
  return { names: [...names], hasDefault, hasStar };
}

/**
 * Build the facade module source for a `'use server'` action module: it imports
 * the REAL module via a `?webjs-seed-orig` query (which the hook passes through
 * unwrapped) and re-exports each function wrapped through `__seedWrap`.
 * @param {string} origUrl the real module URL, WITHOUT the seed query
 * @param {string} absPath the real module's absolute file path (the hash basis)
 * @param {{ names: string[], hasDefault: boolean }} exports
 * @returns {string}
 */
function buildFacade(origUrl, absPath, exports) {
  const sep = origUrl.includes('?') ? '&' : '?';
  const origSpec = JSON.stringify(origUrl + sep + 'webjs-seed-orig');
  const file = JSON.stringify(absPath);
  let out = `import * as __orig from ${origSpec};\n`;
  out += `import { __seedWrap as __w } from ${JSON.stringify(SELF_URL)};\n`;
  for (const n of exports.names) {
    const k = JSON.stringify(n);
    out += `export const ${n} = __w(${file}, ${k}, __orig[${k}]);\n`;
  }
  if (exports.hasDefault) {
    out += `export default __w(${file}, 'default', __orig.default);\n`;
  }
  return out;
}

/** Match `*.server.{js,ts,mjs,mts}` (optionally with a query). */
const SERVER_FILE_RE = /\.server\.m?[jt]s(\?|$)/;
/** The `'use server'` directive in the file head. */
const USE_SERVER_RE = /^\s*(['"])use server\1\s*;?\s*$/m;

/**
 * The synchronous `module.registerHooks` load hook. For a `'use server'`
 * `*.server.*` module it returns a wrapping facade; for everything else
 * (including the `?webjs-seed-orig` passthrough of the real module) it defers to
 * `nextLoad`. Fail-open: any error defers to `nextLoad`, so a load that the hook
 * cannot facade simply runs unwrapped (no seeding for it).
 * @param {string} url
 * @param {object} context
 * @param {(u: string, c: object) => any} nextLoad
 */
function seedLoadHook(url, context, nextLoad) {
  try {
    if (!SERVER_FILE_RE.test(url)) return nextLoad(url, context);
    // The facade's own `?webjs-seed-orig` import must load the REAL module.
    if (url.includes('webjs-seed-orig')) return nextLoad(url, context);
    const absPath = fileURLToPath(url.split('?')[0]);
    const src = readFileSync(absPath, 'utf8');
    const head = src.split('\n').slice(0, 5).join('\n');
    if (!USE_SERVER_RE.test(head)) return nextLoad(url, context);
    const exports = extractExportNames(src);
    // A `export *` re-export cannot be enumerated; skip faceting (passthrough)
    // so we never emit a facade that silently drops re-exported bindings.
    if (exports.hasStar) return nextLoad(url, context);
    if (exports.names.length === 0 && !exports.hasDefault) return nextLoad(url, context);
    const source = buildFacade(url, absPath, exports);
    return { source, format: 'module', shortCircuit: true };
  } catch {
    return nextLoad(url, context);
  }
}

/**
 * Install the seed load hook (idempotent). Called once at boot from `dev.js`
 * when seeding is enabled, BEFORE any action module is imported (ESM caches by
 * URL, so a module loaded before the hook would never be faceted). A no-op on a
 * second call.
 */
export function registerSeedHooks() {
  _enabled = true;
  if (_registered) return;
  _registered = true;
  nodeModule.registerHooks({ load: seedLoadHook });
}

/**
 * Run `fn` (the page render) inside a fresh ambient seed collector and return
 * both its value and the collected seeds. Every action call made during the
 * render (however deeply nested in the SSR walker / async render chain) records
 * into this collector via the ambient ALS.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ value: T, collector: Map<string, unknown> }>}
 */
export async function collectSeeds(fn) {
  const collector = new Map();
  const value = await als.run(collector, fn);
  return { value, collector };
}

/**
 * Serialize a collector into a `<script type="application/json">` block to embed
 * in the page. Returns '' for an empty collector (so a render with no seeded
 * action is byte-identical to before). The payload is rich-serialized (same wire
 * format the RPC stub's `parse` reads) and HTML-escaped so it can never break out
 * of the script element. A `type="application/json"` script is DATA, not
 * executable JS, so it needs no CSP nonce.
 * @param {Map<string, unknown>} collector
 * @returns {Promise<string>}
 */
export async function buildSeedScript(collector) {
  if (!collector || collector.size === 0) return '';
  try {
    const obj = {};
    for (const [k, v] of collector) obj[k] = v;
    const payload = await stringify(obj);
    const safe = payload
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return `<script type="application/json" id="__webjs-seeds">${safe}</script>`;
  } catch {
    return '';
  }
}

/** Test seam: clear the per-file hash memo (e.g. between fixtures). */
export function __clearSeedHashCache() {
  _hashCache.clear();
}
