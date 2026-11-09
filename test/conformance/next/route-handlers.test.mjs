/**
 * Next.js conformance: route handlers (#1686). Each case quotes the Next.js
 * documentation it asserts, from the local clone at `frameworks/next.js`,
 * `docs/01-app/03-api-reference/03-file-conventions/route.mdx`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../../packages/server/index.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };

/** Boot an app whose `app/api/route.js` is `source` and send it `req`. */
async function call(source, req) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-route-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  try {
    w('package.json', JSON.stringify({ name: 'conf-route', type: 'module' }));
    w('app/api/route.js', source);
    const app = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
    return await app.handle(req);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('"You can also use the underlying Web APIs to read cookies from the request": request.cookies.get(\'token\')', async () => {
  // The documented example, verbatim apart from returning what it read.
  const res = await call(
    `export async function GET(request) {\n  const token = request.cookies.get('token')\n  return Response.json({ token: token?.value ?? null, all: request.cookies.getAll().length })\n}\n`,
    new Request('http://localhost/api', { headers: { cookie: 'token=abc; theme=dark' } }),
  );
  assert.equal(res.status, 200, 'request.cookies exists in a route handler (it was undefined, a 500)');
  assert.deepEqual(await res.json(), { token: 'abc', all: 2 });
});

test('request.cookies.has() and an absent cookie read undefined, as on NextRequest', async () => {
  const res = await call(
    `export async function GET(request) {\n  return Response.json({ has: request.cookies.has('token'), missing: request.cookies.get('nope') === undefined })\n}\n`,
    new Request('http://localhost/api', { headers: { cookie: 'token=abc' } }),
  );
  assert.deepEqual(await res.json(), { has: true, missing: true });
});
