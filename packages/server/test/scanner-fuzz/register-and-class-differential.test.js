// Differential test: the hand-rolled scanner's `register()` / `customElements
// .define()` call-site detection AND its WebComponent class-body extraction vs a
// real AST (#753).
//
// Component elision and `webjs check` decide which component modules ship and
// which class bodies to lint off the hand-rolled scanner (`component-scanner.js`
// `extractComponents`, `js-scan.js` `extractWebComponentClassBodies`), not a real
// parse. The elision direction-safety invariant: it must NEVER elide a component
// the AST says is real, i.e. the scanner must find AT LEAST every registration /
// WebComponent class the AST finds. So the hard assertion is `lexerSet` covers
// `astSet`; a lexer-only over-match ships more (safe) and is only reported.
//
// The scanner runs over redacted source (comments masked, string bodies turned
// to placeholders), so a `register()` inside a comment or a string is inert;
// the fixtures pin those blind spots.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, join } from 'node:path';
import ts from 'typescript';
import { extractComponents } from '../../src/component-scanner.js';
import { extractWebComponentClassBodies, redactStringsAndTemplates } from '../../src/js-scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

// --- register() / customElements.define(): lexer set. ------------------------
/** `Set<"Class tag">` the hand-rolled component scanner detects. */
function lexerRegistrations(src) {
  return new Set(extractComponents(src).map((c) => `${c.className} ${c.tag}`));
}

