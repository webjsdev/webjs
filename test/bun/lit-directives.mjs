/**
 * Cross-runtime proof that the lit directive surface (iterables in a child
 * hole, `repeat(items, template)`, `when` / `choose` / `map` / `join` /
 * `range`, `unsafeSVG`, the `mathml` tag, `isServer`, and the
 * `@webjsdev/core/static-html` subpath) renders identically under WHICHEVER
 * runtime executes this file:
 *
 *   node test/bun/lit-directives.mjs
 *   bun  test/bun/lit-directives.mjs
 *
 * The iterable branch sits in the SSR walker's value ladder, which is on the
 * hot path and runtime-sensitive. Run from the repo root so the bare
 * `@webjsdev/core` specifier resolves to the workspace package (the BUILT
 * bundle under Bun, so rebuild dist first).
 */
import assert from 'node:assert/strict';
import {
  html, mathml, isServer, repeat, when, choose, map, join, range, unsafeSVG,
} from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import { html as staticHtml, literal } from '@webjsdev/core/static-html';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

assert.equal(isServer, true, `${runtime}: isServer`);

const out = strip(await renderToString(html`<ul>${map(range(3), (i) => html`<li>${i}</li>`)}</ul>`));
assert.equal(out, '<ul><li>0</li><li>1</li><li>2</li></ul>', `${runtime}: generator child`);

assert.equal(
  strip(await renderToString(html`<p>${new Set(['x', 'y'])}${join(['a', 'b'], '|')}</p>`)),
  '<p>xya|b</p>',
  `${runtime}: Set and join`,
);

assert.equal(
  strip(await renderToString(html`<ol>${repeat(['a', 'b'], (x, i) => html`<li>${i}${x}</li>`)}</ol>`)),
  '<ol><li>0a</li><li>1b</li></ol>',
  `${runtime}: repeat two-argument form`,
);

assert.equal(
  strip(await renderToString(html`${when(1, () => 'T', () => 'F')}${choose('b', [['a', () => 1], ['b', () => 2]])}`)),
  'T2',
  `${runtime}: when / choose`,
);

assert.equal(
  strip(await renderToString(html`<svg>${unsafeSVG('<circle r="1"></circle>')}</svg><math>${mathml`<mi>${'x'}</mi>`}</math>`)),
  '<svg><circle r="1"></circle></svg><math><mi>x</mi></math>',
  `${runtime}: unsafeSVG and the mathml tag`,
);

const tag = literal`my-static-el`;
assert.equal(
  strip(await renderToString(staticHtml`<${tag}>${'b'}</${tag}>`)),
  '<my-static-el>b</my-static-el>',
  `${runtime}: static-html literal tag`,
);

console.log(`lit-directives: OK on ${runtime}`);
