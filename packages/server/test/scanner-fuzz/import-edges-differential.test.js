// Differential test: the hand-rolled lexer's import-edge extraction vs a real
// AST (#753).
//
// Three correctness-critical subsystems (the browser-bound authorization gate
// in module-graph.js, component elision, and `webjs check`) read import edges
// off the hand-rolled lexical scanner (js-scan.js `redactStringsAndTemplates`)
// plus the module-graph regexes, NOT a real parse. A lexer desync (a misread
// string boundary or template-interpolation edge) can drop a real `import`
// edge (the gate then 404s a legitimate module) or invent a phantom one.
//
// This proves the lexer agrees with a real parser (TypeScript's AST, already a
// devDep) over a large corpus of the repo's own source plus adversarial
// fixtures. The lexer stays on the hot path; the AST runs ONLY here.
//
// Direction-safety (the gate's asymmetric invariant, from the issue): the gate
// may admit MORE than the AST (an extra app file becomes servable, which is
// safe because `.server.*` files are blocked by a separate path-level
// guardrail, not the import graph), but it must NEVER admit FEWER (a real
// import the lexer misses is a module that 404s). So the HARD assertion is
// `lexerSet` is a superset of `astSet`: every real import the AST sees, the
// lexer sees too. A lexer-only over-match is reported but not a failure on real
// source; the adversarial fixtures pin the exact expected set on both sides.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, join } from 'node:path';
import ts from 'typescript';
import { redactStringsAndTemplates, maskComments } from '../../src/js-scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

// --- The lexer path: mirror module-graph.js's specifier scan exactly. --------
// These regexes are COPIED from packages/server/src/module-graph.js; a drift
// guard below asserts they still match the source, so the mirror can never
// silently diverge from what the gate actually runs.
const IMPORT_RE = /\bimport\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const EXPORT_FROM_RE = /\bexport\b[^'";]+?\sfrom\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*[,)]/g;

/**
 * The set of import/export-from/dynamic-import SPECIFIERS the lexer extracts,
 * applying the same redaction-mask + type-only + quote-position guards the
 * real gate (module-graph.js `parseFile`) applies. Specifier-level (pre
 * resolution) so a divergence is a LEXER bug, not a path-resolution difference.
 *
 * @param {string} src
 * @returns {Set<string>}
 */
function lexerSpecifiers(src) {
  const specs = new Set();
  const masked = redactStringsAndTemplates(src, true);
  // Mirror module-graph.js: scan over a comment-masked copy (strings kept) so a
  // commented `import`/`export` keyword can't anchor a match that swallows the
  // next real one (#753). The `masked` guard still rejects a string-embedded
  // keyword.
  const scanSrc = maskComments(src);
  for (const re of [IMPORT_RE, EXPORT_FROM_RE]) {
    for (const m of scanSrc.matchAll(re)) {
      if (masked[m.index] === ' ') continue; // keyword inside a literal
      const lead = m[0];
      const typeOnly =
        /^(?:import|export)\s+type\s*[{*]/.test(lead) ||
        (/^import\s+type\s+[A-Za-z_$]/.test(lead) && !/^import\s+type\s+from\b/.test(lead));
      if (typeOnly) continue;
      const spec = m[1];
      const quoteAt = m.index + m[0].length - spec.length - 2;
      if (masked[quoteAt] === ' ') continue; // specifier tail inside a literal
      specs.add(spec);
    }
  }
  // The dynamic-import loop mirrors module-graph.js exactly: it guards ONLY on
  // the keyword position, with no quote-position guard (the static scan's
  // quoteAt guard exists for EXPORT_FROM_RE's lazy body-spanning `from`, which
  // a `import(<literal>)` cannot exhibit). Applying a quoteAt guard here would
  // be off-by-one anyway, since the match ends with `)` not the closing quote.
  for (const m of scanSrc.matchAll(DYNAMIC_IMPORT_RE)) {
    if (masked[m.index] === ' ') continue;
    specs.add(m[1]);
  }
  return specs;
}

// --- The oracle: a real TypeScript AST. --------------------------------------
/**
 * The set of runtime (non-type-only) import/export-from/dynamic-import
 * specifiers a real parse finds. This is what a correct lexer must at least
 * match.
 *
 * @param {string} src
 * @param {string} filename  Drives the script kind (tsx/ts/js).
 * @returns {Set<string>}
 */
function astSpecifiers(src, filename) {
  const ext = extname(filename);
  const kind =
    ext === '.tsx' ? ts.ScriptKind.TSX :
    ext === '.jsx' ? ts.ScriptKind.JSX :
    ext === '.js' || ext === '.mjs' || ext === '.cjs' ? ts.ScriptKind.JS :
    ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filename, src, ts.ScriptTarget.Latest, false, kind);
  const specs = new Set();
  /** @param {ts.Node} node */
  function walk(node) {
    // Static `import ... from '...'`
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause || !node.importClause.isTypeOnly) {
        if (ts.isStringLiteral(node.moduleSpecifier)) specs.add(node.moduleSpecifier.text);
      }
    // `export ... from '...'`
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specs.add(node.moduleSpecifier.text);
      }
    // Dynamic `import('...')`
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.add(node.arguments[0].text);
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return specs;
}