/** `Set<"Class tag">` a real AST finds (`X.register('tag')` / `define('tag', X)`). */
function astRegistrations(src, filename) {
  const sf = tsSource(src, filename);
  const out = new Set();
  /** @param {ts.Node} node */
  function walk(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // X.register('tag')
      if (
        ts.isPropertyAccessExpression(callee) && callee.name.text === 'register' &&
        ts.isIdentifier(callee.expression) && /^[A-Z]/.test(callee.expression.text) &&
        node.arguments.length >= 1 && isStr(node.arguments[0])
      ) {
        const tag = strText(node.arguments[0]);
        if (tag.includes('-')) out.add(`${callee.expression.text} ${tag}`);
      }
      // customElements.define('tag', X)
      if (
        ts.isPropertyAccessExpression(callee) && callee.name.text === 'define' &&
        ts.isIdentifier(callee.expression) && callee.expression.text === 'customElements' &&
        node.arguments.length >= 2 && isStr(node.arguments[0]) && ts.isIdentifier(node.arguments[1]) &&
        /^[A-Z]/.test(node.arguments[1].text)
      ) {
        const tag = strText(node.arguments[0]);
        if (tag.includes('-')) out.add(`${node.arguments[1].text} ${tag}`);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return out;
}

// --- WebComponent class bodies: lexer set. -----------------------------------
/** Class NAMES the hand-rolled body extractor finds (over comment-masked src). */
function lexerWebComponentClasses(src) {
  // Mirror component-elision.js:557 / check.js: the extractor is fed
  // comment-masked source. The name window mirrors the extractor's own regex
  // (incl. the optional generic parameter) and just adds a capture group.
  const masked = redactStringsAndTemplates(src);
  const names = new Set();
  const re = /class\s+(\w+)(?:\s*<[^{}();]*?>)?\s+extends\s+WebComponent/g;
  let count = 0;
  let m;
  while ((m = re.exec(masked)) !== null) { names.add(m[1]); count++; }
  // Sanity: the public extractor finds the same NUMBER of bodies as the window
  // has matches, so a name-window regression cannot silently diverge. Compare
  // the raw MATCH count (not the deduped name-set size): two same-named classes
  // (one real, one string-embedded) are two bodies but one name, and comparing
  // to the Set size would wrongly throw on that verdict-safe over-match.
  assert.equal(
    extractWebComponentClassBodies(masked).length, count,
    'class-body extractor count disagrees with the name window',
  );
  return names;
}

/** Class names a real AST finds extending `WebComponent` or `WebComponent(...)`. */
function astWebComponentClasses(src, filename) {
  const sf = tsSource(src, filename);
  const out = new Set();
  /** @param {ts.Node} node */
  function walk(node) {
    if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name && node.heritageClauses) {
      for (const h of node.heritageClauses) {
        if (h.token !== ts.SyntaxKind.ExtendsKeyword) continue;
        for (const t of h.types) {
          const e = t.expression;
          const extendsWc =
            (ts.isIdentifier(e) && e.text === 'WebComponent') ||
            (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'WebComponent');
          if (extendsWc) out.add(node.name.text);
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return out;
}

// --- helpers -----------------------------------------------------------------
function tsSource(src, filename) {
  const ext = extname(filename);
  const kind =
    ext === '.tsx' ? ts.ScriptKind.TSX : ext === '.jsx' ? ts.ScriptKind.JSX :
    ext === '.js' || ext === '.mjs' || ext === '.cjs' ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  return ts.createSourceFile(filename, src, ts.ScriptTarget.Latest, false, kind);
}
const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
const strText = (n) => n.text;

// --- Adversarial fixtures. ---------------------------------------------------
const FIXTURES = [
  {
    name: 'idiomatic Class.register(tag)',
    file: 'c.ts',
    src: "class MyThing extends WebComponent({ n: Number }) { render(){ return html`x`; } }\nMyThing.register('my-thing');",
    reg: ['MyThing my-thing'],
    cls: ['MyThing'],
  },
  {
    name: 'customElements.define(tag, Class)',
    file: 'c.ts',
    src: "class Foo extends WebComponent { }\ncustomElements.define('foo-bar', Foo);",
    reg: ['Foo foo-bar'],
    cls: ['Foo'],
  },
  {
    name: 'register() inside a comment is NOT a registration',
    file: 'c.ts',
    src: "class Real extends WebComponent {}\n// Fake.register('ghost-tag')\nReal.register('real-tag');",
    reg: ['Real real-tag'],
    cls: ['Real'],
  },
  {
    name: 'register() inside a string/template is NOT a registration',
    file: 'c.ts',
    src: "class Real extends WebComponent {}\nconst doc = `usage: Ghost.register('ghost-tag')`;\nReal.register('real-tag');",
    reg: ['Real real-tag'],
    cls: ['Real'],
  },
  {
    name: 'a class extending WebComponent inside a comment is NOT a class',
    file: 'c.ts',
    src: "// class Ghost extends WebComponent {}\nclass Real extends WebComponent {}\nReal.register('real-tag');",
    reg: ['Real real-tag'],
    cls: ['Real'],
  },
  {
    name: 'a tag without a hyphen is not a valid custom element registration',
    file: 'c.ts',
    src: "class Nope extends WebComponent {}\nNope.register('nohyphen');",
    reg: [],
    cls: ['Nope'],
  },
  {
    // #753 round-2: a TS generic on the class name must not hide the component
    // from the extractor (else elision could strip an interactive component).
    name: 'a generic WebComponent class is detected',
    file: 'c.ts',
    src: "class Grid<T> extends WebComponent({ rows: prop<T[]>(Array) }) { render(){ return html`x`; } }\nGrid.register('data-grid');",
    reg: ['Grid data-grid'],
    cls: ['Grid'],
  },
  {
    // #753 round-2: a real class plus a same-named class inside a plain string
    // (verdict-safe over-match) must NOT make the extractor-vs-window count
    // assert throw (two bodies, one name).
    name: 'a duplicate class name (real + string-embedded) does not error the count check',
    file: 'c.ts',
    src: "class Dup extends WebComponent {}\nconst sample = 'class Dup extends WebComponent {}';\nDup.register('dup-tag');",
    reg: ['Dup dup-tag'],
    cls: ['Dup'],
  },
];

// Note: an anonymous `export default class extends WebComponent` is a MUTUAL
// blind spot (the AST oracle also requires a class name), so the differential
// cannot assert on it; it is out of scope for both sides here.

for (const fx of FIXTURES) {
  test(`fixture (register): ${fx.name}`, () => {
    assert.deepEqual([...lexerRegistrations(fx.src)].sort(), [...new Set(fx.reg)].sort(), `lexer reg: ${fx.name}`);
    assert.deepEqual([...astRegistrations(fx.src, fx.file)].sort(), [...new Set(fx.reg)].sort(), `AST reg: ${fx.name}`);
  });
  test(`fixture (class): ${fx.name}`, () => {
    assert.deepEqual([...lexerWebComponentClasses(fx.src)].sort(), [...new Set(fx.cls)].sort(), `lexer class: ${fx.name}`);
    assert.deepEqual([...astWebComponentClasses(fx.src, fx.file)].sort(), [...new Set(fx.cls)].sort(), `AST class: ${fx.name}`);
  });
}

// --- Corpus sweep over real component source. --------------------------------
const CORPUS_ROOTS = [
  'packages/core/src', 'packages/cli/templates', 'examples/blog', 'docs/app', 'website/app',
  'packages/ui/src', 'packages/server/test/elision', 'packages/server/test/scanner',
];
const CODE_EXT = new Set(['.js', '.mjs', '.ts', '.mts', '.tsx', '.jsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.webjs', 'vendor']);
function collectFiles(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) collectFiles(full, out); }
    else if (e.isFile() && CODE_EXT.has(extname(e.name)) && !e.name.endsWith('.d.ts')) out.push(full);
  }
}
const CORPUS = [];
for (const root of CORPUS_ROOTS) collectFiles(resolve(repoRoot, root), CORPUS);

test('corpus: scanner never misses a register()/define the AST finds', () => {
  const misses = [];
  let over = 0;
  for (const file of CORPUS) {
    let src; try { src = readFileSync(file, 'utf8'); } catch { continue; }
    let ast; try { ast = astRegistrations(src, file); } catch { continue; }
    const lex = lexerRegistrations(src);
    const rel = relative(repoRoot, file);
    for (const r of ast) if (!lex.has(r)) misses.push(`${rel}: ${r}`);
    over += [...lex].filter((r) => !ast.has(r)).length;
  }
  console.log(`[register] ${CORPUS.length} files; ${over} lexer-only over-match(es).`);
  assert.deepEqual(misses, [], `scanner MISSED a registration the AST found:\n${misses.join('\n')}`);
});

// Note on class over-matches: the extractor runs over the DEFAULT
// `redactStringsAndTemplates` mask, which keeps PLAIN string bodies verbatim (so
// a sibling `register('tag')` tag stays readable). So a `class X extends
// WebComponent` written INSIDE a plain string (test fixtures, a doc string in
// mcp-docs.js) is over-matched. That is verdict-safe (elision ships more, check
// flags more, never the reverse) and is the documented, accepted trade-off in
// the js-scan.js header. The corpus asserts only the hard direction: no MISS.
test('corpus: scanner never misses a WebComponent class the AST finds', () => {
  const misses = [];
  let over = 0;
  for (const file of CORPUS) {
    let src; try { src = readFileSync(file, 'utf8'); } catch { continue; }
    let ast; try { ast = astWebComponentClasses(src, file); } catch { continue; }
    let lex; try { lex = lexerWebComponentClasses(src); } catch (e) { misses.push(`${relative(repoRoot, file)}: EXTRACTOR ${e.message}`); continue; }
    const rel = relative(repoRoot, file);
    for (const c of ast) if (!lex.has(c)) misses.push(`${rel}: ${c}`);
    over += [...lex].filter((c) => !ast.has(c)).length;
  }
  console.log(`[class] ${CORPUS.length} files; ${over} lexer-only over-match(es).`);
  assert.deepEqual(misses, [], `extractor MISSED a WebComponent class the AST found:\n${misses.join('\n')}`);
});
