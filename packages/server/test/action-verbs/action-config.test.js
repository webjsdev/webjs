import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionFunctionNames, actionMethod, actionCache, resolveTags,
  cacheControlFor, allowedRequestMethods, RESERVED_CONFIG,
} from '../../src/action-config.js';

test('actionFunctionNames excludes reserved config exports', () => {
  const mod = {
    method: 'GET', cache: 60,
    tags: () => ['t'], invalidates: () => ['t'], validate: () => ({}),
    getUser: async () => 1,
  };
  assert.deepEqual(actionFunctionNames(mod), ['getUser']);
});

test('actionMethod defaults to POST, validates, uppercases', () => {
  assert.equal(actionMethod({}), 'POST');
  assert.equal(actionMethod({ method: 'get' }), 'GET');
  assert.equal(actionMethod({ method: ' Patch ' }), 'PATCH');
  assert.equal(actionMethod({ method: 'BOGUS' }), 'POST');
  assert.equal(actionMethod({ method: 5 }), 'POST');
});

test('actionCache normalizes number and object, default private', () => {
  assert.equal(actionCache({}), null);
  assert.deepEqual(actionCache({ cache: 60 }), { maxAge: 60, swr: 0, public: false });
  assert.deepEqual(actionCache({ cache: { maxAge: 30, swr: 120, public: true } }), { maxAge: 30, swr: 120, public: true });
  assert.deepEqual(actionCache({ cache: { maxAge: 30 } }), { maxAge: 30, swr: 0, public: false });
});

test('resolveTags invokes a fn with args, filters non-strings, never throws', () => {
  assert.deepEqual(resolveTags((id) => [`user:${id}`], [5]), ['user:5']);
  assert.deepEqual(resolveTags(['a', 'b'], []), ['a', 'b']);
  assert.deepEqual(resolveTags(() => { throw new Error('x'); }, []), []);
  assert.deepEqual(resolveTags((x) => [x, 1, null, 'ok'], ['a']), ['a', 'ok']);
});

test('cacheControlFor builds GET headers, null otherwise', () => {
  assert.equal(cacheControlFor('GET', null), null);
  assert.equal(cacheControlFor('POST', { maxAge: 60, swr: 0, public: false }), null);
  assert.equal(cacheControlFor('GET', { maxAge: 60, swr: 0, public: false }), 'private, max-age=60');
  assert.equal(cacheControlFor('GET', { maxAge: 60, swr: 300, public: true }), 'public, max-age=60, stale-while-revalidate=300');
});

test('allowedRequestMethods: URL-arg verbs also accept POST fallback', () => {
  assert.deepEqual([...allowedRequestMethods('GET')].sort(), ['GET', 'POST']);
  assert.deepEqual([...allowedRequestMethods('DELETE')].sort(), ['DELETE', 'POST']);
  assert.deepEqual([...allowedRequestMethods('PUT')], ['PUT']);
  assert.deepEqual([...allowedRequestMethods('POST')], ['POST']);
});

test('RESERVED_CONFIG covers the five config names', () => {
  for (const n of ['method', 'cache', 'tags', 'invalidates', 'validate']) assert.ok(RESERVED_CONFIG.has(n));
});
