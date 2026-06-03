/**
 * Content-hash asset URLs for immutable caching (issue #243, feature 1).
 *
 * The problem: every served app module (`.js` / `.ts`) and `public/` asset
 * ships `Cache-Control: public, max-age=3600` because its URL is
 * un-versioned. The framework cannot serve them `immutable` (1 year) without
 * a per-file fingerprint, because a deploy that changes a module's bytes
 * keeps the SAME url, so a year-long immutable copy at an edge CDN would
 * silently brick the next deploy (a real regression, see the core-serve note
 * in `dev.js`). The importmap build id (`publishedBuildId`) does NOT change
 * on an app-module byte change, so it cannot be the per-asset fingerprint.
 *
 * The fix: a PER-FILE content hash computed at serve time (no build step).
 *
 *   1. `withAssetHash(url)` appends `?v=<hash>` to a framework-emitted
 *      SAME-ORIGIN absolute url (the importmap targets, the modulepreload
 *      hrefs, the boot script specifiers). It is a NO-OP in DEV (so dev
 *      output is byte-identical to before), a NO-OP for a CROSS-ORIGIN url
 *      (a `https://` jspm vendor target, which jspm already versions and
 *      which carries SRI keyed by the un-hashed url), and for a same-origin
 *      `/`-rooted url it resolves the underlying file, looks up its hash, and
 *      appends `?v=<hash>`.
 *
 *   2. The serve path (`dev.js`) serves any request carrying a `?v` query
 *      `Cache-Control: public, max-age=31536000, immutable`. An un-fingerprinted
 *      request keeps the 1h fallback. Dev stays `no-cache` regardless.
 *
 * Deploy-busts invariant: a deploy that changes a module's bytes changes its
 * hash, so its emitted url changes, so a returning client fetches the new url
 * instead of serving the stale immutable copy.
 *
 * The hash is a short prefix of a sha-256 over the file BYTES, computed
 * synchronously (so the emit hot path stays sync) and memoized in a
 * `Map<absPath, hash>`. The cache is cleared on the fs.watch rebuild (dev) so
 * a changed file re-hashes, wired next to `clearVendorCache` in `dev.js`.
 *
 * @module asset-hash
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * Length of the emitted hex hash. 12 hex chars (48 bits) is plenty to
 * distinguish builds of one file while keeping the url short. Collisions
 * across DIFFERENT bytes of the SAME url are the only failure mode, and at
 * 48 bits that is astronomically unlikely; a same-bytes-same-hash is exactly
 * the desired behaviour.
 *
 * @type {number}
 */
const HASH_LEN = 12;

/**
 * Whether fingerprinting is active. Off in dev (so dev output is
 * byte-identical to before this feature) and off until `setAssetRoots`
 * binds the app + core roots. Both gates make `withAssetHash` a pure
 * pass-through, which is what keeps the inert case byte-identical.
 *
 * @type {boolean}
 */
let _enabled = false;

/** @type {string} */
let _appDir = '';
/** @type {string} */
let _coreDir = '';

/**
 * A fingerprint of the current elision verdict (the elidable-component +
 * inert-route set), folded into an APP MODULE's hash. An app module's SERVED
 * body is not its raw source: `dev.js` runs `elideImportsFromSource` over it,
 * stripping a side-effect import of a display-only component. That strip is a
 * property of the IMPORTED component's verdict, not of the importer's own
 * bytes, so when a component flips display-only <-> interactive the importer's
 * served body changes while its source is byte-identical. Hashing the source
 * alone would keep the same `?v`, and a returning client would hold the stale
 * immutable copy (the now-interactive component never imported, so never
 * hydrated) for the full immutable TTL. Folding the verdict fingerprint into
 * the hash busts every app module's url on a verdict change, so the stale-copy
 * window cannot open. Empty when no module is elidable (then an app module's
 * hash is exactly `sha256(bytes)`), and only mixed for files under `_appDir`
 * (core / public assets are never elision-transformed). Set by `dev.js`'s
 * `ensureReady` after `analyzeElision`, re-set on every rebuild.
 *
 * @type {string}
 */
