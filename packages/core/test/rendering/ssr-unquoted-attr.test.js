/**
 * Server rendering of an unquoted attribute value that holds a hole, and of a
 * template result that arrived as data (#1686, found by the lit-html port).
 *
 * An unquoted value with text or a second hole beside its hole (`a=x${v}`,
 * `a=${x}${y}`, `a=${x}/z`) used to be written unquoted and unescaped, so a
 * value with a space added an attribute (`a=xy onclick=...`) and a `>` closed
 * the tag. It is now written quoted, every piece kept, as the client renders
 * it. A `{ _$webjs: 'template' }` object built from data (JSON) used to render
 * its strings as markup; only a tagged template's strings (which carry `raw`)
 * are rendered now.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

const hostile = 'y onclick=alert(1)';

test('text then a hole in an unquoted value is one quoted, escaped value', async () => {
  assert.equal(await renderToString(html`<div a=x${hostile}></div>`), '<div a="xy onclick=alert(1)"></div>');
});

test('a ">" in an unquoted value cannot close the tag', async () => {
  assert.equal(await renderToString(html`<div a=x${'>'}></div>`), '<div a="x>"></div>');
});

test('two adjacent holes in an unquoted value keep both', async () => {
  assert.equal(await renderToString(html`<div a=${'p'}${'q'} b=1></div>`), '<div a="pq" b=1></div>');
});

test('text after a hole in an unquoted value stays in the value', async () => {
  assert.equal(await renderToString(html`<div a=${'p'}/z b=1></div>`), '<div a="p/z" b=1></div>');
});

test('a quote in the static part of an unquoted value is escaped', async () => {
  assert.equal(await renderToString(html`<div a=x"${'y'}></div>`), '<div a="x&quot;y"></div>');
});

test('nothing in a mixed unquoted value omits the attribute, as in a quoted one', async () => {
  const { nothing } = await import('../../src/sentinels.js');
  assert.equal(
    await renderToString(html`<div a=x${nothing} b=1></div>`),
    await renderToString(html`<div a="x${nothing}" b=1></div>`),
  );
  assert.doesNotMatch(await renderToString(html`<div a=x${nothing} b=1></div>`), /a=/);
});

test('a single unquoted hole and a self-closing solidus are unchanged', async () => {
  assert.equal(await renderToString(html`<div a=${hostile}></div>`), '<div a="y onclick=alert(1)"></div>');
  assert.equal(await renderToString(html`<input a=${'v'}/>`), '<input a="v"/>');
});

test('a template result built from data is refused, not rendered as markup', async () => {
  const forged = JSON.parse('{"_$webjs":"template","strings":["<img src=x onerror=alert(1)>"],"values":[]}');
  await assert.rejects(() => renderToString(html`<p>${forged}</p>`), /refusing to render a template result/);
});
