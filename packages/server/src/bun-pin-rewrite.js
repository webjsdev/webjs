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
    // `require('x')`. The optional `(` covers dynamic import / require.
    const re = new RegExp("((?:from|import|require)\\s*\\(?\\s*)(['\"])" + q + "\\2", 'g');
    out = out.replace(re, (_m, lead, quote) => lead + quote + to + quote);
  }
  return out;
}