// A MIXED `import { type A, b }` keeps a runtime binding, so the AST reports it
// but the whole-declaration `isTypeOnly` is false: correct. An `import type { X
// }` sets `isTypeOnly` and is excluded on both sides. The lexer's `typeOnly`
// guard and the AST's `isTypeOnly` therefore align; the fixtures below pin it.

/**
 * Assert the lexer's specifier set covers the AST's, i.e. never misses a real
 * import. Returns the lexer-only over-match set for reporting.
 *
 * @param {string} src
 * @param {string} filename
 * @param {string} label
 * @returns {string[]} lexer-only specifiers (over-matches)
 */
function assertCovers(src, filename, label) {
  const lex = lexerSpecifiers(src);
  const ast = astSpecifiers(src, filename);
  const missed = [...ast].filter((s) => !lex.has(s));
  assert.equal(
    missed.length, 0,
    `${label}: lexer MISSED real import(s) the AST found: ${JSON.stringify(missed)}`,
  );
  return [...lex].filter((s) => !ast.has(s));
}

test('drift guard: the mirrored regexes still match module-graph.js', () => {
  const src = readFileSync(resolve(here, '../../src/module-graph.js'), 'utf8');
  assert.ok(src.includes(IMPORT_RE.source), 'IMPORT_RE drifted from module-graph.js');
  assert.ok(src.includes(EXPORT_FROM_RE.source), 'EXPORT_FROM_RE drifted from module-graph.js');
  assert.ok(src.includes(DYNAMIC_IMPORT_RE.source), 'DYNAMIC_IMPORT_RE drifted from module-graph.js');
});

// --- Adversarial fixtures: the exact edges the lexer's blind spots live in. ---
// Each pins the expected specifier set on BOTH sides, so a lexer regression on
// one of these edges fails loudly rather than degrading to a silent 404.
const FIXTURES = [
  {
    name: 'import keyword inside a plain string is NOT an edge',
    file: 'f.ts',
    src: `const doc = "import x from 'left-pad'";\nimport { real } from './real.ts';`,
    expect: ['./real.ts'],
  },
  {
    name: 'import inside an html template literal is NOT an edge',
    file: 'f.ts',
    src: 'import { html } from "@webjsdev/core";\n' +
      'export const t = html`<pre>import x from \'phantom\'</pre>`;\n' +
      "import { real } from './real.ts';",
    expect: ['@webjsdev/core', './real.ts'],
  },
  {
    name: 'export-from spanning a template body to a from is NOT an edge',
    file: 'f.ts',
    src: 'export const t = `some ... import x from \'left-pad\'`;\n' +
      "export { a } from './real.ts';",
    expect: ['./real.ts'],
  },
  {
    name: 'import inside a line comment is NOT an edge',
    file: 'f.ts',
    src: "// import x from 'commented-out'\nimport { real } from './real.ts';",
    expect: ['./real.ts'],
  },
  {
    name: 'import inside a block comment is NOT an edge',
    file: 'f.ts',
    src: "/* import x from 'commented-out' */\nimport { real } from './real.ts';",
    expect: ['./real.ts'],
  },
  {
    name: 'type-only import is erased, not an edge; mixed import IS an edge',
    file: 'f.ts',
    src: "import type { A } from './types.ts';\nimport { type B, c } from './mixed.ts';",
    expect: ['./mixed.ts'],
  },
  {
    name: 'nested template literals do not swallow a trailing real import',
    file: 'f.ts',
    src: 'import { html } from "@webjsdev/core";\n' +
      'export const t = html`<div>${html`<span>import y from \'x\'</span>`}</div>`;\n' +
      "import { real } from './real.ts';",
    expect: ['@webjsdev/core', './real.ts'],
  },
  {
    name: 'regex literal containing quotes does not desync string scanning',
    file: 'f.ts',
    src: "const re = /['\"]import x from 'y'/g;\nimport { real } from './real.ts';",
    expect: ['./real.ts'],
  },
  {
    name: 'dynamic import with a string literal IS an edge',
    file: 'f.ts',
    src: "const m = await import('./lazy.ts');\nimport { real } from './real.ts';",
    expect: ['./lazy.ts', './real.ts'],
  },
];

