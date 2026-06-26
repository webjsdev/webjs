/**
 * Pin Bun zero-install dependency versions by rewriting bare import specifiers
 * to inline-versioned ones (#685).
 *
 * Under Bun zero-install (`bun run dev` / `start` via the `webjs-bun.mjs`
 * bootstrap, no `node_modules`), Bun's auto-install fetches `latest` for a bare
 * `import 'zod'`, ignoring package.json and `bun.lock` (#684). But Bun honors an
 * INLINE version in the specifier (`import 'zod@1.0.0'`), and that survives the
 * `onResolve` bypass because it is part of the specifier the loader receives. So
 * an `onLoad` transform that rewrites `import 'zod'` to `import 'zod@<pinned>'`
 * (the version from package.json / `bun.lock`) makes auto-install fetch the
 * pinned version. This module is the runtime-neutral, unit-testable core; the
 * Bun `onLoad` glue (which supplies `Bun.Transpiler().scanImports` and the
 * resolved dep versions) lives in the Bun-side plugin.
 *
 * The specifier set comes from `Bun.Transpiler.scanImports`, which is
 * AST-accurate (a plain string that merely looks like a specifier is NOT
 * listed), so we never rewrite a non-import string. The in-source replacement is
 * additionally anchored on the `from` / `import` / `require` keyword so an
 * identical non-import string literal elsewhere is left alone.
 */

/**
 * Resolve the version to pin each DECLARED dependency to.
 *
 * Two callers, two needs, selected by `prefer`:
 *
 * - `prefer: 'exact'` (default): the `bun.lock` exact wins when present (precise
 *   and reproducible), else the inline-safe declared range. This is the right
 *   source for `vendor.js` `declaredVendorVersions` (#699) and `resolveBin`
 *   pinning, which want the reproducible exact, and it is also what an INSTALLED
 *   app would resolve from disk.
 *
 * - `prefer: 'range'`: the ZERO-INSTALL serve path. Bun's RUNTIME auto-install is
 *   latest-only: an inline EXACT, NON-LATEST specifier ENOENTs on a cold cache
 *   (proven; e.g. `is-odd@2.0.0`, `drizzle-orm@1.0.0-rc.3`), so emitting the
 *   `bun.lock` exact would break the moment the exact is no longer `latest`. An
 *   inline RANGE (`zod@^3.20.0`), by contrast, resolves latest-in-range
 *   correctly. So for the auto-install serve path we forward the DECLARED range
 *   for an inline-safe range, and fall back to the lock exact only for a dep
 *   whose declared value is itself exact (nothing better to emit). Reproducibility
 *   on this path is NOT achievable on Bun (it would require the latest-only
 *   auto-install to fetch a non-latest version); a reproducible dep is served via
 *   the transparent `bun install` + installed mode instead (see `classifyBunDeps`
 *   and `bun-bg-install.js`).
 *
 * Only declared deps are returned, so the rewrite never pins a transitive dep
 * through an app import (those follow from the pinned direct deps' own manifests).
 *
 * A protocol range (`workspace:`, `file:`, `link:`, git / URL) and a bare
 * wildcard (`*`, `x`, empty) are NOT valid inline specifiers, so they are left
 * BARE (resolving to latest, exactly as before this feature, never to a broken
 * specifier).
 *
 * Runtime-neutral: takes the two file contents (the Bun glue reads them via
 * `Bun.file`), so this stays unit-testable on Node.
 *
 * @param {string} pkgJsonText  package.json contents
 * @param {string | null} [bunLockText]  bun.lock contents, when present
 * @param {{ prefer?: 'exact' | 'range' }} [opts]  source preference (default `'exact'`)
 * @returns {Record<string, string>}  package name -> version
 */
export function resolveDepVersions(pkgJsonText, bunLockText, opts) {
  const prefer = (opts && opts.prefer) || 'exact';
  /** @type {Record<string, string>} */
  const out = {};
  let pkg;
  try { pkg = JSON.parse(pkgJsonText); } catch { return out; }
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };

  // bun.lock pins each package as `"name": ["name@<exact>", ...]`. Extract the
  // exact version for each DECLARED dep, anchored on its name so a substring
  // match cannot cross to another package. This is the precise source.
  /** @type {Record<string, string>} */
  const lockExact = {};
  if (bunLockText) {
    for (const name of Object.keys(declared)) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = bunLockText.match(new RegExp('"' + esc + '"\\s*:\\s*\\[\\s*"' + esc + '@([^"]+)"'));
      if (m && isExactVersion(m[1])) lockExact[name] = m[1];
    }
  }

  for (const [name, range] of Object.entries(declared)) {
    if (prefer === 'range') {
      // Zero-install serve path. Forward the DECLARED range (resolves
      // latest-in-range under Bun auto-install) when inline-safe; only fall
      // back to the lock exact for a dep whose declared value is itself exact.
      if (isInlineableVersion(range)) out[name] = range;
      else if (lockExact[name] && isExactVersion(range)) out[name] = lockExact[name];
    } else {
      // Reproducible / installed-equivalent source. bun.lock exact wins,
      // otherwise the inline-safe declared range.
      if (lockExact[name]) out[name] = lockExact[name];
      else if (isInlineableVersion(range)) out[name] = range;
    }
  }
  return out;
}

