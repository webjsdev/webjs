import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRegistryItem, fetchRegistryIndex } from '../src/registry/fetcher.js';

const origFetch = globalThis.fetch;
let calls = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const name = String(url).split('/').pop().replace('.json', '');
    if (name === 'index') {
      return new Response(JSON.stringify([
        { name: 'button', type: 'registry:ui' },
        { name: 'card', type: 'registry:ui' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (name === 'missing') return new Response('not found', { status: 404 });
    if (name === 'bad-shape') {
      // valid JSON but wrong schema (missing required `name`)
      return new Response(JSON.stringify({ type: 'registry:ui', files: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      name,
      type: 'registry:ui',
      files: [{ path: `${name}.ts`, type: 'registry:ui', content: `// ${name}` }],
    }), { status: 200 });
  };
});

test('fetchRegistryItem — fetches and validates a registry item', async () => {
  const it = await fetchRegistryItem('button', 'http://test/registry');
  assert.equal(it.name, 'button');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^http:\/\/test\/registry\/button\.json$/);
});

test('fetchRegistryItem — caches subsequent fetches', async () => {
  await fetchRegistryItem('button2', 'http://test/registry');
  await fetchRegistryItem('button2', 'http://test/registry');
  assert.equal(calls.length, 1); // second call hits cache
});

test('fetchRegistryItem — throws on HTTP error', async () => {
  await assert.rejects(
    () => fetchRegistryItem('missing', 'http://test/registry'),
    /HTTP 404/,
  );
});

test('fetchRegistryItem — throws on schema mismatch', async () => {
  await assert.rejects(() => fetchRegistryItem('bad-shape', 'http://test/registry'));
});

test('fetchRegistryItem — strips trailing slash in baseUrl', async () => {
  await fetchRegistryItem('strip-test', 'http://test/registry/');
  assert.equal(calls.at(-1), 'http://test/registry/strip-test.json');
});

test('fetchRegistryIndex — fetches the index', async () => {
  const items = await fetchRegistryIndex('http://test/registry');
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'button');
});

// Restore fetch after tests run
globalThis.fetch = origFetch;