let _elisionFp = '';

/**
 * Memoized per-file content hash. Keyed by absolute path. Cleared on the
 * fs.watch rebuild so a changed file re-hashes.
 *
 * @type {Map<string, string>}
 */
const _hashCache = new Map();

/**
 * Bind the asset-hash module to the app + core install roots and enable
 * fingerprinting. Called once at boot by `dev.js` for a PROD server only
 * (`dev === false`); a dev server never calls this, so `_enabled` stays
 * false and `withAssetHash` is a pure no-op.
 *
 * @param {{ appDir: string, coreDir: string, enabled: boolean }} opts
 * @returns {void}
 */
export function setAssetRoots(opts) {
  _appDir = opts.appDir || '';
  _coreDir = opts.coreDir || '';
  _enabled = !!opts.enabled && !!_appDir && !!_coreDir;
}

/**
 * Set the elision-verdict fingerprint folded into app-module hashes (see
 * `_elisionFp`). A no-op when the value is unchanged; on a change it clears the
 * hash cache so every app module re-hashes against the new verdict. `dev.js`
 * calls this from `ensureReady` after `analyzeElision` (and again on each
 * rebuild), passing a stable digest of the elidable-component + inert-route set
 * (or `''` when nothing is elidable).
 *
 * @param {string} fp
 * @returns {void}
 */
export function setElisionFingerprint(fp) {
  const next = fp || '';
  if (next === _elisionFp) return;
  _elisionFp = next;
  _hashCache.clear();
}

/**
 * Clear the per-file hash cache. Wired into the dev rebuild path next to
 * `clearVendorCache` so a changed file re-hashes (dev never fingerprints,
 * but a future serve that re-derives the map after a rebuild stays correct,
 * and tests rely on the clear to observe a re-hash after a byte change).
 *
 * @returns {void}
 */
export function clearAssetHashCache() {
  _hashCache.clear();
}

/**
 * Compute (and memoize) the short content hash for an absolute file path.
 * Returns `''` when the file cannot be read, so the caller emits the url
 * UNCHANGED (no `?v`), failing safe to the 1h fallback rather than breaking
 * the url.
 *
 * @param {string} absPath
 * @returns {string} the short hex hash, or `''` on a read failure
 */
export function assetHashFor(absPath) {
  const cached = _hashCache.get(absPath);
  if (cached !== undefined) return cached;
  try {
    const bytes = readFileSync(absPath);
    const h = createHash('sha256').update(bytes);
    // An app module's served body is elision-transformed, so fold the verdict
    // fingerprint in (see `_elisionFp`). Core / public files are never
    // transformed, so they hash over their bytes alone. Empty fp leaves an app
    // module's hash at exactly `sha256(bytes)`.
    if (_elisionFp && _appDir && absPath.startsWith(_appDir + sep)) {
      h.update('\0');
      h.update(_elisionFp);
    }
    const hash = h.digest('hex').slice(0, HASH_LEN);
    _hashCache.set(absPath, hash);
    return hash;
  } catch {
    // A transient read failure is NOT memoized (returning '' fails safe to the
    // 1h fallback), so a later emit re-attempts instead of pinning the file to
    // the fallback for the process lifetime.
    return '';
  }
}

