/**
 * Real-browser tests for the dev stylesheet re-request (#1398, #1535).
 *
 * `dev-styles.js` is the BROWSER half of the in-place refresh: the exact source
 * the served reload client inlines (`reloadClientJs` reads this file, strips
 * `export`, and embeds it), so driving it here tests the code that ships.
 *
 * It runs in a real browser because the headline rules are about REAL `load`
 * and `error` events on real `<link>` elements, and which node survives each.
 * `preloadStyles` loads the cache-busted replacements BESIDE the live links and
 * resolves once they have settled, so the caller can swap the markup in only
 * when the rebuilt rules are there (#1535); `commit()` then drops the old ones.
 */
import { preloadStyles } from '../../../src/dev-styles.js';

import { assert } from '../../../../../test/browser-assert.js';

const SHEET = '/packages/server/test/dev/browser/fixture-sheet.css';
const MISSING = '/packages/server/test/dev/browser/does-not-exist-1398.css';

/** Resolve once `el` has fired `load` or `error`, or after a bounded wait. */
function settled(el) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    el.addEventListener('load', finish);
    el.addEventListener('error', finish);
    setTimeout(finish, 3000);
  });
}

function link(container, href, attrs) {
  const el = document.createElement('link');
  el.setAttribute('rel', 'stylesheet');
  el.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  container.appendChild(el);
  return el;
}

suite('dev stylesheet re-request (#1398, #1535)', () => {
  let container;

  function setup() {
    container = document.createElement('div');
    document.body.appendChild(container);
  }
  function teardown() { container.remove(); }

  test('resolves only once the replacement has LOADED, keeping the old sheet until commit', async () => {
    setup();
    try {
      const old = link(container, SHEET);
      await settled(old);

      const pending = preloadStyles(container);
      // Synchronously, both are in: the overlap is what keeps the page styled.
      assert.equal(container.querySelectorAll('link').length, 2, 'the replacement went in beside the live sheet');
      const { links, commit } = await pending;
      const next = links[0];
      assert.match(next.getAttribute('href'), /__webjs_dev=/, 'cache-busted, so the server re-runs its regenerate step');
      assert.ok(next.sheet, 'the promise resolved after the replacement loaded, so its rules apply');
      assert.equal(old.parentNode, container, 'the old sheet is kept until the markup has been swapped in');

      commit();
      assert.equal(old.parentNode, null, 'commit drops the old link');
      assert.equal(next.parentNode, container, 'and the replacement stays');
    } finally {
      teardown();
    }
  });

  // A failed re-request must never take the working sheet down with it.
  test('a replacement that FAILS is removed and the working sheet kept', async () => {
    setup();
    try {
      const old = link(container, SHEET);
      await settled(old);
      old.setAttribute('href', MISSING);
      const { links, commit } = await preloadStyles(container);
      commit();
      assert.equal(links[0].parentNode, null, 'the failed replacement removes itself');
      assert.equal(old.parentNode, container, 'and the sheet that still works stays on the page');
      assert.equal(container.querySelectorAll('link').length, 1, 'so the page is never left with no stylesheet at all');
    } finally {
      teardown();
    }
  });

  test('a stylesheet that hangs does not hold the swap past the timeout', async () => {
    setup();
    try {
      link(container, SHEET);
      // An href the browser never finishes within 50ms is hard to guarantee,
      // so the clock is the contract: a zero timeout resolves at once.
      const t0 = performance.now();
      await preloadStyles(container, undefined, 0);
      assert.ok(performance.now() - t0 < 1000, 'resolved on the timeout');
    } finally {
      teardown();
    }
  });

  test('commit collapses a copy the head merge appended, so the head cannot grow per refresh', async () => {
    setup();
    try {
      link(container, SHEET);
      const { links, commit } = await preloadStyles(container);
      // What the head merge produces after the swap: the incoming bare href.
      link(container, SHEET);
      commit();
      const left = container.querySelectorAll('link');
      assert.equal(left.length, 1, 'exactly one link to the file is left');
      assert.equal(left[0], links[0], 'and it is the loaded replacement');
    } finally {
      teardown();
    }
  });

  test('duplicates present before the preload are collapsed first', async () => {
    setup();
    try {
      link(container, SHEET);
      link(container, SHEET + '?__webjs_dev=1');
      const pending = preloadStyles(container);
      assert.equal(container.querySelectorAll('link').length, 2, 'one survivor plus its replacement, not three');
      await pending;
    } finally {
      teardown();
    }
  });

  // Two links to one file are NOT necessarily duplicates.
  test('a media-scoped link to the same file is kept, not treated as a duplicate', async () => {
    setup();
    try {
      link(container, SHEET);
      const print = link(container, SHEET, { media: 'print' });
      const { commit } = await preloadStyles(container);
      commit();
      assert.equal(container.querySelectorAll('link[media="print"]').length, 1, 'the print sheet is still there (replaced, not deleted)');
      assert.equal(container.querySelectorAll('link').length, 2, 'one per identity');
      assert.ok(print.parentNode === null, 'the old print link made way for its own replacement');
    } finally {
      teardown();
    }
  });

  test('a cross-origin stylesheet is left alone', async () => {
    setup();
    try {
      const ext = link(container, 'https://example.invalid/x.css');
      const { links } = await preloadStyles(container);
      assert.deepEqual(links, [], 'nothing was re-requested');
      assert.equal(ext.getAttribute('href'), 'https://example.invalid/x.css', 'and its href is untouched');
    } finally {
      teardown();
    }
  });
});
