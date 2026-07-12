/**
 * Real-browser tests locking the client router's query-string (`?a=1&b=2`)
 * handling across every navigation path (#639). Filed after query params
 * sometimes appeared NOT to carry forward while dogfooding the blog; a source
 * review found the router mostly correct, so this pins the spec-correct
 * behaviour so a genuine drop is caught and the deliberate cases are not later
 * "fixed" into a regression.
 *
 * MUST run in a real browser: these assert `location.search` / real `pushState`
 * / real `popstate` after a soft swap, which linkedom (the unit DOM) does not
 * implement. The router's fetch is stubbed so the assertion is about the URL the
 * router requests and the history it records, not a real server.
 */
import {
  enableClientRouter,
  navigate,
  _prefetch,
  _prefetchPeek,
  _resetPrefetch,
  _prefetchInflightSize,
} from '../../../src/router-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};
const tick = () => new Promise((r) => setTimeout(r, 25));
/** Poll `location.search` until it equals `want` (a real popstate/pushState is
 *  async), returning the final value so the assertion message is useful. */
async function waitForSearch(want, ms = 1000) {
  const deadline = Date.now() + ms;
  while (location.search !== want && Date.now() < deadline) await tick();
  return location.search;
}

/** A minimal swap body: the `<!--wj:children:/-->` markers the router diffs into.
 *  Same for every URL (these tests assert the URL + history, not content). */
function swapBody() {
  return new Response(
    '<!doctype html><html><head></head><body>' +
    '<!--wj:children:/-->after<!--/wj:children--></body></html>',
    { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } },
  );
}

