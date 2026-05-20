import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString } from '../packages/core/index.js';
import { unsafeHTML, isUnsafeHTML, live, isLive, keyed, isKeyed, guard, isGuard, templateContent, isTemplateContent, ref, isRef, createRef, cache, isCache, until, isUntil, asyncAppend, isAsyncAppend, asyncReplace, isAsyncReplace } from '../packages/core/src/directives.js';

// --- unsafeHTML ---

test('unsafeHTML: creates marker with correct shape', () => {
  const result = unsafeHTML('<b>bold</b>');
  assert.equal(result._$webjs, 'unsafe-html');
  assert.equal(result.value, '<b>bold</b>');
});

test('unsafeHTML: coerces null/undefined to empty string', () => {
  assert.equal(unsafeHTML(null).value, '');
  assert.equal(unsafeHTML(undefined).value, '');
});

test('isUnsafeHTML: detects markers', () => {
  assert.ok(isUnsafeHTML(unsafeHTML('hi')));
  assert.ok(!isUnsafeHTML('hi'));
  assert.ok(!isUnsafeHTML(null));
  assert.ok(!isUnsafeHTML({ _$webjs: 'template' }));
});

test('unsafeHTML: server renderer injects raw HTML without escaping', async () => {
  const result = await renderToString(html`<div>${unsafeHTML('<b>bold</b>')}</div>`);
  assert.ok(result.includes('<b>bold</b>'), `Expected raw HTML, got: ${result}`);
  // Normal text would be escaped
  const escaped = await renderToString(html`<div>${'<b>bold</b>'}</div>`);
  assert.ok(escaped.includes('&lt;b&gt;'), 'Normal text should be escaped');
});

test('unsafeHTML: empty string renders nothing', async () => {
  const result = await renderToString(html`<div>${unsafeHTML('')}</div>`);
  assert.ok(result.includes('<div></div>'));
});

// --- live ---

test('live: creates marker with correct shape', () => {
  const result = live('hello');
  assert.equal(result._$webjs, 'live');
  assert.equal(result.value, 'hello');
});

test('isLive: detects markers', () => {
  assert.ok(isLive(live('x')));
  assert.ok(!isLive('x'));
  assert.ok(!isLive(null));
});

test('live: server renderer unwraps to inner value', async () => {
  const result = await renderToString(html`<div>${live('hello')}</div>`);
  assert.ok(result.includes('hello'), `Expected unwrapped value, got: ${result}`);
});

// --- keyed (lit-html parity) ---

test('keyed: creates marker with correct shape', () => {
  const tpl = html`<p>hi</p>`;
  const r = keyed('k1', tpl);
  assert.equal(r._$webjs, 'keyed');
  assert.equal(r.key, 'k1');
  assert.equal(r.value, tpl);
});

test('isKeyed: detects markers', () => {
  assert.ok(isKeyed(keyed('k', null)));
  assert.ok(!isKeyed({ _$webjs: 'live' }));
  assert.ok(!isKeyed(null));
});

test('keyed: SSR renders the wrapped template', async () => {
  const result = await renderToString(html`<section>${keyed('a', html`<p>hello</p>`)}</section>`);
  assert.ok(result.includes('<p>hello</p>'), `Expected wrapped template, got: ${result}`);
});

// --- guard (lit-html parity) ---

test('guard: creates marker with correct shape', () => {
  const fn = () => 'x';
  const r = guard([1, 2], fn);
  assert.equal(r._$webjs, 'guard');
  assert.deepEqual(r.deps, [1, 2]);
  assert.equal(r.fn, fn);
});

test('isGuard: detects markers', () => {
  assert.ok(isGuard(guard([], () => null)));
  assert.ok(!isGuard({ _$webjs: 'live' }));
});

test('guard: SSR always invokes the function', async () => {
  let calls = 0;
  const result = await renderToString(
    html`<div>${guard([1, 2], () => { calls++; return html`<p>v</p>`; })}</div>`,
  );
  assert.equal(calls, 1);
  assert.ok(result.includes('<p>v</p>'));
});

// --- templateContent (lit-html parity) ---

