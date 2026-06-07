/**
 * Unit tests for the webjs in-template HTML parser (`src/template/parse.js`,
 * Phase 2 of #381 / #385).
 *
 * The parser turns the markup inside an `` html`…` `` tagged template into a
 * node/attribute AST with ABSOLUTE source spans and binding-modifier
 * classification, via length-preserving `${}` masking. These tests pin span
 * accuracy, binding kinds, value kinds, hole-to-expression pairing, and
 * graceful degradation on malformed input. No language service is needed: we
 * parse a source string and grab the first `` html`` `` tagged template.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let ts, parse;
before(() => {
  ts = require('typescript');
  parse = require('../../src/template/parse.js');
});

/** Parse `source`, return { doc, sf, src } for the first html`` template. */
function docFor(source) {
  const sf = ts.createSourceFile('t.ts', source, ts.ScriptTarget.ES2022, true);
  let expr;
  (function walk(node) {
    if (expr) return;
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'html') {
      expr = node;
      return;
    }
    ts.forEachChild(node, walk);
  })(sf);
  assert.ok(expr, 'found an html`` template');
  return { doc: parse.parseTemplate(ts, expr), sf, src: source };
}

/** Assert a span covers exactly `text` in the original source. */
function spanIs(src, span, text) {
  assert.equal(src.slice(span.start, span.start + span.length), text);
}

test('parses a custom-element tag with an absolute tag-name span', () => {
  const src = 'const x = html`<my-counter></my-counter>`;';
  const { doc } = docFor(src);
  assert.equal(doc.nodes.length, 1);
  const node = doc.nodes[0];
  assert.equal(node.tag, 'my-counter');
  assert.equal(node.isCustom, true);
  spanIs(src, node.tagSpan, 'my-counter');
});

test('classifies the four binding modifiers with correct bare names', () => {
  const src = 'const x = html`<my-el @click=${f} .value=${v} ?open=${b} title="hi"></my-el>`;';
  const { doc } = docFor(src);
  const attrs = doc.nodes[0].attrs;
  const by = (name) => attrs.find((a) => a.name === name);
  assert.equal(by('click').modifier, 'event');
  assert.equal(by('value').modifier, 'property');
  assert.equal(by('open').modifier, 'boolean');
  assert.equal(by('title').modifier, 'none');
  // rawName keeps the prefix; nameSpan covers the prefix too.
  assert.equal(by('click').rawName, '@click');
});

test('attribute name spans are absolute and exact (prefix included)', () => {
  const src = 'const x = html`<my-el @click=${f}></my-el>`;';
  const { doc } = docFor(src);
  spanIs(src, doc.nodes[0].attrs[0].nameSpan, '@click');
});

test('a sole-hole value is an expression bound to the right hole/expression', () => {
  const src = 'const x = html`<my-el .value=${count}></my-el>`;';
  const { doc } = docFor(src);
  const attr = doc.nodes[0].attrs[0];
  assert.equal(attr.valueKind, 'expression');
  assert.equal(attr.holeIndex, 0);
  // The paired hole's expression is the `count` identifier.
  const hole = doc.holes[attr.holeIndex];
  assert.ok(hole.expression && ts.isIdentifier(hole.expression));
  assert.equal(hole.expression.text, 'count');
  // valueSpan covers the `${count}` region.
  spanIs(src, attr.valueSpan, '${count}');
});

test('quoted static value is a string; quoted value with a hole is mixed', () => {
  const src = 'const x = html`<my-el a="static" class="x ${y}"></my-el>`;';
  const { doc } = docFor(src);
  const [a, cls] = doc.nodes[0].attrs;
  assert.equal(a.valueKind, 'string');
  spanIs(src, a.valueSpan, 'static');
  assert.equal(cls.valueKind, 'mixed');
});

test('a bare attribute with no value is boolean kind', () => {
  const src = 'const x = html`<input disabled>`;';
  const { doc } = docFor(src);
  const attr = doc.nodes[0].attrs[0];
  assert.equal(attr.name, 'disabled');
  assert.equal(attr.valueKind, 'boolean');
});

test('holes are masked length-preservingly so spans stay aligned', () => {
  const src = 'const x = html`<my-el a=${LONG_EXPRESSION_NAME} b="end"></my-el>`;';
  const { doc } = docFor(src);
  // masked is the same length as rawText (masking preserves byte length).
  assert.equal(doc.masked.length, doc.rawText.length);
  // The `b` attribute after a long hole still has a correct absolute span.
  const b = doc.nodes[0].attrs.find((at) => at.name === 'b');
  spanIs(src, b.valueSpan, 'end');
});

test('multiple holes pair with templateSpans in order', () => {
  const src = 'const x = html`<my-el a=${one} b=${two}></my-el>`;';
  const { doc } = docFor(src);
  assert.equal(doc.holes.length, 2);
  assert.equal(doc.holes[0].expression.text, 'one');
  assert.equal(doc.holes[1].expression.text, 'two');
});

test('a hole in attribute-name position does not read as an attribute', () => {
  const src = 'const x = html`<my-el ${spread} title="t"></my-el>`;';
  const { doc } = docFor(src);
  const names = doc.nodes[0].attrs.map((a) => a.name);
  assert.deepEqual(names, ['title']);
});

test('self-closing and multiple sibling nodes parse', () => {
  const src = 'const x = html`<my-a /><my-b></my-b>`;';
  const { doc } = docFor(src);
  assert.equal(doc.nodes.length, 2);
  assert.equal(doc.nodes[0].tag, 'my-a');
  assert.equal(doc.nodes[0].selfClosing, true);
  assert.equal(doc.nodes[1].tag, 'my-b');
});

test('comments and close tags are skipped, native tags kept', () => {
  const src = 'const x = html`<div><!-- c --><span>hi</span></div>`;';
  const { doc } = docFor(src);
  const tags = doc.nodes.map((nd) => nd.tag);
  assert.deepEqual(tags, ['div', 'span']);
  assert.equal(doc.nodes[0].isCustom, false);
});

test('offset query helpers resolve tag and attribute under cursor', () => {
  const src = 'const x = html`<my-counter count=${n}></my-counter>`;';
  const { doc } = docFor(src);
  const tagOff = src.indexOf('my-counter') + 2;
  assert.equal(parse.tagNameAtOffset(doc, tagOff)?.tag, 'my-counter');
  const attrOff = src.indexOf('count=') + 1;
  const hit = parse.attrNameAtOffset(doc, attrOff);
  assert.equal(hit?.attr.name, 'count');
});

test('malformed template degrades without throwing', () => {
  const src = 'const x = html`<my-el attr= <unclosed ${v}`;';
  const { doc } = docFor(src);
  assert.ok(doc, 'returns a document');
  assert.ok(Array.isArray(doc.nodes));
});

test('a no-substitution template (no holes) parses', () => {
  const src = 'const x = html`<my-el a="b"></my-el>`;';
  const { doc } = docFor(src);
  assert.equal(doc.holes.length, 0);
  assert.equal(doc.nodes[0].attrs[0].valueKind, 'string');
});
