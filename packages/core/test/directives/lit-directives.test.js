/**
 * The lit directive surface WebJs gained so a lit-trained author's code works
 * unchanged: `repeat(items, template)` with no key function, `when`,
 * `choose`, the generator helpers `map` / `join` / `range` (and any iterable
 * in a child hole), `unsafeSVG` / `unsafeMathML`, the `mathml` tag, `isServer`
 * and the `@webjsdev/core/static-html` subpath. SSR side; the client twin is
 * `browser/lit-directives.test.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, svg, mathml, isServer, renderToString } from '../../index.js';
import {
  repeat, when, choose, map, join, range, unsafeSVG, unsafeMathML,
} from '../../src/directives.js';
import {
  html as staticHtml, svg as staticSvg, literal, unsafeStatic, withStatic,
} from '../../src/static-html.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

test('repeat(items, template): the two-argument form renders every item in order', async () => {
  const out = await renderToString(html`<ul>${repeat(['a', 'b'], (x, i) => html`<li>${i}:${x}</li>`)}</ul>`);
  assert.equal(strip(out), '<ul><li>0:a</li><li>1:b</li></ul>');
});

test('repeat(items, template): keys each item by its index', () => {
  const r = repeat(['a', 'b'], (x) => x);
  assert.equal(r.keyFn('a', 0), 0);
  assert.equal(r.keyFn('b', 1), 1);
  assert.equal(r.templateFn('b', 1), 'b');
});

test('repeat(items, keyFn, template): the three-argument form is unchanged', () => {
  const r = repeat([{ id: 7 }], (x) => x.id, () => 'x');
  assert.equal(r.keyFn({ id: 7 }, 0), 7);
});

test('when: passes the condition to the case it picks', async () => {
  assert.equal(when({ n: 1 }, (c) => c.n, () => 0), 1);
  assert.equal(when(0, () => 'yes', (c) => `no:${c}`), 'no:0');
  assert.equal(when(false, () => 'yes'), undefined);
  const out = await renderToString(html`<p>${when(true, () => html`<b>on</b>`, () => html`<i>off</i>`)}</p>`);
  assert.equal(strip(out), '<p><b>on</b></p>');
});

test('choose: strict equality, then the default case', () => {
  const cases = [['a', () => 1], ['b', () => 2]];
  assert.equal(choose('b', cases), 2);
  assert.equal(choose('z', cases, () => 9), 9);
  assert.equal(choose('z', cases), undefined);
  assert.equal(choose(1, [['1', () => 'string']], () => 'default'), 'default');
});

test('map / join / range: lit-shaped generators', () => {
  assert.deepEqual([...range(3)], [0, 1, 2]);
  assert.deepEqual([...range(1, 4)], [1, 2, 3]);
  assert.deepEqual([...range(0, 10, 4)], [0, 4, 8]);
  assert.deepEqual([...range(3, 0, -1)], [3, 2, 1]);
  assert.deepEqual([...map(['a', 'b'], (x, i) => x + i)], ['a0', 'b1']);
  assert.deepEqual([...map(undefined, (x) => x)], []);
  assert.deepEqual([...join(['a', 'b', 'c'], '|')], ['a', '|', 'b', '|', 'c']);
  assert.deepEqual([...join(['a', 'b', 'c'], (i) => i)], ['a', 0, 'b', 1, 'c']);
});

test('a generator renders like an array at SSR', async () => {
  const out = await renderToString(html`<ul>${map(range(3), (i) => html`<li>${i}</li>`)}</ul>`);
  assert.equal(strip(out), '<ul><li>0</li><li>1</li><li>2</li></ul>');
});

test('any iterable renders like an array at SSR (a Set, a join)', async () => {
  const out = await renderToString(html`<p>${new Set(['x', 'y'])}</p><p>${join(['a', 'b'], html`<hr>`)}</p>`);
  assert.equal(strip(out), '<p>xy</p><p>a<hr>b</p>');
});

test('a string hole is never iterated character by character', async () => {
  const out = await renderToString(html`<p>${'<b>'}</p>`);
  assert.equal(strip(out), '<p>&lt;b&gt;</p>');
});

test('unsafeSVG / unsafeMathML emit their markup verbatim at SSR', async () => {
  assert.equal(unsafeSVG('<circle r="1"></circle>').ns, 'svg');
  assert.equal(unsafeMathML('<mi>x</mi>').ns, 'mathml');
  const out = await renderToString(html`<svg>${unsafeSVG('<circle r="1"></circle>')}</svg><math>${unsafeMathML('<mi>x</mi>')}</math>`);
  assert.equal(strip(out), '<svg><circle r="1"></circle></svg><math><mi>x</mi></math>');
});

test('mathml tag: a template flagged mathml, rendered like html at SSR', async () => {
  const t = mathml`<mi>${'y'}</mi>`;
  assert.equal(t.mathml, true);
  assert.equal(t._$webjs, 'template');
  const out = await renderToString(html`<math>${t}</math>`);
  assert.equal(strip(out), '<math><mi>y</mi></math>');
});

test('isServer is true under Node', () => {
  assert.equal(isServer, true);
});

test('static-html: a literal tag name is spliced into the strings', async () => {
  const tag = literal`my-static-el`;
  const out = await renderToString(staticHtml`<${tag} title=${'t'}>${'body'}</${tag}>`);
  assert.equal(strip(out), '<my-static-el title="t">body</my-static-el>');
});

test('static-html: the merged strings array is stable across renders', () => {
  const a = staticHtml`<${literal`h2`}>${1}</${literal`h2`}>`;
  const b = staticHtml`<${literal`h2`}>${2}</${literal`h2`}>`;
  assert.equal(a.strings, b.strings, 'same static shape must reuse one strings array');
  assert.deepEqual(a.values, [1]);
  const c = staticHtml`<${literal`h3`}>${1}</${literal`h3`}>`;
  assert.notEqual(a.strings, c.strings, 'a different static is a different shape');
});

test('static-html: unsafeStatic trusts a runtime string; literal refuses a plain value', async () => {
  const level = 'h4';
  const out = await renderToString(staticHtml`<${unsafeStatic(level)}>x</${unsafeStatic(level)}>`);
  assert.equal(strip(out), '<h4>x</h4>');
  assert.throws(() => literal`a${'b'}`, /must be a 'literal' result.*unsafeStatic/);
  assert.equal(literal`a${literal`b`}c`._$webjsStatic, 'abc');
});

test('static-html: no static values passes the original strings through', () => {
  const t = staticHtml`<p>${1}</p>`;
  assert.equal(t.strings.length, 2);
  assert.equal(staticSvg`<rect/>`.svg, true);
  const tag = withStatic((s, ...v) => ({ s, v }));
  assert.deepEqual(tag`a${unsafeStatic('X')}b${2}c`.s.slice(), ['aXb', 'c']);
});
