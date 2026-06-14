/**
 * Pluggable TypeScript stripper (#508), the one seam that lets webjs run on both
 * Node and Bun.
 *
 * webjs serves `.ts` / `.mts` source to the browser as JavaScript by ERASING the
 * type syntax in place (position-preserving whitespace replacement, so no
 * sourcemap is shipped and stack traces stay byte-exact). On Node 24+ that is the
 * built-in `module.stripTypeScriptTypes`. Bun has no such built-in, so this
 * module picks the backend at boot:
 *
 *   - **Node 24+**: the built-in `module.stripTypeScriptTypes` (zero deps, the
 *     default; nothing about the Node path changes).
 *   - **Bun (or any runtime lacking the built-in)**: `amaro`, lazily imported.
 *     Node's built-in is itself a thin wrapper over `amaro`'s `strip-only` mode,
 *     so the output is BYTE-IDENTICAL and equally position-preserving. `amaro` is
 *     an `optionalDependency` of `@webjsdev/server`: a Node-only install that
 *     prunes optionals still runs (it never loads amaro), while a Bun install
 *     gets it.
 *
 * `WEBJS_TS_STRIPPER=builtin|amaro` forces a backend (used by the tests to
 * exercise the amaro path under Node, and an escape hatch).
 *
 * Erasable TypeScript only, either way: non-erasable syntax (`enum`, value
 * `namespace`, parameter properties, legacy decorators, `import = require`)
 * throws at strip time, which the `erasable-typescript-only` /
 * `no-non-erasable-typescript` lint rules catch at edit time.
 */
// Namespace import, NOT `import { stripTypeScriptTypes }`. On Node < 22.13 the
// named export does not exist, and a NAMED import of a missing builtin export is
// a LINK-TIME SyntaxError that fires before any module body runs, which would
// defeat the Node-version preflight by crashing the import of @webjsdev/server
// itself. A namespace import links on every runtime (the property is just
// `undefined` where absent, e.g. Bun) and we branch on it at runtime instead.
import * as nodeModule from 'node:module';

// Suppress the one-shot ExperimentalWarning Node prints the first time
// `stripTypeScriptTypes` is called (the API is committed per Node 24's release
// notes; the warning is a holdover). Installed here, co-located with the strip
// call, so it covers every consumer of this module (dev.js, the CLI, tests),
// not just the dev server. Every other warning passes through untouched.
const _origEmitWarning = process.emitWarning.bind(process);
process.emitWarning = function (warning, type, code, ctor) {
  const msg = warning && warning.message ? warning.message : String(warning);
  if (
    (type === 'ExperimentalWarning' || (warning && warning.name === 'ExperimentalWarning')) &&
    msg.includes('stripTypeScriptTypes')
  ) {
    return;
  }
  return _origEmitWarning(warning, type, code, ctor);
};

/** @typedef {{ fn: (source: string) => string, name: 'builtin' | 'amaro' }} Stripper */

/** @type {Stripper | null} */
let _strip = null;
/** @type {Promise<Stripper> | null} */
let _resolving = null;

/** Forced backend from the env, or '' for auto-detect. */
function forcedBackend() {
  const v = String(process.env.WEBJS_TS_STRIPPER || '').toLowerCase().trim();
  return v === 'builtin' || v === 'amaro' ? v : '';
}

/**
 * Resolve the active stripper backend once. Auto-detects (built-in when present,
 * else amaro); honors a `WEBJS_TS_STRIPPER` override.
 * @returns {Promise<Stripper>}
 */
async function resolve() {
  const forced = forcedBackend();
  const hasBuiltin = typeof nodeModule.stripTypeScriptTypes === 'function';
  if (forced !== 'amaro' && (forced === 'builtin' || hasBuiltin)) {
    if (forced === 'builtin' && !hasBuiltin) {
      throw new Error('WEBJS_TS_STRIPPER=builtin but module.stripTypeScriptTypes is unavailable on this runtime.');
    }
    return { fn: (source) => nodeModule.stripTypeScriptTypes(source), name: 'builtin' };
  }
  // amaro backend (Bun, a Node without the built-in, or forced).
  let amaro;
  try {
    amaro = await import('amaro');
  } catch (e) {
    const why = e && e.message ? e.message : String(e);
    throw new Error(
      "webjs needs a TypeScript stripper: this runtime has no built-in " +
      "`module.stripTypeScriptTypes` (e.g. Bun) and the `amaro` fallback failed " +
      "to load. Install `amaro` (it is an optionalDependency of @webjsdev/server) " +
      "to run webjs here. Underlying: " + why,
    );
  }
  const tx = amaro.transformSync || (amaro.default && amaro.default.transformSync);
  if (typeof tx !== 'function') {
    throw new Error('webjs: the resolved `amaro` module has no `transformSync` export.');
  }
  return { fn: (source) => tx(source, { mode: 'strip-only' }).code, name: 'amaro' };
}

/**
 * Resolve (once, memoized) and return the active stripper. Call at boot so the
 * backend is ready and a missing-amaro error surfaces early rather than on the
 * first `.ts` request.
 * @returns {Promise<Stripper>}
 */
export async function ensureStripper() {
  if (_strip) return _strip;
  // Clear `_resolving` on BOTH settle paths so a failed resolve (e.g. a missing
  // amaro on a runtime lacking the built-in) re-detects on the next call instead
  // of caching the rejection forever (self-healing, matching `__resetStripper`).
  if (!_resolving) {
    _resolving = resolve().then(
      (s) => { _strip = s; _resolving = null; return s; },
      (e) => { _resolving = null; throw e; },
    );
  }
  return _resolving;
}

/**
 * Strip TypeScript types from `source`, resolving the backend on first use.
 * @param {string} source
 * @returns {Promise<string>}
 */
export async function stripTypeScript(source) {
  const s = _strip || await ensureStripper();
  return s.fn(source);
}

/** The active backend name, or null before resolution (diagnostics / tests). */
export function stripperName() {
  return _strip ? _strip.name : null;
}

/** Test seam: forget the resolved backend so the next call re-detects. */
export function __resetStripper() {
  _strip = null;
  _resolving = null;
}
