/**
 * Ported from lit-html's until directive test suite
 * (packages/lit-html/src/test/directives/until_test.ts) to exercise
 * webjs's `until` directive (applyUntil in render-client.js).
 *
 * Goal: extensive coverage of priority ordering, Promise resolution
 * timing, multi-render replacement, and teardown plus late-resolve abort
 * behaviour.
 *
 * Skipped tests, each explained inline:
 *   1. All "renders a fallback to an attribute / property / boolean /
 *      event / interpolated attribute" variants. webjs's `applyPart`
 *      does NOT unwrap directive markers like `until()` at non-child
 *      positions (attr / attr-mixed / prop / bool / event). The marker
 *      object stringifies directly (e.g. "[object Object]"). This is a
 *      known divergence from lit. The ported tests cover only ChildPart
 *      positions, plus one xtest that asserts the divergence to make the
 *      gap explicit.
 *   2. "renders a nothing fallback to an interpolated attribute" uses
 *      lit's `nothing` sentinel; webjs does not ship `nothing`.
 *   3. "disconnection" subsuite: lit returns a `ChildPart` from
 *      `render()` with `setConnected(bool)`. webjs's `render()` returns
 *      void; there is no setConnected surface. One test from the suite
 *      (the "same promise rendered into two until instances" case) is
 *      still applicable and is ported separately.
 *   4. "memorySuite" memory-leak test depends on `window.gc()` plus
 *      `performance.memory` which require browser flags and are not
 *      stable across the WTR Playwright run; the equivalent
 *      abort-on-teardown behaviour is asserted directly via the "late
 *      resolve after replacement" test.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { until } from '../../../src/directives.js';

import { assert } from '../../../../../test/browser-assert.js';

/**
 * Strip webjs marker comments so HTML assertions compare visible markup.
 */
function stripExpressionComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

