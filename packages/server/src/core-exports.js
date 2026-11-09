/**
 * The `@webjsdev/core` export surface, read from the installed package's own
 * source at check time.
 *
 * `core-imports-exist` and the dev overlay need to know which names each
 * `@webjsdev/core` specifier really exports, as a runtime VALUE and as a
 * TYPE. A hand-kept list would rot the first time core gains an export, so
 * this reads the package the app actually resolves: `package.json` `exports`
 * names the subpaths, each subpath's source module (the `source` condition, or
 * a `default` that is a source file) names its runtime exports, and its
 * `types` declaration names the types. `export * from` is followed on both
 * sides. The root specifier is the union of `index.js` and `index-browser.js`,
 * so a server-only export (`renderToString`) and a browser-only one both count.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactStringsAndTemplates } from './js-scan.js';

/**
 * @typedef {{ runtime: Set<string>, types: Set<string>, hasDefault: boolean }} ModuleSurface
 * @typedef {{ dir: string, subpaths: Map<string, ModuleSurface> }} CoreSurface
 */

/** @type {Map<string, CoreSurface>} */
const SURFACE_CACHE = new Map();

/**
 * Locate the `@webjsdev/core` package directory the app resolves, falling
 * back to the copy this server package sits beside (the monorepo layout and a
 * flat `node_modules/@webjsdev/` install alike).
 * @param {string} [appDir]
 * @returns {string | null}
 */
export function resolveCoreDir(appDir) {
  if (appDir) {
    try {
      const req = createRequire(join(appDir, 'package.json'));
      return dirname(req.resolve('@webjsdev/core/package.json'));
    } catch { /* not resolvable from the app; fall through */ }
  }
  const sibling = resolve(dirname(fileURLToPath(import.meta.url)), '../../core');
  return existsSync(join(sibling, 'package.json')) ? sibling : null;
}

/**
 * Read (and cache per core directory) the whole core export surface.
 * @param {string} [appDir]
 * @returns {CoreSurface | null}
 */
export function coreSurface(appDir) {
  const dir = resolveCoreDir(appDir);
  if (!dir) return null;
  const hit = SURFACE_CACHE.get(dir);
  if (hit) return hit;
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')); } catch { return null; }
  /** @type {Map<string, ModuleSurface>} */
  const subpaths = new Map();
  const exportsField = pkg.exports && typeof pkg.exports === 'object' ? pkg.exports : {};
  for (const [key, entry] of Object.entries(exportsField)) {
    if (!key.startsWith('.') || key === './package.json' || key.endsWith('/')) continue;
    const spec = key === '.' ? '@webjsdev/core' : '@webjsdev/core' + key.slice(1);
    const { sources, types } = entryFiles(dir, key, entry);
    /** @type {ModuleSurface} */
    const surface = { runtime: new Set(), types: new Set(), hasDefault: false };
    for (const file of sources) {
      const r = moduleExports(file, false, new Set());
      for (const n of r.names) surface.runtime.add(n);
      if (r.hasDefault) surface.hasDefault = true;
    }
    if (types) for (const n of moduleExports(types, true, new Set()).names) surface.types.add(n);
    subpaths.set(spec, surface);
  }
  const out = { dir, subpaths };
  SURFACE_CACHE.set(dir, out);
  return out;
}

/**
 * The source and declaration files one `exports` entry maps to. A built
 * `dist/` default is skipped in favour of the `source` condition, since the
 * bundle's export list is the source's.
 * @param {string} dir
 * @param {string} key
 * @param {unknown} entry
 * @returns {{ sources: string[], types: string | null }}
 */
function entryFiles(dir, key, entry) {
  /** @type {string[]} */
  const sources = [];
  let types = null;
  if (typeof entry === 'string') {
    sources.push(join(dir, entry));
  } else if (entry && typeof entry === 'object') {
    const e = /** @type {Record<string, unknown>} */ (entry);
    const src = typeof e.source === 'string' ? e.source
      : typeof e.default === 'string' && !e.default.includes('/dist/') ? e.default
        : typeof e.import === 'string' ? e.import : null;
    if (src) sources.push(join(dir, src));
    if (typeof e.types === 'string') types = join(dir, e.types);
  }
  if (key === '.') {
    const browser = join(dir, 'index-browser.js');
    if (existsSync(browser) && !sources.includes(browser)) sources.push(browser);
    if (!sources.length) sources.push(join(dir, 'index.js'));
  }
  return { sources: sources.filter((f) => existsSync(f)), types: types && existsSync(types) ? types : null };
}

/**
 * The names one module exports, following `export * from` relative edges.
 * Comments and string / template bodies are masked first, except that the
 * `from '...'` specifier is read back from the raw source at the same offset.
 * @param {string} file
 * @param {boolean} dts  read declaration syntax (`interface`, `type`, `declare`)
 * @param {Set<string>} seen
 * @returns {{ names: Set<string>, hasDefault: boolean }}
 */
function moduleExports(file, dts, seen) {
  const names = new Set();
  let hasDefault = false;
  if (seen.has(file)) return { names, hasDefault };
  seen.add(file);
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { return { names, hasDefault }; }
  const scan = redactStringsAndTemplates(src);
  const decl = dts
    ? /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g
    : /\bexport\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = decl.exec(scan))) names.add(m[1]);
  if (/\bexport\s+default\b/.test(scan)) hasDefault = true;
  const clause = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((m = clause.exec(scan))) {
    for (const part of m[1].split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (!p) continue;
      const alias = p.split(/\s+as\s+/);
      const name = (alias[1] || alias[0]).trim();
      if (name === 'default') hasDefault = true;
      else if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  const star = /\bexport\s+(?:type\s+)?\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s*)?from\s*(['"])([^'"]*)\2/g;
  while ((m = star.exec(scan))) {
    if (m[1]) { names.add(m[1]); continue; }
    // The specifier body is a plain string, kept verbatim by the mask.
    const target = resolveRelative(file, m[3], dts);
    if (!target) continue;
    for (const n of moduleExports(target, dts, seen).names) names.add(n);
  }
  return { names, hasDefault };
}

/**
 * Resolve a relative `export * from` specifier; in a declaration file `x.js`
 * means the sibling `x.d.ts`.
 * @param {string} from
 * @param {string} spec
 * @param {boolean} dts
 * @returns {string | null}
 */
function resolveRelative(from, spec, dts) {
  if (!spec.startsWith('.')) return null;
  const abs = resolve(dirname(from), spec);
  if (dts) {
    const candidates = [abs.replace(/\.m?js$/, '.d.ts'), abs, abs + '.d.ts'];
    for (const c of candidates) if (c.endsWith('.ts') && existsSync(c)) return c;
    return null;
  }
  return existsSync(abs) ? abs : null;
}

/**
 * Whether `name` is a TYPE somewhere in core with no runtime value anywhere,
 * the shape a plain (non-`type`) import of it fails on at load.
 * @param {CoreSurface} surface
 * @param {string} name
 * @returns {boolean}
 */
export function isTypeOnlyAnywhere(surface, name) {
  let inTypes = false;
  for (const s of surface.subpaths.values()) {
    if (s.runtime.has(name)) return false;
    if (s.types.has(name)) inTypes = true;
  }
  return inTypes;
}
