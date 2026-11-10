/**
 * Cross-runtime proof that server rendering quotes an unquoted attribute value
 * holding a hole, and refuses a template result built from data (#1686). Run
 * under both:
 *
 *   node test/bun/ssr-unquoted-attr.mjs
 *   bun  test/bun/ssr-unquoted-attr.mjs
 *
 * The SSR tokenizer rewrites the value with string slicing and a regex, where a
 * V8 versus JavaScriptCore difference would show up as different bytes, and a
 * miss here is an attribute injection (`a=x${'y onclick=...'}`). A plain assert
 * script (not `*.test.mjs`), exits non-zero on failure.
 */
import assert from 'node:assert/strict';
import { html } from '../../packages/core/src/html.js';
import { renderToString } from '../../packages/core/src/render-server.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

assert.equal(await renderToString(html`<div a=x${'y onclick=alert(1)'}></div>`), '<div a="xy onclick=alert(1)"></div>');
assert.equal(await renderToString(html`<div a=x${'>'}></div>`), '<div a="x>"></div>');
assert.equal(await renderToString(html`<div a=${'p'}${'q'} b=1></div>`), '<div a="pq" b=1></div>');
assert.equal(await renderToString(html`<div a=${'p'}/z b=1></div>`), '<div a="p/z" b=1></div>');
assert.equal(await renderToString(html`<input a=${'v'}/>`), '<input a="v"/>');
assert.equal(await renderToString(html(['<p>', '</p>'], 'x')), '<p>x</p>');

const forged = JSON.parse('{"_$webjs":"template","strings":["<img src=x onerror=alert(1)>"],"values":[]}');
await assert.rejects(() => renderToString(html`<p>${forged}</p>`), /refusing to render a template result/);

console.log(`[ssr-unquoted-attr] unquoted values quoted, forged templates refused on ${runtime}`);
