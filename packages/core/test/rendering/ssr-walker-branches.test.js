/**
 * Branch coverage for the one-pass renderer (#1646): the shapes the golden
 * corpus and the edge suite leave untaken. A bare registered class with no
 * lifecycle, a non-Error throw, slot names in every quoting, the default
 * aliases and extra attributes on a `<slot>`, the watch / ref / asyncAppend
 * directives, self-closed boundary and slot tags, an outer end tag closing
 * an unclosed inner frame, a processing instruction, a stray `<`, and a
 * template that ends inside a tag name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString, WebComponent, signal } from '../../index.js';
import { register } from '../../src/registry.js';
import { watch, ref, createRef, asyncAppend, asyncReplace } from '../../src/directives.js';
import { browserMemberHint, defaultSSRErrorTemplate } from '../../src/render-server/errors.js';

class Bare {}
register('bare-class', Bare);

class StringThrow extends WebComponent {
  render() { throw 'not an error'; } // eslint-disable-line no-throw-literal
}
StringThrow.register('bare-string-throw');

class SlotShapes extends WebComponent {
  render() {
    return html`<slot name='single'>s</slot><slot name=bare>b</slot><slot name="default" class="x">d</slot><slot name="">e</slot><slot/>`;
  }
}
SlotShapes.register('bare-slot-shapes');

class Inner extends WebComponent {
  render() { return html`<i>inner</i>`; }
}
Inner.register('bare-inner');

class Outer extends WebComponent {
  render() { return html`<p><slot></slot></p>`; }
}
Outer.register('bare-outer');

async function quiet(fn) {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
}

test('a bare registered class with no lifecycle renders as a transparent host', async () => {
  const out = await renderToString(html`<bare-class title="t"><p>kept</p></bare-class>`);
  assert.equal(out, '<bare-class title="t" data-wj-host><!--webjs-hydrate--><p>kept</p></bare-class>');
});

test('a non-Error throw is wrapped and reported', async () => {
  const out = await quiet(() => renderToString(html`<bare-string-throw></bare-string-throw>`, { ssr: true, dev: true }));
  assert.match(out, /failed to render/);
  assert.match(out, /not an error/);
});

test('slot names in every quoting, the default aliases, extra attributes and a self-closed slot', async () => {
  const out = await renderToString(html`<bare-slot-shapes><b slot="single">S</b><u slot="bare">B</u>D</bare-slot-shapes>`);
  assert.match(out, /data-projection="actual" data-wj-slot-owner="bare-slot-shapes" name="single"><b slot="single">S<\/b><\/slot>/);
  assert.match(out, /data-projection="actual" data-wj-slot-owner="bare-slot-shapes" name="bare"><u slot="bare">B<\/u><\/slot>/);
  assert.match(out, /data-projection="actual" data-wj-slot-owner="bare-slot-shapes" name="default" class="x">D<\/slot>/, 'name="default" is the default slot, first wins, extra attributes kept');
  assert.match(out, /data-projection="fallback" data-wj-slot-owner="bare-slot-shapes" name="">e<\/slot>/, 'a later same-key slot falls back');
  assert.match(out, /data-projection="fallback" data-wj-slot-owner="bare-slot-shapes"><\/slot><\/bare-slot-shapes>$/, 'a self-closed slot has an empty fallback');
});

test('watch(), ref() and asyncAppend / asyncReplace at SSR', async () => {
  const s = signal('w');
  const r = createRef();
  async function* gen() { yield 'a'; }
  const out = await renderToString(html`<p>${watch(s)}${ref(r)}${asyncAppend(gen())}${asyncReplace(gen())}</p>`);
  assert.equal(out, '<p>w</p>');
});

test('a self-closed boundary and an outer end tag closing an unclosed inner frame', async () => {
  const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
  const out = await renderToString(html`<webjs-suspense .fallback=${html`f`}/><bare-outer><bare-inner></bare-outer>`, { ssr: true, suspenseCtx: ctx });
  assert.match(out, /^<webjs-suspense id="s1">f<\/webjs-suspense>/);
  assert.equal(ctx.pending.length, 1);
  assert.match(out, /<bare-outer data-wj-host><!--webjs-hydrate--><p><slot data-webjs-light data-projection="actual" data-wj-slot-owner="bare-outer"><bare-inner data-wj-host><!--webjs-hydrate--><i>inner<\/i><\/bare-inner><\/slot><\/p><\/bare-outer>$/);
});

test('a processing instruction, a stray <, and a template ending inside a tag name are text', async () => {
  assert.equal(await renderToString(html`<?xml version="1.0"?><p>a < b</p><1>`), '<?xml version="1.0"?><p>a < b</p><1>');
  assert.equal(await renderToString(html`<div`), '<div');
  assert.equal(await renderToString(html`<bare-inner`), '<bare-inner');
});

test('the error helpers tolerate a throw with no message', () => {
  assert.equal(browserMemberHint({}), null);
  assert.equal(browserMemberHint(null), null);
  const tpl = defaultSSRErrorTemplate('x-y', /** @type any */ (new Error('')), true);
  assert.ok(tpl && typeof tpl === 'object', 'a dev error template is returned for an empty message');
  assert.equal(defaultSSRErrorTemplate('x-y', new Error('m'), false), '');
});
