/**
 * notFound() / forbidden() / unauthorized() inside a server action called over
 * RPC answer the same 404 / 403 / 401 the no-JS form path renders (#1697), are
 * never handed to the error sink as a failure, and the generated stub plus
 * invokeActionForTest reject with the matching sentinel. They used to answer a
 * logged 500, which an agent then spent turns chasing.
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
import { isNotFound, isForbidden, isUnauthorized } from '../../../core/src/nav.js';
import { stringify as wjStringify, parse as wjParse } from '../../../core/src/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

async function scaffold() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-rpc-control-'));
  await mkdir(join(dir, 'actions'), { recursive: true });
  await writeFile(join(dir, 'package.json'), '{"name":"c","type":"module"}');
  await writeFile(join(dir, 'actions/guard.server.js'), `'use server';
    import { notFound, forbidden, unauthorized } from ${JSON.stringify(CORE)};
    export async function missing() { notFound(); }
    export async function denied() { forbidden(); }
    export async function anon() { unauthorized(); }
  `);
  await writeFile(join(dir, 'actions/checked.server.js'), `'use server';
    import { forbidden } from ${JSON.stringify(CORE)};
    export const validate = () => forbidden();
    export async function checked() { return 1; }
  `);
  return dir;
}

async function call(dir, file, fn, dev, onError) {
  const idx = await buildActionIndex(dir, dev);
  const abs = resolveServerModule(idx, file);
  const hash = idx.fileToHash.get(abs);
  const req = new Request(`http://x/__webjs/action/${hash}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': RPC_CONTENT_TYPE, 'sec-fetch-site': 'same-origin' },
    body: await wjStringify([]),
  });
  return withRequest(req, () => invokeAction(idx, hash, fn, req, onError));
}

for (const [fn, status, kind] of [['missing', 404, 'not-found'], ['denied', 403, 'forbidden'], ['anon', 401, 'unauthorized']]) {
  for (const dev of [true, false]) {
    test(`${fn}() over RPC answers ${status} in ${dev ? 'dev' : 'prod'}, not a logged 500`, async () => {
      const dir = await scaffold();
      const res = await call(dir, '/actions/guard.server.js', fn, dev, () => assert.fail('a boundary sentinel is not an error'));
      assert.equal(res.status, status);
      assert.equal(res.headers.get('x-webjs-control'), kind);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const body = wjParse(await res.text());
      assert.match(body.error, /^webjs: /, 'the sentinel message, never the generic prod one');
      assert.equal(body.digest, undefined);
    });
  }
}

test('a validator that throws forbidden() answers 403 too', async () => {
  const dir = await scaffold();
  const res = await call(dir, '/actions/checked.server.js', 'checked', false, () => assert.fail('not an error'));
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('x-webjs-control'), 'forbidden');
});

test('the generated stub rethrows the sentinel the header names', async () => {
  const dir = await scaffold();
  const idx = await buildActionIndex(dir, false);
  const stub = await serveActionStub(idx, resolveServerModule(idx, '/actions/guard.server.js'));
  assert.match(stub, /notFound as __nf, forbidden as __fb, unauthorized as __ua/);
  assert.match(stub, /x-webjs-control'\); if \(cf === 'not-found'\) __nf\(\); if \(cf === 'forbidden'\) __fb\(\); if \(cf === 'unauthorized'\) __ua\(\);/);
});

test('invokeActionForTest rejects with the sentinel, so isForbidden(err) holds', async () => {
  const dir = await scaffold();
  const app = await createRequestHandler({ appDir: dir, dev: true });
  await assert.rejects(invokeActionForTest(app, 'actions/guard.server.js', 'denied'), (e) => isForbidden(e));
  await assert.rejects(invokeActionForTest(app, 'actions/guard.server.js', 'missing'), (e) => isNotFound(e));
  await assert.rejects(invokeActionForTest(app, 'actions/guard.server.js', 'anon'), (e) => isUnauthorized(e));
});
