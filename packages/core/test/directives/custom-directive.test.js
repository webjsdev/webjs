/**
 * Custom directive authoring (`@webjsdev/core/directive` and
 * `@webjsdev/core/async-directive`, lit's API) on the SERVER renderer: every
 * part type resolves a directive to its `render()` result, with lit's part
 * info. The client twin is `browser/custom-directive.test.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString } from '../../index.js';
import { directive, Directive, PartType, isDirectiveResult, getDirectiveClass } from '../../src/directive.js';
import { AsyncDirective, directive as asyncDirectiveFn } from '../../src/async-directive.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** @type {any[]} */
let infos = [];
class Upper extends Directive {
  constructor(partInfo) {
    super(partInfo);
    infos.push(partInfo);
  }
  render(text) { return String(text).toUpperCase(); }
}
const upper = directive(Upper);

test('directive(): a result is a branded marker carrying the class and arguments', () => {
  const r = upper('a', 2);
  assert.equal(r._$webjs, 'directive');
  assert.equal(r.ctor, Upper);
  assert.deepEqual(r.values, ['a', 2]);
  assert.ok(isDirectiveResult(r));
  assert.ok(!isDirectiveResult({ _$webjs: 'template' }));
  assert.equal(getDirectiveClass(r), Upper);
  assert.equal(getDirectiveClass('x'), undefined);
});

test('PartType carries lit\'s values', () => {
  assert.deepEqual({ ...PartType }, { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 });
});

test('SSR: a child directive renders its render() result, with CHILD part info', async () => {
  infos = [];
  const out = await renderToString(html`<p>${upper('hi')}</p>`);
  assert.equal(strip(out), '<p>HI</p>');
  assert.equal(infos[0].type, PartType.CHILD);
});

test('SSR: attribute, quoted piece and boolean parts resolve with their part info', async () => {
  infos = [];
  const on = directive(class extends Directive { render(v) { return v; } });
  const out = await renderToString(html`<a title=${upper('t')} class="x ${upper('y')} z" ?hidden=${on(true)}></a>`);
  assert.equal(strip(out), '<a title="T" class="x Y z" hidden=""></a>');
  assert.equal(infos[0].type, PartType.ATTRIBUTE);
  assert.equal(infos[0].name, 'title');
  assert.equal(infos[0].tagName, 'A');
  assert.equal(infos[1].type, PartType.ATTRIBUTE);
  assert.equal(infos[1].name, 'class');
});

test('SSR: a directive returning a template or another directive resolves fully', async () => {
  const wrap = directive(class extends Directive { render(v) { return html`<b>${upper(v)}</b>`; } });
  const twice = directive(class extends Directive { render(v) { return upper(v + v); } });
  const out = await renderToString(html`<p>${wrap('a')}${twice('b')}</p>`);
  assert.equal(strip(out), '<p><b>A</b>BB</p>');
});

test('SSR: a directive inside an array item resolves too', async () => {
  const out = await renderToString(html`<p>${['a', 'b'].map((x) => upper(x))}</p>`);
  assert.equal(strip(out), '<p>AB</p>');
});

test('SSR: an AsyncDirective renders render() and setValue is a no-op', async () => {
  let called = false;
  class Later extends AsyncDirective {
    render(v) {
      this.setValue('never');
      called = this.isConnected;
      return v;
    }
  }
  const later = asyncDirectiveFn(Later);
  const out = await renderToString(html`<p>${later('now')}</p>`);
  assert.equal(strip(out), '<p>now</p>');
  assert.equal(called, true);
});

test('AsyncDirective: connection transitions call the hooks once each', () => {
  const log = [];
  class D extends AsyncDirective {
    render() { return ''; }
    disconnected() { log.push('d'); }
    reconnected() { log.push('r'); }
  }
  const d = new D({ type: PartType.CHILD });
  d._$webjsSetConnected(true);
  d._$webjsSetConnected(false);
  d._$webjsSetConnected(false);
  d._$webjsSetConnected(true);
  assert.deepEqual(log, ['d', 'r']);
});