/** Deferred / pending Promise helper, matches lit's test-utils/deferred. */
class Deferred {
  constructor() {
    this.promise = new Promise((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

/** Macrotask boundary so all queued microtasks settle. */
const laterTask = () => new Promise((r) => setTimeout(r));

suite('until directive (lit parity port)', () => {
  let container;
  let deferred;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    deferred = new Deferred();
  });

  teardown(() => {
    container.remove();
  });

  // ============================================================
  // Basic Promise resolution
  // ============================================================

  test('renders a Promise when it resolves', async () => {
    const d = new Deferred();
    render(html`<div>${until(d.promise)}</div>`, container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');
    d.resolve('foo');
    await d.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders non-Promises immediately', async () => {
    const defaultContent = html`<span>loading...</span>`;
    render(
      html`<div>${until(deferred.promise, defaultContent)}</div>`,
      container,
    );
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><span>loading...</span></div>',
    );
    deferred.resolve('foo');
    await deferred.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders primitive low-priority content only once', async () => {
    const go = () =>
      render(
        html`<div>${until(deferred.promise, 'loading...')}</div>`,
        container,
      );

    go();
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>loading...</div>',
    );
    deferred.resolve('foo');
    await deferred.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');

    go();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders non-primitive low-priority content only once', async () => {
    const go = () =>
      render(
        html`<div>${until(deferred.promise, html`loading...`)}</div>`,
        container,
      );

    go();
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>loading...</div>',
    );
    deferred.resolve('foo');
    await deferred.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');

    go();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders changing defaultContent', async () => {
    const t = (d) => html`<div>${until(deferred.promise, d)}</div>`;
    render(t('A'), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>A</div>');

    render(t('B'), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>B</div>');

    deferred.resolve('C');
    await deferred.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>C</div>');
  });

  // ============================================================
  // Non-child positions (attr / prop / bool / event).
  //
  // Skipped: webjs does not unwrap until() at non-child positions.
  // Documented as a known divergence; see file header. One
  // assert-the-divergence test below makes the gap visible to humans.
  // ============================================================

  test('DIVERGENCE: until() in attribute position is stringified, NOT unwrapped (webjs)', async () => {
    // In lit this would render '<div></div>' and after resolution
    // '<div test="foo"></div>'. In webjs the directive marker is
    // stringified verbatim. If webjs ever gains attr-position support,
    // this test will fail loudly and prompt a port of the lit tests.
    const p = Promise.resolve('foo');
    render(html`<div test=${until(p)}></div>`, container);
    await p;
    await laterTask();
    const test = container.querySelector('div').getAttribute('test');
    // The marker stringifies to '[object Object]' under current behaviour.
    assert.equal(
      test,
      '[object Object]',
      `webjs DIVERGENCE: attr-position until() is stringified, not unwrapped. ` +
      `Lit unwraps the directive at every binding position; webjs only ` +
      `handles ChildPart in applyChild's directive dispatch. Got: ${test}`,
    );
  });

  // ============================================================
  // Literal-only fallback in ChildPart position
  // ============================================================

  test('renders a literal in a ChildPart', () => {
    render(html`${until('a')}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), 'a');
  });

  // ============================================================
  // Promise replaces Promise across renders
  // ============================================================

  test('renders new Promise over existing Promise', async () => {
    const t = (v) => html`<div>${until(v, html`<span>loading...</span>`)}</div>`;
    render(t(deferred.promise), container);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><span>loading...</span></div>',
    );

    const deferred2 = new Deferred();
    render(t(deferred2.promise), container);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><span>loading...</span></div>',
    );

    deferred2.resolve('bar');
    await deferred2.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');

    deferred.resolve('foo');
    await deferred.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');
  });

  test('renders racing Promises across renders correctly', async () => {
    const d1 = new Deferred();
    const d2 = new Deferred();
    const t = (p) => html`<div>${until(p)}</div>`;

    render(t(d1.promise), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    render(t(d2.promise), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    d1.resolve('foo');
    await d1.promise;
    await laterTask();
    // First promise was aborted by the second render; DOM stays empty.
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    d2.resolve('bar');
    await d2.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');
  });

  // ============================================================
  // Priority ordering: multiple Promises in one until()
  // ============================================================

  test('renders Promises resolving in high-to-low priority', async () => {
    const d1 = new Deferred();
    const d2 = new Deferred();
    const t = () => html`<div>${until(d1.promise, d2.promise)}</div>`;

    render(t(), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    d1.resolve('foo');
    await d1.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');

    d2.resolve('bar');
    await d2.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders Promises resolving in low-to-high priority', async () => {
    const d1 = new Deferred();
    const d2 = new Deferred();
    const t = () => html`<div>${until(d1.promise, d2.promise)}</div>`;

    render(t(), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    d2.resolve('bar');
    await d2.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');

    d1.resolve('foo');
    await d1.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders Promises with changing priorities', async () => {
    const p1 = Promise.resolve('foo');
    const p2 = Promise.resolve('bar');
    const t = (a, b) => html`<div>${until(a, b)}</div>`;

    render(t(p1, p2), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');

    render(t(p2, p1), container);
    // Both promises are already resolved. The initial sync candidate
    // is none (both are Promises); subscriptions fire on the next
    // microtask.
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');
  });

  test('renders low-priority content when arguments change', async () => {
    const d1 = new Deferred();
    const p2 = Promise.resolve('bar');
    const t = (a, b) => html`<div>${until(a, b)}</div>`;

    // First render: the synchronous string is the highest-priority candidate.
    render(t('string', p2), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>string</div>');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>string</div>');

    // Then both args become Promises: low-priority p2 wins first.
    render(t(d1.promise, p2), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>string</div>');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');

    // Resolving the higher-priority promise replaces.
    d1.resolve('foo');
    await d1.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');
  });

  test('renders Promises resolving after changing priority', async () => {
    const d1 = new Deferred();
    const d2 = new Deferred();
    const t = (a, b) => html`<div>${until(a, b)}</div>`;

    render(t(d1.promise, d2.promise), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    // Swap priorities mid-flight.
    render(t(d2.promise, d1.promise), container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');

    d1.resolve('foo');
    await d1.promise;
    await laterTask();
    // After swap, d1 is the low-priority arg; it resolves first so it wins.
    assert.equal(stripExpressionComments(container.innerHTML), '<div>foo</div>');

    d2.resolve('bar');
    await d2.promise;
    await laterTask();
    // d2 is now high-priority; it overrides d1.
    assert.equal(stripExpressionComments(container.innerHTML), '<div>bar</div>');
  });

  // ============================================================
  // Promises in ChildPart and promise-likes (thenables)
  // ============================================================

  test('renders a Promise in a ChildPart', async () => {
    render(html`${until(Promise.resolve('a'))}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), '');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), 'a');
  });