/**
 * Classify the app's DECLARED deps for the Bun boot decision, WITHOUT any
 * network (so it runs on the latency-sensitive boot path). Bun runtime
 * auto-install is latest-only, so a dep can be served zero-install ONLY when an
 * inline RANGE that resolves latest-in-range is acceptable. A prerelease, a
 * protocol / wildcard / multi-token / dist-tag value, or a reproducibility
 * request (a committed `bun.lock`) cannot be served correctly that way and needs
 * a real `bun install`.
 *
 * Returns:
 * - `inlineable`: deps the zero-install pin can emit as an inline specifier (an
 *   inline-safe range, or a plain exact). A plain exact MIGHT still be non-latest
 *   and ENOENT, which we cannot detect without the network; the detached
 *   background install (`bun-bg-install.js`) is the reactive net that heals the
 *   next boot.
 * - `needsInstall`: deps that PROVABLY cannot be served zero-install:
 *   - a prerelease (an exact non-latest prerelease ENOENTs; a caret-prerelease
 *     ENOENTs too, #703);
 *   - a value that is not inline-safe (protocol / wildcard / multi-token /
 *     dist-tag), which today resolves to latest and is not reproducible.
 * - `hasLock`: a non-empty `bun.lock` is present, i.e. a reproducibility request.
 *   The boot path treats this as a reason to install proactively (so the
 *   undetectable non-latest-exact case is handled before the first request).
 *
 * The boot decision (in `dev.js`) installs proactively when `needsInstall` is
 * non-empty OR `hasLock` is true; otherwise it serves on the fast path and fires
 * a detached install.
 *
 * @param {string} pkgJsonText  package.json contents
 * @param {string | null} [bunLockText]  bun.lock contents, when present
 * @returns {{ inlineable: string[], needsInstall: string[], hasLock: boolean }}
 */
export function classifyBunDeps(pkgJsonText, bunLockText) {
  /** @type {string[]} */ const inlineable = [];
  /** @type {string[]} */ const needsInstall = [];
  let pkg;
  try { pkg = JSON.parse(pkgJsonText); } catch { return { inlineable, needsInstall, hasLock: false }; }
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };

  /** @type {Record<string, string>} */
  const lockExact = {};
  if (bunLockText) {
    for (const name of Object.keys(declared)) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = bunLockText.match(new RegExp('"' + esc + '"\\s*:\\s*\\[\\s*"' + esc + '@([^"]+)"'));
      if (m && isExactVersion(m[1])) lockExact[name] = m[1];
    }
  }

  for (const [name, range] of Object.entries(declared)) {
    const effective = lockExact[name] || range;
    if (isPrereleaseVersion(effective) || !isInlineableVersion(range)) needsInstall.push(name);
    else inlineable.push(name);
  }
  const hasLock = !!(bunLockText && bunLockText.trim().length);
  return { inlineable, needsInstall, hasLock };
}

/**
 * Whether a single-token semver (exact or a caret / tilde / comparator range)
 * carries a `-prerelease` suffix (`1.0.0-rc.3`, `^1.0.0-rc.3`). Returns false
 * for a multi-token / protocol / wildcard value (which the caller already routes
 * to `needsInstall` via the inline-safety check).
 * @param {unknown} v
 * @returns {boolean}
 */
function isPrereleaseVersion(v) {
  if (typeof v !== 'string') return false;
  const m = /^(?:>=|<=|>|<|=|\^|~)?\d+(?:\.\d+){0,2}(-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(v);
  return !!(m && m[1]);
}

/**
 * Whether a version string is an EXACT semver (the only form valid as a Bun
 * inline specifier): `1.2.3`, with an optional prerelease / build suffix
 * (`1.2.3-rc.1`, `1.2.3+build`). Rejects any range operator (`^ ~ > < = * x | -`
 * space), a dist-tag (`latest`), and a protocol range (`workspace:` etc.).
 * @param {unknown} v
 * @returns {boolean}
 */
function isExactVersion(v) {
  return typeof v === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v);
}

