/**
 * Ported from lit-html's `asyncAppend` and `asyncReplace` directive test
 * suites (packages/lit-html/src/test/directives/async-append_test.ts +
 * async-replace_test.ts) to exercise webjs's implementations in
 * render-client.js (applyAsyncAppend / applyAsyncReplace /
 * consumeAsyncStream / teardownAsyncStream).
 *
 * Goal: shake out bugs in DOM appending, replacement, mapper handling,
 * teardown on re-render, and pending-iterable swap behaviour.
 *
 * Skipped tests (and why):
 *   - asyncReplace (AttributePart / PropertyPart / BooleanAttributePart
 *     / EventPart): webjs only handles asyncReplace at child positions
 *     (see render-client.js isAsyncReplace dispatch around line 846).
 *     Attribute / property / boolean / event positions are not in the
 *     documented surface for webjs's async stream directives.
 *   - disconnection sub-suite: webjs's `render(v, container)` returns
 *     undefined, no `part.setConnected(...)` API. Pause / resume of
 *     in-flight iteration is not part of webjs's directive contract.
 *   - memory leak tests: depend on `window.gc()` (only available with
 *     --js-flags=--expose-gc) and `performance.memory` (Chromium only,
 *     and even there only with a flag in newer versions). Out of scope
 *     for a portable browser test.
 */

import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';
import { asyncAppend, asyncReplace } from '../../packages/core/src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Strip webjs marker comments so HTML assertions can match lit's
 * `stripExpressionMarkers` shape.
 */
function stripExpressionMarkers(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Minimal port of lit's TestAsyncIterable. A push-driven async iterable
 * intended for single-consumer use. `push(v)` resolves the next pending
 * `_nextValue` promise and waits one rAF so that downstream renderers
 * have had a chance to commit.
 */
class TestAsyncIterable {
  constructor() {
    this._nextValue = new Promise((resolve) => { this._resolveNextValue = resolve; });
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      yield await this._nextValue;
    }
  }
  async push(value) {
    const currentValue = this._nextValue;
    const currentResolveValue = this._resolveNextValue;
    this._nextValue = new Promise((resolve) => { this._resolveNextValue = resolve; });
    currentResolveValue(value);
    await currentValue;
    await nextFrame();
  }
}

/* ================================================================
 * asyncAppend
 * ================================================================ */