  test('renders a promise-like (thenable) in a ChildPart', async () => {
    const thenable = {
      then(resolve) {
        resolve('a');
      },
    };
    render(html`${until(thenable)}`, container);
    // Wrapped in Promise.resolve() server-side so synchronous thenables
    // get a microtask boundary, matching lit's deferred-resolution
    // contract.
    assert.equal(stripExpressionComments(container.innerHTML), '');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), 'a');
  });

  // ============================================================
  // Argument-array semantics
  // ============================================================

  test('renders later arguments until earlier promises resolve', async () => {
    let resolvePromise;
    const promise = new Promise((res) => { resolvePromise = res; });

    render(html`${until(promise, 'default')}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), 'default');

    resolvePromise('resolved value');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), 'resolved value');
  });

  test('later promises do not overwrite current value', async () => {
    let resolveA, resolveB;
    const pA = new Promise((res) => { resolveA = res; });
    const pB = new Promise((res) => { resolveB = res; });

    render(html`${until(pA, pB, 'default')}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), 'default');

    resolveA('A');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), 'A');

    resolveB('B');
    await laterTask();
    // B is lower-priority than A and arrives later; A stays.
    assert.equal(stripExpressionComments(container.innerHTML), 'A');
  });

  test('earlier promises overwrite the current value', async () => {
    let resolveA, resolveB;
    const pA = new Promise((res) => { resolveA = res; });
    const pB = new Promise((res) => { resolveB = res; });

    render(html`${until(pA, pB, 'default')}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), 'default');

    resolveB('B');
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), 'B');

    resolveA('A');
    await laterTask();
    // A is higher-priority; it replaces B.
    assert.equal(stripExpressionComments(container.innerHTML), 'A');
  });

  test('promises later than a non-promise are never rendered', async () => {
    let resolvePromise;
    const promise = new Promise((res) => { resolvePromise = res; });

    render(html`${until('default', promise)}`, container);
    assert.equal(stripExpressionComments(container.innerHTML), 'default');

    resolvePromise('resolved value');
    await laterTask();
    // 'default' is the high-priority sync candidate; the promise
    // below it can never win.
    assert.equal(stripExpressionComments(container.innerHTML), 'default');
  });

  // ============================================================
  // Same promise shared across multiple until() instances
  // ============================================================

  test('the same promise can be rendered into two until instances', async () => {
    let resolvePromise;
    const promise = new Promise((res) => { resolvePromise = res; });

    render(
      html`<div>${until(promise, 'unresolved1')}</div><span>${until(promise, 'unresolved2')}</span>`,
      container,
    );
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>unresolved1</div><span>unresolved2</span>',
    );

    resolvePromise('resolved');
    await promise;
    await laterTask();
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>resolved</div><span>resolved</span>',
    );
  });

  // ============================================================
  // Teardown / abort: re-render with a different value.
  // (Covers the disconnection scenario lit tests via setConnected.)
  // ============================================================

  test('late Promise resolution after replacement does NOT overwrite newer DOM', async () => {
    let resolveP;
    const p = new Promise((res) => { resolveP = res; });
    const make = (val) => html`<div>${val}</div>`;

    render(make(until(p, 'fallback')), container);
    await laterTask();
    assert.ok(container.textContent.includes('fallback'));

    // Replace the until directive with a plain string.
    render(make('replaced'), container);
    assert.ok(container.textContent.includes('replaced'));

    // Resolving the orphaned promise must NOT smash the new DOM.
    resolveP('SHOULD-NOT-APPEAR');
    await laterTask();
    assert.ok(container.textContent.includes('replaced'),
      'newer DOM survives');
    assert.isFalse(container.textContent.includes('SHOULD-NOT-APPEAR'),
      'late resolve did NOT overwrite');
  });

  test('late Promise resolution after switching to a different until() does NOT overwrite', async () => {
    let resolveP1;
    const p1 = new Promise((res) => { resolveP1 = res; });
    const p2 = Promise.resolve('p2');
    const t = (p) => html`<div>${until(p, 'fallback')}</div>`;

    render(t(p1), container);
    await laterTask();
    assert.ok(container.textContent.includes('fallback'));

    // Replace p1's until with p2's until (different directive instance,
    // same part). p1's __untilState should be aborted.
    render(t(p2), container);
    await laterTask();
    assert.ok(container.textContent.includes('p2'),
      'second until resolved its promise');

    // Now resolve p1, the orphan. Must NOT smash the DOM.
    resolveP1('STALE');
    await laterTask();
    assert.ok(container.textContent.includes('p2'),
      'newer until value survives');
    assert.isFalse(container.textContent.includes('STALE'),
      'orphaned p1 did NOT overwrite');
  });

  // ============================================================
  // Rejected promises: webjs swallows rejections, existing render stays.
  // ============================================================

  test('rejected promise keeps the fallback', async () => {
    const p = Promise.reject(new Error('boom'));
    // Attach a no-op handler to avoid unhandled rejection noise.
    p.catch(() => {});
    render(html`<div>${until(p, 'fallback')}</div>`, container);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>fallback</div>',
    );
    await laterTask();
    // After the rejection settles, the fallback should still be visible.
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>fallback</div>',
    );
  });

  test('rejected high-priority promise does not displace lower-priority resolved value', async () => {
    const pBad = Promise.reject(new Error('boom'));
    pBad.catch(() => {});
    const pGood = Promise.resolve('good');
    render(html`<div>${until(pBad, pGood, 'fallback')}</div>`, container);
    // Initial sync candidate is 'fallback'.
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>fallback</div>',
    );
    await laterTask();
    // pGood (lower-priority) resolved while pBad rejected.
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>good</div>',
    );
  });

  // ============================================================
  // Edge cases: no args, all-Promise (no sync candidate)
  // ============================================================

  test('until() with no args renders empty', () => {
    render(html`<div>${until()}</div>`, container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');
  });

  test('all-Promise candidates render empty until one resolves', async () => {
    const d = new Deferred();
    render(html`<div>${until(d.promise)}</div>`, container);
    assert.equal(stripExpressionComments(container.innerHTML), '<div></div>');
    d.resolve('ok');
    await d.promise;
    await laterTask();
    assert.equal(stripExpressionComments(container.innerHTML), '<div>ok</div>');
  });
});
