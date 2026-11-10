/**
 * redirect() inside a server action called over RPC (Next.js parity): the
 * response is 200 + `x-webjs-redirect: <url>;<push|replace>` (push by default,
 * as in a Next server action), the action's `invalidates` tags are still
 * evicted, the generated stub follows it, and invokeActionForTest rethrows the
 * redirect sentinel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildActionIndex, resolveServerModule, invokeAction, serveActionStub, RPC_CONTENT_TYPE } from '../../src/actions.js';
import { withRequest } from '../../src/context.js';
import { createRequestHandler } from '../../src/dev.js';
import { invokeActionForTest } from '../../src/testing.js';
import { isRedirect } from '../../../core/src/nav.js';
import { stringify as wjStringify } from '../../../core/src/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

async function scaffold() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-rpc-redirect-'));
  await mkdir(join(dir, 'actions'), { recursive: true });
  await writeFile(join(dir, 'package.json'), '{"name":"r","type":"module"}');
  await writeFile(join(dir, 'actions/go.server.js'), `'use server';
    import { redirect, permanentRedirect } from ${JSON.stringify(CORE)};
    export const invalidates = () => ['posts'];
    export async function go(to) { redirect(to || '/posts/1'); }
  `);
  await writeFile(join(dir, 'actions/rep.server.js'), `'use server';
    import { permanentRedirect } from ${JSON.stringify(CORE)};
    export async function rep() { permanentRedirect('/moved', 'replace'); }
  `);
  return dir;
}

async function call(dir, file, fn, args = []) {
  const idx = await buildActionIndex(dir, false);
  const abs = resolveServerModule(idx, file);
  const hash = idx.fileToHash.get(abs);
  const req = new Request(`http://x/__webjs/action/${hash}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': RPC_CONTENT_TYPE, 'sec-fetch-site': 'same-origin' },
    body: await wjStringify(args),
  });
  return withRequest(req, () => invokeAction(idx, hash, fn, req, () => assert.fail('a redirect is not an error')));
}

test('a redirect to a non-Latin path is percent-encoded instead of failing the response', async () => {
  const dir = await scaffold();
  const res = await call(dir, '/actions/go.server.js', 'go', ['/日本 x?q=é']);
  assert.equal(res.status, 200, 'a ByteString-unsafe target no longer throws inside the redirect branch');
  assert.equal(res.headers.get('x-webjs-redirect'), '/%E6%97%A5%E6%9C%AC%20x?q=%C3%A9;push');
});

test('a redirect from an RPC action is 200 + x-webjs-redirect (push), tags still evicted', async () => {
  const dir = await scaffold();
  const res = await call(dir, '/actions/go.server.js', 'go', ['/done?x=1']);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-webjs-redirect'), '/done?x=1;push');
  assert.equal(res.headers.get('x-webjs-invalidate'), 'posts');
});

test("a 'replace' type rides the header", async () => {
  const dir = await scaffold();
  const res = await call(dir, '/actions/rep.server.js', 'rep');
  assert.equal(res.headers.get('x-webjs-redirect'), '/moved;replace');
});

test('the generated stub reads x-webjs-redirect before anything else', async () => {
  const dir = await scaffold();
  const idx = await buildActionIndex(dir, false);
  const stub = await serveActionStub(idx, resolveServerModule(idx, '/actions/go.server.js'));
  assert.match(stub, /followActionRedirect as __redirect/);
  assert.match(stub, /x-webjs-redirect'\); if \(rd\) return __redirect\(rd\)/);
});

test('invokeActionForTest rethrows the redirect sentinel', async () => {
  const dir = await scaffold();
  const app = await createRequestHandler({ appDir: dir, dev: false, logger: { info() {}, warn() {}, error() {} } });
  await assert.rejects(
    () => invokeActionForTest(app, 'actions/go.server.js', 'go', ['/x']),
    (e) => isRedirect(e) && e.url === '/x' && e.redirectType === 'push',
  );
});
