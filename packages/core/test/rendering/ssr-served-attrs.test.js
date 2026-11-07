/**
 * The server serves a custom element's attributes as the element left them
 * after the server pass, the way lit-ssr's `renderAttributes()` does: one it
 * changed carries its new value, one it removed is dropped, one it added is
 * appended, and one it left alone keeps its source text byte for byte. Before
 * this, an attribute the tag was written with was always served as written,
 * so a component that hands its class to the element it renders (shadcn's
 * `className`) was served with the class on both, and the first paint drew
 * two boxes until the page hydrated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from '../../src/render-server.js';
import { html } from '../../src/html.js';
import { WebComponent, prop } from '../../src/component.js';

class MovesClass extends WebComponent {
  render() {
    // The kit's move-the-class shape: read the author's class, keep it off
    // the host, render it on the box.
    const authored = this.getAttribute('class');
    this.removeAttribute('class');
    this.setAttribute('style', 'display: contents');
    return html`<div class=${`box ${authored ?? ''}`}></div>`;
  }
}
MovesClass.register('served-moves-class');

class Edits extends WebComponent({ data: prop(Object), open: prop(Boolean, { reflect: true }) }) {
  render() {
    this.setAttribute('data-state', 'open');
    this.removeAttribute('data-gone');
    this.setAttribute('role', 'group');
    return html`<i>${this.data?.n ?? ''}</i>`;
  }
}
Edits.register('served-edits');

class Untouched extends WebComponent {
  render() { return html`<b>u</b>`; }
}
Untouched.register('served-untouched');

test('an attribute the element changed is served with its new value, and one it removed is dropped', async () => {
  const out = await renderToString(html`<served-edits data-state="closed" data-gone="x" title="t"></served-edits>`);
  const tag = out.match(/<served-edits[^>]*>/)[0];
  assert.match(tag, /\sdata-state="open"/, 'the changed value');
  assert.doesNotMatch(tag, /data-state="closed"/);
  assert.doesNotMatch(tag, /data-gone/, 'the removed attribute is gone');
  assert.match(tag, /\stitle="t"/, 'the untouched one stays');
  assert.match(tag, /\srole="group"/, 'and the added one is appended');
});

test('a moved class leaves the host: one box on the first paint', async () => {
  const out = await renderToString(html`<served-moves-class class="max-w-sm border"></served-moves-class>`);
  const tag = out.match(/<served-moves-class[^>]*>/)[0];
  assert.doesNotMatch(tag, /\sclass=/, 'the host no longer carries the class');
  assert.match(tag, /style="display: contents"/);
  assert.match(out, /<div class="box max-w-sm border">/, 'the box does');
});

test('a value from a template hole follows the same rule', async () => {
  const cls = 'from-hole';
  const out = await renderToString(html`<served-moves-class class=${cls}></served-moves-class>`);
  assert.doesNotMatch(out.match(/<served-moves-class[^>]*>/)[0], /\sclass=/);
  assert.match(out, /<div class="box from-hole">/);
});

test('an untouched attribute keeps its source text byte for byte, and a .prop binding is kept as written', async () => {
  const src = html`<served-untouched title='t &amp; u' data-x=bare hidden></served-untouched>`;
  const out = await renderToString(src);
  assert.match(out, /^<served-untouched title='t &amp; u' data-x=bare hidden data-wj-host>/, 'quoting, entities and order unchanged');
  const withProp = await renderToString(html`<served-edits .data=${{ n: 1 }}></served-edits>`);
  assert.match(withProp, /data-webjs-prop-data="\{&quot;n&quot;:1\}"/, 'the prop carrier, which the instance never holds, is kept');
  assert.match(withProp, /<i>1<\/i>/);
});

test('a reflected property still lands in the tag, and nothing changes for an element that touches nothing', async () => {
  const out = await renderToString(html`<served-edits ?open=${true}></served-edits>`);
  assert.match(out.match(/<served-edits[^>]*>/)[0], /\sopen(=""|\s|>)/);
  const plain = await renderToString(html`<served-untouched class="a" id="b"></served-untouched>`);
  assert.equal(plain, '<served-untouched class="a" id="b" data-wj-host><!--webjs-hydrate--><b>u</b></served-untouched>');
});
