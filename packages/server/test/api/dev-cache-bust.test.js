/**
 * handleApi() dev cache-bust: in dev, a route module is re-imported per request
 * with a `?t=<timestamp>` query so an edit is picked up without a restart.
 *
 * SPLIT OUT of api.test.js (#509) because this is the ONE handleApi behavior that
 * is NODE-ONLY: Bun's ESM loader ignores the query cache-bust (and exposes no
 * module-eviction API), so this assertion cannot hold on Bun. It is denylisted in
 * the Bun matrix (see scripts/run-bun-tests.js); the rest of handleApi (routing,
 * 405, params, Response.json) stays in api.test.js and DOES run under Bun. This
 * test exercises the bare server-level `?t=` mechanism directly (no supervisor),
 * which Bun ignores by design. The USER-FACING dev hot reload it underpins IS
 * fixed for Bun at the CLI level via `bun --hot` (#514), proven cross-runtime by
 * test/bun/dev-hot-reload.mjs.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleApi } from '../../src/api.js';

let dir;

before(async () => { dir = await mkdtemp(join(tmpdir(), 'webjs-api-cachebust-')); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

test('handleApi: dev=true cache-busts the import (re-reads the module from disk)', async () => {
  const file = join(dir, 'live.js');
  await writeFile(file, `export async function GET() { return new Response('v1'); }`);

  const route = { file };
  const r1 = await handleApi(route, {}, new Request('http://x/api/live'), true);
  assert.equal(await r1.text(), 'v1');

  // Overwrite module and call again with dev=true; cache-busting query should
  // force re-import.
  await writeFile(file, `export async function GET() { return new Response('v2'); }`);
  const r2 = await handleApi(route, {}, new Request('http://x/api/live'), true);
  assert.equal(await r2.text(), 'v2');
});
