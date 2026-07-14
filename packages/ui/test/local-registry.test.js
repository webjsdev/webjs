/**
 * Local-first registry resolution (#983).
 *
 * The registry sources ship in the package, so `add` / `list` / `view` resolve
 * with NO network by default; an explicit `--registry <url>` still fetches. The
 * `diff` carve-out (stays network-default) is covered in diff-command.test.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getRegistryItem,
  getRegistryIndex,
  isDefaultRegistry,
  DEFAULT_REGISTRY_URL,
} from '../src/registry/fetcher.js';
import { loadRegistryItem, loadRegistryIndex, isCustomElementSource, tierOfItem } from '../src/registry/local.js';

const origFetch = globalThis.fetch;

/** Install a fetch that FAILS loudly, so any accidental network use reds the test. */
function noNetwork() {
  globalThis.fetch = async (url) => {
    throw new Error(`network was hit for ${url} but local-first should not fetch`);
  };
}

test('getRegistryItem: resolves the packaged registry with NO network (default registry)', async () => {
  noNetwork();
  try {
    const btn = await getRegistryItem('button');
    assert.equal(btn.name, 'button');
    assert.ok(btn.files?.[0]?.content, 'file content is inlined from disk');
    assert.deepEqual(btn.registryDependencies, ['lib-utils']);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('getRegistryItem: synthesizes a non-neutral colour theme offline', async () => {
  noNetwork();
  try {
    const theme = await getRegistryItem('theme-stone');
    assert.equal(theme.name, 'theme-stone');
    assert.match(theme.files[0].content, /@webjsdev\/ui theme/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('getRegistryItem: an explicit custom --registry still fetches over the network', async () => {
  let hit = null;
  globalThis.fetch = async (url) => {
    hit = String(url);
    return new Response(JSON.stringify({
      name: 'button', type: 'registry:ui',
      files: [{ path: 'button.ts', type: 'registry:ui', content: '// remote' }],
    }), { status: 200 });
  };
  try {
    const btn = await getRegistryItem('button', 'http://custom/registry');
    assert.equal(btn.files[0].content, '// remote');
    assert.match(hit, /^http:\/\/custom\/registry\/button\.json$/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('getRegistryIndex: resolves offline and includes synthesized themes', async () => {
  noNetwork();
  try {
    const index = await getRegistryIndex();
    assert.ok(index.length >= 32);
    assert.ok(index.some((i) => i.name === 'button'));
    assert.ok(index.some((i) => i.name === 'theme-mauve'));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('getRegistryItem: throws a helpful error for an unknown local item', async () => {
  noNetwork();
  try {
    await assert.rejects(() => getRegistryItem('does-not-exist'), /Unknown registry item/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('isDefaultRegistry: only the hosted URL (or unset) is default', () => {
  assert.equal(isDefaultRegistry(undefined), true);
  assert.equal(isDefaultRegistry(DEFAULT_REGISTRY_URL), true);
  assert.equal(isDefaultRegistry('http://custom/registry'), false);
});

test('loadRegistryItem: returns null for an unknown name', () => {
  assert.equal(loadRegistryItem('nope-nope'), null);
});

test('loadRegistryIndex: metadata-only entries (no inlined content)', () => {
  const index = loadRegistryIndex();
  const btn = index.find((i) => i.name === 'button');
  assert.ok(btn);
  assert.equal(btn.files, undefined);
});

test('isCustomElementSource: distinguishes Tier-2 elements from Tier-1 helpers', () => {
  assert.equal(isCustomElementSource('class X extends WebComponent({}) {}\nX.register("x-y");'), true);
  assert.equal(isCustomElementSource('export const buttonClass = () => "px-4";'), false);
});

test('tierOfItem: dialog is Tier-2, button is Tier-1', () => {
  assert.equal(tierOfItem('dialog'), 2);
  assert.equal(tierOfItem('button'), 1);
});