for (const fx of FIXTURES) {
  test(`fixture: ${fx.name}`, () => {
    const lex = lexerSpecifiers(fx.src);
    const ast = astSpecifiers(fx.src, fx.file);
    const want = new Set(fx.expect);
    // The lexer must match the pinned set exactly on these edges.
    assert.deepEqual([...lex].sort(), [...want].sort(), `lexer set for: ${fx.name}`);
    // And the AST agrees with the pin (proves the fixture encodes real semantics).
    assert.deepEqual([...ast].sort(), [...want].sort(), `AST set for: ${fx.name}`);
  });
}

// --- Corpus sweep: prove agreement over the repo's own real source. ---------
// Walks a set of real source trees and, for every file, asserts the lexer's
// import-specifier set COVERS the AST's (never misses a real import). Over-
// matches (lexer-only specifiers, which are gate-safe "admit more") are tallied
// and reported so a large or suspicious over-match is visible; a small, bounded
// count is expected (e.g. a specifier a parser drops as unreachable that the
// regex still sees).

const CORPUS_ROOTS = [
  'packages/core/src',
  'packages/server/src',
  'packages/cli/lib',
  'packages/mcp/src',
  'packages/editors/intellisense/src',
  'examples/blog/app',
  'examples/blog/modules',
  'docs/app',
  'website/app',
];

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.webjs', 'vendor']);

/** Recursively collect code files under `dir`. */
function collectFiles(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      collectFiles(full, out);
    } else if (e.isFile() && CODE_EXT.has(extname(e.name)) && !e.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
}

const CORPUS = [];
for (const root of CORPUS_ROOTS) collectFiles(resolve(repoRoot, root), CORPUS);

test('corpus: the lexer never misses a real import edge the AST finds', () => {
  assert.ok(CORPUS.length > 200, `corpus too small (${CORPUS.length}); roots may have moved`);
  const misses = [];
  let overMatchTotal = 0;
  const overMatchFiles = [];
  for (const file of CORPUS) {
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { continue; }
    let ast;
    try { ast = astSpecifiers(src, file); } catch { continue; } // unparseable-by-tsc file: skip (never a gate input)
    const lex = lexerSpecifiers(src);
    const rel = relative(repoRoot, file);
    for (const s of ast) if (!lex.has(s)) misses.push(`${rel}: ${s}`);
    const over = [...lex].filter((s) => !ast.has(s));
    if (over.length) { overMatchTotal += over.length; overMatchFiles.push(`${rel}: ${JSON.stringify(over)}`); }
  }
  // Report over-matches for visibility (not a failure: the gate admitting more
  // is safe). If this grows unexpectedly, a scan regression is likely.
  if (overMatchFiles.length) {
    console.log(`[import-edges] ${CORPUS.length} files scanned; ${overMatchTotal} lexer-only over-match(es) in ${overMatchFiles.length} file(s):`);
    for (const f of overMatchFiles.slice(0, 20)) console.log('  ' + f);
  } else {
    console.log(`[import-edges] ${CORPUS.length} files scanned; exact agreement (zero over-matches).`);
  }
  // The HARD invariant: the lexer covers every real import edge. A miss is a
  // gate under-authorization (a real module would 404).
  assert.deepEqual(misses, [], `lexer MISSED real import edge(s) the AST found:\n${misses.join('\n')}`);
});