/**
 * Whether a declared package.json version is safe to forward verbatim as a Bun
 * inline specifier (`name@<v>`). Accepts a single-token semver: an exact version
 * (with an optional prerelease / build suffix, `1.2.3`, `1.0.0-rc.3`) or a caret
 * / tilde / comparator range over a numeric core WITHOUT a suffix (`^1.2.3`,
 * `~1.2`, `>=1.2.3`, `^3`). Bun resolves these the standard way (highest match)
 * at auto-install time.
 *
 * Rejects, so they are left BARE: a RANGE OPERATOR combined with a prerelease /
 * build suffix (`^1.0.0-rc.3`, `~1.0.0-beta.1`, #703): Bun zero-install ENOENTs
 * on a caret-prerelease inline specifier (verified, `drizzle-orm@^1.0.0-rc.3`
 * errors while the exact `drizzle-orm@1.0.0-rc.3` resolves). Also a protocol
 * range (`workspace:`, `file:`, `link:`, `git+...`, an `http(s)://` URL, any
 * value with a `:`), a bare wildcard (`*`, `x`, `X`, empty), a multi-token range
 * (a space, a `||` union, a hyphen `1 - 2` range, which would break the
 * specifier string), and a dist-tag (`latest`, `next`, which auto-install
 * resolves unreliably). A rejected value resolves to latest, the pre-feature
 * behaviour, never a broken specifier.
 * @param {unknown} v
 * @returns {boolean}
 */
function isInlineableVersion(v) {
  if (typeof v !== 'string') return false;
  const m = /^(>=|<=|>|<|=|\^|~)?(\d+(?:\.\d+){0,2})([-+][0-9A-Za-z.-]+)?$/.exec(v);
  if (!m) return false;
  // A range operator (group 1) plus a prerelease / build suffix (group 3) is not
  // inline-resolvable under Bun zero-install (#703). An exact version with a
  // suffix, or a range with no suffix, is fine.
  return !(m[1] && m[3]);
}

/**
 * The npm package name a specifier belongs to: `@scope/name[/sub]` or
 * `name[/sub]`. Returns null for a bare scope with no name.
 * @param {string} p
 * @returns {string | null}
 */
export function packageNameOf(p) {
  if (p.startsWith('@')) {
    const parts = p.split('/');
    return parts.length >= 2 && parts[0] && parts[1] ? parts[0] + '/' + parts[1] : null;
  }
  return p.split('/')[0] || null;
}

/**
 * Whether a specifier should be left untouched: relative, the `#` app alias, a
 * protocol/builtin (`node:`, `bun:`, `http:`...), or already version-pinned.
 * @param {string} p
 * @param {string} name
 * @returns {boolean}
 */
function skipSpecifier(p, name) {
  if (!p || p[0] === '.' || p[0] === '#') return true;
  // A protocol/builtin has a colon before any slash (node:fs, bun:sqlite, http:).
  // A scope `@scope/x` has no leading colon, so it is not caught here.
  const firstSlash = p.indexOf('/');
  const head = firstSlash === -1 ? p : p.slice(0, firstSlash);
  if (head.includes(':')) return true;
  // Already versioned: the name is immediately followed by `@<something>`.
  if (p.slice(name.length).startsWith('@')) return true;
  return false;
}

/**
 * Rewrite bare specifiers of DECLARED deps to `name@version` (keeping any
 * subpath). `name` -> `name@v`, `name/sub` -> `name@v/sub`,
 * `@scope/name/sub` -> `@scope/name@v/sub`.
 *
 * @param {string} src  module source
 * @param {Array<{ kind: string, path: string }>} imports  Bun.Transpiler.scanImports output
 * @param {Record<string, string>} depVersions  package name -> version (exact preferred, e.g. from bun.lock)
 * @returns {string} the rewritten source (unchanged when nothing matched)
 */
export function rewriteDepSpecifiers(src, imports, depVersions) {
  /** @type {Map<string, string>} specifier -> versioned specifier */
  const remap = new Map();
  for (const imp of imports) {
    const p = imp && imp.path;
    if (!p || remap.has(p)) continue;
    const name = packageNameOf(p);
    if (!name || skipSpecifier(p, name)) continue;
    const ver = depVersions[name];
    if (!ver) continue;
    remap.set(p, name + '@' + ver + p.slice(name.length));
  }
  if (remap.size === 0) return src;

  let out = src;
  for (const [from, to] of remap) {
    const q = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Anchor on the import/export/require form so an identical non-import
    // string literal is not touched: `from 'x'`, `import 'x'`, `import('x')`,
    // `require('x')`. The optional `(` covers dynamic import / require. The
    // leading `(^|[^\w.$])` boundary keeps a method call (`db.select().from('x')`,
    // a `.import(...)` member) or a keyword-suffixed identifier (`xfrom 'x'`)
    // from matching, which an unanchored keyword would wrongly rewrite.
    const re = new RegExp("(^|[^\\w.$])((?:from|import|require)\\s*\\(?\\s*)(['\"])" + q + "\\3", 'g');
    out = out.replace(re, (_m, pre, lead, quote) => pre + lead + quote + to + quote);
  }
  return out;
}