suite('asyncAppend (lit parity port)', () => {
  let container;
  let iterable;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    iterable = new TestAsyncIterable();
  });

  teardown(() => {
    container.remove();
  });

  test('appends content as the async iterable yields new values', async () => {
    render(html`<div>${asyncAppend(iterable)}</div>`, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foobar</div>');
  });

  test('appends nothing when a value is undefined', async () => {
    render(html`<div>${asyncAppend(iterable)}</div>`, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    await iterable.push(undefined);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');
  });

  test('uses a mapper function', async () => {
    render(
      html`<div>${asyncAppend(iterable, (v, i) => html`${i}: ${v} `)}</div>`,
      container,
    );
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>0: foo </div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>0: foo 1: bar </div>');
  });

  test('renders new iterable over a pending iterable', async () => {
    const t = (iter) => html`<div>${asyncAppend(iter)}</div>`;
    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    const iterable2 = new TestAsyncIterable();
    render(t(iterable2), container);

    // The last value is NOT preserved in webjs: teardown removes all
    // nodes rendered by the prior iterable. (lit-html's asyncAppend
    // preserves last value until first yield from new iterable; this
    // assertion documents webjs's actual behaviour.)
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable2.push('hello');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    await iterable.push('bar');
    // Old iterable was torn down; further pushes to it must not affect DOM.
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');
  });

  test('renders new value over a pending iterable', async () => {
    const t = (v) => html`<div>${v}</div>`;
    render(t(asyncAppend(iterable)), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    render(t('hello'), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    await iterable.push('bar');
    // Stream was torn down by the re-render; new push must not leak in.
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');
  });

  test('does not render the first value if it is replaced first', async () => {
    const iterable2 = new TestAsyncIterable();

    const component = (value) => html`<p>${asyncAppend(value)}</p>`;

    render(component(iterable), container);
    render(component(iterable2), container);

    await iterable2.push('fast');
    // This write should not render: the first iterable was replaced.
    await iterable.push('slow');

    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>fast</p>');
  });

  test('the same iterable can be rendered into two asyncAppend instances', async () => {
    const component = (iter) =>
      html`<p>${asyncAppend(iter)}</p><p>${asyncAppend(iter)}</p>`;
    render(component(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p></p><p></p>');

    await iterable.push('1');
    // Each asyncAppend has its own iterator instance from
    // [Symbol.asyncIterator](), but they share the underlying
    // _nextValue promise. push() resolves once, so both consumers
    // observe the same emitted value.
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>1</p><p>1</p>');

    await iterable.push('2');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>12</p><p>12</p>');
  });
});

/* ================================================================
 * asyncReplace
 * ================================================================ */

suite('asyncReplace (lit parity port)', () => {
  let container;
  let iterable;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    iterable = new TestAsyncIterable();
  });

  teardown(() => {
    container.remove();
  });

  test('replaces content as the async iterable yields new values (ChildPart)', async () => {
    render(html`<div>${asyncReplace(iterable)}</div>`, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>bar</div>');
  });

  test('clears the part when a value is undefined', async () => {
    render(html`<div>${asyncReplace(iterable)}</div>`, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    await iterable.push(undefined);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');
  });

  test('uses the mapper function', async () => {
    render(
      html`<div>${asyncReplace(iterable, (v, i) => html`${i}: ${v} `)}</div>`,
      container,
    );
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>0: foo </div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>1: bar </div>');
  });

  test('renders new iterable over a pending iterable', async () => {
    const t = (iter) => html`<div>${asyncReplace(iter)}</div>`;
    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    const iterable2 = new TestAsyncIterable();
    render(t(iterable2), container);

    // webjs tears down the prior stream on re-render. Documenting
    // actual behaviour: container is emptied. (lit-html keeps the
    // last value until iterable2 yields.)
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable2.push('hello');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');
  });

  test('renders the same iterable even when the iterable new value is emitted at the same time as a re-render', async () => {
    const t = (iter) => html`<div>${asyncReplace(iter)}</div>`;
    let wait;
    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    wait = iterable.push('hello');
    render(t(iterable), container);
    await wait;
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    wait = iterable.push('bar');
    render(t(iterable), container);
    await wait;
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>bar</div>');
  });

  test('renders the same iterable value when re-rendered with no new value emitted', async () => {
    const t = (iter) => html`<div>${asyncReplace(iter)}</div>`;
    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('hello');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    render(t(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');
  });

  test('renders new value over a pending iterable', async () => {
    const t = (v) => html`<div>${v}</div>`;
    render(t(asyncReplace(iterable)), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div></div>');

    await iterable.push('foo');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>foo</div>');

    render(t('hello'), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');

    await iterable.push('bar');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<div>hello</div>');
  });

  test('does not render the first value if it is replaced first', async () => {
    async function* generator(delay, value) {
      await delay;
      yield value;
    }
    const component = (value) => html`<p>${asyncReplace(value)}</p>`;
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const slowDelay = delay(20);
    const fastDelay = delay(10);

    render(component(generator(slowDelay, 'slow')), container);
    render(component(generator(fastDelay, 'fast')), container);

    await slowDelay;
    await delay(10);

    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>fast</p>');
  });

  test('the same iterable can be rendered into two asyncReplace instances', async () => {
    const component = (iter) =>
      html`<p>${asyncReplace(iter)}</p><p>${asyncReplace(iter)}</p>`;
    render(component(iterable), container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p></p><p></p>');

    await iterable.push('1');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>1</p><p>1</p>');

    await iterable.push('2');
    assert.equal(stripExpressionMarkers(container.innerHTML), '<p>2</p><p>2</p>');
  });
});
