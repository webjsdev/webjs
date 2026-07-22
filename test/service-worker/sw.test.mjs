/**
 * Tests for the progressive-enhancement service worker template (#271).
 *
 * The worker (`packages/cli/templates/public/sw.js`) ships into the UI scaffold
 * (the api template has no UI).
 * These tests run the REAL worker source in a `node:vm` sandbox with mocked
 * service-worker globals (self / caches / fetch / Request / Response / URL),
 * capture its event handlers, and drive them to prove the headline behaviours:
 * navigations are network-first and fall back to the offline page when offline,
 * and a non-GET / cross-origin request is left alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_SRC = readFileSync(
  resolve(__dirname, '../../packages/cli/templates/public/sw.js'),
  'utf8',
);

/** A minimal in-memory Cache + CacheStorage mock. */
function makeCaches() {
  const stores = new Map();
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      // A real cache.add fetches + stores the response; the mock stores a
      // DISTINGUISHABLE sentinel body so the offline-fallback test asserts on
      // real offline content, not just a URL substring.
      add: async (req) => { m.set(keyOf(req), new Resp('OFFLINE_FALLBACK_CONTENT')); },
      put: async (req, res) => { m.set(keyOf(req), res); },
      match: async (req) => m.get(keyOf(req)) || undefined,
    };
  };
  return {
    storage: { open, keys: async () => [...stores.keys()], delete: async (k) => stores.delete(k) },
    stores,
  };
}
// A real Cache resolves a relative request URL against the worker scope, so
// `match('/offline.html')` finds an entry stored under the absolute URL.
const keyOf = (req) => {
  const u = typeof req === 'string' ? req : req.url;
  return u.startsWith('http') ? u : 'https://app.test' + u;
};

/** A tiny Response stand-in. */
class Resp {
  constructor(body, init = {}) { this.body = body; this.ok = init.ok !== false; this.status = init.status || 200; }
  clone() { return new Resp(this.body, { ok: this.ok, status: this.status }); }
  static error() { return new Resp('', { ok: false, status: 0 }); }
}
class Req {
  constructor(url, init = {}) { this.url = url.startsWith('http') ? url : 'https://app.test' + url; this.method = init.method || 'GET'; this.mode = init.mode || 'cors'; }
}

/** Load sw.js into a sandbox, return its captured handlers + the cache mock. */
function loadWorker(swUrl = 'https://app.test/sw.js?v=build123') {
  const handlers = {};
  const cachesMock = makeCaches();
  const sandbox = {
    self: {
      location: new URL(swUrl), // a real URL: has href, origin, searchParams
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: cachesMock.storage,
    fetch: async () => { throw new Error('fetch not stubbed'); },
    Response: Resp,
    Request: Req,
    URL,
    Promise,
    console,
  };
  sandbox.self.caches = cachesMock.storage;
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox);
  return { handlers, cachesMock, sandbox };
}

/** Drive a fetch event through the worker, returning the response it commits. */
async function dispatchFetch(handlers, sandbox, request) {
  let responded;
  const waits = [];
  handlers.fetch({
    request,
    respondWith: (p) => { responded = p; },
    waitUntil: (p) => waits.push(p),
  });
  await Promise.all(waits);
  return responded ? await responded : undefined;
}

