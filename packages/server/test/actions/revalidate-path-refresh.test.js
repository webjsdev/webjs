/**
 * revalidatePath(path, type?) inside a server action (Next.js parity): the
 * RPC response carries `x-webjs-refresh` naming the revalidated paths, so the
 * browser refreshes the page in place when it is one of them. A `'layout'`
 * revalidation is marked and clears the whole HTML cache.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildActionIndex, resolveServerModule, invokeAction, RPC_CONTENT_TYPE } from '../../src/actions.js';
import { withRequest, refreshHeaderValue } from '../../src/context.js';
import { stringify as wjStringify } from '../../../core/src/serialize.js';
import { parseRefreshHeader, refreshCovers } from '../../../core/src/action-effects-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_CACHE = pathToFileURL(resolve(__dirname, '../../src/html-cache.js')).toString();

async function scaffold() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-refresh-'));
  await mkdir(join(dir, 'actions'), { recursive: true });
  await writeFile(join(dir, 'actions/save.server.js'), `'use server';
    import { revalidatePath } from ${JSON.stringify(HTML_CACHE)};
    export async function save() { await revalidatePath('/posts'); await revalidatePath('/a,b'); return { success: true }; }
    export async function saveLayout() { await revalidatePath('/blog', 'layout'); return 1; }
    export async function quiet() { return 2; }
  `);
  return dir;
}

async function call(dir, fn) {
  const idx = await buildActionIndex(dir, false);
  const file = resolveServerModule(idx, '/actions/save.server.js');
  const hash = idx.fileToHash.get(file);
  const req = new Request(`http://x/__webjs/action/${hash}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': RPC_CONTENT_TYPE, 'sec-fetch-site': 'same-origin' },
    body: await wjStringify([]),
  });
  return withRequest(req, () => invokeAction(idx, hash, fn, req));
}

test('an action calling revalidatePath answers x-webjs-refresh with each path encoded', async () => {
  const dir = await scaffold();
  const res = await call(dir, 'save');
  assert.equal(res.headers.get('x-webjs-refresh'), '%2Fposts,%2Fa%2Cb');
  assert.deepEqual(parseRefreshHeader(res.headers.get('x-webjs-refresh')), [
    { path: '/posts', layout: false },
    { path: '/a,b', layout: false },
  ]);
});

test("revalidatePath(path, 'layout') is marked ;layout", async () => {
  const dir = await scaffold();
  const res = await call(dir, 'saveLayout');
  assert.equal(res.headers.get('x-webjs-refresh'), '%2Fblog;layout');
});

test('an action that revalidates nothing sends no refresh header', async () => {
  const dir = await scaffold();
  const res = await call(dir, 'quiet');
  assert.equal(res.headers.get('x-webjs-refresh'), null);
});

test('refreshHeaderValue is null outside a request and dedupes within one', async () => {
  assert.equal(refreshHeaderValue(), null);
  const { recordRevalidatedPath } = await import('../../src/context.js');
  const v = withRequest(new Request('http://x/'), () => {
    recordRevalidatedPath('/x', false);
    recordRevalidatedPath('/x', false);
    return refreshHeaderValue();
  });
  assert.equal(v, '%2Fx');
});

test('refreshCovers: exact page, layout subtree, and route patterns', () => {
  assert.equal(refreshCovers({ path: '/posts', layout: false }, '/posts'), true);
  assert.equal(refreshCovers({ path: '/posts', layout: false }, '/posts/1'), false);
  assert.equal(refreshCovers({ path: '/posts', layout: true }, '/posts/1'), true);
  assert.equal(refreshCovers({ path: '/', layout: true }, '/anything/deep'), true);
  assert.equal(refreshCovers({ path: '/blog/[slug]', layout: false }, '/blog/hello'), true);
  assert.equal(refreshCovers({ path: '/blog/[slug]', layout: false }, '/blog/hello/x'), false);
  assert.equal(refreshCovers({ path: '/docs/[...rest]', layout: false }, '/docs/a/b/c'), true);
  assert.equal(refreshCovers({ path: '/other', layout: false }, '/posts'), false);
});

test('under webjs.basePath the reported path is the public one the browser compares', async () => {
  const { setBasePath } = await import('../../src/importmap.js');
  const { revalidatePath } = await import('../../src/html-cache.js');
  await setBasePath('/app');
  try {
    const header = await withRequest(new Request('http://x/app/posts'), async () => {
      await revalidatePath('/posts');
      await revalidatePath('https://x/app/blog');
      return refreshHeaderValue();
    });
    const [bare, absolute] = parseRefreshHeader(header);
    assert.equal(bare.path, '/app/posts', 'a bare app-relative path gains the base path');
    assert.equal(refreshCovers(bare, '/app/posts'), true, 'so the page on screen is refreshed');
    assert.equal(absolute.path, '/app/blog', 'an absolute url is already public and is not prefixed twice');
  } finally {
    await setBasePath('');
  }
});