test('templateContent: SSR emits the template element innerHTML', async () => {
  const fakeTpl = { innerHTML: '<span>cloned</span>' };
  const result = await renderToString(html`<div>${templateContent(fakeTpl)}</div>`);
  assert.ok(result.includes('<span>cloned</span>'), `Expected innerHTML emitted, got: ${result}`);
});

test('isTemplateContent: detects markers', () => {
  assert.ok(isTemplateContent(templateContent({ innerHTML: '' })));
  assert.ok(!isTemplateContent({ _$webjs: 'live' }));
});

// --- ref / createRef (lit-html parity) ---

test('ref: SSR is a no-op (produces empty output)', async () => {
  const r = createRef();
  const result = await renderToString(html`<div>${ref(r)}</div>`);
  assert.ok(result.includes('<div></div>') || /<div>\s*<\/div>/.test(result),
    `Expected empty div, got: ${result}`);
});

test('isRef: detects markers', () => {
  assert.ok(isRef(ref(createRef())));
  assert.ok(!isRef({ _$webjs: 'live' }));
});

test('createRef: returns a { value: undefined } object', () => {
  const r = createRef();
  assert.deepEqual(r, { value: undefined });
});

// --- cache (lit-html parity) ---

test('cache: creates marker', () => {
  const r = cache(html`<p>v</p>`);
  assert.equal(r._$webjs, 'cache');
});

test('isCache: detects markers', () => {
  assert.ok(isCache(cache(null)));
  assert.ok(!isCache({ _$webjs: 'live' }));
});

test('cache: SSR passes through to the inner value', async () => {
  const result = await renderToString(html`<div>${cache(html`<p>hello</p>`)}</div>`);
  assert.ok(result.includes('<p>hello</p>'));
});

// --- until (lit-html parity) ---

test('until: creates marker', () => {
  const r = until('a', 'b');
  assert.equal(r._$webjs, 'until');
  assert.deepEqual(r.args, ['a', 'b']);
});

test('isUntil: detects markers', () => {
  assert.ok(isUntil(until('x')));
  assert.ok(!isUntil({ _$webjs: 'live' }));
});

test('until: SSR renders first synchronous candidate', async () => {
  const promise = new Promise(() => {});  // never resolves
  const result = await renderToString(html`<div>${until(promise, 'fallback')}</div>`);
  assert.ok(result.includes('fallback'));
});

test('until: SSR awaits first Promise when all candidates are Promises', async () => {
  const result = await renderToString(
    html`<div>${until(Promise.resolve('won'), new Promise(() => {}))}</div>`,
  );
  assert.ok(result.includes('won'));
});

// --- asyncAppend / asyncReplace ---

test('asyncAppend: creates marker', () => {
  async function* gen() { yield 'a'; }
  const r = asyncAppend(gen());
  assert.equal(r._$webjs, 'async-append');
  assert.equal(typeof r.iterable[Symbol.asyncIterator], 'function');
});

test('isAsyncAppend: detects markers', () => {
  async function* gen() {}
  assert.ok(isAsyncAppend(asyncAppend(gen())));
  assert.ok(!isAsyncAppend({ _$webjs: 'live' }));
});

test('asyncReplace: creates marker', () => {
  async function* gen() { yield 'a'; }
  const r = asyncReplace(gen());
  assert.equal(r._$webjs, 'async-replace');
});

test('isAsyncReplace: detects markers', () => {
  async function* gen() {}
  assert.ok(isAsyncReplace(asyncReplace(gen())));
  assert.ok(!isAsyncReplace({ _$webjs: 'live' }));
});

test('asyncAppend: SSR renders empty (streaming is deferred)', async () => {
  async function* gen() { yield 'one'; yield 'two'; }
  const result = await renderToString(html`<div>${asyncAppend(gen())}</div>`);
  assert.ok(result.includes('<div></div>') || /<div>\s*<\/div>/.test(result));
});

test('asyncReplace: SSR renders empty (streaming is deferred)', async () => {
  async function* gen() { yield 'one'; }
  const result = await renderToString(html`<div>${asyncReplace(gen())}</div>`);
  assert.ok(result.includes('<div></div>') || /<div>\s*<\/div>/.test(result));
});