test('install precaches the offline page and the cache name derives from the ?v build id', async () => {
  const { handlers, cachesMock } = loadWorker('https://app.test/sw.js?v=build123');
  const waits = [];
  handlers.install({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.ok(cachesMock.stores.has('webjs-build123'), 'cache name folds in the build id');
  const store = cachesMock.stores.get('webjs-build123');
  assert.ok(store.has('https://app.test/offline.html'), 'the offline page is precached');
});

test('activate deletes caches that are not the current version', async () => {
  const { handlers, cachesMock } = loadWorker('https://app.test/sw.js?v=v2');
  cachesMock.stores.set('webjs-v1', new Map()); // a stale prior-deploy cache
  cachesMock.stores.set('webjs-v2', new Map());
  const waits = [];
  handlers.activate({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.ok(!cachesMock.stores.has('webjs-v1'), 'the stale cache is evicted');
  assert.ok(cachesMock.stores.has('webjs-v2'), 'the current cache is kept');
});

test('a navigation is network-first: fresh response is returned AND cached', async () => {
  const { handlers, sandbox, cachesMock } = loadWorker();
  sandbox.fetch = async () => new Resp('<html>FRESH</html>');
  const res = await dispatchFetch(handlers, sandbox, new Req('/dashboard', { mode: 'navigate' }));
  assert.equal(res.body, '<html>FRESH</html>', 'the fresh network response is served');
  const store = cachesMock.stores.get('webjs-build123');
  assert.ok(store.has('https://app.test/dashboard'), 'the SSR shell was cached for offline');
});

test('an OFFLINE navigation to a cached page serves the cached page', async () => {
  const { handlers, sandbox, cachesMock } = loadWorker();
  // Prime the cache with a prior successful visit.
  cachesMock.stores.set('webjs-build123', new Map([['https://app.test/dashboard', new Resp('<html>CACHED</html>')]]));
  sandbox.fetch = async () => { throw new Error('offline'); };
  const res = await dispatchFetch(handlers, sandbox, new Req('/dashboard', { mode: 'navigate' }));
  assert.equal(res.body, '<html>CACHED</html>', 'the cached page is served offline');
});

test('an OFFLINE navigation to an UNVISITED page serves the offline fallback', async () => {
  const { handlers, sandbox } = loadWorker();
  // Run install so the offline page is precached.
  const w = []; handlers.install({ waitUntil: (p) => w.push(p) }); await Promise.all(w);
  sandbox.fetch = async () => { throw new Error('offline'); };
  const res = await dispatchFetch(handlers, sandbox, new Req('/never-seen', { mode: 'navigate' }));
  assert.equal(res.body, 'OFFLINE_FALLBACK_CONTENT', 'the precached offline page is served (not a cached page)');
});

test('a non-200 navigation response is NOT cached (offline then serves the fallback, not the error)', async () => {
  const { handlers, sandbox, cachesMock } = loadWorker();
  const w = []; handlers.install({ waitUntil: (p) => w.push(p) }); await Promise.all(w);
  // Online: the server returns a 500 error page for /broken.
  sandbox.fetch = async () => new Resp('<html>ERROR 500</html>', { ok: false, status: 500 });
  const online = await dispatchFetch(handlers, sandbox, new Req('/broken', { mode: 'navigate' }));
  assert.equal(online.body, '<html>ERROR 500</html>', 'the error page is still shown online');
  const store = cachesMock.stores.get('webjs-build123');
  assert.ok(!store.has('https://app.test/broken'), 'the error page was NOT cached');
  // Offline: a later visit serves the offline fallback, NOT the cached error.
  sandbox.fetch = async () => { throw new Error('offline'); };
  const offline = await dispatchFetch(handlers, sandbox, new Req('/broken', { mode: 'navigate' }));
  assert.equal(offline.body, 'OFFLINE_FALLBACK_CONTENT', 'offline serves the fallback, not a cached error');
});

test('a non-ok static asset response is NOT cached (no cache poisoning)', async () => {
  const { handlers, sandbox, cachesMock } = loadWorker();
  sandbox.fetch = async () => new Resp('NOT FOUND', { ok: false, status: 404 });
  await dispatchFetch(handlers, sandbox, new Req('/app/missing.js?v=x', { mode: 'cors' }));
  const store = cachesMock.stores.get('webjs-build123') || new Map();
  assert.ok(!store.has('https://app.test/app/missing.js?v=x'), 'a 404 asset is not cached');
});

test('the dev SSE + reload client are never cached', async () => {
  const { handlers, sandbox } = loadWorker();
  const sse = await dispatchFetch(handlers, sandbox, new Req('/__webjs/events', { mode: 'cors' }));
  assert.equal(sse, undefined, '/__webjs/events is not intercepted');
  const reload = await dispatchFetch(handlers, sandbox, new Req('/__webjs/reload.js', { mode: 'cors' }));
  assert.equal(reload, undefined, '/__webjs/reload.js is not intercepted');
});

test('a non-GET request is NOT intercepted (writes never cached)', async () => {
  const { handlers, sandbox } = loadWorker();
  const res = await dispatchFetch(handlers, sandbox, new Req('/api/x', { method: 'POST', mode: 'cors' }));
  assert.equal(res, undefined, 'respondWith is never called for a POST');
});

test('a cross-origin request is NOT intercepted', async () => {
  const { handlers, sandbox } = loadWorker();
  const res = await dispatchFetch(handlers, sandbox, new Req('https://cdn.other.com/x.js', { mode: 'cors' }));
  assert.equal(res, undefined, 'respondWith is never called cross-origin');
});

test('the RPC action endpoint is never cached', async () => {
  const { handlers, sandbox } = loadWorker();
  const res = await dispatchFetch(handlers, sandbox, new Req('/__webjs/action/abc/fn', { mode: 'cors' }));
  assert.equal(res, undefined, 'respondWith is never called for an action RPC GET');
});

test('a static asset is stale-while-revalidate (served from cache, refreshed in the background)', async () => {
  const { handlers, sandbox, cachesMock } = loadWorker();
  cachesMock.stores.set('webjs-build123', new Map([['https://app.test/app/page.js?v=abc', new Resp('OLD')]]));
  let fetched = false;
  sandbox.fetch = async () => { fetched = true; return new Resp('NEW'); };
  const res = await dispatchFetch(handlers, sandbox, new Req('/app/page.js?v=abc', { mode: 'cors' }));
  assert.equal(res.body, 'OLD', 'the cached asset is served immediately');
  assert.ok(fetched, 'the network revalidation still fired');
});