/**
 * Resolve a framework-emitted same-origin absolute url to the absolute file
 * path it serves, or `null` when the url does not map to a fingerprintable
 * same-origin file. Mirrors the serve-path resolution in `dev.js`:
 *   - `/__webjs/core/<rel>`  -> `<coreDir>/<rel>`  (the core runtime)
 *   - any other `/<rel>`     -> `<appDir>/<rel>`   (app modules + public/)
 *
 * Containment-checked against the respective root (the same trailing-separator
 * boundary guard the serve path uses), so a `..`-laden url that escapes the
 * root resolves to `null` and is emitted unchanged.
 *
 * The `?v` query / `#hash` are stripped before resolution (a freshly-emitted
 * url never carries one, but stay robust). A cross-origin / protocol-relative
 * / relative url is NOT a `/`-rooted same-origin path and returns `null`.
 *
 * @param {string} url
 * @returns {string | null}
 */
function resolveUrlToFile(url) {
  // Only a single-leading-slash same-origin path. A protocol-relative
  // `//host` or an absolute `scheme://` url (a vendor CDN target) is not ours.
  if (typeof url !== 'string' || url[0] !== '/' || url[1] === '/') return null;
  // Strip any query / hash before mapping to a file.
  let pathname = url;
  const q = pathname.indexOf('?');
  if (q !== -1) pathname = pathname.slice(0, q);
  const h = pathname.indexOf('#');
  if (h !== -1) pathname = pathname.slice(0, h);
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* keep raw */ }

  const CORE_PREFIX = '/__webjs/core/';
  if (decoded.startsWith(CORE_PREFIX)) {
    const rel = decoded.slice(CORE_PREFIX.length);
    const abs = resolve(_coreDir, rel);
    if (abs !== _coreDir && !abs.startsWith(_coreDir + sep)) return null;
    return abs;
  }
  // A `/__webjs/*` path that is not a core module (e.g. a downloaded
  // `/__webjs/vendor/<pkg>@<ver>.js` bundle) is already version-named, so it
  // does not need fingerprinting and is left unchanged.
  if (decoded.startsWith('/__webjs/')) return null;

  const abs = join(_appDir, decoded);
  if (abs !== _appDir && !abs.startsWith(_appDir + sep)) return null;
  return abs;
}

/**
 * Append `?v=<content-hash>` to a framework-emitted same-origin absolute url
 * for immutable caching. Composes with `withBasePath`: call ORDER is basePath
 * then `withAssetHash` (the `?v` is a query the ingress base-path strip never
 * touches, and the file resolution here works on the post-basePath url because
 * a `<basePath>/app/foo.js` still resolves under `_appDir` only after the
 * basePath is stripped, so callers apply `withAssetHash` to the ALREADY
 * base-path-prefixed url and pass the base path so we strip it for resolution).
 *
 * No-op when:
 *   - fingerprinting is disabled (dev, or roots unset) -> byte-identical output;
 *   - the url is cross-origin / protocol-relative / relative (a vendor CDN
 *     target keeps its exact url, so its SRI key, computed over the un-hashed
 *     url in #235, still matches, and jspm already versions it);
 *   - the url does not resolve to a readable same-origin file (fail-safe to the
 *     1h fallback).
 *
 * @param {string} url   the (possibly base-path-prefixed) same-origin url
 * @param {string} [basePath]  the active base path, stripped before file resolution
 * @returns {string}
 */
export function withAssetHash(url, basePath = '') {
  if (!_enabled) return url;
  if (typeof url !== 'string' || url[0] !== '/' || url[1] === '/') return url;
  // Resolve against the file system using the base-path-stripped url, so a
  // sub-path-deployed `<basePath>/app/foo.js` maps to `<appDir>/app/foo.js`.
  let forResolve = url;
  if (basePath && url.startsWith(basePath + '/')) {
    forResolve = url.slice(basePath.length);
  } else if (basePath && url === basePath) {
    forResolve = '/';
  }
  const abs = resolveUrlToFile(forResolve);
  if (!abs) return url;
  const hash = assetHashFor(abs);
  if (!hash) return url;
  // The freshly-emitted url never already carries a query, but stay robust:
  // merge with `&` if one is somehow present.
  const sepChar = url.includes('?') ? '&' : '?';
  return `${url}${sepChar}v=${hash}`;
}
