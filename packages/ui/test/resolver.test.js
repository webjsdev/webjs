import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTree, collectNpmDeps } from '../src/registry/resolver.js';

const FIXTURE = {
  button: { name: 'button', type: 'registry:ui', dependencies: ['@webjskit/core'], registryDependencies: ['lib-utils'], files: [{ path: 'b.ts', type: 'registry:ui' }] },
  'lib-utils': { name: 'lib-utils', type: 'registry:lib', files: [{ path: 'utils.ts', type: 'registry:lib' }] },
  dialog: { name: 'dialog', type: 'registry:ui', dependencies: ['@webjskit/core'], registryDependencies: ['button'], files: [{ path: 'd.ts', type: 'registry:ui' }] },
  popover: { name: 'popover', type: 'registry:ui', dependencies: ['@webjskit/core', '@floating-ui/dom'], files: [{ path: 'p.ts', type: 'registry:ui' }] },
};

const origFetch = globalThis.fetch;
function stubFetch() {
  globalThis.fetch = async (url) => {
    const name = String(url).split('/').pop().replace('.json', '');
    if (!FIXTURE[name]) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(FIXTURE[name]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
function restoreFetch() { globalThis.fetch = origFetch; }

test('resolveTree: resolves transitive registry deps in install order', async () => {
  stubFetch();
  try {
    const tree = await resolveTree(['dialog'], 'http://test/r');
    assert.deepEqual(tree.map((i) => i.name), ['lib-utils', 'button', 'dialog']);
  } finally { restoreFetch(); }
});

test('resolveTree: dedupes shared deps', async () => {
  stubFetch();
  try {
    const tree = await resolveTree(['button', 'dialog'], 'http://test/r');
    const names = tree.map((i) => i.name);
    assert.equal(names.filter((n) => n === 'lib-utils').length, 1);
    assert.equal(names.filter((n) => n === 'button').length, 1);
  } finally { restoreFetch(); }
});

test('collectNpmDeps: flattens and dedupes', async () => {
  stubFetch();
  try {
    const tree = await resolveTree(['dialog', 'popover'], 'http://test/r');
    const { dependencies, devDependencies } = collectNpmDeps(tree);
    assert.ok(dependencies.includes('@webjskit/core'));
    assert.ok(dependencies.includes('@floating-ui/dom'));
    assert.equal(dependencies.filter((d) => d === '@webjskit/core').length, 1);
    assert.deepEqual(devDependencies, []);
  } finally { restoreFetch(); }
});
