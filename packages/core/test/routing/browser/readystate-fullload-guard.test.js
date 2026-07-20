/**
 * Regression for #1008 (folded into #1013): a forward, main-document client-router
 * nav fired while the document is still parsing (`readyState === 'loading'`) must
 * degrade to a full page load, NOT attempt a soft swap. During parse the leaving
 * page's closing layout markers may not be attached yet, so snapshotting the tree
 * and running a scoped swap would corrupt the DOM. The prefetch path already skips
 * this window (#936); the click / `navigate()` path did not.
 *
 * Testing the actual `location.href = href` full load in a browser would navigate
 * the runner away, so this asserts the degradation PREDICATE directly, under a
 * `document.readyState` override. Counterfactual: revert the guard in
 * `performNavigation` (or make the predicate always return false) and the first
 * assertion goes red.
 */
import { _shouldFullLoadDuringParse } from '../../../src/router-client.js';
import { assert } from '../../../../../test/browser-assert.js';

/**
 * Run `fn` with `document.readyState` forced to `value`, restoring the native
 * getter afterwards no matter what.
 */
function withReadyState(value, fn) {
  const proto = Object.getPrototypeOf(document);
  const original = Object.getOwnPropertyDescriptor(document, 'readyState');
  Object.defineProperty(document, 'readyState', { get: () => value, configurable: true });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(document, 'readyState', original);
    else delete document.readyState;
    // Sanity: the native value is back.
    void proto;
  }
}

suite('client router: readyState-loading full-load degradation (#1008)', () => {
  test('a forward frameless nav during parse degrades to a full load', () => {
    withReadyState('loading', () => {
      assert.equal(
        _shouldFullLoadDuringParse(/* isPopState */ false, /* frameId */ null),
        true,
        'forward frameless nav at readyState=loading must full-load'
      );
    });
  });

  test('a nav after the document is complete stays a soft nav', () => {
    withReadyState('complete', () => {
      assert.equal(
        _shouldFullLoadDuringParse(false, null),
        false,
        'complete document keeps the soft-nav path'
      );
    });
  });

  test('popstate is never hijacked (browser-driven), even during parse', () => {
    withReadyState('loading', () => {
      assert.equal(
        _shouldFullLoadDuringParse(/* isPopState */ true, null),
        false,
        'popstate during parse is left to the browser'
      );
    });
  });

  test('a frame nav during parse is scoped out (carries its own boundary)', () => {
    withReadyState('loading', () => {
      assert.equal(
        _shouldFullLoadDuringParse(false, /* frameId */ 'sidebar'),
        false,
        'frame nav during parse is not a full-document full-load'
      );
    });
  });

  test('interactive readyState still counts as parsing (markers may be incomplete)', () => {
    // 'interactive' means the DOM is parsed but sub-resources still load; the
    // guard only fires on 'loading', so interactive stays a soft nav.
    withReadyState('interactive', () => {
      assert.equal(_shouldFullLoadDuringParse(false, null), false);
    });
  });
});
