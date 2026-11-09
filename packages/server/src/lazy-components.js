/**
 * `static lazy = true` components (#1524): a side-effect import of a lazy
 * component is served as a lazy-loader registration instead of an eager
 * import, so the browser fetches the module on first sight of its tag.
 *
 * @module
 */
import { redactStringsAndTemplates, maskComments } from './js-scan.js';

/** A `.server.{js,ts,mjs,mts}` file: a stub on the client, inert there. */
const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

/** Match a whole-line side-effect import: `import './x.js';` (no bindings). */
const SIDE_EFFECT_IMPORT_RE = /^([ \t]*)import\s+(['"])([^'"]+)\2\s*;?[ \t]*$/gm;

/**
 * Defer side-effect imports of `static lazy` components (#1524). A lazy
 * component that a shipping module imports for registration used to load
 * eagerly as part of that module's static graph, which defeated `static lazy`
 * whenever the class had to be imported at all (and SSR needs the import: the
 * server only knows the tag is lazy once the class registered). The SERVER
 * keeps the real import; this rewrites only the BROWSER copy, replacing the
 * import line in place (same line, so positions stay stable) with a
 * registration on the lazy loader:
 *
 *     import('@webjsdev/core/lazy-loader').then((m) => m.observeLazy({"x-tag":"/url"}));
 *
 * The loader then imports the module the first time an element with one of
 * its tags is in (or near) the viewport: a hidden tab panel when it first
 * shows, a closed dialog's content when it opens, a below-the-fold element
 * when it scrolls near. Its MutationObserver also catches a tag rendered
 * later on the client, so an imported-but-not-yet-rendered component still
 * registers when it appears.
 *
 * Only a side-effect import is rewritten (a binding import needs its value
 * now, so it stays eager), the match runs over a redacted copy so an
 * import-looking line inside a string, template, or comment is never touched,
 * and an importer with no lazy dependency in the graph returns untouched with
 * no regex work.
 *
 * @param {string} source             module source (already type-stripped if TS)
 * @param {string} importerAbs        absolute path of the importing module
 * @param {import('./module-graph.js').ModuleGraph | undefined} moduleGraph
 * @param {Map<string, string[]> | undefined} lazyFiles  lazy component file -> the tags it registers
 * @param {(spec: string, fromFile: string, appDir: string) => (string|null)} resolveImport
 * @param {string} appDir
 * @param {(abs: string) => string} urlFor  the browser URL the loader imports (base path + content hash applied)
 * @returns {string}
 */
export function deferLazyImportsFromSource(source, importerAbs, moduleGraph, lazyFiles, resolveImport, appDir, urlFor) {
  if (!lazyFiles || lazyFiles.size === 0) return source;
  const deps = moduleGraph && moduleGraph.get(importerAbs);
  if (!deps) return source;
  let hasLazyDep = false;
  for (const d of deps) {
    if (lazyFiles.has(d)) { hasLazyDep = true; break; }
  }
  if (!hasLazyDep) return source;

  const redacted = redactStringsAndTemplates(source);
  let out = '';
  let last = 0;
  for (const m of redacted.matchAll(SIDE_EFFECT_IMPORT_RE)) {
    const start = /** @type {number} */ (m.index);
    const end = start + m[0].length;
    const resolved = resolveImport(m[3], importerAbs, appDir);
    const tags = resolved ? lazyFiles.get(resolved) : undefined;
    out += source.slice(last, start);
    if (tags && tags.length) {
      const url = urlFor(/** @type {string} */ (resolved));
      const entries = Object.fromEntries(tags.map((t) => [t, url]));
      out += `${m[1]}import('@webjsdev/core/lazy-loader').then((m) => m.observeLazy(${JSON.stringify(entries)}));`;
    } else {
      out += source.slice(start, end);
    }
    last = end;
  }
  out += source.slice(last);
  return out;
}

/**
 * The lazy component files of an app (#1524): every scanned component file
 * that declares `static lazy = true`, mapped to the tags it registers.
 *
 * @param {Array<{ tag: string, file: string, lazy?: boolean }>} components
 * @returns {Map<string, string[]>}
 */
export function lazyComponentFiles(components) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const c of components) {
    if (!c.lazy) continue;
    const tags = out.get(c.file);
    if (tags) { if (!tags.includes(c.tag)) tags.push(c.tag); } else out.set(c.file, [c.tag]);
  }
  return out;
}

/** A test module (the same rule the component scanner skips). */
const TEST_FILE_RE = /\.(test|spec)\.m?[jt]sx?$/;

/** `import <bindings> from 'x'` (the bindings part is captured). */
const BINDING_IMPORT_RE = /\bimport\s+(type\s+)?([\w$*{}\s,]+?)\s+from\s+(['"])([^'"]+)\3/g;
/** `export { a } from 'x'` / `export * from 'x'` (a re-export needs the module too). */
const REEXPORT_RE = /\bexport\s+(type\s+)?(?:\*|\{[^}]*\}|\*\s+as\s+[\w$]+)\s+from\s+(['"])([^'"]+)\2/g;

/**
 * Is this import clause types only (`import type { A }`, or every named
 * specifier marked `type`)? Those are erased before the browser sees them.
 *
 * @param {string | undefined} typeKw
 * @param {string} clause
 */
function typeOnlyClause(typeKw, clause) {
  if (typeKw) return true;
  const m = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!m) return false;
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return names.length > 0 && names.every((n) => /^type\s/.test(n));
}

/**
 * The lazy component files some module imports WITH bindings (#1524). A
 * binding import loads the module eagerly whatever the class says, because the
 * importer needs the value when it runs. Such a file is not lazy in practice,
 * so the caller drops it from the lazy set: otherwise the preload walks would
 * skip a module the browser still fetches up front, which only makes it slower.
 *
 * Only importers whose graph edges reach a lazy file are read. A server file is
 * never served, and a test file (`*.test.*` / `*.spec.*`) never ships to a
 * page, so their imports do not count: a component's own browser test imports
 * it with bindings, and that must not make it eager in the app.
 *
 * @param {Map<string, string[]>} lazyFiles
 * @param {import('./module-graph.js').ModuleGraph | undefined} moduleGraph
 * @param {(file: string) => Promise<string>} readFileFn
 * @param {(spec: string, fromFile: string, appDir: string) => (string|null)} resolveImport
 * @param {string} appDir
 * @returns {Promise<Set<string>>}
 */
export async function bindingImportedLazyFiles(lazyFiles, moduleGraph, readFileFn, resolveImport, appDir) {
  /** @type {Set<string>} */
  const out = new Set();
  if (!lazyFiles.size || !moduleGraph) return out;
  for (const [importer, deps] of moduleGraph) {
    if (SERVER_FILE_RE.test(importer) || TEST_FILE_RE.test(importer)) continue;
    let reaches = false;
    for (const d of deps) if (lazyFiles.has(d) && !out.has(d)) { reaches = true; break; }
    if (!reaches) continue;
    let src;
    try { src = await readFileFn(importer); } catch { continue; }
    const code = redactStringsAndTemplates(maskComments(src));
    for (const m of code.matchAll(BINDING_IMPORT_RE)) {
      if (typeOnlyClause(m[1], m[2])) continue;
      const abs = resolveImport(m[4], importer, appDir);
      if (abs && lazyFiles.has(abs)) out.add(abs);
    }
    for (const m of code.matchAll(REEXPORT_RE)) {
      if (m[1]) continue;
      const abs = resolveImport(m[3], importer, appDir);
      if (abs && lazyFiles.has(abs)) out.add(abs);
    }
  }
  return out;
}