suite('Client router: query-string preservation (#639)', () => {
  let origFetch, calls, before, container;

  function setup(responder) {
    enableClientRouter(); // idempotent
    _resetPrefetch();
    document.body.innerHTML = '<!--wj:children:/-->before<!--/wj:children-->';
    container = document.createElement('div');
    document.body.appendChild(container);
    calls = [];
    before = location.href;
    origFetch = window.fetch;
    window.fetch = (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return Promise.resolve((responder || swapBody)(String(url), init || {}));
    };
  }
  function teardown() {
    window.fetch = origFetch;
    // Restore history so a later test starts on the original URL.
    try { history.replaceState(null, '', before); } catch { /* ignore */ }
    _resetPrefetch();
    container.remove();
    document.body.innerHTML = '';
  }

  test('a link with a query string preserves it in location.search AND the fetch (#639)', async () => {
    setup();
    try {
      await navigate(location.origin + '/qp/list?q=shoes&page=2');
      // pushState recorded the full URL, so the browser location keeps the query.
      assert.equal(location.pathname, '/qp/list', 'pathname navigated');
      assert.equal(location.search, '?q=shoes&page=2', 'query string preserved in location.search');
      // The router fetched the query, not a bare pathname (a dropped search would
      // request /qp/list with no ?).
      assert.ok(calls.some((c) => c.url.includes('/qp/list?q=shoes&page=2')),
        `router fetched the query-carrying URL; got ${JSON.stringify(calls.map((c) => c.url))}`);
    } finally { teardown(); }
  });

  test('sequential navs keep DISTINCT params, not merged and not dropped (#639)', async () => {
    setup();
    try {
      await navigate(location.origin + '/qp/a?x=1');
      assert.equal(location.search, '?x=1', 'first nav search');
      await navigate(location.origin + '/qp/b?y=2');
      assert.equal(location.pathname, '/qp/b', 'second nav pathname');
      // NOT '?x=1&y=2' (merged) and NOT '' (dropped): the second URL replaces the first.
      assert.equal(location.search, '?y=2', 'second nav search replaces the first, not merged');
    } finally { teardown(); }
  });

  test('the prefetch cache is keyed by search, so distinct params do not collide (#639)', async () => {
    setup();
    try {
      _prefetch(location.origin + '/qp/p?x=1');
      // Let the speculative fetch settle into the cache.
      for (let i = 0; i < 40 && (_prefetchInflightSize() > 0 || !_prefetchPeek(location.origin + '/qp/p?x=1')); i++) await tick();
      assert.ok(_prefetchPeek(location.origin + '/qp/p?x=1'), 'the prefetched ?x=1 entry is cached');
      // A different search value is a DIFFERENT key, so it must miss (not be served
      // the ?x=1 entry): this is what makes ?x=1 and ?x=2 distinct cache entries.
      assert.equal(_prefetchPeek(location.origin + '/qp/p?x=2'), null,
        'a different search value is a cache MISS (keyed by pathname+search, not pathname)');
      // Same pathname, no query, is also a distinct key -> miss.
      assert.equal(_prefetchPeek(location.origin + '/qp/p'), null,
        'the query-less URL is a distinct key (miss)');
    } finally { teardown(); }
  });

  test('back/forward restores the query string of the prior history entry (#639)', async () => {
    setup();
    try {
      await navigate(location.origin + '/qp/a?x=1');
      await navigate(location.origin + '/qp/b?y=2');
      assert.equal(location.search, '?y=2', 'at /qp/b?y=2 before going back');
      history.back();
      const search = await waitForSearch('?x=1');
      assert.equal(search, '?x=1', 'back restored the prior entry query string');
      assert.equal(location.pathname, '/qp/a', 'back restored the prior entry pathname');
    } finally { teardown(); }
  });

  test('a GET-form submission REPLACES the action query with the form fields (spec-correct, #639)', async () => {
    // The HTML5 GET-form algorithm rebuilds the query from the form body, so the
    // action's own `?old=1` is discarded. This is deliberate, NOT a dropped
    // query: assert it so it is never "fixed" into a merge/preserve regression.
    setup();
    try {
      container.innerHTML =
        '<form method="get" action="/qp/search?old=1">' +
        '<input name="q" value="shoes"><button type="submit">go</button></form>';
      container.querySelector('button').click();
      // Poll for the routed fetch (more robust than a fixed delay on a slow runner).
      let fetched;
      for (let i = 0; i < 40 && !(fetched = calls.find((c) => c.url.includes('/qp/search'))); i++) await tick();
      assert.ok(fetched, 'the GET form submission was routed (fetched)');
      assert.ok(fetched.url.includes('q=shoes'), 'the form field is in the submitted query');
      assert.ok(!fetched.url.includes('old=1'), "the action's own query (?old=1) is replaced, not merged");
      assert.equal(location.search, '?q=shoes', 'location.search is the form-built query');
    } finally { teardown(); }
  });

  test('repeated keys are a DISTINCT cache key from the single-value form (#639)', async () => {
    // The cache keys on the RAW `pathname + search` string, so `?foo=bar&foo=baz`
    // and `?foo=baz` are different entries. Next.js had a real bug here (#92787):
    // its key collapsed repeated keys via `Object.fromEntries(URLSearchParams)`,
    // keeping only the last value, so a multi-value -> single-value nav was a
    // false cache HIT with no re-render. Lock that WebJs does NOT collapse.
    setup();
    try {
      _prefetch(location.origin + '/qp/multi?foo=bar&foo=baz');
      for (let i = 0; i < 40 && (_prefetchInflightSize() > 0 || !_prefetchPeek(location.origin + '/qp/multi?foo=bar&foo=baz')); i++) await tick();
      assert.ok(_prefetchPeek(location.origin + '/qp/multi?foo=bar&foo=baz'), 'the multi-value entry is cached');
      assert.equal(_prefetchPeek(location.origin + '/qp/multi?foo=baz'), null,
        'the single-value ?foo=baz is a cache MISS (repeated keys are NOT collapsed to the last value)');
    } finally { teardown(); }
  });

  test('a hash and a query survive a nav TOGETHER; a hash-only nav keeps the query (#639)', async () => {
    setup();
    try {
      await navigate(location.origin + '/qp/h?a=1#sec');
      assert.equal(location.search, '?a=1', 'query preserved alongside a hash');
      assert.equal(location.hash, '#sec', 'hash preserved alongside a query');
      // Changing only the hash must NOT drop the existing query.
      await navigate(location.origin + '/qp/h?a=1#other');
      assert.equal(location.search, '?a=1', 'a hash change did not drop the query');
      assert.equal(location.hash, '#other', 'the hash updated');
    } finally { teardown(); }
  });

  test('an encoded / unicode query value round-trips through the nav (#639)', async () => {
    setup();
    try {
      // A space (encoded), a unicode value, and a reserved char in a value.
      const search = '?name=' + encodeURIComponent('a b 名') + '&tag=' + encodeURIComponent('x&y');
      await navigate(location.origin + '/qp/enc' + search);
      assert.equal(location.search, search, 'the encoded query round-trips byte-for-byte in location.search');
      assert.ok(calls.some((c) => c.url.includes(search)), 'the router fetched the encoded query unchanged');
    } finally { teardown(); }
  });

  test('a server redirect updates the URL to the redirect target query (#639)', async () => {
    // fetch follows a redirect and the resolved Response reports redirected=true +
    // url=<final>; the router records THAT url (with its query), not the request's.
    setup(() => {
      const r = swapBody();
      Object.defineProperty(r, 'redirected', { value: true });
      Object.defineProperty(r, 'url', { value: location.origin + '/qp/dest?to=2' });
      return r;
    });
    try {
      await navigate(location.origin + '/qp/start?from=1');
      assert.equal(location.pathname, '/qp/dest', 'history advanced to the redirect target');
      assert.equal(location.search, '?to=2', 'the redirect target query wins, not the request query');
    } finally { teardown(); }
  });
});
